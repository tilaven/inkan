import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const pkg = readJson(path.join(pkgDir, 'package.json'));

/** Paths npm would publish, relative to the package folder. */
function packed(dir) {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: dir, encoding: 'utf8' });
  return new Set(JSON.parse(out)[0].files.map((f) => f.path));
}

describe('package', () => {
  const files = packed(pkgDir);

  it('does not ship tests or build caches', () => {
    const stray = [...files].filter((f) => /\.test\.|^test\/|(^|\/)(node_modules|\.astro|dist)\//.test(f));
    expect(stray).toEqual([]);
  });

  it('ships every file its bin and exports point at', () => {
    const targets = [
      ...Object.values(pkg.bin),
      pkg.main,
      pkg.types,
      ...Object.values(pkg.exports).flatMap((e) => (typeof e === 'string' ? [e] : Object.values(e))),
    ].map((p) => p.replace(/^\.\//, ''));
    expect(targets.filter((t) => !files.has(t))).toEqual([]);
  });

  it('ships the whole starter, dotfiles included', () => {
    const starter = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? starter(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const expected = starter(path.join(pkgDir, 'starter')).map((f) => path.relative(pkgDir, f));
    expect(expected.filter((f) => !files.has(f))).toEqual([]);
  });

  it('@tilaven/create-inkan installs this version', () => {
    const create = readJson(path.join(pkgDir, '..', 'create-inkan', 'package.json'));
    expect(create.dependencies['@tilaven/inkan']).toBe(pkg.version);
    expect([...packed(path.join(pkgDir, '..', 'create-inkan'))].sort()).toEqual(['LICENSE', 'README.md', 'bin/create.mjs', 'package.json']);
  });
});
