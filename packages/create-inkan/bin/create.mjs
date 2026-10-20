#!/usr/bin/env node
// npm create @tilaven/inkan [dir]  →  inkan init [dir]
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('@tilaven/inkan/package.json')), 'bin', 'cli.mjs');
const dir = process.argv[2] ?? 'decisions-site';
const r = spawnSync(process.execPath, [cli, 'init', dir], { stdio: 'inherit' });
process.exit(r.status ?? 1);
