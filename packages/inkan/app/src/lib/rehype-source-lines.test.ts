import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import rehypeSourceLines from './rehype-source-lines.mjs';

const block = (tagName: string, start: number, end: number) => ({
  type: 'element',
  tagName,
  properties: {},
  children: [],
  position: { start: { line: start, column: 1 }, end: { line: end, column: 1 } },
});

const run = (value: string, children: unknown[], file?: string) => {
  const tree = { type: 'root', children };
  (rehypeSourceLines() as (t: unknown, f: unknown) => void)(tree, { value, path: file });
  return tree.children as { properties: Record<string, unknown> }[];
};

describe('rehypeSourceLines', () => {
  it('adds the front matter to body lines', () => {
    const [h, p] = run('---\ntitle: X\nstatus: draft\n---\n## Context\nText\nmore\n', [block('h2', 1, 1), block('p', 2, 3)]);
    expect(h.properties).toMatchObject({ dataLine: 5, dataLineEnd: 5 });
    expect(p.properties).toMatchObject({ dataLine: 6, dataLineEnd: 7 });
  });

  it('keeps body lines without front matter and skips text nodes', () => {
    const [p, text] = run('Text\n', [block('p', 1, 1), { type: 'text', value: '\n' }]);
    expect(p.properties).toMatchObject({ dataLine: 1, dataLineEnd: 1 });
    expect(text).not.toHaveProperty('properties');
  });

  it('reads the front matter from the file, so a body opening with a rule is not mistaken for it', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-lines-')), 'r.md');
    fs.writeFileSync(file, '---\ntitle: X\n---\n---\n\nText\n\n---\n');
    const [hr, p] = run('---\n\nText\n\n---\n', [block('hr', 1, 1), block('p', 3, 3)], file);
    expect(hr.properties).toMatchObject({ dataLine: 4, dataLineEnd: 4 });
    expect(p.properties).toMatchObject({ dataLine: 6, dataLineEnd: 6 });
  });
});
