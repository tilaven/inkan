import { describe, expect, it } from 'vitest';
import { resolveRedirects, withBase } from '../lib/redirects.mjs';

describe('withBase', () => {
  it('prefixes site-relative targets', () => {
    expect(withBase('/decisions', '/new/')).toBe('/decisions/new/');
    expect(withBase('/decisions/', '/new/')).toBe('/decisions/new/');
    expect(withBase('/', '/new/')).toBe('/new/');
    expect(withBase('', '/new/')).toBe('/new/');
  });

  it('leaves external and protocol-relative URLs alone', () => {
    expect(withBase('/decisions', 'https://example.com/x')).toBe('https://example.com/x');
    expect(withBase('/decisions', '//example.com/x')).toBe('//example.com/x');
    expect(withBase('/decisions', 'relative/')).toBe('relative/');
  });

  it('resolves a redirects map', () => {
    expect(resolveRedirects({ '/old': '/new/', '/gone': 'https://example.com' }, '/d')).toEqual({ '/old': '/d/new/', '/gone': 'https://example.com' });
  });
});
