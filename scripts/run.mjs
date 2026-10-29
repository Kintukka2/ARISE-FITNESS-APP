// Bundle a TypeScript script with the app's path aliases and run it: node scripts/run.mjs scripts/x.ts [args]
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const [entry, ...args] = process.argv.slice(2);
mkdirSync('node_modules/.cache/scripts', { recursive: true });
const outfile = `node_modules/.cache/scripts/${entry.replace(/[\\/]/g, '_')}.mjs`;
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'warning' });
const r = spawnSync(process.execPath, [outfile, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
