import { describe, expect, it, vi } from 'vitest';
import type { MotifCanvas, MotifFn } from 'inkan';
import { Canvas } from './canvas';
import { coverSvg } from './covers';
import { getMotif, motifKeywords, motifNames } from './motif-registry';
import { BUILTIN_MOTIFS } from './motifs';

vi.mock('virtual:inkan/motifs', () => ({
  default: {
    stamp: Object.assign((c: MotifCanvas) => c.add(`<rect class="k" width="${c.w}" height="${c.h / 2}"/><!--stamp-->`), {
      keywords: ['Legal', 'data-science'],
    }),
    rings: (c: MotifCanvas) => c.add('<!--replaced-->'),
  } satisfies Record<string, MotifFn>,
}));

describe('motif registry', () => {
  it('lists the built-ins plus the plugin motifs', () => {
    expect(motifNames()).toContain('stamp');
    for (const name of Object.keys(BUILTIN_MOTIFS)) expect(motifNames()).toContain(name);
  });
  it('gives every built-in keyword to one motif only, plurals included', () => {
    const owner = new Map<string, string>();
    for (const [motif, words] of Object.entries(motifKeywords())) {
      if (motif === 'stamp') continue;
      for (const word of words) {
        const stem = word.replace(/s$/, '');
        expect(owner.get(stem) ?? motif, `"${word}" listed for ${owner.get(stem)} and ${motif}`).toBe(motif);
        owner.set(stem, motif);
      }
    }
  });
  it('takes keywords from plugin motifs', () => {
    expect(motifKeywords().stamp).toEqual(['legal', 'data', 'science']);
  });
  it('lets a plugin replace a built-in', () => {
    expect(getMotif('rings')).not.toBe(BUILTIN_MOTIFS.rings);
    expect(getMotif('discs')).toBe(BUILTIN_MOTIFS.discs);
    expect(getMotif('nope')).toBeUndefined();
  });
  it('draws a plugin motif in coverSvg', () => {
    const svg = coverSvg({ id: 'platform/adr/0001-x', ink: 'y', motif: 'stamp' });
    expect(svg).toContain('<!--stamp-->');
    expect(svg).toContain('height="170"');
  });
  it('hands motifs the internal canvas as the public MotifCanvas', () => {
    const canvas: MotifCanvas = new Canvas(10, 20, 't-');
    expect([canvas.w, canvas.h]).toEqual([10, 20]);
  });
});
