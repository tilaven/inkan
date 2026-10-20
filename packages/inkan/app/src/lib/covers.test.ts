import { describe, expect, it } from 'vitest';
import { coverStock, coverSvg, PRINT_PALETTE, standaloneCoverSvg } from './covers';
import { motifNames } from './motif-registry';

const input = { id: 'sre/adr/0001-define-slos', ink: 'c', motif: 'rings' } as const;

describe('coverSvg', () => {
  it('is deterministic', () => {
    expect(coverSvg(input)).toBe(coverSvg(input));
  });
  it('differs between ids', () => {
    expect(coverSvg(input)).not.toBe(coverSvg({ ...input, id: 'sre/adr/0002-other' }));
  });
  it('uses ink tokens, never ink hex values', () => {
    const svg = coverSvg(input);
    expect(svg).toContain('var(--inkan-ink-c)');
    expect(svg).toContain('var(--inkan-ink-m)');
    for (const hex of ['#00AEEF', '#FF2D8F', '#FFE000', '#00B35A', '#7B4DFF', '#FF6B1A', '#F4F6FA']) {
      expect(svg.toUpperCase()).not.toContain(hex);
    }
  });
  it('renders every motif as a single well-formed svg', () => {
    for (const motif of motifNames()) {
      const svg = coverSvg({ ...input, motif });
      expect(svg.startsWith('<svg class="cv cv--')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg.match(/<svg/g)).toHaveLength(1);
    }
  });
  it('bakes a treatment into retired records only', () => {
    expect(coverSvg({ ...input, status: 'rejected' })).toContain('color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/>');
    expect(coverSvg({ ...input, status: 'accepted' })).not.toContain('filterUnits');
    expect(coverSvg({ ...input, status: 'custom' })).not.toContain('filterUnits');
  });
  it('honours the requested size', () => {
    expect(coverSvg(input, { width: 440, height: 680 })).toContain('viewBox="0 0 440 680"');
  });
});

const ids = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
const refs = (svg: string) => [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);

describe('cover ids', () => {
  it('resolve every url(#…) reference within the cover', () => {
    for (const motif of motifNames()) {
      const svg = coverSvg({ ...input, motif });
      const defined = new Set(ids(svg));
      expect(defined.size).toBe(ids(svg).length);
      for (const ref of refs(svg)) expect(defined.has(ref)).toBe(true);
    }
  });
  it('do not collide between different records', () => {
    const a = new Set(ids(coverSvg(input)));
    for (const id of ids(coverSvg({ ...input, id: 'sre/adr/0002-other' }))) expect(a.has(id)).toBe(false);
  });
  it('do not collide between two renders of the same record', () => {
    const a = new Set(ids(coverSvg(input, { instance: 0 })));
    for (const id of ids(coverSvg(input, { instance: 1 }))) expect(a.has(id)).toBe(false);
  });
});

describe('coverStock', () => {
  it('is one of the three stocks and stable', () => {
    const stock = coverStock('x');
    expect(['paper', 'flood', 'black']).toContain(stock);
    expect(coverStock('x')).toBe(stock);
  });
});

describe('standaloneCoverSvg', () => {
  it('resolves the ink roles to colours, so it renders without the page CSS', () => {
    const svg = standaloneCoverSvg(input);
    expect(svg).not.toContain('var(--');
    expect(svg).toContain('<style>');
    expect(svg.replace(/<style>.*<\/style>/, '')).toBe(coverSvg(input).replace(/ style="--cv-ink:[^"]*"/, ''));
  });
  it('uses the theme inks', () => {
    expect(standaloneCoverSvg(input)).toContain(PRINT_PALETTE.light.inks.c);
    expect(standaloneCoverSvg(input, { theme: 'dark' })).toContain(PRINT_PALETTE.dark.inks.c);
  });
});
