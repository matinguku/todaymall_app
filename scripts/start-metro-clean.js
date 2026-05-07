const { spawnSync, spawn } = require('child_process');
const { join } = require('path');
const { buildAndroidToolchainEnv } = require('./androidToolchainEnv');

const METRO_PORT = '8081';

const killPortListeners = () => {
  if (process.platform !== 'win32') {
    const lsof = spawnSync('bash', ['-lc', `lsof -ti tcp:${METRO_PORT}`], { encoding: 'utf8' });
    const pids = (lsof.stdout || '')
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    pids.forEach((pid) => {
      spawnSync('kill', ['-9', pid], { stdio: 'inherit' });
    });
    return;
  }

  const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
  const pids = (netstat.stdout || '')
    .split(/\r?\n/)
    .filter((line) => line.includes(`:${METRO_PORT}`) && line.includes('LISTENING'))
    .map((line) => line.trim().split(/\s+/).pop())
    .filter(Boolean);

  [...new Set(pids)].forEach((pid) => {
    spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'inherit' });
  });
};

const runAdbReverse = (env) => {
  const adbReverseScript = join(process.cwd(), 'scripts', 'adbReverse.js');
  const result = spawnSync(process.execPath, [adbReverseScript], {
    stdio: 'inherit',
    env,
  });
  return typeof result.status === 'number' ? result.status : (result.error ? 1 : 0);
};

const startMetro = (env) => {
  const rnCli = join(process.cwd(), 'node_modules', 'react-native', 'cli.js');
  const metro = spawn(
    process.execPath,
    [rnCli, 'start', '--reset-cache', '--custom-log-reporter-path', './scripts/metroFilteredReporter.js'],
    { stdio: 'inherit', env }
  );

  metro.on('exit', (code) => {
    process.exit(typeof code === 'number' ? code : 1);
  });
};

const main = () => {
  const { env } = buildAndroidToolchainEnv();
  killPortListeners();
  const reverseStatus = runAdbReverse(env);
  if (reverseStatus !== 0) {
    console.log('[start:clean] adb reverse skipped.');
  }
  startMetro(env);
};

main();
