/**
 * Патчит android/app/build.gradle после `expo prebuild`:
 * подключает release-подпись из credentials/keystore.properties (спека 08).
 * Запуск: node scripts/patch-signing.js
 */
const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');

if (gradle.includes('keystoreProperties')) {
  console.log('build.gradle уже пропатчен');
  process.exit(0);
}

// 1. Загрузка keystore.properties перед блоком android {
const loader = `
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("../credentials/keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {`;
gradle = gradle.replace(/\nandroid \{/, loader);

// 2. release-конфиг в signingConfigs
gradle = gradle.replace(
  /signingConfigs \{/,
  `signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`,
);

// 3. buildTypes.release подписывается release-ключом
gradle = gradle.replace(
  /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
  '$1signingConfig signingConfigs.release',
);

fs.writeFileSync(gradlePath, gradle);

if (!gradle.includes("keystoreProperties['storeFile']")) {
  console.error('ПАТЧ НЕ ПРИМЕНИЛСЯ — проверь build.gradle вручную');
  process.exit(1);
}
console.log('build.gradle: release-подпись подключена');
