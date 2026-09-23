import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const flutter = process.env.FLUTTER_BIN || 'flutter';

if (!commandExists(flutter)) {
  if (existsSync('build/web/index.html')) {
    copyLoginPage();
    console.log('Flutter is unavailable; build/web is already present for the Cloudflare artifact branch.');
    process.exit(0);
  }
  throw new Error('Flutter is unavailable and build/web does not exist. Run the GitHub Actions build or install Flutter.');
}

run(flutter, ['pub', 'get']);
run(flutter, ['build', 'web']);
copyLoginPage();

function copyLoginPage() {
  if (!existsSync('web/login.html') || !existsSync('build/web')) throw new Error('The Flutter login page or web build output is missing.');
  copyFileSync('web/login.html', 'build/web/login.html');
}

function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(lookup, [command], { stdio: 'ignore' }).status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, CI: process.env.CI || 'true' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
