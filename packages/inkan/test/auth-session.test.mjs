import { describe, expect, it, vi } from 'vitest';
import { isAllowed } from '../lib/auth/allow.mjs';
import { emailVerified } from '../lib/auth/providers.mjs';
import { cacheControl, safeRedirect } from '../lib/auth/server.mjs';
import { seal, unseal } from '../lib/auth/session.mjs';

const secret = 'a'.repeat(32);

describe('seal / unseal', () => {
  it('round-trips data in an opaque url-safe token', () => {
    const data = { sub: '1', name: 'Annika Lindqvist-Okafor' };
    const token = seal(data, secret, 60);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain(data.name);
    expect(token).not.toContain(Buffer.from(JSON.stringify(data)).toString('base64url').slice(0, 16));
    expect(unseal(token, secret)).toEqual(data);
  });

  it('rejects tampering, other secrets and garbage', () => {
    const token = seal({ sub: '1' }, secret, 60);
    const flipped = token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21);
    expect(unseal(flipped, secret)).toBeNull();
    expect(unseal(token, 'b'.repeat(32))).toBeNull();
    expect(unseal('', secret)).toBeNull();
    expect(unseal('not a token!', secret)).toBeNull();
    expect(unseal(undefined, secret)).toBeNull();
    expect(unseal(token.slice(0, 10), secret)).toBeNull();
  });

  it('expires', () => {
    const token = seal({ sub: '1' }, secret, 60);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 61_000);
      expect(unseal(token, secret)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('needs a long secret', () => {
    expect(() => seal({}, 'short', 60)).toThrow(/at least 32 characters/);
    expect(() => unseal('x', 'short')).toThrow(/at least 32 characters/);
  });
});

describe('isAllowed', () => {
  const user = { email: 'Ann@Example.com', emailVerified: true, groups: ['Admins'] };

  it('lets everyone in without lists', () => {
    expect(isAllowed(user, undefined)).toBe(true);
    expect(isAllowed(user, {})).toBe(true);
    expect(isAllowed(user, { emails: [] })).toBe(true);
  });

  it('matches emails, domains and groups case-insensitively', () => {
    expect(isAllowed(user, { emails: ['ann@example.com'] })).toBe(true);
    expect(isAllowed(user, { emails: ['bob@example.com'] })).toBe(false);
    expect(isAllowed(user, { domains: ['EXAMPLE.com'] })).toBe(true);
    expect(isAllowed(user, { domains: ['example.org'] })).toBe(false);
    expect(isAllowed(user, { groups: ['admins'] })).toBe(true);
    expect(isAllowed(user, { groups: ['ops'], domains: ['example.com'] })).toBe(true);
    expect(isAllowed({ ...user, groups: [] }, { groups: ['admins'] })).toBe(false);
  });

  it('ignores unverified emails for email rules', () => {
    const unverified = { ...user, emailVerified: false };
    expect(isAllowed(unverified, { emails: ['ann@example.com'] })).toBe(false);
    expect(isAllowed(unverified, { domains: ['example.com'] })).toBe(false);
    expect(isAllowed(unverified, { groups: ['admins'] })).toBe(true);
    const unknown = { email: 'ann@example.com', groups: [] };
    expect(isAllowed(unknown, { emails: ['ann@example.com'] })).toBe(false);
    expect(isAllowed(unknown, { domains: ['example.com'] })).toBe(false);
    expect(isAllowed(unknown, { emails: ['ann@example.com'] }, { trustEmail: true })).toBe(true);
    expect(isAllowed(unknown, { domains: ['example.com'] }, { trustEmail: true })).toBe(true);
    expect(isAllowed(unverified, { emails: ['ann@example.com'] }, { trustEmail: true })).toBe(false);
  });
});

describe('safeRedirect', () => {
  it('keeps same-site paths under base', () => {
    expect(safeRedirect('/adr/1/?x=1', '/')).toBe('/adr/1/?x=1');
    expect(safeRedirect('/docs/adr/1/', '/docs/')).toBe('/docs/adr/1/');
    expect(safeRedirect('/docs', '/docs/')).toBe('/docs');
  });

  it('falls back to base for anything else', () => {
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'adr/1/', '', null, undefined, '/a\r\nb', '/%5Cevil.com'.replace('%5C', '\\')]) {
      expect(safeRedirect(bad, '/')).toBe('/');
    }
    expect(safeRedirect('/other/', '/docs/')).toBe('/docs/');
    expect(safeRedirect('/docs-x/', '/docs/')).toBe('/docs/');
  });
});

describe('cacheControl', () => {
  it('marks hashed assets immutable and everything else no-cache', () => {
    expect(cacheControl('/_astro/app.abc123.js')).toMatch(/immutable/);
    expect(cacheControl('/pagefind/index/en_abc.pf_index')).toMatch(/immutable/);
    expect(cacheControl('/pagefind/fragment/en_abc.pf_fragment')).toMatch(/immutable/);
    expect(cacheControl('/pagefind/en_abc.pf_meta')).toMatch(/immutable/);
    expect(cacheControl('/pagefind/pagefind.js')).toBe('no-cache');
    expect(cacheControl('/pagefind/pagefind-entry.json')).toBe('no-cache');
    expect(cacheControl('/adr/1/')).toBe('no-cache');
    expect(cacheControl('/adr/1/', { signedIn: true })).toBe('private, no-cache');
  });
});

describe('emailVerified', () => {
  it('reads email_verified, and xms_edov from Entra only', () => {
    expect(emailVerified({ type: 'openid' }, { email_verified: true })).toBe(true);
    expect(emailVerified({ type: 'openid' }, { email_verified: false })).toBe(false);
    expect(emailVerified({ type: 'openid' }, { email_verified: 'true' })).toBeUndefined();
    expect(emailVerified({ type: 'openid' }, { xms_edov: true })).toBeUndefined();
    expect(emailVerified({ type: 'entra' }, { xms_edov: true })).toBe(true);
    expect(emailVerified({ type: 'entra' }, { xms_edov: false })).toBe(false);
    expect(emailVerified({ type: 'entra' }, { email_verified: false, xms_edov: true })).toBe(false);
    expect(emailVerified({ type: 'entra' }, {})).toBeUndefined();
  });
});
