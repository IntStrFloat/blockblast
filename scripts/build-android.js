const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const [target, ...options] = process.argv.slice(2);
const unsigned = options.includes('--unsigned');
const architectures = options.find((arg) => arg.startsWith('--architectures='))?.split('=')[1]
  ?? (target === 'apk' ? 'arm64-v8a' : 'armeabi-v7a,arm64-v8a,x86,x86_64');
const supportedAbis = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
if (!['apk', 'aab'].includes(target) || (unsigned && target !== 'aab')
  || options.some((arg) => arg !== '--unsigned' && !arg.startsWith('--architectures='))
  || !architectures || architectures.split(',').some((abi) => !supportedAbis.includes(abi))) {
  console.error('Usage: node scripts/build-android.js apk|aab [--unsigned] [--architectures=arm64-v8a,...]');
  process.exit(1);
}
const signedRelease = target === 'aab' && !unsigned;
const signing = target === 'apk' ? 'local' : unsigned ? 'unsigned' : 'release';
if (signedRelease) {
  for (const name of ['release.jks', 'keystore.properties']) {
    if (!fs.existsSync(path.join(root, 'credentials', name))) {
      throw new Error(`Missing credentials/${name}; restore the existing release key or explicitly use --unsigned for a local AAB.`);
    }
  }
  if (!fs.existsSync(path.join(root, 'agconnect-services.json'))) {
    throw new Error('Signed store builds require the real agconnect-services.json from AppGallery Connect.');
  }
}

const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };
env.ANDROID_HOME = env.ANDROID_HOME || env.ANDROID_SDK_ROOT
  || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Android/sdk')
    : process.platform === 'win32' ? path.join(env.LOCALAPPDATA || '', 'Android/Sdk')
      : path.join(os.homedir(), 'Android/Sdk'));
env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
const javaCandidates = [
  env.JAVA_HOME,
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  path.join(env.PROGRAMFILES || 'C:/Program Files', 'Android/Android Studio/jbr'),
].filter(Boolean);
env.JAVA_HOME = javaCandidates.find((dir) => fs.existsSync(path.join(dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')));
if (!env.JAVA_HOME) throw new Error('Set JAVA_HOME to JDK 21 before building Android.');
if (!fs.existsSync(path.join(env.ANDROID_HOME, 'platform-tools'))) {
  throw new Error('Android SDK not found. Set ANDROID_HOME to the installed SDK.');
}
env.PATH = [path.join(env.JAVA_HOME, 'bin'), env.PATH].join(path.delimiter);
env.BLOCKBLAST_LOCAL_BUILD = signedRelease ? '0' : '1';
env.CMAKE_BUILD_PARALLEL_LEVEL = env.CMAKE_BUILD_PARALLEL_LEVEL || '4';

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' && command.endsWith('.bat') });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
run(process.execPath, [expoCli, 'prebuild', '--platform', 'android', '--no-install',
  '--template', 'expo-template-bare-minimum@56.0.38']);
fs.writeFileSync(path.join(root, 'android/local.properties'), `sdk.dir=${env.ANDROID_HOME.replaceAll('\\', '/')}\n`);
run(process.execPath, [path.join(__dirname, 'patch-signing.js')]);
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradle, [target === 'apk' ? ':app:assembleRelease' : ':app:bundleRelease',
  `-PblockblastSigning=${signing}`, `-PreactNativeArchitectures=${architectures}`,
  '--max-workers=4', '--console=plain'], path.join(root, 'android'));

const source = path.join(root, target === 'apk'
  ? 'android/app/build/outputs/apk/release/app-release.apk'
  : 'android/app/build/outputs/bundle/release/app-release.aab');
const app = require('../app.json').expo;
const suffix = target === 'apk' ? 'local' : unsigned ? 'unsigned' : 'release';
const file = `blockblast-${app.version}-vc${app.android.versionCode}-${suffix}.${target}`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
if (signedRelease) {
  const keytool = spawnSync(path.join(env.JAVA_HOME, 'bin', 'keytool'), ['-J-Duser.language=en', '-printcert', '-jarfile', source], { env, encoding: 'utf8' });
  const expected = '74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3';
  if (keytool.status !== 0 || !keytool.stdout.includes(expected)) {
    throw new Error('The AAB signer does not match the published game; artifact not delivered.');
  }
  run(path.join(env.JAVA_HOME, 'bin', 'jarsigner'), ['-J-Duser.language=en', '-verify', source]);
}
const destination = path.join(root, 'dist', file);
fs.copyFileSync(source, destination);
console.log(`\n${destination}\nSigning: ${signing}; Android ABIs: ${architectures}`);
if (unsigned) console.log('This AAB is unsigned and cannot be uploaded as a signed store release.');
