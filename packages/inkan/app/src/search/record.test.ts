import { describe, expect, it } from 'vitest';
import { plainText, recordId, toHit } from './record';

describe('toHit', () => {
  it('maps a full record', () => {
    expect(
      toHit({ url: '/sre/adr/1/', title: 'Use SLOs', description: 'Why', project: 'sre', type: 'adr', status: 'accepted', ref: 'SRE-ADR-0001' }),
    ).toEqual({ url: '/sre/adr/1/', title: 'Use SLOs', excerpt: 'Why', project: 'sre', type: 'adr', status: 'accepted', ref: 'SRE-ADR-0001' });
  });

  it('falls back to href, the url as title and the start of the content', () => {
    const content = 'word '.repeat(80);
    const hit = toHit({ href: '/a/', content });
    expect(hit.url).toBe('/a/');
    expect(hit.title).toBe('/a/');
    expect(hit.excerpt?.length).toBeLessThanOrEqual(161);
    expect(hit.excerpt?.endsWith('…')).toBe(true);
    expect(hit.marked).toBeUndefined();
  });

  it('uses the highlighted excerpt and marks it', () => {
    expect(toHit({ url: '/a/', title: 'A', description: 'plain' }, 'a <mark>b</mark>')).toMatchObject({
      excerpt: 'a <mark>b</mark>',
      marked: true,
    });
  });

  it('omits the excerpt when nothing is stored', () => {
    expect(toHit({ url: '/a/', title: 'A' })).toEqual({ url: '/a/', title: 'A' });
  });
});

describe('recordId', () => {
  it('only emits characters Meilisearch accepts', () => {
    expect(recordId('sre/adr/0001-use slos.md')).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not collide', () => {
    const ids = ['a/b', 'a-b', 'a__b', 'a_b', 'a b'].map(recordId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('plainText', () => {
  it('drops front matter, fences and tags but keeps code text', () => {
    const md = '---\ntitle: x\n---\n# Title\n\n```ts\nconst a = 1;\n```\n\n<div class="x">hello</div>';
    expect(plainText(md)).toBe('Title const a = 1; hello');
  });

  it('keeps link and image text, strips emphasis and list markers', () => {
    expect(plainText('See [the **docs**](https://x.y) and ![logo](a.png).\n\n- one\n- [x] two\n> quote')).toBe(
      'See the docs and logo. one two quote',
    );
  });

  it('drops Mermaid diagrams and table rules', () => {
    const md = 'Intro\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n| Option | Verdict |\n|---|:---:|\n| Postgres | Yes |';
    expect(plainText(md)).toBe('Intro Option Verdict Postgres Yes');
  });

  it('keeps comparisons in prose and decodes entities', () => {
    expect(plainText('p95 < 200ms and p99 > 500ms, R&amp;D &#x2192; ops')).toBe('p95 < 200ms and p99 > 500ms, R&D → ops');
  });
});
