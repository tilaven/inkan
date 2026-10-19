/**
 * What only signed-in users may see: projects with `protected: true` in `_project.yml` and paths matching
 * `protectedRoutes`. Shared by the app (data layer, lock marks), the build (which files leave the public site) and `check`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadProjects } from '../records.mjs';
import { slugSegment } from '../pages.mjs';
import { routeMatcher } from './routes.mjs';
import { escapeRegExp } from '../regex.mjs';

/** Ids of the projects whose `_project.yml` says `protected: true`. */
export function protectedProjects(config) {
  return [...loadProjects(config).values()].filter((p) => p.data?.protected === true).map((p) => p.id);
}

/**
 * `(pathname) => boolean` telling whether a page is protected. `pathname` may include `base`, a trailing slash
 * or the `.md` suffix; the first segment is taken as the project folder, as named (`Secret Ops`) or as its slug
 * (`secret-ops`, the project id). Case does not matter: page URLs are lowercased.
 * @param {{ protectedRoutes?: string[], base?: string }} config
 * @param {Iterable<string>} projects protected project ids, from `protectedProjects`
 */
export function protectedMatcher(config, projects) {
  const matches = routeMatcher(config.protectedRoutes ?? [], config.base || '/');
  const ids = new Set([...projects].map(slugSegment));
  const prefix = (config.base || '/').replace(/\/+$/, '');
  return (pathname) => {
    if (matches(pathname)) return true;
    let p = pathname;
    try {
      p = decodeURI(p);
    } catch {}
    if (prefix && (p === prefix || p.startsWith(`${prefix}/`))) p = p.slice(prefix.length);
    const first = p.replace(/^\/+/, '').split('/')[0] ?? '';
    return ids.has(slugSegment(first.replace(/\.mdx?$/i, '')));
  };
}

/** Projects that opted into protection while `authentication` is not set, so nobody could sign in to see them. */
export const unprotectableProjects = (config) => (config.authentication ? [] : protectedProjects(config));

export function unprotectableMessage(ids) {
  if (!ids.length) return null;
  const list = ids.map((id) => `"${id}"`).join(', ');
  return `project${ids.length === 1 ? '' : 's'} ${list} ${ids.length === 1 ? 'is' : 'are'} protected (protected: true in _project.yml) but \`authentication\` is not set in inkan.config, so nobody could sign in to see ${ids.length === 1 ? 'it' : 'them'}`;
}

/** Route of a built file (`sre/adr/0001-x/index.html` -> `/sre/adr/0001-x/`, `handbook.md` -> `/handbook.md`). */
export function builtRoute(relativeFile) {
  const f = relativeFile.split('\\').join('/');
  if (f === 'index.html' || f.endsWith('/index.html')) return `/${f.slice(0, -'index.html'.length)}`;
  return `/${f.endsWith('.html') ? f.slice(0, -'.html'.length) : f}`;
}

/** Files of the public build that stay whatever `protectedRoutes` says. */
export const keepInPublic = (relativeFile) => relativeFile === '404.html' || relativeFile.startsWith('_auth/');

/** Files that reference nothing: everything else is scanned as text, so an unknown type is never a reason to drop an asset. */
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|woff2?|ttf|otf|eot|pdf|wasm|mp[34]|webm|ogg|zip|gz|br)$/i;

/**
 * Files under `_astro/` of a build that no other file of it names, directly or through another asset (a font from a
 * stylesheet, a chunk from a script). Every file there carries a content hash in its name, so a name appearing in a
 * text file is a reference, however it is written: `src`, `srcset`, `url()`, an import or a preload list.
 * @param {string} outDir
 * @returns {string[]} absolute paths
 */
export function orphanedAssets(outDir) {
  const assetsDir = path.join(outDir, '_astro');
  if (!fs.existsSync(assetsDir)) return [];
  const files = (dir) =>
    fs
      .readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => path.join(e.parentPath, e.name));
  const assets = new Map(files(assetsDir).map((file) => [path.basename(file), file]));
  if (!assets.size) return [];
  const names = new RegExp([...assets.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|'), 'g');
  const referenced = new Set();
  const queue = files(outDir).filter((file) => !file.startsWith(assetsDir + path.sep));
  while (queue.length) {
    const file = /** @type {string} */ (queue.pop());
    if (BINARY.test(file)) continue;
    for (const [name] of fs.readFileSync(file, 'latin1').matchAll(names)) {
      if (referenced.has(name)) continue;
      referenced.add(name);
      queue.push(/** @type {string} */ (assets.get(name)));
    }
  }
  return [...assets].filter(([name]) => !referenced.has(name)).map(([, file]) => file);
}

/** A literal path as a glob pattern: metacharacters in a folder name must not widen or break the match. */
export const escapeGlob = (s) => s.replace(/[\\()[\]{}*?!]/g, '\\$&');
