/** Apply the shared Android signing configuration after Expo prebuild. */
const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const applySigning = 'apply from: rootProject.file("../scripts/android-signing.gradle")';
const gradle = fs.readFileSync(gradlePath, 'utf8');
if (!gradle.includes('com.android.application')) {
  throw new Error('Android application Gradle file not found');
}
if (!gradle.includes(applySigning)) {
  fs.appendFileSync(gradlePath, `\n${applySigning}\n`);
}
console.log('Android signing configuration connected');
