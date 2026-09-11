import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const api = spawn(process.execPath, [resolve(root, 'scripts', 'local-database-server.mjs')], { cwd: root, stdio: 'inherit' });
const web = spawn(process.execPath, [resolve(root, 'node_modules', 'vinext', 'dist', 'cli.js'), 'dev'], { cwd: root, stdio: 'inherit' });
let closing = false;
const close = code => { if (closing) return; closing = true; api.kill(); web.kill(); setTimeout(() => process.exit(code), 200) };
api.on('exit', code => close(code || 0));
web.on('exit', code => close(code || 0));
process.on('SIGINT', () => close(0));
process.on('SIGTERM', () => close(0));
