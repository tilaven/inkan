import { describe, expect, it } from 'vitest';
import { Canvas } from './canvas';
import { BUILTIN_MOTIFS } from './motifs';
import { INFRA_KEYWORDS, INFRA_MOTIFS } from './motifs-infra';
import { rng } from './rng';

const names = Object.keys(INFRA_MOTIFS);
const ids = [
  'sre/adr/0001-define-slos',
  'sre/adr/0002-error-budgets',
  'payments/rfc/0001-async',
  'mobile/adr/0004-flags',
];

const draw = (motif: string, record: string, project: string, w = 220, h = 340) => {
  const c = new Canvas(w, h, 'cx-');
  INFRA_MOTIFS[motif](c, rng(`art:${record}`), rng(`house:${project}`));
  return `<defs>${c.defs.join('')}</defs>${c.parts.join('')}`;
};

describe('infra motifs', () => {
  it('cover the ten infrastructure symbols with short lowercase names', () => {
    for (const name of ['shield', 'key', 'mesh', 'cloud', 'pipeline', 'gear', 'rack', 'queue', 'lens', 'terminal']) {
      expect(names).toContain(name);
    }
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(BUILTIN_MOTIFS).not.toHaveProperty(name);
    }
  });

  it.each(names)('%s is deterministic', (motif) => {
    expect(draw(motif, ids[0], 'alpha')).toBe(draw(motif, ids[0], 'alpha'));
  });

  it.each(names)('%s varies by record and by project', (motif) => {
    const base = draw(motif, ids[0], 'alpha');
    expect(draw(motif, ids[1], 'alpha')).not.toBe(base);
    const houses = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'].map((p) => draw(motif, ids[0], p)));
    expect(houses.size).toBeGreaterThan(1);
  });

  it.each(names)('%s uses ink classes only, never colours', (motif) => {
    const svg = draw(motif, ids[0], 'alpha');
    const body = svg.replace(/<defs>.*<\/defs>/, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/(fill|stroke)="(?!url\(|none)/);
    expect(svg).not.toMatch(/<text/);
    for (const cls of svg.matchAll(/class="([^"]+)"/g)) {
      for (const token of cls[1].split(' ')) expect(['a', 'b', 'k', 'p', 'n', 'x', 'sa', 'sk', 'mul']).toContain(token);
    }
  });

  it.each(names)('%s only creates ids through the canvas', (motif) => {
    const svg = draw(motif, ids[0], 'alpha');
    for (const id of svg.matchAll(/ id="([^"]+)"/g)) expect(id[1]).toMatch(/^cx-[0-9a-z]+$/);
    for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) expect(svg).toContain(` id="${ref[1]}"`);
  });

  it.each(names)('%s draws at other sizes', (motif) => {
    const small = draw(motif, ids[0], 'alpha', 120, 120);
    const big = draw(motif, ids[0], 'alpha', 440, 680);
    expect(small.length).toBeGreaterThan(200);
    expect(big).not.toBe(small);
    expect(big).not.toContain('NaN');
    expect(small).not.toContain('NaN');
  });

  it('keep a cover around 6 KB on average', () => {
    let total = 0;
    let count = 0;
    for (const motif of names) {
      for (const id of ids) {
        for (const project of ['alpha', 'beta']) {
          total += draw(motif, id, project).length;
          count++;
        }
      }
    }
    expect(total / count).toBeLessThan(6 * 1024);
  });
});

describe('infra keywords', () => {
  const known = new Set([...names, ...Object.keys(BUILTIN_MOTIFS)]);

  it('name a motif from this file or the built-in set', () => {
    for (const key of Object.keys(INFRA_KEYWORDS)) expect(known).toContain(key);
    for (const name of names) expect(INFRA_KEYWORDS).toHaveProperty(name);
  });

  it('are lowercase single words, several per motif, never shared between motifs', () => {
    const seen = new Map<string, string>();
    for (const [motif, words] of Object.entries(INFRA_KEYWORDS)) {
      expect(words.length).toBeGreaterThanOrEqual(3);
      for (const word of words) {
        expect(word).toMatch(/^[a-z0-9]+$/);
        expect(seen.get(word), `"${word}" listed for ${seen.get(word)} and ${motif}`).toBeUndefined();
        seen.set(word, motif);
      }
    }
  });
});
