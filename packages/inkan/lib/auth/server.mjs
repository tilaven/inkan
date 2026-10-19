/**
 * Production HTTP handler for a built site: static files with the same rules as the starter's nginx.conf,
 * and, when the build carries an `_server.json` manifest, sign-in routes under `<base>_auth/` and
 * gating between the public (`dist/`) and full (`dist-protected/`) variants.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { createGzip } from 'node:zlib';
import { isAllowed } from './allow.mjs';
import { createProvider } from './providers.mjs';
import { routeMatcher } from './routes.mjs';
import { MIN_SECRET_LENGTH, seal, unseal } from './session.mjs';

export const SESSION_COOKIE = 'inkan_session';
export const FLOW_COOKIE = 'inkan_auth_flow';
const FLOW_MAX_AGE = 10 * 60;
const IMMUTABLE = 'public, max-age=31536000, immutable';

const TYPES = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  rss: 'application/rss+xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
  webmanifest: 'application/manifest+json',
  pf_index: 'application/octet-stream',
  pf_fragment: 'application/octet-stream',
  pf_filter: 'application/octet-stream',
  pf_meta: 'application/octet-stream',
};
const GZIP = /^(text\/|application\/(json|javascript|xml|rss\+xml|manifest\+json|wasm)|image\/svg\+xml)/;
const GZIP_MIN = 256;

const contentType = (file) => TYPES[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream';

/** nginx: `/_astro/` and Pagefind's content-hashed chunks never change; everything else is revalidated. */
export function cacheControl(rel, { signedIn = false } = {}) {
  const immutable = rel.startsWith('/_astro/') || /^\/pagefind\/((index|fragment|filter)\/|.*\.pf_meta$)/.test(rel);
  if (signedIn) return immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache';
  return immutable ? IMMUTABLE : 'no-cache';
}

/** Normalises `base` to `/` or `/sub/`. */
export const normalizeBase = (base = '/') => `/${String(base).replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');

/**
 * Only same-site paths under `base` may be redirect targets after sign-in; anything else becomes `base`.
 * @param {unknown} target
 */
export function safeRedirect(target, base = '/') {
  base = normalizeBase(base);
  if (typeof target !== 'string' || !target.startsWith('/') || /^\/[\/\\]/.test(target) || /[\\\0\r\n]/.test(target)) return base;
  let p;
  try {
    p = new URL(target, 'http://localhost');
  } catch {
    return base;
  }
  if (p.origin !== 'http://localhost' || /^\/[\/\\]/.test(p.pathname)) return base;
  const inBase = base === '/' || p.pathname === base.slice(0, -1) || p.pathname.startsWith(base);
  return inBase ? p.pathname + p.search : base;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function cookie(name, value, { base, secure, maxAge }) {
  return `${name}=${value}; Path=${base}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Resolves a request path to a file inside `dir`; `null` when it would leave `dir`, hit a dotfile or the manifest. */
function resolveIn(dir, rel) {
  if (rel.split('/').some((seg) => seg.startsWith('.') || seg === '_server.json')) return null;
  const file = path.resolve(dir, `.${rel}`);
  return file === dir || file.startsWith(dir + path.sep) ? file : null;
}

/** The file to serve for `rel` in `dir` (`index.html` for folders), or `null`. */
function lookup(dir, rel) {
  if (rel === '/404.html') return null;
  const file = resolveIn(dir, rel);
  if (!file) return null;
  for (const candidate of rel.endsWith('/') ? [path.join(file, 'index.html')] : [file, path.join(file, 'index.html')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function send(req, res, status, file, headers) {
  const type = contentType(file);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return plain(res, 404, 'Not found', headers);
  }
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  res.setHeader('Content-Type', type);
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', stat.mtime.toUTCString());
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (status === 200 && req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    return res.end();
  }
  res.statusCode = status;
  const gzip = GZIP.test(type) && stat.size >= GZIP_MIN && /(^|,)\s*gzip\s*(;|,|$)/.test(req.headers['accept-encoding'] ?? '');
  res.setHeader('Vary', [headers.Vary, 'Accept-Encoding'].filter(Boolean).join(', '));
  if (gzip) res.setHeader('Content-Encoding', 'gzip');
  else res.setHeader('Content-Length', stat.size);
  if (req.method === 'HEAD') return res.end();
  const done = () => res.destroy();
  if (gzip) pipeline(fs.createReadStream(file), createGzip(), res, done);
  else pipeline(fs.createReadStream(file), res, done);
}

function plain(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

function redirect(res, location, status = 302, headers = {}) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-cache', 'Content-Length': 0, ...headers });
  res.end();
}

function json(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', ...headers });
  res.end(text);
}

/**
 * @param {object} options
 * @param {string} options.publicDir Built site everybody may see
 * @param {string} [options.protectedDir] Full build for signed-in users (needs `manifest`)
 * @param {object | null} [options.manifest] `dist-protected/_server.json`, or `null` for a plain static server
 * @param {string} [options.base] Base path when there is no manifest
 * @param {Record<string, string | undefined>} [options.env]
 * @param {(line: string) => void} [options.log] Errors, without secrets
 * @returns {Promise<(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void>}
 */
export async function createHandler({ publicDir, protectedDir, manifest = null, base, env = process.env, log = (line) => console.error(line) }) {
  publicDir = path.resolve(publicDir);
  base = normalizeBase(manifest?.base ?? base);
  if (manifest && !protectedDir) throw new Error('protectedDir is needed when a manifest is given');
  const auth = manifest ? await setupAuth(manifest, env, base, log) : null;
  protectedDir = path.resolve(protectedDir ?? publicDir);
  const vary = auth ? { Vary: 'Cookie' } : {};

  const notFound = (req, res, dir, signedIn) => {
    const page = path.join(dir, '404.html');
    const headers = { ...vary, 'Cache-Control': signedIn ? 'private, no-cache' : 'no-cache' };
    return fs.existsSync(page) ? send(req, res, 404, page, headers) : plain(res, 404, 'Not found', headers);
  };
  const serve = (req, res, file, rel, signedIn) => send(req, res, 200, file, { ...vary, 'Cache-Control': cacheControl(rel, { signedIn }) });

  return (req, res) => {
    const raw = req.url ?? '/';
    if (raw.includes('\0') || /%00/i.test(raw)) return plain(res, 400, 'Bad request', vary);
    let url;
    try {
      url = new URL(`http://localhost${raw.startsWith('/') ? '' : '/'}${raw}`);
    } catch {
      return plain(res, 400, 'Bad request', vary);
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return plain(res, 400, 'Bad request', vary);
    }
    if (pathname.includes('\0')) return plain(res, 400, 'Bad request', vary);

    const prefix = base.slice(0, -1);
    if (prefix && pathname !== prefix && !pathname.startsWith(base)) return notFound(req, res, publicDir, false);
    if (!/\./.test(pathname) && !pathname.endsWith('/')) return redirect(res, `${url.pathname.replace(/^\/+/, '/')}/${url.search}`, 301, vary);
    const rel = pathname.slice(prefix.length) || '/';

    if (auth && rel.startsWith('/_auth/') && !rel.startsWith('/_auth/denied/')) return auth.route(req, res, rel, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method not allowed', { ...vary, Allow: 'GET, HEAD' });

    if (!auth) {
      const file = lookup(publicDir, rel);
      return file ? serve(req, res, file, rel, false) : notFound(req, res, publicDir, false);
    }
    if (auth.session(req)) {
      const file = lookup(protectedDir, rel);
      return file ? serve(req, res, file, rel, true) : notFound(req, res, protectedDir, true);
    }
    if (auth.isProtected(pathname)) return auth.login(res, url);
    const file = lookup(publicDir, rel);
    if (file) return serve(req, res, file, rel, false);
    if (lookup(protectedDir, rel)) return auth.login(res, url);
    return notFound(req, res, publicDir, false);
  };
}

/**
 * Whether a request's `Origin` (browsers always send it with a form POST) is the site itself: the host the request
 * was sent to, or the configured public address, for a proxy that rewrites `Host` on the way in.
 * @param {string | undefined} origin the `Origin` header
 * @param {string | undefined} host the `Host` header
 * @param {string} [publicUrl] `INKAN_PUBLIC_URL` or `url` from the config
 */
export function sameOrigin(origin, host, publicUrl) {
  if (typeof origin !== 'string') return false;
  let o;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  if (host && o.host.toLowerCase() === host.toLowerCase()) return true;
  try {
    return !!publicUrl && o.origin === new URL(publicUrl).origin;
  } catch {
    return false;
  }
}

async function setupAuth(manifest, env, base, log) {
  const { authentication } = manifest;
  if (!authentication) throw new Error('_server.json has no "authentication" section; rebuild the site');
  const secret = env.INKAN_AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Set INKAN_AUTH_SECRET to a random string of at least ${MIN_SECRET_LENGTH} characters (sessions are encrypted with it)`);
  }
  const clientSecret = env.INKAN_AUTH_CLIENT_SECRET;
  if (!clientSecret) throw new Error(`Set INKAN_AUTH_CLIENT_SECRET to the client secret of your ${authentication.type} application`);
  const clientId = env.INKAN_AUTH_CLIENT_ID || authentication.clientId;
  const origin = env.INKAN_PUBLIC_URL || manifest.url;
  if (!/^https?:\/\//.test(origin ?? '')) throw new Error('Set INKAN_PUBLIC_URL (or `url` in the config) to the address users open, e.g. https://decisions.example.com');
  const redirectUri = new URL(`${base}_auth/callback/`, origin).href;
  const secure = redirectUri.startsWith('https:');
  const provider = await createProvider({ ...authentication, clientId }, { clientId, clientSecret });
  const isProtected = routeMatcher(manifest.protectedRoutes ?? [], base);
  const vary = { Vary: 'Cookie' };
  const clearFlow = cookie(FLOW_COOKIE, '', { base, secure, maxAge: 0 });
  const denied = (res, reason, extra = []) => redirect(res, `${base}_auth/denied/?reason=${reason}`, 302, { ...vary, 'Set-Cookie': [clearFlow, ...extra] });
  const after = (flow) => safeRedirect(authentication.redirectToAfterSignIn ? base + authentication.redirectToAfterSignIn.replace(/^\/+/, '') : flow?.redirect, base);

  const readSession = (cookies) => {
    const user = unseal(cookies[SESSION_COOKIE], secret);
    return typeof user?.sub === 'string' ? user : null;
  };

  return {
    isProtected,
    session: (req) => readSession(parseCookies(req.headers.cookie)),
    login: (res, url) => redirect(res, `${base}_auth/login/?redirect=${encodeURIComponent(url.pathname + url.search)}`, 302, vary),
    route(req, res, rel, url) {
      if (rel === '/_auth/logout/') {
        if (req.method !== 'POST') return plain(res, 405, 'Method not allowed', { ...vary, Allow: 'POST' });
        // Only the site's own sign-out form may end a session: another site posting here must not sign people out.
        if (!sameOrigin(req.headers.origin, req.headers.host, origin)) return plain(res, 403, 'Forbidden', vary);
        const target = authentication.redirectToAfterSignOut ? base + authentication.redirectToAfterSignOut.replace(/^\/+/, '') : base;
        return redirect(res, target, 303, { ...vary, 'Set-Cookie': cookie(SESSION_COOKIE, '', { base, secure, maxAge: 0 }) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method not allowed', { ...vary, Allow: 'GET, HEAD' });
      const cookies = parseCookies(req.headers.cookie);
      switch (rel) {
        case '/_auth/login/':
          return provider
            .start({ redirectUri })
            .then(({ url: target, ...flow }) => {
              const token = seal({ ...flow, redirect: safeRedirect(url.searchParams.get('redirect'), base) }, secret, FLOW_MAX_AGE, 'flow');
              redirect(res, target, 302, { ...vary, 'Set-Cookie': cookie(FLOW_COOKIE, token, { base, secure, maxAge: FLOW_MAX_AGE }) });
            })
            .catch((e) => {
              log(`inkan serve: sign-in could not start: ${e instanceof Error ? e.message : e}`);
              denied(res, 'error');
            });
        case '/_auth/callback/': {
          const flow = unseal(cookies[FLOW_COOKIE], secret, 'flow');
          if (!flow || url.searchParams.get('state') !== flow.state) {
            log(`inkan serve: sign-in callback without a valid flow cookie or state`);
            return denied(res, 'error');
          }
          const current = new URL(redirectUri);
          current.search = url.search;
          return provider
            .finish(current, flow)
            .then((user) => {
              if (!isAllowed(user, authentication.allow, { trustEmail: authentication.trustEmail === true })) {
                log(`inkan serve: ${user.email ?? user.sub} signed in but is not on the allow list`);
                return denied(res, 'forbidden');
              }
              const session = seal({ sub: user.sub, name: user.name, email: user.email, picture: user.picture }, secret, authentication.maxAge);
              redirect(res, after(flow), 302, { ...vary, 'Set-Cookie': [cookie(SESSION_COOKIE, session, { base, secure, maxAge: authentication.maxAge }), clearFlow] });
            })
            .catch((e) => {
              log(`inkan serve: sign-in failed: ${e instanceof Error ? e.message : e}`);
              denied(res, 'error');
            });
        }
        case '/_auth/me/': {
          const user = readSession(cookies);
          return user ? json(res, 200, { name: user.name, email: user.email, picture: user.picture }, vary) : json(res, 401, {}, vary);
        }
        default:
          return plain(res, 404, 'Not found', vary);
      }
    },
  };
}
