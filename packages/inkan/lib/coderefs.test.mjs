import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpSite } from '../test/helpers.mjs';
import { blobUrl, commitDiffUrl, globMatcher, listFiles, parseCodeRefs, scanCodeRefs } from './coderefs.mjs';
import { defaults } from './defaults.mjs';
import { loadRecords } from './records.mjs';

const files = {
  'decisions/sre/adr/0001-define-slos.md': '---\ntitle: SLOs\n---\n@adr sre/adr/0001 must not count: content is skipped\n',
  'decisions/sre/adr/0002-two.md': '---\ntitle: Two\n---\n',
  'decisions/pay/rfc/0001-batches.md': '---\ntitle: Batches\n---\n',
  'services/api/handler.ts': '// @adr sre/adr/0001-define-slos\nexport const a = 1;\n/* see @adr SRE-ADR-0002, and @adr pay/rfc/1 */\n// @adr sre/adr/9999 (nobody)\n',
  'services/jobs/run.py': '# @adr: sre/adr/0001\n',
  'services/jobs/run.test.py': '# @adr sre/adr/0001\n',
  'docs/notes.md': 'The `@adr` marker and user@adr.io are not references.\n',
  'assets/blob.bin': Buffer.from([0, 1, 2, 64, 97, 100, 114, 32, 115, 114, 101]),
  'node_modules/dep/index.js': '// @adr sre/adr/0001\n',
  'dist/out.js': '// @adr sre/adr/0001\n',
};

function site(extra = {}) {
  const root = tmpSite(files);
  return {
    root,
    config: { ...defaults, root, repoRoot: root, contentDir: path.join(root, 'decisions'), contentPath: 'decisions', docTypes: { adr: defaults.docTypes.adr, rfc: defaults.docTypes.rfc }, ...extra },
  };
}

describe('parseCodeRefs', () => {
  it('finds marker + reference with line numbers, in any comment style', () => {
    expect(parseCodeRefs('// @adr sre/adr/0001\nx\n# @adr: SRE-ADR-0002.\n/* @adr a/b/3, @adr c/d/0004-x */\n<!-- @adr\te/f/5 -->')).toEqual([
      { line: 1, ref: 'sre/adr/0001' },
      { line: 3, ref: 'SRE-ADR-0002' },
      { line: 4, ref: 'a/b/3' },
      { line: 4, ref: 'c/d/0004-x' },
      { line: 5, ref: 'e/f/5' },
    ]);
  });
  it('ignores the bare marker, e-mail-like text and other markers', () => {
    expect(parseCodeRefs('`@adr` alone; me@adr sre/adr/1; @adrx sre/adr/1; @adr')).toEqual([]);
    expect(parseCodeRefs('// @decision sre/adr/1', '@decision')).toEqual([{ line: 1, ref: 'sre/adr/1' }]);
  });
});

describe('globMatcher', () => {
  it('matches like .gitignore-style globs', () => {
    expect(globMatcher('**/*')('a/b/c.ts')).toBe(true);
    expect(globMatcher('services/**')('services/a/b.ts')).toBe(true);
    expect(globMatcher('services/**')('other/services/a.ts')).toBe(false);
    expect(globMatcher('**/*.{ts,py}')('x.py')).toBe(true);
    expect(globMatcher('**/*.{ts,py}')('a/x.rb')).toBe(false);
    expect(globMatcher('*.test.py')('a/b/run.test.py')).toBe(true);
    expect(globMatcher('src/*.ts')('src/a/b.ts')).toBe(false);
    expect(globMatcher('a?c')('abc')).toBe(true);
  });
});

describe('scanCodeRefs', () => {
  it('groups resolved references by record id and reports unknown ones', () => {
    const { config } = site();
    const { refs, unresolved } = scanCodeRefs(config, loadRecords(config));
    expect(refs.get('sre/adr/0001-define-slos')).toEqual([
      { file: 'services/api/handler.ts', line: 1 },
      { file: 'services/jobs/run.py', line: 1 },
      { file: 'services/jobs/run.test.py', line: 1 },
    ]);
    expect(refs.get('sre/adr/0002-two')).toEqual([{ file: 'services/api/handler.ts', line: 3 }]);
    expect(refs.get('pay/rfc/0001-batches')).toEqual([{ file: 'services/api/handler.ts', line: 3 }]);
    expect(unresolved).toEqual([{ file: 'services/api/handler.ts', line: 4, ref: 'sre/adr/9999' }]);
  });

  it('applies include/exclude globs and can be turned off', () => {
    const { config } = site({ codeRefs: { include: ['services/**'], exclude: ['*.test.py'] } });
    const { refs } = scanCodeRefs(config, loadRecords(config));
    expect(refs.get('sre/adr/0001-define-slos')?.map((r) => r.file)).toEqual(['services/api/handler.ts', 'services/jobs/run.py']);
    expect(scanCodeRefs({ ...config, codeRefs: false }, loadRecords(config)).refs.size).toBe(0);
  });

  it('uses git ls-files inside a repository (ignored files are skipped)', () => {
    const { config, root } = site({ codeRefs: { marker: '@adr' } });
    fs.writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
    fs.mkdirSync(path.join(root, 'ignored'));
    fs.writeFileSync(path.join(root, 'ignored/x.js'), '// @adr sre/adr/0002\n');
    fs.writeFileSync(path.join(root, 'untracked.js'), '// @adr sre/adr/0002\n');
    expect(spawnSync('git', ['init', '-q'], { cwd: root }).status).toBe(0);
    expect(listFiles(root)).not.toContain('ignored/x.js');
    const { refs } = scanCodeRefs(config, loadRecords(config));
    expect(refs.get('sre/adr/0002-two')?.map((r) => r.file)).toEqual(['services/api/handler.ts', 'untracked.js']);
  });
});

describe('blobUrl', () => {
  it('links to the line on GitHub and GitLab', () => {
    expect(blobUrl({ url: 'https://github.com/acme/x', branch: 'main', provider: 'github' }, 'src/a.ts', 12)).toBe('https://github.com/acme/x/blob/main/src/a.ts#L12');
    expect(blobUrl({ url: 'https://gitlab.com/acme/x', branch: 'dev', provider: 'gitlab' }, 'src/a.ts', 3)).toBe('https://gitlab.com/acme/x/-/blob/dev/src/a.ts#L3');
    expect(blobUrl({ url: '', branch: 'main', provider: 'github' }, 'a', 1)).toBeUndefined();
  });
});

describe('commitDiffUrl', () => {
  it('anchors the file diff by the hash of its path', () => {
    const file = 'docs/decisions/0001-x.md';
    const sha = 'a'.repeat(40);
    expect(commitDiffUrl({ url: 'https://github.com/acme/x', provider: 'github' }, sha, file)).toBe(
      `https://github.com/acme/x/commit/${sha}#diff-${createHash('sha256').update(file).digest('hex')}`,
    );
    expect(commitDiffUrl({ url: 'https://gitlab.com/acme/x', provider: 'gitlab' }, sha, file)).toBe(
      `https://gitlab.com/acme/x/-/commit/${sha}#${createHash('sha1').update(file).digest('hex')}`,
    );
    expect(commitDiffUrl({ url: '', provider: 'github' }, sha, file)).toBeUndefined();
  });
});
