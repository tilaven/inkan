/**
 * End to end: with `authentication` the build writes the public site to dist/ (nothing protected in it) and the
 * members' site to dist-protected/ (everything, with lock marks and `_server.json`).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { orphanedAssets } from '../lib/auth/protect.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const record = (title, extra = '') => `---\ntitle: ${title}\nstatus: accepted\ndate: 2026-01-02\n${extra}---\n## Context\n${title} body.\n`;
const SECRET = ['Hidden Plan Zeta', 'zeta-secret-tag', 'XYZZY', 'Secret Ops', 'Top secret description', 'QUUX', 'PLUGH', 'secret/adr', 'handbook', 'Zed Classified', 'CLASSIFIED-ROUTING-TABLE', 'zz-classified', 'Ops Plans', 'ops-plans', 'WALDO'];
const svg = (marker) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>${marker}</text></svg>\n`;

/** A valid 1x1 PNG, so the image pipeline treats it like any photo. */
function png() {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Every text file of a build (Pagefind's fragments are compressed, so the HTML it indexed is what counts). */
const textFiles = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(html|md|txt|json|xml)$/.test(e.name) && !path.relative(dir, e.parentPath).startsWith('pagefind'))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'));

/**
 * Every file of a build as text, Pagefind's gzipped index included; binary files (images, PDFs) are left out.
 * Outputs added later (graphs, cards, feeds) are covered without this test knowing about them.
 */
const everyFile = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const file = path.join(e.parentPath, e.name);
      const rel = path.relative(dir, file).split(path.sep).join('/');
      let bytes = fs.readFileSync(file);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        try {
          bytes = zlib.gunzipSync(bytes);
        } catch (err) {
          throw new Error(`${rel} (${bytes.length} bytes) does not unzip: ${err.message}`);
        }
      }
      return { file: rel, text: bytes.includes(0) ? null : bytes.toString('utf8') };
    });

describe('build with authentication', () => {
  const root = tmpSite({
    'inkan.config.mjs': configModule(
      `{ url: 'https://hub.example.com', authentication: { type: 'github', clientId: 'abc', allow: { domains: ['example.com'] } }, protectedRoutes: ['/handbook/*'] }`,
    ),
    'decisions/sre/_project.yml': 'name: SRE\n',
    'decisions/_authors.yml': 'ann:\n  name: Ann Public\n  team: SRE\nzed:\n  name: Zed Classified\n  team: Secret Ops\n',
    'decisions/sre/adr/0001-slos.md': record('Public SLOs', 'related: [secret/adr/0001-hidden-plan, ./Secret/adr/0001-hidden-plan.md]\nsupersedes: [/Secret/ADR/0001-Hidden-Plan.md/]\nreviewBy: 2027-01-01\n') + '\n![Diagram](./img/public-diagram.svg)\n',
    'decisions/sre/adr/img/public-diagram.svg': svg('PUBLIC-DIAGRAM'),
    'decisions/secret/_project.yml': 'name: Secret Ops\ndescription: Top secret description.\nprotected: true\n',
    'decisions/secret/adr/0001-hidden-plan.md':
      record('Hidden Plan Zeta', 'tags: [zeta-secret-tag]\nauthors: [secretperson]\nreviewBy: 2027-01-01\n') + '\nClassified XYZZY.\n\n![Diagram](./img/zz-classified-diagram.svg)\n![Photo](./img/zz-classified-photo.png)\n',
    'decisions/secret/adr/img/zz-classified-diagram.svg': svg('CLASSIFIED-ROUTING-TABLE'),
    'decisions/secret/adr/img/zz-classified-photo.png': png(),
    // A folder that is no URL slug: the project, its team page and its records all get the slug `ops-plans`.
    'decisions/Ops Plans/_project.yml': 'name: Ops Plans\nprotected: true\n',
    'decisions/Ops Plans/adr/0001-waldo.md': record('Waldo', '') + '\nWALDO body.\n',
    'pages/about.md': '---\ntitle: Public Page\n---\nVisible to all.\n',
    'pages/handbook/onboarding.md': '---\ntitle: Handbook Onboarding\n---\nOnboarding QUUX text.\n\n![Map](./img/zz-handbook-map.svg)\n',
    'pages/handbook/img/zz-handbook-map.svg': svg('HANDBOOK-SECRET-MAP'),
    'pages/handbook/index.astro': '<html><body><h1>Handbook PLUGH</h1></body></html>\n',
  });
  const dist = path.join(root, 'dist');
  const members = path.join(root, 'dist-protected');
  const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

  it('builds both sites', { timeout: 240_000 }, () => {
    const build = spawnSync(process.execPath, [cli, 'build', '--root', root], { encoding: 'utf8' });
    expect(build.status, build.stderr + build.stdout).toBe(0);
    expect(build.stdout).toContain('inkan: building the public site into dist/');
    expect(build.stdout).toContain('inkan: building the protected site into dist-protected/');
  });

  it('leaves every protected page and word out of the public site', () => {
    const files = textFiles(dist);
    expect(files).toContain('sre/adr/0001-slos/index.html');
    expect(files).toContain('about/index.html');
    expect(files).not.toContain('secret/index.html');
    expect(files).not.toContain('secret/adr/0001-hidden-plan/index.html');
    expect(files).not.toContain('secret/adr/0001-hidden-plan.md');
    expect(files).not.toContain('handbook/index.html');
    expect(files).not.toContain('handbook/onboarding/index.html');
    expect(files).not.toContain('badges/secret.json');
    expect(files.filter((f) => /ops[- ]plans/i.test(f))).toEqual([]);
    for (const f of files) {
      const text = read(dist, f);
      for (const word of SECRET) expect(text, `${f} mentions ${word}`).not.toContain(word);
    }
    expect(read(dist, 'sitemap-0.xml')).not.toContain('/_auth/');
    // No trace in the search index either: Pagefind only saw the public pages.
    const pagefind = fs.readdirSync(path.join(dist, 'pagefind')).filter((f) => f.endsWith('.json'));
    expect(pagefind.length).toBeGreaterThan(0);
    for (const f of pagefind) expect(read(dist, `pagefind/${f}`)).not.toMatch(/secret|handbook/);
    // The public record's own links stop at the fence.
    expect(JSON.parse(read(dist, 'decisions.json')).find((d) => d.id === 'sre/adr/0001-slos').related).toEqual([]);
    expect(read(dist, 'sre/adr/0001-slos.md')).not.toMatch(/related:|supersedes:/);
    expect(JSON.parse(read(dist, 'graph.json'))).toMatchObject({ nodes: [], edges: [], dangling: [] });
    expect(read(dist, 'index.html')).toContain('1 record from 1 team');
    expect(read(dist, 'index.html')).toContain('href="/_auth/login/" data-auth-login>Sign in</a>');
    expect(read(dist, 'index.html')).not.toContain('Members only');
  });

  it('has no trace of protected content in any file of the public site', () => {
    for (const { file, text } of everyFile(dist)) {
      expect(file).not.toMatch(/secret|hidden-plan|handbook/);
      if (text === null) continue;
      const lower = text.toLowerCase();
      for (const word of [...SECRET, 'hidden-plan']) expect(lower, `${file} mentions ${word}`).not.toContain(word.toLowerCase());
    }
  });

  it('copies the images of protected pages only into the members site', () => {
    const assets = (dir) => fs.readdirSync(path.join(dir, '_astro')).sort();
    expect(assets(dist).filter((f) => /classified|handbook/.test(f))).toEqual([]);
    expect(assets(dist).some((f) => /^public-diagram\..+\.svg$/.test(f))).toBe(true);
    expect(assets(dist).some((f) => f.endsWith('.css'))).toBe(true);
    for (const { file } of everyFile(dist)) {
      const bytes = fs.readFileSync(path.join(dist, file));
      for (const marker of ['CLASSIFIED-ROUTING-TABLE', 'HANDBOOK-SECRET-MAP']) expect(bytes.includes(marker), `${file} holds ${marker}`).toBe(false);
    }
    // The image pipeline may add optimised variants (webp, sizes) next to the originals.
    for (const name of ['zz-classified-diagram', 'zz-classified-photo', 'zz-handbook-map']) {
      expect(assets(members).some((f) => f.startsWith(`${name}.`)), `${name} in dist-protected/_astro`).toBe(true);
    }
    expect(read(members, 'secret/adr/0001-hidden-plan/index.html')).toMatch(/src="\/_astro\/zz-classified-diagram\.[^"]+\.svg"/);
  });

  it('draws Open Graph cards for protected records only into the members site', () => {
    const cards = (dir) => everyFile(path.join(dir, 'og')).map((f) => f.file).sort();
    expect(cards(dist)).toEqual(['index.png', 'sre.png', 'sre/adr/0001-slos.png']);
    expect(cards(members)).toEqual(expect.arrayContaining(['index.png', 'secret.png', 'secret/adr/0001-hidden-plan.png', 'sre.png', 'sre/adr/0001-slos.png', 'ops-plans/adr/0001-waldo.png']));
    expect(fs.readFileSync(path.join(dist, 'og/index.png')).equals(fs.readFileSync(path.join(members, 'og/index.png')))).toBe(false);
  });

  it('lists only public records on the reviews page', () => {
    expect(read(dist, 'reviews/index.html')).toContain('Public SLOs');
    expect(read(members, 'reviews/index.html')).toContain('Hidden Plan Zeta');
  });

  it('builds the members site with everything and lock marks', () => {
    const files = textFiles(members);
    expect(files).toEqual(expect.arrayContaining(['secret/index.html', 'secret/adr/0001-hidden-plan/index.html', 'secret/adr/0001-hidden-plan.md', 'handbook/index.html', 'handbook/onboarding/index.html', 'badges/secret.json']));
    expect(read(members, 'handbook/index.html')).toContain('PLUGH');
    expect(read(members, 'ops-plans/adr/0001-waldo/index.html')).toContain('WALDO');
    expect(read(members, 'authors/index.html')).toContain('Zed Classified');
    expect(read(dist, 'authors/index.html')).toContain('Ann Public');
    expect(read(members, 'sre/adr/0001-slos.md')).toContain('related: [secret/adr/0001-hidden-plan, ./Secret/adr/0001-hidden-plan.md]');
    const graph = JSON.parse(read(members, 'graph.json'));
    expect(graph.edges).toEqual([{ from: 'sre/adr/0001-slos', to: 'secret/adr/0001-hidden-plan', kind: 'supersedes' }]);
    expect(read(members, 'sre/adr/0001-slos/index.html')).toContain('href="/secret/adr/0001-hidden-plan/"');
    expect(read(members, 'index.html')).toContain('3 records from 3 teams');
    expect(files.filter((f) => /ops[- ]plans/i.test(f) && f.endsWith('index.html')).sort()).toEqual(['ops-plans/adr/0001-waldo/index.html', 'ops-plans/index.html', 'projects/ops-plans/index.html']);
    expect(read(members, 'ops-plans/index.html')).toContain('Waldo');
    expect(read(members, 'index.html')).toContain('class="lock unit__lock"');
    expect(read(members, 'secret/adr/0001-hidden-plan/index.html')).toContain('Members only');
    expect(read(members, 'sre/adr/0001-slos/index.html')).not.toContain('Members only');
    expect(read(members, 'decisions/index.html')).toContain('class="lock dhc__lock"');
    expect(read(members, 'index.html')).toContain('data-account="/_auth/me/"');
    expect(read(members, 'index.html')).toContain('<form class="account__logout" method="post" action="/_auth/logout/">');
    expect(read(members, 'sitemap-0.xml')).toContain('/secret/adr/0001-hidden-plan/');
    expect(read(members, 'sitemap-0.xml')).not.toContain('/_auth/');
    expect(JSON.parse(read(members, '_server.json'))).toEqual({
      base: '/',
      url: 'https://hub.example.com',
      authentication: { type: 'github', clientId: 'abc', url: 'https://github.com', allow: { domains: ['example.com'] }, maxAge: 28800, scopes: ['read:user', 'user:email'], groupsClaim: 'groups' },
      protectedRoutes: ['/handbook/*'],
    });
  });

  it('writes the sign-in error page to both sites, unindexed', () => {
    for (const dir of [dist, members]) {
      const page = read(dir, '_auth/denied/index.html');
      expect(page).toContain('<meta name="robots" content="noindex">');
      expect(page).toContain('Sign-in failed. Please try again.');
      expect(page).toContain("Your account is not allowed to see this site's protected records.");
      expect(page).toContain('href="/_auth/login/">Try again</a>');
      expect(page).toContain('href="/">Back to the public records</a>');
      expect(read(dir, 'sitemap-0.xml')).not.toContain('denied');
    }
  });

  it('refuses a protected project without authentication and drops a stale members site', { timeout: 240_000 }, () => {
    fs.writeFileSync(path.join(root, 'inkan.config.mjs'), configModule(`{ url: 'https://hub.example.com' }`));
    fs.writeFileSync(path.join(root, 'decisions/Ops Plans/_project.yml'), 'name: Ops Plans\n');
    const failed = spawnSync(process.execPath, [cli, 'build', '--root', root], { encoding: 'utf8' });
    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain('project "secret" is protected (protected: true in _project.yml) but `authentication` is not set');
    const check = spawnSync(process.execPath, [cli, 'check', '--root', root], { encoding: 'utf8' });
    expect(check.status).toBe(1);
    expect(check.stdout).toContain('decisions/secret/_project.yml error project "secret" is protected');

    fs.writeFileSync(path.join(root, 'decisions/secret/_project.yml'), 'name: Secret Ops\n');
    const ok = spawnSync(process.execPath, [cli, 'build', '--root', root], { encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    expect(fs.existsSync(members)).toBe(false);
    expect(fs.existsSync(path.join(dist, 'secret/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(dist, '_auth'))).toBe(false);
    expect(read(dist, 'index.html')).not.toContain('Sign in');
  });
});

describe('orphanedAssets', () => {
  it('keeps what the site references, directly or through another asset, and lists the rest', () => {
    const root = tmpSite({
      'index.html': '<link rel="stylesheet" href="/_astro/site.Ab12.css"><script type="module" src="/_astro/app.Cd34.js"></script>',
      '_astro/site.Ab12.css': '@font-face { src: url(/_astro/Mono.Ef56.woff2) }',
      '_astro/Mono.Ef56.woff2': Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 1]),
      '_astro/app.Cd34.js': 'import("./chart.Gh78.js");',
      '_astro/chart.Gh78.js': 'export const chart = 1;',
      '_astro/diagram.Ij90.svg': '<svg/>',
      '_astro/photo.Kl12.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]),
      '_astro/stale.Mn34.js': 'import("./photo.Kl12.png")',
      // A text file with a stray NUL byte is still read, so what it names stays.
      'data.json': Buffer.concat([Buffer.from('{"logo":"/_astro/logo.Op56.svg","pad":"'), Buffer.from([0]), Buffer.from('"}')]),
      '_astro/logo.Op56.svg': '<svg/>',
    });
    expect(orphanedAssets(root).map((f) => path.relative(root, f)).sort()).toEqual(['_astro/diagram.Ij90.svg', '_astro/photo.Kl12.png', '_astro/stale.Mn34.js']);
    expect(orphanedAssets(tmpSite({ 'index.html': 'no assets' }))).toEqual([]);
  });
});
