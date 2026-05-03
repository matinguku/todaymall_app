const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');
const { buildAndroidToolchainEnv } = require('./androidToolchainEnv');

const { env, javaHome, androidHome } = buildAndroidToolchainEnv();

if (!javaHome) {
  console.error(
    'JAVA_HOME is not set and no JDK was found (checked Android Studio jbr/jre under Program Files).',
  );
  console.error('Install Android Studio or set JAVA_HOME to a JDK 17+ install.');
  process.exit(1);
}

const adbPath = androidHome
  ? join(
      androidHome,
      'platform-tools',
      process.platform === 'win32' ? 'adb.exe' : 'adb'
    )
  : null;

const adbCmd = adbPath && existsSync(adbPath) ? adbPath : process.platform === 'win32' ? 'adb.exe' : 'adb';

// Reverse Metro port only when adb is available.
const reverseResult = spawnSync(adbCmd, ['reverse', 'tcp:8081', 'tcp:8081'], {
  stdio: 'inherit',
  env,
});

if (reverseResult.status !== 0) {
  console.log('adb reverse skipped.');
}

const rnCli = join(process.cwd(), 'node_modules', 'react-native', 'cli.js');
const runResult = spawnSync(process.execPath, [rnCli, 'run-android', '--no-packager'], {
  stdio: 'inherit',
  env,
});

if (typeof runResult.status === 'number') {
  process.exit(runResult.status);
}

process.exit(runResult.error ? 1 : 0);
