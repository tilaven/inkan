import { describe, expect, it } from 'vitest';
import { Canvas } from './canvas';
import { BUILTIN_MOTIFS } from './motifs';
import { coverSvg } from './covers';
import { rng } from './rng';

const names = Object.keys(BUILTIN_MOTIFS);
const ids = ['sre/adr/0001-define-slos', 'sre/adr/0002-error-budgets', 'payments/rfc/0001-async', 'mobile/adr/0004-flags'];

const draw = (motif: string, record: string, project: string, w = 220, h = 340) => {
  const c = new Canvas(w, h, 'cx-');
  BUILTIN_MOTIFS[motif](c, rng(`art:${record}`), rng(`house:${project}`));
  return `<defs>${c.defs.join('')}</defs>${c.parts.join('')}`;
};

describe('built-in motifs', () => {
  it('offer at least 14 short lowercase names', () => {
    expect(names.length).toBeGreaterThanOrEqual(14);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
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
    for (const cls of svg.matchAll(/class="([^"]+)"/g)) {
      for (const token of cls[1].split(' ')) expect(['a', 'b', 'k', 'p', 'n', 'x', 'sa', 'sk', 'mul']).toContain(token);
    }
  });

  it.each(names)('%s only creates ids through the canvas', (motif) => {
    for (const id of draw(motif, ids[0], 'alpha').matchAll(/ id="([^"]+)"/g)) expect(id[1]).toMatch(/^cx-[0-9a-z]+$/);
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
        total += coverSvg({ id, ink: 'c', motif, project: 'alpha' }).length;
        count++;
      }
    }
    expect(total / count).toBeLessThan(6 * 1024);
  });
});
