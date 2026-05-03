/**
 * Run android/gradlew with JAVA_HOME / ANDROID_HOME set (same logic as run-android.js).
 * Usage: node scripts/run-gradle.js [gradle-args...]
 * Example: node scripts/run-gradle.js clean
 */
const { join } = require('path');
const { spawnSync } = require('child_process');
const { buildAndroidToolchainEnv } = require('./androidToolchainEnv');

const androidDir = join(__dirname, '..', 'android');
const args = process.argv.slice(2);
const { env, javaHome } = buildAndroidToolchainEnv();

if (!javaHome) {
  console.error(
    'JAVA_HOME is not set and no JDK was found (checked Android Studio jbr/jre under Program Files).',
  );
  console.error('Install Android Studio or a JDK, then set JAVA_HOME, or add sdk.dir/java in android/local.properties.');
  process.exit(1);
}

const isWin = process.platform === 'win32';
const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';

const result = spawnSync(gradleCmd, args, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: isWin,
});

process.exit(typeof result.status === 'number' ? result.status : 1);
