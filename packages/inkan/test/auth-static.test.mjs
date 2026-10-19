import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveAuthentication } from '../lib/auth/config.mjs';
import { createHandler, sameOrigin } from '../lib/auth/server.mjs';
import { seal } from '../lib/auth/session.mjs';
import { buildSite, SECRET, startServer } from './auth-helpers.mjs';

describe('static serving', () => {
  let server;
  beforeAll(async () => {
    server = await startServer({ root: buildSite() });
  });
  afterAll(() => server.close());

  it('serves folders through index.html with no-cache', async () => {
    const res = await server.get('/adr/0001/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    expect(await res.text()).toContain('ADR 1');
    expect((await server.get('/')).status).toBe(200);
  });

  it('redirects slash-less paths to the trailing-slash form, keeping the query', async () => {
    const res = await server.get('/adr/0001?x=1');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/adr/0001/?x=1');
    expect((await server.get('/missing')).headers.get('location')).toBe('/missing/');
    expect((await server.get('/about.html')).status).toBe(200);
    expect((await server.get('/.//evilhost')).headers.get('location')).toBe('/evilhost/');
    expect((await server.get('//evilhost')).headers.get('location')).toBe('/evilhost/');
    expect((await server.get('/adr/0001/index.md')).headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  });

  it('answers misses with the 404 page', async () => {
    const res = await server.get('/missing/');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('Not found');
    expect((await server.get('/404.html')).status).toBe(404);
    expect((await server.get('/adr/')).status).toBe(404);
  });

  it('never leaves the site folder or shows dotfiles and the manifest', async () => {
    expect((await server.get('/../package.json')).status).toBe(404);
    expect((await server.get('/adr/%2e%2e/%2e%2e/package.json')).status).toBe(404);
    expect((await server.get('/.hidden')).status).toBe(404);
    expect((await server.get('/_server.json')).status).toBe(404);
    expect((await server.get('/a%00b.html')).status).toBe(400);
    expect((await server.get('/%zz.html')).status).toBe(400);
  });

  it('sets long-lived caching only for hashed assets', async () => {
    const immutable = 'public, max-age=31536000, immutable';
    expect((await server.get('/_astro/app.abc123.js')).headers.get('cache-control')).toBe(immutable);
    expect((await server.get('/pagefind/index/en_1.pf_index')).headers.get('cache-control')).toBe(immutable);
    expect((await server.get('/pagefind/en_1.pf_meta')).headers.get('cache-control')).toBe(immutable);
    expect((await server.get('/pagefind/pagefind.js')).headers.get('cache-control')).toBe('no-cache');
    expect((await server.get('/pagefind/pagefind-entry.json')).headers.get('cache-control')).toBe('no-cache');
    expect((await server.get('/_astro/app.abc123.js')).headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect((await server.get('/img/logo.png')).headers.get('content-type')).toBe('image/png');
    expect((await server.get('/decisions.json')).headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('gzips text when asked and the file is big enough', async () => {
    const res = await server.get('/_astro/app.abc123.js', { headers: { 'accept-encoding': 'gzip, br' } });
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(await res.text()).toContain('console.log(1)'); // fetch inflates it
    const small = await server.get('/decisions.json', { headers: { 'accept-encoding': 'gzip' } });
    expect(small.headers.get('content-encoding')).toBeNull();
    const plain = await server.get('/_astro/app.abc123.js', { headers: { 'accept-encoding': 'identity' } });
    expect(plain.headers.get('content-encoding')).toBeNull();
    expect(plain.headers.get('content-length')).toBe(String(Buffer.byteLength(await plain.text())));
    const png = await server.get('/img/logo.png', { headers: { 'accept-encoding': 'gzip' } });
    expect(png.headers.get('content-encoding')).toBeNull();
  });

  it('supports HEAD, conditional requests and refuses other methods', async () => {
    const head = await server.get('/adr/0001/', { method: 'HEAD', headers: { 'accept-encoding': 'identity' } });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect(Number(head.headers.get('content-length'))).toBeGreaterThan(0);
    const again = await server.get('/adr/0001/', { headers: { 'if-none-match': head.headers.get('etag') } });
    expect(again.status).toBe(304);
    const post = await server.get('/adr/0001/', { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe('static serving under a base path', () => {
  let server;
  beforeAll(async () => {
    server = await startServer({ root: buildSite(), base: '/docs' });
  });
  afterAll(() => server.close());

  it('strips the base and refuses paths outside it', async () => {
    expect((await server.get('/docs/adr/0001/')).status).toBe(200);
    expect((await server.get('/docs/')).status).toBe(200);
    expect((await server.get('/docs')).headers.get('location')).toBe('/docs/');
    expect((await server.get('/adr/0001/')).status).toBe(404);
    expect((await server.get('/docsx/')).status).toBe(404);
  });
});

const auth = resolveAuthentication({ type: 'github', url: 'http://127.0.0.1:9', clientId: 'app' });
const manifest = { url: 'https://decisions.example.com', authentication: auth, protectedRoutes: ['/adr/*'] };
const env = { INKAN_AUTH_SECRET: SECRET, INKAN_AUTH_CLIENT_SECRET: 'shh' };

describe('gating', () => {
  let server;
  const session = `inkan_session=${seal({ sub: '1', name: 'Ann', email: 'ann@example.com', picture: null }, SECRET, 60)}`;
  beforeAll(async () => {
    server = await startServer({ root: buildSite({ manifest }), manifest, env });
  });
  afterAll(() => server.close());

  it('serves public files to anonymous visitors with Vary: Cookie', async () => {
    const res = await server.get('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('vary')).toBe('Cookie, Accept-Encoding');
    expect(await res.text()).toContain('Home');
    expect(await (await server.get('/about.html')).text()).not.toContain('full');
    expect((await server.get('/_auth/denied/?reason=forbidden')).status).toBe(200);
  });

  it('sends anonymous visitors of protected paths to sign in', async () => {
    const byRoute = await server.get('/adr/0001/?v=2');
    expect(byRoute.status).toBe(302);
    expect(byRoute.headers.get('location')).toBe(`/_auth/login/?redirect=${encodeURIComponent('/adr/0001/?v=2')}`);
    expect(byRoute.headers.get('vary')).toBe('Cookie');
    const byFile = await server.get('/sre/');
    expect(byFile.headers.get('location')).toBe(`/_auth/login/?redirect=${encodeURIComponent('/sre/')}`);
    expect((await server.get('/sre/adr/0002/')).status).toBe(302);
    const miss = await server.get('/nowhere/');
    expect(miss.status).toBe(404);
    expect(await miss.text()).not.toContain('full');
  });

  it('serves the full variant to signed-in users', async () => {
    const home = await server.get('/', { headers: { cookie: session } });
    expect(await home.text()).toContain('Home (full)');
    expect(home.headers.get('cache-control')).toBe('private, no-cache');
    const sre = await server.get('/sre/', { headers: { cookie: session } });
    expect(sre.status).toBe(200);
    expect(await sre.text()).toContain('SRE');
    expect((await server.get('/_astro/app.abc123.js', { headers: { cookie: session } })).headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect((await server.get('/pagefind/en_1.pf_meta', { headers: { cookie: session } })).headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    const miss = await server.get('/nowhere/', { headers: { cookie: session } });
    expect(miss.status).toBe(404);
    expect(await miss.text()).toContain('Not found (full)');
    expect((await server.get('/_server.json', { headers: { cookie: session } })).status).toBe(404);
  });

  it('ignores forged or expired sessions', async () => {
    const forged = `inkan_session=${seal({ sub: '1', name: 'Eve' }, 'x'.repeat(32), 60)}`;
    expect((await server.get('/sre/', { headers: { cookie: forged } })).status).toBe(302);
    expect((await server.get('/sre/', { headers: { cookie: 'inkan_session=garbage' } })).status).toBe(302);
    // A sign-in flow cookie is sealed for another purpose and never opens as a session.
    const login = await server.get('/_auth/login/');
    const flow = login.headers.getSetCookie().find((c) => c.startsWith('inkan_auth_flow='))?.split(';')[0].slice('inkan_auth_flow='.length);
    expect(flow).toBeTruthy();
    expect((await server.get('/sre/', { headers: { cookie: `inkan_session=${flow}` } })).status).toBe(302);
    const noSub = `inkan_session=${seal({ name: 'Eve' }, SECRET, 60)}`;
    expect((await server.get('/sre/', { headers: { cookie: noSub } })).status).toBe(302);
  });

  it('answers /_auth/me/ and /_auth/logout/', async () => {
    const anon = await server.get('/_auth/me/');
    expect(anon.status).toBe(401);
    expect(anon.headers.get('cache-control')).toBe('no-store');
    expect(await anon.json()).toEqual({});
    const me = await server.get('/_auth/me/', { headers: { cookie: session } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ name: 'Ann', email: 'ann@example.com', picture: null });
    const out = await server.get('/_auth/logout/', { method: 'POST', headers: { cookie: session, origin: server.origin } });
    expect(out.status).toBe(303);
    expect(out.headers.get('location')).toBe('/');
    expect(out.headers.getSetCookie()[0]).toMatch(/^inkan_session=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/);
    // Signing out takes the site's own form: not a link, not a form on another site.
    const byLink = await server.get('/_auth/logout/', { headers: { cookie: session } });
    expect(byLink.status).toBe(405);
    expect(byLink.headers.get('allow')).toBe('POST');
    expect(byLink.headers.getSetCookie()).toEqual([]);
    // A proxy may rewrite Host on the way in; the configured public address counts as the site too.
    const viaProxy = await server.get('/_auth/logout/', { method: 'POST', headers: { cookie: session, origin: 'https://decisions.example.com' } });
    expect(viaProxy.status).toBe(303);
    for (const origin of ['https://evil.example', 'https://decisions.example.com.evil.example', 'http://decisions.example.com', 'null', undefined]) {
      const crossSite = await server.get('/_auth/logout/', { method: 'POST', headers: { cookie: session, ...(origin && { origin }) } });
      expect(crossSite.status, `origin ${origin}`).toBe(403);
      expect(crossSite.headers.getSetCookie()).toEqual([]);
    }
    expect((await server.get('/_auth/other/')).status).toBe(404);
    expect((await server.get('/_auth/me/', { method: 'POST' })).status).toBe(405);
  });

  it('rejects a callback without a flow', async () => {
    const res = await server.get('/_auth/callback/?code=x&state=y');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/_auth/denied/?reason=error');
  });
});

describe('startup checks', () => {
  const root = buildSite({ manifest });
  const dirs = { publicDir: `${root}/dist`, protectedDir: `${root}/dist-protected`, manifest };

  it('fails fast without secrets', async () => {
    await expect(createHandler({ ...dirs, env: {} })).rejects.toThrow(/INKAN_AUTH_SECRET/);
    await expect(createHandler({ ...dirs, env: { INKAN_AUTH_SECRET: 'short' } })).rejects.toThrow(/at least 32/);
    await expect(createHandler({ ...dirs, env: { INKAN_AUTH_SECRET: SECRET } })).rejects.toThrow(/INKAN_AUTH_CLIENT_SECRET/);
    await expect(createHandler({ ...dirs, manifest: { ...manifest, url: '' }, env })).rejects.toThrow(/INKAN_PUBLIC_URL/);
  });
});

describe('sameOrigin', () => {
  it('accepts the request host or the public address, nothing else', () => {
    expect(sameOrigin('http://127.0.0.1:8080', '127.0.0.1:8080')).toBe(true);
    expect(sameOrigin('https://Decisions.Example.com', 'decisions.example.com', 'https://decisions.example.com')).toBe(true);
    expect(sameOrigin('https://decisions.example.com', '10.0.0.5:8080', 'https://decisions.example.com/')).toBe(true);
    expect(sameOrigin('https://decisions.example.com', '10.0.0.5:8080', 'http://decisions.example.com')).toBe(false);
    expect(sameOrigin('https://decisions.example.com', undefined, undefined)).toBe(false);
    expect(sameOrigin('null', 'decisions.example.com', 'https://decisions.example.com')).toBe(false);
    expect(sameOrigin(undefined, 'decisions.example.com', 'https://decisions.example.com')).toBe(false);
    expect(sameOrigin('https://decisions.example.com', 'decisions.example.com', 'not a url')).toBe(true);
  });
});
