import fs from 'node:fs';
import path from 'node:path';
import { t } from './i18n/index.mjs';

/** Statuses the export includes: `export.statuses` from the config, else every status marked `current`. */
export function exportStatuses(config) {
  const chosen = config.export?.statuses ?? [];
  return chosen.length ? chosen : Object.keys(config.statuses).filter((s) => config.statuses[s].current);
}

/** Title on the cover page: `export.title`, else "<site title>: decisions" */
export const exportTitle = (config, fallback = t('export.title', { title: config.title })) =>
  config.export?.title || fallback;

/** Comments the export page wraps its document in, so the CLI can lift it out of the site shell. */
export const MARK_START = '<!--inkan:export-->';
export const MARK_END = '<!--/inkan:export-->';

const MIME = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};
export const mimeType = (file) => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

/** Local path behind a site URL (`/docs/_astro/x.css` with base `/docs` -> `<dist>/_astro/x.css`), or null when it is not one. */
export function sitePath(href, { dist, base = '/' }) {
  if (!href || /^(data:|https?:|\/\/|#)/i.test(href)) return null;
  let p = href.split(/[?#]/)[0];
  const prefix = base.replace(/\/$/, '');
  if (prefix && (p === prefix || p.startsWith(prefix + '/'))) p = p.slice(prefix.length) || '/';
  if (!p.startsWith('/')) return null;
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  const file = path.resolve(dist, '.' + path.posix.normalize(p));
  const root = path.resolve(dist);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

/** Existing file behind a site URL, or null. */
export function assetFile(href, opts) {
  const file = sitePath(href, opts);
  return file && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

const dataUri = (file) => `data:${mimeType(file)};base64,${fs.readFileSync(file).toString('base64')}`;

/** Fonts and images a stylesheet refers to become data URIs; `woff`/`ttf` fallbacks of an inlined `woff2` are dropped. */
export function inlineCssUrls(css, opts) {
  return css
    .replace(/,\s*url\((['"]?)[^)'"]+\.(?:woff|ttf|eot)\1\)\s*format\((['"])[^'"]*\2\)/g, '')
    .replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, ref) => {
      const file = assetFile(ref, opts);
      return file && /\.(woff2|svg|png|jpe?g|gif|webp)$/i.test(file) ? `url(${dataUri(file)})` : m;
    });
}

/** Everything between the export marks of a built page, or null when the page is not an export page. */
export function extractDocument(html) {
  const start = html.indexOf(MARK_START);
  const end = html.indexOf(MARK_END);
  return start === -1 || end === -1 ? null : html.slice(start + MARK_START.length, end).trim();
}

const attr = (tag, name) => new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag)?.slice(1).find((v) => v !== undefined);

/**
 * Turns the built export page into one file: stylesheets, fonts and images inlined, scripts dropped,
 * site links made absolute, the Day theme fixed. `html` may be the page as built or as a browser serialized it
 * (with Mermaid diagrams rendered).
 */
export function standaloneHtml(html, { dist, base = '/', siteUrl = '' }) {
  const opts = { dist, base };
  const body = extractDocument(html);
  if (body === null) throw new Error('The built site has no export page (dist/export/index.html lacks the export marks).');
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
  const title = /<title>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? 'Decisions';
  // Stylesheets can sit in the body too (Expressive Code links its CSS next to the first code block).
  const styles = [];
  const seen = new Set();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel=["']?stylesheet\b/i.test(tag)) continue;
    const file = assetFile(attr(tag, 'href'), opts);
    if (file && !seen.has(file)) styles.push(inlineCssUrls(fs.readFileSync(file, 'utf8'), opts));
    if (file) seen.add(file);
  }
  for (const [, css] of head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) styles.push(inlineCssUrls(css, opts));

  const absolute = (href) => {
    if (!siteUrl || !href.startsWith('/') || href.startsWith('//')) return href;
    try {
      return new URL(href, siteUrl).href;
    } catch {
      return href;
    }
  };
  const content = body
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const file = assetFile(attr(tag, 'src'), opts);
      return file ? tag.replace(/\ssrc=(["']).*?\1/, ` src="${dataUri(file)}"`).replace(/\ssrcset=(["']).*?\1/, '') : tag;
    })
    .replace(/<a\b[^>]*\shref=(["'])([^"']*)\1/gi, (tag, q, href) => tag.replace(`href=${q}${href}${q}`, `href=${q}${absolute(href)}${q}`));

  return [
    '<!doctype html>',
    `<html lang="${/<html\b[^>]*\slang="([^"]+)"/i.exec(html)?.[1] ?? 'en'}" data-theme="light">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<meta name="generator" content="inkan">',
    `<style>${styles.join('\n')}</style>`,
    '</head>',
    '<body class="xp-file"><div class="shell shell--plain"><div class="main"><main class="view" id="content">',
    content,
    '</main></div></div></body>',
    '</html>',
    '',
  ].join('\n');
}

/** Number of pages in a PDF (counts page objects; Chromium writes them uncompressed). */
export function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}
