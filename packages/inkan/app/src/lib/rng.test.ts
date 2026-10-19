import { describe, expect, it } from 'vitest';
import { hash, rng } from './rng';

describe('hash', () => {
  it('is stable for the same text', () => {
    expect(hash('sre/adr/0001')).toBe(hash('sre/adr/0001'));
  });
  it('differs for different text', () => {
    expect(hash('sre/adr/0001')).not.toBe(hash('sre/adr/0002'));
  });
});

describe('rng', () => {
  it('yields the same sequence for the same seed', () => {
    const a = rng('art:x');
    const b = rng('art:x');
    expect(Array.from({ length: 8 }, a)).toEqual(Array.from({ length: 8 }, b));
  });
  it('yields numbers in [0, 1)', () => {
    const r = rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(rng('a')()).not.toBe(rng('b')());
  });
});
