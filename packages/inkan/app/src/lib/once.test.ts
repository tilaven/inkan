import { describe, expect, it, vi } from 'vitest';
import { once, relativeInside } from './once';

describe('once', () => {
  it('computes a null result only once', () => {
    const fn = vi.fn(() => null);
    const get = once(fn);
    expect(get()).toBeNull();
    expect(get()).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('relativeInside', () => {
  it('returns undefined for paths outside the root', () => {
    expect(relativeInside('/repo', '/repo/decisions/a.md')).toBe('decisions/a.md');
    expect(relativeInside('/repo/hub', '/repo/other/a.md')).toBeUndefined();
    expect(relativeInside('/repo/hub', '/repo/hub-two/a.md')).toBeUndefined();
    expect(relativeInside('/repo/hub', '/elsewhere/a.md')).toBeUndefined();
  });
});
