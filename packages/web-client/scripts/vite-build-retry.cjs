const { spawnSync } = require('child_process');
const path = require('path');

const viteBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
);

function runViteBuild() {
  const spawnOptions = {
    cwd: process.cwd(),
    encoding: 'utf8',
  };
  const result = process.platform === 'win32'
    ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', 'vite build'],
      spawnOptions
    )
    : spawnSync(viteBin, ['build'], spawnOptions);

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    process.stderr.write(`[web-client build] ${result.error.message}\n`);
  }

  return result;
}

const first = runViteBuild();
if (first.status === 0) {
  process.exit(0);
}

const combinedOutput = `${first.stdout || ''}\n${first.stderr || ''}`;
const isSpawnEperm =
  combinedOutput.includes('spawn EPERM')
  || (first.error && first.error.code === 'EPERM');

if (isSpawnEperm) {
  process.stderr.write('[web-client build] Detected spawn EPERM, retrying vite build once...\n');
  const retry = runViteBuild();
  process.exit(retry.status === null ? 1 : retry.status);
}

process.exit(first.status === null ? 1 : first.status);
