import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageDir } from '../lib/config.mjs';
import { docId, assertNoCollisions, builtInRoutes, contentId, discoverPages, fileToRoute, pluginPages, projectFolders, recordRoutes, routesCollide } from '../lib/pages.mjs';
import { tmpSite } from './helpers.mjs';

const appDir = path.join(packageDir, 'app');

describe('fileToRoute', () => {
  it('maps files to routes', () => {
    expect(fileToRoute('about.astro')).toBe('about');
    expect(fileToRoute('index.astro')).toBe('');
    expect(fileToRoute('guides/index.md')).toBe('guides');
    expect(fileToRoute('guides/[slug].astro')).toBe('guides/[slug]');
    expect(fileToRoute('a/b/c.mdx')).toBe('a/b/c');
  });
});

describe('contentId', () => {
  it('matches the ids of the glob loader', () => {
    expect(contentId('sre/adr/0001-x.md')).toBe('sre/adr/0001-x');
    expect(contentId('Team Payments/ADR/0001 Use Stripe!.md')).toBe('team-payments/adr/0001-use-stripe');
    expect(contentId('guides/index.md')).toBe('guides');
    expect(contentId('index.md')).toBe('index');
  });

  it('prefers a front-matter slug', () => {
    const root = tmpSite({ 'a/b.md': '---\ntitle: T\nslug: custom/path\n---\nbody', 'a/c.md': '---\ntitle: T\n---\nslug: not-front-matter' });
    expect(contentId('a/b.md', path.join(root, 'a/b.md'))).toBe('custom/path');
    expect(contentId('a/c.md', path.join(root, 'a/c.md'))).toBe('a/c');
    expect(recordRoutes(root).map((r) => r.route)).toEqual(['custom/path', 'a/c']);
  });
});

describe('discoverPages', () => {
  it('finds astro and markdown pages, skipping _ files and folders and other extensions', () => {
    const root = tmpSite({
      'pages/about.astro': '',
      'pages/handbook.md': '',
      'pages/team/index.mdx': '',
      'pages/team/[member].astro': '',
      'pages/_draft.md': '',
      'pages/_dir/x.astro': '',
      'pages/a/_b/c.md': '',
      'pages/notes.txt': '',
    });
    const pages = discoverPages(path.join(root, 'pages'));
    expect(pages.map((p) => [p.route, p.kind])).toEqual([
      ['about', 'astro'],
      ['handbook', 'markdown'],
      ['team/[member]', 'astro'],
      ['team', 'markdown'],
    ]);
    expect(pages[0].file).toBe(path.join(root, 'pages/about.astro'));
  });

  it('returns nothing for a missing folder', () => {
    expect(discoverPages('/nope/pages')).toEqual([]);
    expect(discoverPages(null)).toEqual([]);
  });
});

describe('routesCollide', () => {
  it('compares static and dynamic segments', () => {
    expect(routesCollide('about', '/about/')).toBe(true);
    expect(routesCollide('about', 'contact')).toBe(false);
    expect(routesCollide('projects/sre', 'projects/[project]')).toBe(true);
    expect(routesCollide('projects', 'projects/[project]')).toBe(false);
    expect(routesCollide('docs/a/b', 'docs/[...rest]')).toBe(true);
    expect(routesCollide('', '')).toBe(true);
  });

  it('handles mixed segments like post-[id]', () => {
    expect(routesCollide('blog/post-[id]', 'blog/post-1')).toBe(true);
    expect(routesCollide('blog/post-[id]', 'blog/[slug]')).toBe(true);
    expect(routesCollide('blog/post-[id]', 'blog/about')).toBe(false);
    expect(routesCollide('[a]-[b]', 'x-y')).toBe(true);
  });
});

describe('pluginPages', () => {
  it('accepts paths and URLs and checks the file exists', () => {
    const root = tmpSite({ 'p/page.astro': '' });
    const file = path.join(root, 'p/page.astro');
    const pages = pluginPages([{ name: 'p', pages: [{ pattern: '/a', entrypoint: file }, { pattern: '/b', entrypoint: new URL(`file://${file}`) }] }]);
    expect(pages.map((p) => p.entrypoint)).toEqual([file, file]);
    expect(pages[0].plugin).toBe('p');
    expect(() => pluginPages([{ name: 'p', pages: [{ pattern: '/a', entrypoint: '/nope/x.astro' }] }])).toThrow(/plugin "p" page \/a: entrypoint not found: \/nope\/x\.astro/);
  });
});

describe('assertNoCollisions', () => {
  const site = (files) => {
    const root = tmpSite(files);
    return { root, contentDir: path.join(root, 'decisions'), pages: discoverPages(path.join(root, 'pages')), appDir };
  };

  it('lists built-in routes from the app', () => {
    const routes = builtInRoutes(appDir, path.join(appDir, 'none'));
    expect(routes).toContain('timeline');
    expect(routes).toContain('sitemap-index.xml');
    expect(routes).toContain('projects/[project]');
    expect(routes).toContain('llms.txt');
    expect(routes.some((r) => r.startsWith('['))).toBe(false);
  });

  it('rejects a project folder named like a built-in page', () => {
    expect(() => assertNoCollisions(site({ 'decisions/timeline/adr/0001-x.md': '' }))).toThrow(
      /project folder timeline collides with the built-in page \/timeline\//,
    );
  });

  it('rejects a project folder named like a folder of built-in pages', () => {
    expect(builtInRoutes(appDir, path.join(appDir, 'none'))).toContain('badges/[name].svg');
    expect(() => assertNoCollisions(site({ 'decisions/badges/adr/0001-x.md': '' }))).toThrow(/project folder badges collides with the built-in pages under \/badges\//);
    expect(() => assertNoCollisions(site({ 'decisions/projects/index.md': '' }))).toThrow(/project folder projects collides with the built-in pages under \/projects\//);
  });

  it('rejects a flat page that shares its route with a project folder, but allows the folder index', () => {
    expect(() => assertNoCollisions(site({ 'decisions/billing.md': '', 'decisions/billing/adr/0001-x.md': '' }))).toThrow(/billing\.md collides with the team page \/billing\//);
    expect(() => assertNoCollisions(site({ 'decisions/billing/index.md': '' }))).not.toThrow();
  });

  it('rejects two project folders served at the same URL', () => {
    expect(() => assertNoCollisions(site({ 'decisions/Ops Plans/adr/0001-x.md': '', 'decisions/ops-plans/adr/0002-y.md': '' }))).toThrow(
      /project folders Ops Plans\/ and ops-plans\/ are both served at \/ops-plans\//,
    );
    expect(() => assertNoCollisions(site({ 'decisions/Ops Plans/adr/0001-x.md': '' }))).not.toThrow();
  });

  it('treats a folder holding only index.md as a project', () => {
    expect(projectFolders(site({ 'decisions/billing/index.md': '', 'decisions/_drafts/x.md': '' }).contentDir)).toEqual(['billing']);
  });

  it('passes for unique routes', () => {
    expect(() => assertNoCollisions(site({ 'pages/about.astro': '', 'pages/handbook.md': '', 'decisions/sre/adr/0001-x.md': '' }))).not.toThrow();
  });

  it('rejects a page that shadows a built-in page', () => {
    expect(() => assertNoCollisions(site({ 'pages/timeline.md': '' }))).toThrow(/pages\/timeline\.md: route \/timeline\/ collides with the built-in page \/timeline\//);
    expect(() => assertNoCollisions(site({ 'pages/index.astro': '' }))).toThrow(/collides with the built-in page \//);
    expect(() => assertNoCollisions(site({ 'pages/projects/sre.astro': '' }))).toThrow(/built-in page \/projects\/\[project\]\//);
  });

  it('rejects a page that shadows a record', () => {
    expect(recordRoutes(site({ 'decisions/sre/adr/0001-x.md': '', 'decisions/_landing.md': '' }).contentDir).map((r) => r.route)).toEqual(['sre/adr/0001-x']);
    expect(() => assertNoCollisions(site({ 'pages/sre/adr/0001-x.astro': '', 'decisions/sre/adr/0001-x.md': '' }))).toThrow(
      /pages\/sre\/adr\/0001-x\.astro: route \/sre\/adr\/0001-x\/ collides with record decisions\/sre\/adr\/0001-x\.md/,
    );
  });

  it('rejects two pages or a plugin page on the same route', () => {
    expect(() => assertNoCollisions(site({ 'pages/about.astro': '', 'pages/about.md': '' }))).toThrow(/pages\/about\.md: route \/about\/ collides with pages\/about\.astro/);
    const s = site({ 'pages/stats.md': '' });
    expect(() => assertNoCollisions({ ...s, pluginPages: [{ pattern: '/stats', entrypoint: '/p/stats.astro', plugin: 'p' }] })).toThrow(/collides with plugin "p" page \/stats/);
    expect(() => assertNoCollisions({ ...s, pluginPages: [{ pattern: '/timeline', entrypoint: '/p/t.astro', plugin: 'p' }] })).toThrow(/plugin "p" page \/timeline: route \/timeline\/ collides with the built-in/);
  });

  it('uses slugified record ids', () => {
    expect(() => assertNoCollisions(site({ 'pages/sre/adr/0001-x.astro': '', 'decisions/SRE/ADR/0001 X.md': '' }))).toThrow(/collides with record decisions\/SRE\/ADR\/0001 X\.md/);
    expect(() => assertNoCollisions(site({ 'pages/moved.astro': '', 'decisions/a/b.md': '---\nslug: moved\n---' }))).toThrow(/collides with record decisions\/a\/b\.md/);
  });

  it('only warns when a dynamic page sits next to a static route', () => {
    const warnings = [];
    expect(() => assertNoCollisions({ ...site({ 'pages/[slug].astro': '' }), warn: (m) => warnings.push(m) })).not.toThrow();
    expect(warnings[0]).toMatch(/pages\/\[slug\]\.astro: route \/\[slug\]\/ collides with the built-in page \/[\w-]+\/; the more specific route wins/);
    expect(() => assertNoCollisions(site({ 'pages/projects/sre.astro': '' }))).toThrow();
  });

  it('includes redirect sources and sitemap files', () => {
    expect(() => assertNoCollisions({ ...site({ 'pages/old.md': '' }), redirects: { '/old': '/new/' } })).toThrow(/pages\/old\.md: route \/old\/ collides with the redirect from \/old\//);
    expect(() => assertNoCollisions(site({ 'pages/sitemap-index.xml.astro': '' }))).toThrow(/sitemap-index\.xml/);
  });

  it('reports every collision', () => {
    expect(() => assertNoCollisions(site({ 'pages/timeline.md': '', 'pages/tags.astro': '' }))).toThrow(/tags[\s\S]*timeline/);
  });
});

describe('docId', () => {
  it('serves nested index files at their folder but keeps a project intro distinct', () => {
    expect(docId('sre/guides/index.md')).toBe('sre/guides');
    expect(docId('sre/index.md')).toBe('sre/index');
    expect(docId('sre/adr/0001-x.md')).toBe('sre/adr/0001-x');
  });
});
