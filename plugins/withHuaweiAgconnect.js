const fs = require('fs');
const path = require('path');

const {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require('expo/config-plugins');

const AGCONNECT_VERSION = '1.9.6.300';
const TEST_ANDROID_GRADLE_PLUGIN_VERSION = '8.12.0';
const HUAWEI_REPOSITORY = "maven { url 'https://developer.huawei.com/repo/' }";
const AGCONNECT_CLASSPATH = `classpath('com.huawei.agconnect:agcp:${AGCONNECT_VERSION}')`;
const AGCONNECT_CORE =
  `implementation("com.huawei.agconnect:agconnect-core:${AGCONNECT_VERSION}")`;
const AGCONNECT_PLUGIN = 'apply plugin: "com.huawei.agconnect"';

function resolveAndroidGradlePluginVersion(projectRoot) {
  const versionsPath = path.join(
    projectRoot,
    'node_modules',
    'react-native',
    'gradle',
    'libs.versions.toml',
  );
  const versions = fs.readFileSync(versionsPath, 'utf8');
  const match = versions.match(/^agp\s*=\s*"([^"]+)"/m);

  if (!match) {
    throw new Error(
      `Huawei AGConnect: Android Gradle Plugin version was not found in ${versionsPath}`,
    );
  }

  return match[1];
}

function patchAndroidGradlePluginVersion(contents, agpVersion) {
  if (/com\.android\.tools\.build:gradle:[^'")]+/.test(contents)) {
    return contents;
  }

  const unversionedClasspath =
    /classpath\((['"])com\.android\.tools\.build:gradle\1\)/;
  if (!unversionedClasspath.test(contents)) {
    throw new Error(
      'Huawei AGConnect: Android Gradle Plugin classpath was not found',
    );
  }

  return contents.replace(
    unversionedClasspath,
    `classpath('com.android.tools.build:gradle:${agpVersion}')`,
  );
}

function patchRepositoriesBlock(contents, blockName) {
  const pattern = new RegExp(
    `(${blockName}\\s*\\{\\s*repositories\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})`,
  );
  const match = contents.match(pattern);
  if (!match) {
    throw new Error(`Huawei AGConnect: ${blockName}.repositories block was not found`);
  }
  if (match[2].includes('https://developer.huawei.com/repo/')) {
    return contents;
  }

  return contents.replace(pattern, `$1$2\n    ${HUAWEI_REPOSITORY}$3`);
}

function patchProjectBuildGradle(
  contents,
  agpVersion = TEST_ANDROID_GRADLE_PLUGIN_VERSION,
) {
  let next = patchAndroidGradlePluginVersion(contents, agpVersion);
  next = patchRepositoriesBlock(next, 'buildscript');
  next = patchRepositoriesBlock(next, 'allprojects');

  if (!next.includes('com.huawei.agconnect:agcp:')) {
    const dependenciesPattern =
      /(buildscript\s*\{[\s\S]*?dependencies\s*\{)([\s\S]*?)(\n\s*\})/;
    if (!dependenciesPattern.test(next)) {
      throw new Error('Huawei AGConnect: buildscript.dependencies block was not found');
    }
    next = next.replace(
      dependenciesPattern,
      `$1$2\n    ${AGCONNECT_CLASSPATH}$3`,
    );
  }

  return next;
}

function patchAppBuildGradle(contents) {
  let next = contents;

  if (!next.includes('com.huawei.agconnect:agconnect-core:')) {
    if (!/dependencies\s*\{/.test(next)) {
      throw new Error('Huawei AGConnect: app dependencies block was not found');
    }
    next = next.replace(
      /dependencies\s*\{/,
      `dependencies {\n    ${AGCONNECT_CORE}`,
    );
  }

  if (!next.includes('apply plugin: "com.huawei.agconnect"')) {
    next = `${next.trimEnd()}\n\n${AGCONNECT_PLUGIN}\n`;
  }

  return next;
}

function validateAgconnectConfig(agconnectConfig, expectedPackage) {
  const configuredPackage = agconnectConfig?.app_info?.package_name;
  if (!configuredPackage) {
    throw new Error('Huawei AGConnect: app_info.package_name is missing');
  }
  if (configuredPackage !== expectedPackage) {
    throw new Error(
      `Huawei AGConnect package mismatch: expected ${expectedPackage}, got ${configuredPackage}`,
    );
  }
  if (!agconnectConfig?.app_info?.app_id) {
    throw new Error('Huawei AGConnect: app_info.app_id is missing');
  }
}

const withHuaweiAgconnect = (config, options = {}) => {
  const configFile = options.configFile ?? 'agconnect-services.json';

  config = withProjectBuildGradle(config, (projectConfig) => {
    if (projectConfig.modResults.language !== 'groovy') {
      throw new Error('Huawei AGConnect currently supports only Groovy build.gradle files');
    }
    const agpVersion = resolveAndroidGradlePluginVersion(
      projectConfig.modRequest.projectRoot,
    );
    projectConfig.modResults.contents = patchProjectBuildGradle(
      projectConfig.modResults.contents,
      agpVersion,
    );
    return projectConfig;
  });

  config = withAppBuildGradle(config, (appConfig) => {
    if (appConfig.modResults.language !== 'groovy') {
      throw new Error('Huawei AGConnect currently supports only Groovy build.gradle files');
    }
    appConfig.modResults.contents = patchAppBuildGradle(
      appConfig.modResults.contents,
    );
    return appConfig;
  });

  config = withDangerousMod(config, [
    'android',
    async (androidConfig) => {
      const projectRoot = androidConfig.modRequest.projectRoot;
      const sourcePath = path.resolve(projectRoot, configFile);
      const targetPath = path.join(
        androidConfig.modRequest.platformProjectRoot,
        'app',
        'agconnect-services.json',
      );

      if (!fs.existsSync(sourcePath)) {
        throw new Error(
          `Huawei AGConnect config is missing: ${sourcePath}. Download it from AppGallery Connect.`,
        );
      }

      const agconnectConfig = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      validateAgconnectConfig(agconnectConfig, androidConfig.android?.package);
      fs.copyFileSync(sourcePath, targetPath);
      return androidConfig;
    },
  ]);

  return config;
};

const plugin = createRunOncePlugin(
  withHuaweiAgconnect,
  'with-huawei-agconnect',
  '1.0.0',
);

module.exports = plugin;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
module.exports.patchProjectBuildGradle = patchProjectBuildGradle;
module.exports.resolveAndroidGradlePluginVersion =
  resolveAndroidGradlePluginVersion;
module.exports.validateAgconnectConfig = validateAgconnectConfig;
