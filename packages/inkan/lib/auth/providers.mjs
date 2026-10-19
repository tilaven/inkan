/**
 * Sign-in providers: OpenID Connect (authorization code + PKCE, confidential client) for openid, auth0, entra
 * and gitlab, plain OAuth 2.0 for GitHub. Every provider yields the same profile shape.
 */
import * as client from 'openid-client';

/** @typedef {{ sub: string, name: string, email: string | null, emailVerified: boolean | undefined, picture: string | null, groups: string[] }} Profile */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const discoveries = new Map();

/** Plain http is only tolerated towards a provider on this machine (local Keycloak, Dex, tests). */
export function insecureAllowed(url) {
  const u = new URL(url);
  return u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname);
}

const execute = (url) => (insecureAllowed(url) ? [client.allowInsecureRequests] : []);

const text = (v) => (typeof v === 'string' && v ? v : null);
const list = (v) => (Array.isArray(v) ? v.filter((g) => typeof g === 'string') : typeof v === 'string' && v ? [v] : []);

/** `a.b.c` reaches into nested claims (`realm_access.roles`). */
function claim(source, name) {
  return name.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), source);
}

/**
 * Whether the provider vouched for the address: the standard `email_verified` claim, or for Entra ID the optional
 * `xms_edov` claim (the e-mail's domain is verified for the tenant), which is what it emits instead. Undefined when
 * the provider said nothing.
 */
export function emailVerified(auth, claims) {
  if (typeof claims.email_verified === 'boolean') return claims.email_verified;
  if (auth.type === 'entra' && typeof claims.xms_edov === 'boolean') return claims.xms_edov;
  return undefined;
}

function discover(auth, clientId, clientSecret) {
  const key = `${auth.issuer}\n${clientId}`;
  if (!discoveries.has(key)) {
    const p = client.discovery(new URL(auth.issuer), clientId, clientSecret, undefined, { execute: execute(auth.issuer) });
    p.catch(() => discoveries.delete(key));
    discoveries.set(key, p);
  }
  return discoveries.get(key);
}

function oidcProvider(config, auth) {
  return {
    start({ redirectUri }) {
      const codeVerifier = client.randomPKCECodeVerifier();
      const state = client.randomState();
      const nonce = client.randomNonce();
      return client.calculatePKCECodeChallenge(codeVerifier).then((code_challenge) => ({
        codeVerifier,
        state,
        nonce,
        url: client
          .buildAuthorizationUrl(config, { redirect_uri: redirectUri, scope: auth.scopes.join(' '), code_challenge, code_challenge_method: 'S256', state, nonce })
          .href,
      }));
    },
    /** @returns {Promise<Profile>} */
    async finish(currentUrl, { codeVerifier, state, nonce }) {
      const tokens = await client.authorizationCodeGrant(config, currentUrl, { pkceCodeVerifier: codeVerifier, expectedState: state, expectedNonce: nonce, idTokenExpected: true });
      /** @type {Record<string, any>} */
      const claims = tokens.claims() ?? {};
      /** @type {Record<string, any>} */
      let info = {};
      if (config.serverMetadata().userinfo_endpoint) {
        info = await client.fetchUserInfo(config, tokens.access_token, String(claims.sub));
      }
      const merged = { ...claims, ...info };
      return {
        sub: String(merged.sub),
        name: text(merged.name) ?? text(merged.preferred_username) ?? text(merged.email) ?? String(merged.sub),
        email: text(merged.email),
        emailVerified: emailVerified(auth, merged),
        picture: text(merged.picture),
        groups: list(claim(info, auth.groupsClaim) ?? claim(claims, auth.groupsClaim)),
      };
    },
  };
}

function githubProvider(config, auth) {
  const api = auth.url === 'https://github.com' ? 'https://api.github.com' : `${auth.url}/api/v3`;
  const get = async (accessToken, route) => {
    const res = await client.fetchProtectedResource(config, accessToken, new URL(api + route), 'GET', undefined, new Headers({ accept: 'application/vnd.github+json' }));
    if (!res.ok) throw new Error(`GitHub ${route} failed with ${res.status}`);
    return res.json();
  };
  return {
    start({ redirectUri }) {
      const codeVerifier = client.randomPKCECodeVerifier();
      const state = client.randomState();
      return client.calculatePKCECodeChallenge(codeVerifier).then((code_challenge) => ({
        codeVerifier,
        state,
        nonce: null,
        url: client.buildAuthorizationUrl(config, { redirect_uri: redirectUri, scope: auth.scopes.join(' '), code_challenge, code_challenge_method: 'S256', state }).href,
      }));
    },
    /** @returns {Promise<Profile>} */
    async finish(currentUrl, { codeVerifier, state }) {
      const tokens = await client.authorizationCodeGrant(config, currentUrl, { pkceCodeVerifier: codeVerifier, expectedState: state });
      const token = tokens.access_token;
      const user = await get(token, '/user');
      /** @type {Array<{ email: string, primary: boolean, verified: boolean }>} */
      const emails = await get(token, '/user/emails').catch(() => []);
      const verified = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      const groups = auth.allow?.groups?.length ? (await get(token, '/user/orgs')).map((o) => String(o.login).toLowerCase()) : [];
      return {
        sub: String(user.id),
        name: text(user.name) ?? text(user.login) ?? String(user.id),
        email: verified?.email ?? text(user.email),
        emailVerified: !!verified,
        picture: text(user.avatar_url),
        groups,
      };
    },
  };
}

/**
 * @param {ReturnType<import('./config.mjs').resolveAuthentication> & {}} auth Resolved `authentication` option
 * @param {{ clientId: string, clientSecret: string }} credentials
 * @returns {Promise<{ start: (o: { redirectUri: string }) => Promise<{ url: string, codeVerifier: string, state: string, nonce: string | null }>, finish: (currentUrl: URL, flow: { codeVerifier: string, state: string, nonce: string | null }) => Promise<Profile> }>}
 */
export async function createProvider(auth, { clientId, clientSecret }) {
  if (auth.type === 'github') {
    const config = new client.Configuration(
      { issuer: auth.url, authorization_endpoint: `${auth.url}/login/oauth/authorize`, token_endpoint: `${auth.url}/login/oauth/access_token` },
      clientId,
      clientSecret,
    );
    if (insecureAllowed(auth.url)) client.allowInsecureRequests(config);
    return githubProvider(config, auth);
  }
  return oidcProvider(await discover(auth, clientId, clientSecret), auth);
}
