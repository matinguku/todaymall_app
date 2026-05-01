const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

function pickFirstExisting(paths) {
  for (const p of paths) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

const localAppData = process.env.LOCALAPPDATA || '';
const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

const androidHome =
  process.env.ANDROID_HOME ||
  pickFirstExisting([join(localAppData, 'Android', 'Sdk')]);

const javaHome =
  process.env.JAVA_HOME ||
  pickFirstExisting([
    join(programFiles, 'Android', 'Android Studio', 'jbr'),
    join(programFiles, 'Android', 'Android Studio', 'jre'),
  ]);

const env = { ...process.env };
const pathEntries = [];

if (javaHome) {
  env.JAVA_HOME = javaHome;
  pathEntries.push(join(javaHome, 'bin'));
}

if (androidHome) {
  env.ANDROID_HOME = androidHome;
  pathEntries.push(join(androidHome, 'platform-tools'));
  pathEntries.push(join(androidHome, 'emulator'));
}

env.PATH = `${pathEntries.join(';')};${process.env.PATH || ''}`;

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
