import http from 'node:http';
import { createHandler } from '../lib/auth/server.mjs';
import { tmpSite } from './helpers.mjs';

export const SECRET = 's'.repeat(32);

const page = (title) => `<!doctype html><html><head><title>${title}</title></head><body>${title}${' '.repeat(300)}</body></html>`;

/** Public and full builds of a tiny site: `/sre/` only exists in the protected variant. */
export function buildSite({ base = '/', manifest = null } = {}) {
  const common = {
    'index.html': page('Home'),
    '404.html': page('Not found'),
    'about.html': page('About'),
    'adr/0001/index.html': page('ADR 1'),
    'adr/0001/index.md': '# ADR 1',
    '_auth/denied/index.html': page('Denied'),
    '_astro/app.abc123.js': `console.log(1);${' '.repeat(300)}`,
    'pagefind/pagefind.js': 'x'.repeat(300),
    'pagefind/pagefind-entry.json': '{}',
    'pagefind/index/en_1.pf_index': 'idx',
    'pagefind/en_1.pf_meta': 'meta',
    'img/logo.png': 'png',
    'decisions.json': '[]',
    '.hidden': 'secret',
  };
  const files = {};
  for (const [f, c] of Object.entries(common)) files[`dist/${f}`] = c;
  for (const [f, c] of Object.entries(common)) files[`dist-protected/${f}`] = c;
  files['dist-protected/sre/index.html'] = page('SRE');
  files['dist-protected/sre/adr/0002/index.html'] = page('SRE ADR 2');
  files['dist-protected/index.html'] = page('Home (full)');
  files['dist-protected/404.html'] = page('Not found (full)');
  if (manifest) files['dist-protected/_server.json'] = JSON.stringify({ base, ...manifest });
  return tmpSite(files);
}

/** Starts the handler on a random port; `get(path, { headers })` follows nothing. */
export async function startServer({ root, manifest = null, env = {}, base, log = () => {} }) {
  const handler = await createHandler({ publicDir: `${root}/dist`, protectedDir: `${root}/dist-protected`, manifest, env, base, log });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const origin = `http://127.0.0.1:${port}`;
  return {
    origin,
    get: (path, init = {}) => fetch(origin + path, { redirect: 'manual', ...init }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** `name=value` pairs from Set-Cookie headers. */
export function cookiesOf(res) {
  return res.headers.getSetCookie().map((c) => c.split(';')[0]);
}

export const cookieHeader = (res) => cookiesOf(res).filter((c) => !c.endsWith('=')).join('; ');
