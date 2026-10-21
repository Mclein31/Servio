// native build prep
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (!['demo', 'production'].includes(mode)) throw new Error('Choose demo or production.');
const env = { ...process.env, SERVIO_BUILD: mode };
if (process.platform === 'darwin' && !env.JAVA_HOME) {
  const java = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' });
  if (java.status === 0) env.JAVA_HOME = java.stdout.trim();
}
for (const args of [
  ['node_modules/@angular/cli/bin/ng.js', 'build', '--configuration', mode],
  ['node_modules/@capacitor/cli/bin/capacitor', 'sync'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
