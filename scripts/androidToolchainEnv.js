/**
 * Resolve ANDROID_HOME and JAVA_HOME for CLI builds on Windows/macOS/Linux
 * when the user has not set them (common with Android Studio installs).
 */
const { existsSync } = require('fs');
const { join } = require('path');

function pickFirstExisting(paths) {
  for (const p of paths) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

/**
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {{ env: NodeJS.ProcessEnv; javaHome: string | null; androidHome: string | null }}
 */
function buildAndroidToolchainEnv(baseEnv = process.env) {
  const localAppData = baseEnv.LOCALAPPDATA || '';
  const programFiles = baseEnv.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = baseEnv['ProgramFiles(x86)'] || '';

  const androidHome =
    baseEnv.ANDROID_HOME ||
    pickFirstExisting([join(localAppData, 'Android', 'Sdk')]);

  const javaHome =
    baseEnv.JAVA_HOME ||
    pickFirstExisting([
      join(programFiles, 'Android', 'Android Studio', 'jbr'),
      join(programFiles, 'Android', 'Android Studio', 'jre'),
      join(programFilesX86, 'Android', 'Android Studio', 'jbr'),
      join(programFilesX86, 'Android', 'Android Studio', 'jre'),
    ]);

  const env = { ...baseEnv };
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

  const prefix = pathEntries.length ? `${pathEntries.join(';')};` : '';
  env.PATH = `${prefix}${baseEnv.PATH || ''}`;

  return { env, javaHome, androidHome };
}

module.exports = { buildAndroidToolchainEnv, pickFirstExisting };
