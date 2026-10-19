import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateConfig } from '../lib/config.mjs';
import { TAU, DEG, n, circle } from '../lib/covers.mjs';
import { defineMotif } from '../lib/index.mjs';
import { pluginMotifs } from '../lib/motifs.mjs';
import { tmpSite } from './helpers.mjs';

const errorOf = (user) => {
  try {
    validateConfig(user, '/site/inkan.config.ts');
  } catch (e) {
    return e.message;
  }
  throw new Error('expected validation to fail');
};

describe('plugin motifs config', () => {
  it('accepts names with a path or URL module', () => {
    const config = validateConfig({ plugins: [{ name: 'p', motifs: { stamp: '/x/stamp.ts', 'two-tone': new URL('file:///x/t.ts') } }] });
    expect(Object.keys(config.plugins[0].motifs)).toEqual(['stamp', 'two-tone']);
  });
  it('rejects bad names and empty modules', () => {
    expect(errorOf({ plugins: [{ name: 'p', motifs: { Stamp: '/x.ts' } }] })).toContain('plugins.0.motifs.Stamp: motif names use lowercase letters, digits and dashes and start with a letter');
    expect(errorOf({ plugins: [{ name: 'p', motifs: { '9x': '/x.ts' } }] })).toContain('plugins.0.motifs.9x: motif names');
    expect(errorOf({ plugins: [{ name: 'p', motifs: { stamp: '' } }] })).toContain('plugins.0.motifs.stamp: ');
    expect(errorOf({ plugins: [{ name: 'p', motifs: ['stamp'] }] })).toContain('plugins.0.motifs: expected record');
  });
});

describe('pluginMotifs', () => {
  it('resolves paths and file URLs to absolute files, later plugin winning', () => {
    const root = tmpSite({ 'a.ts': '', 'b.ts': '', 'c.ts': '' });
    const motifs = pluginMotifs([
      { name: 'one', motifs: { stamp: path.join(root, 'a.ts'), rings: pathToFileURL(path.join(root, 'b.ts')) } },
      { name: 'two', motifs: { stamp: pathToFileURL(path.join(root, 'c.ts')).href } },
      { name: 'three' },
    ]);
    expect(motifs).toEqual([
      { name: 'stamp', entrypoint: path.join(root, 'c.ts'), plugin: 'two' },
      { name: 'rings', entrypoint: path.join(root, 'b.ts'), plugin: 'one' },
    ]);
  });
  it('fails for a module that does not exist', () => {
    expect(() => pluginMotifs([{ name: 'p', motifs: { stamp: '/nowhere/stamp.ts' } }])).toThrow('plugin "p" motif "stamp": module not found: /nowhere/stamp.ts');
  });
});

describe('authoring helpers', () => {
  it('defineMotif returns the function unchanged', () => {
    const fn = () => {};
    expect(defineMotif(fn)).toBe(fn);
  });
  it('defineMotif keeps keywords and rejects malformed ones', () => {
    expect(defineMotif(() => {}, { keywords: ['legal'] }).keywords).toEqual(['legal']);
    expect(() => defineMotif(() => {}, { keywords: 'legal' })).toThrow(/array of strings/);
  });
  it('exports the drawing helpers', () => {
    expect(TAU).toBeCloseTo(Math.PI * 2);
    expect(DEG).toBeCloseTo(57.2958, 3);
    expect(n(-0.04)).toBe('0');
    expect(n(1.26)).toBe('1.3');
    expect(circle(1, 2.55, 3, ' class="k"')).toBe('<circle cx="1" cy="2.6" r="3" class="k"/>');
  });
});
