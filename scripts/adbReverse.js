#!/usr/bin/env node
/**
 * Best-effort `adb reverse tcp:8081 tcp:8081`.
 *
 * Runs before Metro starts and before `run-android` so the device can reach
 * the bundler at localhost:8081. Always exits with code 0 — if `adb` is
 * missing or no device is attached (e.g. iOS-only session), we just warn
 * and let the next command continue.
 *
 * Cross-platform: works on Windows (cmd/PowerShell) and macOS/Linux.
 */
const { spawnSync } = require('child_process');

function tryAdbReverse() {
  const result = spawnSync('adb', ['reverse', 'tcp:8081', 'tcp:8081'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    console.warn('[adb-reverse] `adb` not found in PATH — skipping. Install Android platform-tools to enable USB device bundling.');
    return;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.warn('[adb-reverse] adb reverse failed (no device attached?). Continuing without USB port forward.');
    return;
  }

  console.log('[adb-reverse] tcp:8081 → device tcp:8081 OK');
}

tryAdbReverse();
process.exit(0);
