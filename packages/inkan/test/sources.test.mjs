import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, validateConfig } from '../lib/config.mjs';
import { run as sync } from '../lib/commands/sync.mjs';
import { fetchSource, isMissing, repoWebUrl, resolveSources, sourceContentDir, sourcesCacheDir, syncSources } from '../lib/sources.mjs';
import { bareRepo, configModule, git, tmpSite } from './helpers.mjs';

const record = (title) => `---\ntitle: ${title}\nstatus: accepted\n---\n## Context\n${title}\n`;

describe('sources config', () => {
  it('requires exactly one of repo or dir', () => {
    expect(() => validateConfig({ sources: [{ project: 'a' }] })).toThrow('sources.0: set exactly one of repo or dir');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: 'x', dir: 'y' }] })).toThrow('sources.0: set exactly one of repo or dir');
    expect(() => validateConfig({ sources: [{ project: 'a', dir: 'y', branch: 'main' }] })).toThrow('sources.0.branch: only applies to repo sources');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: 'x', path: '../etc' }] })).toThrow('sources.0.path: must be a relative path');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: 'x', depth: 1 }] })).toThrow('sources.0.depth: unknown option');
    expect(() => validateConfig({ sources: [{ project: 'a b', repo: 'x' }] })).toThrow('sources.0.project: must be a folder name');
    expect(validateConfig({ sources: [{ project: 'a', repo: 'x' }, { project: 'b', dir: 'y', path: 'adrs' }] }).sources).toHaveLength(2);
  });

  it('resolves folders, defaults path to docs/decisions and derives the web URL', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ sources: [
        { project: 'checkout', repo: 'git@github.com:acme/checkout.git', branch: 'develop' },
        { project: 'search', dir: './services/search', path: 'adrs/' },
      ] }`),
      'services/search/adrs/adr/0001-x.md': record('x'),
    });
    const [checkout, search] = (await loadConfig(root)).sources;
    expect(checkout).toMatchObject({
      project: 'checkout',
      repo: 'git@github.com:acme/checkout.git',
      dir: null,
      branch: 'develop',
      path: 'docs/decisions',
      root: path.join(sourcesCacheDir(root), 'checkout'),
      contentDir: path.join(sourcesCacheDir(root), 'checkout/docs/decisions'),
      recordsPath: 'docs/decisions',
      web: 'https://github.com/acme/checkout',
      provider: 'github',
      head: null,
    });
    expect(isMissing(checkout)).toBe(true);
    expect(search).toMatchObject({
      repo: null,
      dir: path.join(root, 'services/search'),
      path: 'adrs',
      root: path.join(root, 'services/search'),
      contentDir: path.join(root, 'services/search/adrs'),
      recordsPath: 'adrs',
      web: null,
    });
    expect(isMissing(search)).toBe(false);
  });

  it('rejects a source whose project also exists locally, and duplicate projects', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ sources: [{ project: 'sre', dir: 'elsewhere' }] }`),
      'decisions/sre/adr/0001-x.md': record('x'),
    });
    await expect(loadConfig(root)).rejects.toThrow('project "sre" also exists locally (decisions/sre)');
    expect(() => resolveSources([{ project: 'a', dir: 'x' }, { project: 'a', dir: 'y' }], { root, contentDir: path.join(root, 'decisions'), docTypes: {} })).toThrow(
      'project "a" is listed twice',
    );
    const contentDir = path.join(root, 'decisions');
    expect(() => resolveSources([{ project: 'a', dir: 'x' }, { project: 'A', dir: 'y' }], { root, contentDir, docTypes: {} })).toThrow('project "A" is listed twice');
    expect(() => resolveSources([{ project: 'SRE', dir: 'x' }], { root, contentDir, docTypes: {} })).toThrow('project "SRE" also exists locally (decisions/sre)');
    expect(resolveSources([{ project: 'Billing', dir: 'x' }], { root, contentDir, docTypes: {} })[0].project).toBe('billing');
  });

  it('accepts a source laid out like the hub (<path>/<project>/<type>)', () => {
    const root = tmpSite({ 'svc/docs/decisions/billing/adr/0001-x.md': record('x') });
    const docTypes = { adr: {} };
    const nested = { project: 'billing', root: path.join(root, 'svc'), path: 'docs/decisions' };
    expect(sourceContentDir(nested, docTypes)).toBe(path.join(root, 'svc/docs/decisions/billing'));
    // ...but prefers the flat layout when the folder itself holds records.
    fs.mkdirSync(path.join(root, 'svc/docs/decisions/rfc'));
    expect(sourceContentDir({ ...nested, project: 'other' }, docTypes)).toBe(path.join(root, 'svc/docs/decisions'));
  });

  it('turns git remotes into web URLs', () => {
    expect(repoWebUrl('https://github.com/acme/x.git')).toBe('https://github.com/acme/x');
    expect(repoWebUrl('https://gitlab.example.com/group/sub/x/')).toBe('https://gitlab.example.com/group/sub/x');
    expect(repoWebUrl('git@github.com:acme/x.git')).toBe('https://github.com/acme/x');
    expect(repoWebUrl('ssh://git@gitlab.example.com:2222/group/x.git')).toBe('https://gitlab.example.com/group/x');
    expect(repoWebUrl('/srv/git/x.git')).toBeNull();
    expect(repoWebUrl('file:///srv/git/x.git')).toBeNull();
    expect(repoWebUrl('../other/repo')).toBeNull();
    expect(repoWebUrl('other/repo')).toBeNull();
  });

  it('takes an explicit provider and refuses option-like values', () => {
    const root = tmpSite();
    const [a, b] = resolveSources(
      [{ project: 'a', repo: 'https://git.corp.example/x/y.git', provider: 'gitlab' }, { project: 'b', repo: 'https://gitlab.corp/x.git' }],
      { root, contentDir: path.join(root, 'decisions'), docTypes: {} },
    );
    expect([a.provider, b.provider]).toEqual(['gitlab', 'gitlab']);
    expect(validateConfig({ sources: [{ project: 'a', repo: 'x', provider: 'gitlab' }] }).sources[0].provider).toBe('gitlab');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: 'x', provider: 'bitbucket' }] })).toThrow('sources.0.provider');
    expect(() => validateConfig({ sources: [{ project: 'a', dir: 'x', provider: 'gitlab' }] })).toThrow('sources.0.provider: only applies to repo sources');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: '--upload-pack=x' }] })).toThrow('sources.0.repo: must not start with "-"');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: 'x', branch: '-b' }] })).toThrow('sources.0.branch: must not start with "-"');
    expect(() => validateConfig({ sources: [{ project: 'a', repo: 'x', path: '-x' }] })).toThrow('sources.0.path: must not start with "-"');
  });

  it('resolves a dir source through symlinks', () => {
    const root = tmpSite({ 'real/docs/decisions/adr/0001-x.md': record('x') });
    fs.symlinkSync(path.join(root, 'real'), path.join(root, 'link'));
    const [s] = resolveSources([{ project: 'a', dir: 'link' }], { root, contentDir: path.join(root, 'decisions'), docTypes: { adr: {} } });
    expect(s.root).toBe(fs.realpathSync(path.join(root, 'real')));
    expect(s.contentDir).toBe(path.join(s.root, 'docs/decisions'));
  });
});

describe('inkan sync', () => {
  it('clones only the records folder, updates in place and reports what it fetched', async () => {
    const { remote, commit } = bareRepo({ 'docs/decisions/_project.yml': 'name: Checkout\n', 'docs/decisions/adr/0001-first.md': record('First') });
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ sources: [{ project: 'checkout', repo: ${JSON.stringify(remote)} }] }`) });
    const lines = [];
    const config = await loadConfig(root);
    expect(await syncSources(config, { log: (l) => lines.push(l) })).toBe(1);
    const cache = path.join(sourcesCacheDir(root), 'checkout');
    expect(fs.existsSync(path.join(cache, 'docs/decisions/adr/0001-first.md'))).toBe(true);
    expect(fs.existsSync(path.join(cache, 'src/app.js'))).toBe(false);
    expect(lines).toEqual([expect.stringMatching(/^sync: checkout ← .*remote\.git docs\/decisions @ [0-9a-f]{7}: 1 record$/)]);

    const sha = commit({ 'docs/decisions/adr/0002-second.md': record('Second'), 'docs/decisions/adr/0001-first.md': record('First, revised') });
    lines.length = 0;
    await syncSources(await loadConfig(root), { log: (l) => lines.push(l) });
    expect(fs.readFileSync(path.join(cache, 'docs/decisions/adr/0001-first.md'), 'utf8')).toContain('First, revised');
    expect(fs.existsSync(path.join(cache, 'docs/decisions/adr/0002-second.md'))).toBe(true);
    expect(lines[0]).toContain(`@ ${sha}: 2 records`);
    // Shallow: history is not accumulated, and the branch name is known for edit links.
    expect(git(['rev-list', '--count', 'HEAD'], cache)).toBe('1');
    expect((await loadConfig(root)).sources[0].head).toBe('main');

    // A cache that already exists is left alone with missingOnly (what `dev` does).
    commit({ 'docs/decisions/adr/0003-third.md': record('Third') });
    expect(await syncSources(await loadConfig(root), { log: () => {}, missingOnly: true })).toBe(0);
    expect(fs.existsSync(path.join(cache, 'docs/decisions/adr/0003-third.md'))).toBe(false);
  });

  it('clones a relative local repo path against the project root, not the cache folder', async () => {
    const { remote } = bareRepo({ 'docs/decisions/adr/0001-first.md': record('First') });
    const root = tmpSite();
    fs.writeFileSync(path.join(root, 'inkan.config.mjs'), configModule(`{ sources: [{ project: 'rel', repo: ${JSON.stringify(path.relative(root, remote))} }] }`));
    const config = await loadConfig(root);
    expect(config.sources[0].remote).toMatch(/^file:\/\//);
    await syncSources(config, { log: () => {} });
    expect(fs.existsSync(path.join(sourcesCacheDir(root), 'rel/docs/decisions/adr/0001-first.md'))).toBe(true);
  });

  it('follows the configured branch', async () => {
    const { remote } = bareRepo({ 'docs/decisions/adr/0001-first.md': record('First') }, { branch: 'trunk' });
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ sources: [{ project: 'c', repo: ${JSON.stringify(remote)}, branch: 'trunk' }] }`) });
    const log = [];
    const code = await sync({ args: [], flags: {}, root });
    expect(code).toBe(0);
    const cache = path.join(sourcesCacheDir(root), 'c');
    expect(git(['symbolic-ref', '--short', 'HEAD'], cache)).toBe('trunk');
    expect(fs.existsSync(path.join(cache, 'docs/decisions/adr/0001-first.md'))).toBe(true);
    expect(log).toEqual([]);
  });

  it('fails with a clear message for a missing branch, folder or repository', async () => {
    const { remote } = bareRepo({ 'docs/decisions/adr/0001-first.md': record('First') });
    const resolve = (s) => resolveSources([s], { root: tmpSite(), contentDir: '/nowhere', docTypes: { adr: {} } })[0];
    expect(() => fetchSource(resolve({ project: 'a', repo: remote, branch: 'nope' }))).toThrow(/sync a: git clone failed for .*remote\.git \(nope\):\n {2}.*nope/);
    expect(() => fetchSource(resolve({ project: 'b', repo: remote, path: 'adrs' }))).toThrow(/sync b: folder "adrs" not found in .*remote\.git$/);
    expect(() => fetchSource(resolve({ project: 'c', repo: path.join(os.tmpdir(), 'inkan-no-such-repo.git') }))).toThrow(/sync c: git clone failed/);
  });

  it('lists dir sources without fetching anything', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ sources: [{ project: 'search', dir: 'services/search' }] }`),
      'services/search/docs/decisions/adr/0001-x.md': record('x'),
    });
    const out = [];
    const log = console.log;
    console.log = (l) => out.push(l);
    try {
      expect(await sync({ args: [], flags: {}, root })).toBe(0);
    } finally {
      console.log = log;
    }
    expect(out).toEqual(['sync: search ← services/search/docs/decisions (local): 1 record']);
    expect(fs.existsSync(sourcesCacheDir(root))).toBe(false);
  });
});
