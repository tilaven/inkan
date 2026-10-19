import { createHash } from 'node:crypto';
import http from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveAuthentication } from '../lib/auth/config.mjs';
import { unseal } from '../lib/auth/session.mjs';
import { buildSite, cookieHeader, cookiesOf, SECRET, startServer } from './auth-helpers.mjs';

const env = { INKAN_AUTH_SECRET: SECRET, INKAN_AUTH_CLIENT_SECRET: 'client-secret' };
const s256 = (v) => createHash('sha256').update(v).digest('base64url');

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

const readBody = (req) => new Promise((resolve) => {
  let body = '';
  req.on('data', (c) => (body += c)).on('end', () => resolve(new URLSearchParams(body)));
});
const sendJson = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

/** A minimal OpenID provider: discovery, authorize (records the request), token (RS256 id_token) and userinfo. */
async function fakeOidc({ user, groups = ['Admins'], verified = true }) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const state = { authorize: null, tokenRequest: null, userinfoAuth: null };
  let origin = '';
  const server = await listen(async (req, res) => {
    const url = new URL(req.url, origin);
    if (url.pathname === '/.well-known/openid-configuration') {
      return sendJson(res, 200, {
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        userinfo_endpoint: `${origin}/userinfo`,
        jwks_uri: `${origin}/jwks`,
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (url.pathname === '/jwks') return sendJson(res, 200, { keys: [jwk] });
    if (url.pathname === '/authorize') {
      state.authorize = Object.fromEntries(url.searchParams);
      res.writeHead(302, { location: `${state.authorize.redirect_uri}?code=the-code&state=${state.authorize.state}` });
      return res.end();
    }
    if (url.pathname === '/token') {
      const form = await readBody(req);
      state.tokenRequest = Object.fromEntries(form);
      if (form.get('code') !== 'the-code' || form.get('client_secret') !== 'client-secret' || s256(form.get('code_verifier')) !== state.authorize.code_challenge) {
        return sendJson(res, 400, { error: 'invalid_grant' });
      }
      const idToken = await new SignJWT({ nonce: state.authorize.nonce, groups, email: user.email })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(origin)
        .setSubject(user.sub)
        .setAudience(form.get('client_id'))
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      return sendJson(res, 200, { access_token: 'at-1', token_type: 'Bearer', expires_in: 300, id_token: idToken });
    }
    if (url.pathname === '/userinfo') {
      state.userinfoAuth = req.headers.authorization;
      return sendJson(res, 200, verified === null ? user : { ...user, email_verified: verified });
    }
    res.writeHead(404);
    res.end();
  });
  origin = server.origin;
  return { ...server, state };
}

describe('OpenID Connect sign-in', () => {
  const user = { sub: 'u-1', name: 'Ann Example', email: 'ann@example.com', picture: 'https://img.example.com/ann.png' };
  let idp, site, manifest;
  beforeAll(async () => {
    idp = await fakeOidc({ user });
    const authentication = resolveAuthentication({ type: 'openid', issuer: idp.origin, clientId: 'hub', allow: { domains: ['example.com'] } });
    manifest = { url: 'http://decisions.local', authentication, protectedRoutes: ['/sre/*'] };
    site = await startServer({ root: buildSite({ manifest }), manifest, env });
  });
  afterAll(async () => {
    await site.close();
    await idp.close();
  });

  it('signs a user in and back out', async () => {
    const login = await site.get('/_auth/login/?redirect=%2Fsre%2F%3Fq%3D1');
    expect(login.status).toBe(302);
    const target = new URL(login.headers.get('location'));
    expect(target.origin).toBe(idp.origin);
    expect(target.searchParams.get('client_id')).toBe('hub');
    expect(target.searchParams.get('redirect_uri')).toBe('http://decisions.local/_auth/callback/');
    expect(target.searchParams.get('code_challenge_method')).toBe('S256');
    expect(target.searchParams.get('scope')).toBe('openid email profile');
    const flowCookie = login.headers.getSetCookie()[0];
    expect(flowCookie).toMatch(/^inkan_auth_flow=.+; Path=\/; Max-Age=600; HttpOnly; SameSite=Lax$/);
    const flow = unseal(flowCookie.split(';')[0].slice('inkan_auth_flow='.length), SECRET, 'flow');
    expect(flow.redirect).toBe('/sre/?q=1');
    expect(flow.state).toBe(target.searchParams.get('state'));

    // The browser visits the provider, which sends it back with a code.
    const back = await fetch(target, { redirect: 'manual' });
    const callback = new URL(back.headers.get('location'));
    expect(callback.href.startsWith('http://decisions.local/_auth/callback/?')).toBe(true);
    const done = await site.get(callback.pathname + callback.search, { headers: { cookie: cookieHeader(login) } });
    expect(done.status).toBe(302);
    expect(done.headers.get('location')).toBe('/sre/?q=1');
    expect(idp.state.tokenRequest.redirect_uri).toBe('http://decisions.local/_auth/callback/');
    expect(idp.state.tokenRequest.grant_type).toBe('authorization_code');
    expect(idp.state.userinfoAuth).toBe('Bearer at-1');
    const cookies = cookiesOf(done);
    expect(cookies).toContain('inkan_auth_flow=');
    const sessionCookie = cookies.find((c) => c.startsWith('inkan_session='));
    expect(unseal(sessionCookie.slice('inkan_session='.length), SECRET)).toEqual({ sub: 'u-1', name: 'Ann Example', email: 'ann@example.com', picture: user.picture });
    expect(done.headers.getSetCookie().find((c) => c.startsWith('inkan_session='))).toMatch(/Max-Age=28800; HttpOnly; SameSite=Lax$/);

    const page = await site.get('/sre/', { headers: { cookie: sessionCookie } });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('SRE');
    const me = await site.get('/_auth/me/', { headers: { cookie: sessionCookie } });
    expect(await me.json()).toEqual({ name: 'Ann Example', email: 'ann@example.com', picture: user.picture });

    // A mismatched state or an error from the provider ends on the denied page.
    const wrongState = await site.get(`${callback.pathname}?code=the-code&state=nope`, { headers: { cookie: cookieHeader(login) } });
    expect(wrongState.headers.get('location')).toBe('/_auth/denied/?reason=error');
    const idpError = await site.get(`${callback.pathname}?error=access_denied&state=${flow.state}`, { headers: { cookie: cookieHeader(login) } });
    expect(idpError.headers.get('location')).toBe('/_auth/denied/?reason=error');
  });

  it('refuses users outside the allow list', async () => {
    const other = await fakeOidc({ user: { sub: 'u-2', name: 'Bob', email: 'bob@other.org' } });
    const authentication = resolveAuthentication({ type: 'openid', issuer: other.origin, clientId: 'hub', allow: { emails: ['ann@example.com'], groups: ['ops'] } });
    const m = { url: 'http://decisions.local', authentication, protectedRoutes: [] };
    const s = await startServer({ root: buildSite({ manifest: m }), manifest: m, env });
    try {
      const login = await s.get('/_auth/login/');
      const back = await fetch(login.headers.get('location'), { redirect: 'manual' });
      const callback = new URL(back.headers.get('location'));
      const done = await s.get(callback.pathname + callback.search, { headers: { cookie: cookieHeader(login) } });
      expect(done.headers.get('location')).toBe('/_auth/denied/?reason=forbidden');
      expect(cookiesOf(done).some((c) => c.startsWith('inkan_session=') && c.length > 'inkan_session='.length)).toBe(false);
    } finally {
      await s.close();
      await other.close();
    }
  });

  it('counts an email rule only for an address the provider vouched for', async () => {
    const signIn = async (trustEmail) => {
      const silent = await fakeOidc({ user: { sub: 'u-4', name: 'Di', email: 'di@example.com' }, verified: null });
      const authentication = resolveAuthentication({ type: 'openid', issuer: silent.origin, clientId: 'hub', allow: { domains: ['example.com'] }, ...(trustEmail && { trustEmail }) });
      const m = { url: 'http://decisions.local', authentication, protectedRoutes: [] };
      const s = await startServer({ root: buildSite({ manifest: m }), manifest: m, env });
      try {
        const login = await s.get('/_auth/login/');
        const back = await fetch(login.headers.get('location'), { redirect: 'manual' });
        const callback = new URL(back.headers.get('location'));
        return (await s.get(callback.pathname + callback.search, { headers: { cookie: cookieHeader(login) } })).headers.get('location');
      } finally {
        await s.close();
        await silent.close();
      }
    };
    expect(await signIn(false)).toBe('/_auth/denied/?reason=forbidden');
    expect(await signIn(true)).toBe('/');
  });

  it('lets a group member in', async () => {
    const other = await fakeOidc({ user: { sub: 'u-3', name: 'Cy', email: 'cy@other.org' }, groups: ['OPS'] });
    const authentication = resolveAuthentication({ type: 'openid', issuer: other.origin, clientId: 'hub', allow: { groups: ['ops'] }, redirectToAfterSignIn: '/adr/0001/' });
    const m = { url: 'http://decisions.local', authentication, protectedRoutes: [] };
    const s = await startServer({ root: buildSite({ manifest: m }), manifest: m, env });
    try {
      const login = await s.get('/_auth/login/?redirect=%2Fsre%2F');
      const back = await fetch(login.headers.get('location'), { redirect: 'manual' });
      const callback = new URL(back.headers.get('location'));
      const done = await s.get(callback.pathname + callback.search, { headers: { cookie: cookieHeader(login) } });
      expect(done.headers.get('location')).toBe('/adr/0001/');
      expect(cookiesOf(done).some((c) => c.startsWith('inkan_session=') && c.length > 20)).toBe(true);
    } finally {
      await s.close();
      await other.close();
    }
  });
});

describe('GitHub sign-in', () => {
  let gh, site;
  const seen = { token: null, orgs: 0 };
  beforeAll(async () => {
    gh = await listen(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/login/oauth/authorize') {
        res.writeHead(302, { location: `${url.searchParams.get('redirect_uri')}?code=gh-code&state=${url.searchParams.get('state')}` });
        return res.end();
      }
      if (url.pathname === '/login/oauth/access_token') {
        const form = await readBody(req);
        seen.token = Object.fromEntries(form);
        if (form.get('code') !== 'gh-code' || form.get('client_secret') !== 'client-secret') return sendJson(res, 200, { error: 'bad_verification_code' });
        return sendJson(res, 200, { access_token: 'gho_x', token_type: 'bearer', scope: 'read:user,user:email,read:org' });
      }
      if (req.headers.authorization !== 'Bearer gho_x') return sendJson(res, 401, { message: 'Bad credentials' });
      if (url.pathname === '/api/v3/user') return sendJson(res, 200, { id: 42, login: 'ann', name: 'Ann', email: null, avatar_url: 'https://avatars.example.com/42' });
      if (url.pathname === '/api/v3/user/emails') {
        return sendJson(res, 200, [
          { email: 'old@example.com', primary: false, verified: true },
          { email: 'ann@example.com', primary: true, verified: true },
        ]);
      }
      if (url.pathname === '/api/v3/user/orgs') {
        seen.orgs++;
        return sendJson(res, 200, [{ login: 'Acme' }]);
      }
      res.writeHead(404);
      res.end();
    });
    const authentication = resolveAuthentication({ type: 'github', url: gh.origin, clientId: 'Iv1.x', allow: { groups: ['acme'] } });
    const manifest = { url: 'https://decisions.example.com', authentication, protectedRoutes: [] };
    site = await startServer({ root: buildSite({ manifest }), manifest, env: { ...env, INKAN_PUBLIC_URL: 'https://hub.example.com/' } });
  });
  afterAll(async () => {
    await site.close();
    await gh.close();
  });

  it('runs the OAuth flow and reads the profile from the REST API', async () => {
    const login = await site.get('/_auth/login/');
    const target = new URL(login.headers.get('location'));
    expect(target.href.startsWith(`${gh.origin}/login/oauth/authorize?`)).toBe(true);
    expect(target.searchParams.get('scope')).toBe('read:user user:email read:org');
    expect(target.searchParams.get('redirect_uri')).toBe('https://hub.example.com/_auth/callback/');
    expect(login.headers.getSetCookie()[0]).toMatch(/; Secure$/);
    const back = await fetch(target, { redirect: 'manual' });
    const callback = new URL(back.headers.get('location'));
    const done = await site.get(callback.pathname + callback.search, { headers: { cookie: cookieHeader(login) } });
    expect(done.status).toBe(302);
    expect(done.headers.get('location')).toBe('/');
    expect(seen.token.code_verifier).toBeTruthy();
    expect(seen.orgs).toBe(1);
    const session = cookiesOf(done).find((c) => c.startsWith('inkan_session='));
    expect(unseal(session.slice('inkan_session='.length), SECRET)).toEqual({ sub: '42', name: 'Ann', email: 'ann@example.com', picture: 'https://avatars.example.com/42' });
  });
});
