import { runnerImport } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const { module } = await runnerImport(resolve(root, 'app', 'data', 'seed', 'index.ts'), { root, configFile: false });
const output = resolve(root, 'data', 'structured-seed.json');
await mkdir(resolve(root, 'data'), { recursive: true });
await writeFile(output, JSON.stringify(module.seedDatabase, null, 2), 'utf8');
process.stdout.write(`${output}\n`);
