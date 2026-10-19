import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeRegExp } from './regex.mjs';

/**
 * @typedef {{ file: string, route: string, kind: 'astro' | 'markdown' }} UserPage
 * `file` is absolute, `route` is the URL path without base and trailing slash ('' for the root).
 */

const hidden = (relativeFile) => relativeFile.split('/').some((s) => s.startsWith('_'));

const listFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
        .filter((f) => !hidden(f))
        .sort()
    : [];

/** Same as github-slugger for ASCII names, which is what Astro's glob loader applies to each path segment. */
export const slugSegment = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[\0-\x1F!-,./:-@[-^`{-~]/g, '')
    .replace(/ /g, '-');

/** Front-matter `slug`, which Astro's glob loader uses as the id when present. */
const frontMatterSlug = (file) => {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf8'));
  const slug = head && /^slug:\s*['"]?([^'"\n]+?)['"]?\s*$/m.exec(head[1]);
  return slug ? slug[1].trim() : null;
};

/** `about/index.astro` -> `about`, `index.astro` -> ``, `guides/[slug].astro` -> `guides/[slug]`. */
export const fileToRoute = (relativeFile) =>
  relativeFile
    .replace(/\.[^./]+$/, '')
    .replace(/(^|\/)index$/, '')
    .replace(/\/+$/, '');

/**
 * Id that Astro's glob loader gives a content file: slugified segments, `/index` stripped,
 * a front-matter `slug` winning over the path.
 */
export function contentId(relativeFile, file) {
  const slug = file && frontMatterSlug(file);
  if (slug) return slug.replace(/^\/+|\/+$/g, '');
  return relativeFile
    .replace(/\.[^./]+$/, '')
    .split('/')
    .map(slugSegment)
    .join('/')
    .replace(/\/index$/, '');
}

/**
 * Pages the user put in `pagesDir`: `.astro` files become injected routes,
 * `.md`/`.mdx` files render through the docs route. Files and folders starting with `_` are skipped.
 * @param {string | null} pagesDir
 * @returns {UserPage[]}
 */
export function discoverPages(pagesDir) {
  if (!pagesDir) return [];
  return listFiles(pagesDir)
    .filter((f) => /\.(astro|mdx?)$/.test(f))
    .map((f) => {
      const file = path.join(pagesDir, f);
      return f.endsWith('.astro')
        ? { file, route: fileToRoute(f), kind: 'astro' }
        : { file, route: contentId(f, file), kind: 'markdown' };
    });
}

/** Routes of the records: every Markdown file under the content folder, with the id Astro gives it. */
export function recordRoutes(contentDir) {
  return listFiles(contentDir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => ({ file: path.join(contentDir, f), route: contentId(f, path.join(contentDir, f)) }));
}

/**
 * Project folders: top-level folders of the content directory that hold Markdown or a `_project.yml`.
 * @param {string} contentDir
 */
export function projectFolders(contentDir) {
  const ids = listFiles(contentDir)
    .filter((f) => f.includes('/') && !f.split('/').some((seg) => seg.startsWith('_') && !/^_project\.ya?ml$/.test(seg)))
    .filter((f) => /\.mdx?$/.test(f) || /\/_project\.ya?ml$/.test(f))
    .map((f) => f.split('/')[0]);
  return [...new Set(ids)].sort();
}

/** Id of a content file keeping `index`/`readme`, so `billing.md` and `billing/index.md` stay distinct. */
export function docId(relativeFile, slug) {
  if (slug) return String(slug).replace(/^\/+|\/+$/g, '');
  const id = relativeFile.replace(/\.[^./]+$/, '').split('/').map(slugSegment).join('/');
  // `a/b/index.md` is served at /a/b/; a project's own `<project>/index.md` keeps its id because it is the team intro.
  return /^[^/]+\/.+\/index$/.test(id) ? id.slice(0, -'/index'.length) : id;
}

/**
 * Routes of the app's own pages (`decisions.astro` -> `decisions`, `rss.xml.ts` -> `rss.xml`); the docs catch-all is skipped
 * and the `[project]` team page reserves one route per project folder.
 */
export function builtInRoutes(appDir, contentDir, sourceProjects = []) {
  const projects = [...new Set([...(contentDir ? projectFolders(contentDir).map(slugSegment) : []), ...sourceProjects])];
  const routes = listFiles(path.join(appDir, 'src/pages'))
    .filter((f) => !f.startsWith('[...'))
    .map(fileToRoute)
    .flatMap((route) => (route === '[project]' ? projects : [route]));
  return [...routes, 'pagefind/[...file]', 'search.json', 'sitemap-index.xml', 'sitemap-[n].xml'];
}

/**
 * Plugin pages with `entrypoint` as an absolute path; a `URL` (e.g. `new URL('./x.astro', import.meta.url)`) is accepted.
 * @param {{ name: string, pages?: { pattern: string, entrypoint: string | URL }[] }[]} plugins
 */
export function pluginPages(plugins) {
  return plugins.flatMap((p) =>
    (p.pages ?? []).map((page) => {
      const raw = page.entrypoint;
      const entrypoint = raw instanceof URL || String(raw).startsWith('file:') ? fileURLToPath(raw) : path.resolve(String(raw));
      if (!fs.existsSync(entrypoint)) {
        throw new Error(`inkan: plugin "${p.name}" page ${page.pattern}: entrypoint not found: ${entrypoint}`);
      }
      return { pattern: page.pattern, entrypoint, plugin: p.name };
    }),
  );
}

const normalize = (route) => route.replace(/^\/+|\/+$/g, '');
const isDynamic = (route) => route.includes('[');
/** Regex of one segment: `[id]` and `post-[id]` match any text in the param's place. */
const segmentRegex = (segment) => new RegExp(`^${segment.split(/\[[^\]]+\]/).map(escapeRegExp).join('.+')}$`);
const sample = (segment) => segment.replace(/\[[^\]]+\]/g, 'x');
const segmentMatches = (a, b) => a === b || segmentRegex(a).test(sample(b)) || segmentRegex(b).test(sample(a));

/** True when both routes can serve the same URL (`[param]` segments match anything, `[...rest]` matches the remainder). */
export function routesCollide(a, b) {
  const as = normalize(a).split('/');
  const bs = normalize(b).split('/');
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i];
    const y = bs[i];
    if (x?.startsWith('[...') || y?.startsWith('[...')) return true;
    if (x === undefined || y === undefined || !segmentMatches(x, y)) return false;
  }
  return true;
}

/**
 * Fails when a user or plugin page would shadow a built-in page, a record, a redirect or another page.
 * A page with parameters only warns, because Astro gives the more specific route priority.
 * @param {{ pages: UserPage[], pluginPages?: { pattern: string, entrypoint: string, plugin: string }[], redirects?: Record<string, string>,
 *   contentDir: string, sources?: { project: string, contentDir: string }[], appDir: string, root: string, warn?: (message: string) => void }} opts
 */
export function assertNoCollisions({ pages, pluginPages = [], redirects = {}, contentDir, sources = [], appDir, root, warn = console.warn }) {
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');
  const show = (route) => `/${normalize(route)}${normalize(route) && !/\.[a-z0-9]+$/i.test(route) ? '/' : ''}`;
  const sourceProjects = sources.map((s) => s.project);
  const reserved = [
    ...builtInRoutes(appDir, contentDir, sourceProjects).map((route) => ({ route, what: `the built-in page ${show(route)}` })),
    ...recordRoutes(contentDir).map(({ route, file }) => ({ route, what: `record ${rel(file)}` })),
    ...sources.flatMap((s) =>
      recordRoutes(s.contentDir).map(({ route, file }) => ({ route: `${s.project}/${route}`, what: `record ${rel(file)} (source ${s.project})` })),
    ),
    ...Object.keys(redirects).map((route) => ({ route, what: `the redirect from ${show(route)}` })),
  ];
  const candidates = [
    ...pluginPages.map((p) => ({ route: p.pattern, name: `plugin "${p.plugin}" page ${p.pattern}` })),
    ...pages.map((p) => ({ route: p.route, name: rel(p.file) })),
  ];
  const errors = [];
  const fixed = new Set(builtInRoutes(appDir).filter((r) => r !== 'pagefind/[...file]'));
  // Folders of nested built-in routes (`badges/[name].svg`, `projects/[project]`) are reserved too.
  const folders = new Set([...fixed].filter((r) => r.includes('/')).map((r) => r.split('/')[0]));
  const files = listFiles(contentDir);
  for (const id of sourceProjects) {
    if (fixed.has(id)) errors.push(`source project ${id} collides with the built-in page ${show(id)}`);
  }
  const slugs = new Map();
  for (const folder of projectFolders(contentDir)) {
    const id = slugSegment(folder);
    if (slugs.has(id)) errors.push(`project folders ${slugs.get(id)}/ and ${folder}/ are both served at ${show(id)}; rename one of them`);
    slugs.set(id, folder);
    if (fixed.has(id)) errors.push(`project folder ${folder} collides with the built-in page ${show(id)}`);
    else if (folders.has(id)) errors.push(`project folder ${folder} collides with the built-in pages under ${show(id)}`);
    const flat = files.find((f) => /\.mdx?$/.test(f) && !f.includes('/') && contentId(f) === id);
    if (flat) errors.push(`${flat} collides with the team page ${show(id)} of the folder ${folder}/ (use ${folder}/index.md for its intro)`);
  }
  candidates.forEach((page, i) => {
    const hits = [
      ...reserved.filter((r) => routesCollide(page.route, r.route)),
      ...candidates.slice(0, i).filter((c) => routesCollide(page.route, c.route)).map((c) => ({ route: c.route, what: c.name })),
    ];
    for (const hit of hits) {
      const message = `${page.name}: route ${show(page.route)} collides with ${hit.what}`;
      if (isDynamic(page.route)) warn(`inkan: ${message}; the more specific route wins.`);
      else errors.push(message);
    }
  });
  if (errors.length) throw new Error(`inkan: page routes must be unique.\n  ${errors.join('\n  ')}`);
}
