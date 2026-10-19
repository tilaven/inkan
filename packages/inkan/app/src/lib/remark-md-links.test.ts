import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkMdLinks from './remark-md-links.mjs';

const contentDir = '/repo/decisions';

const sources = [{ project: 'checkout', contentDir: '/repo/node_modules/.inkan/sources/checkout/docs/decisions' }];

function run(markdown: string, filePath: string, base?: string) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkMdLinks, { contentDir, base, sources })
      .use(remarkStringify)
      .processSync({ value: markdown, path: filePath }),
  ).trim();
}

describe('remark-md-links', () => {
  const from = `${contentDir}/payments/adr/0001-first.md`;

  it('rewrites relative markdown links to site URLs and keeps the hash', () => {
    expect(run('[x](../rfc/0002-Second.md#proposal)', from)).toBe('[x](/payments/rfc/0002-second/#proposal)');
  });

  it('rewrites link definitions', () => {
    expect(run('[x][a]\n\n[a]: ./0003-third.mdx', from)).toContain('[a]: /payments/adr/0003-third/');
  });

  it('prefixes the base path', () => {
    expect(run('[x](./0003-third.md)', from, '/docs')).toBe('[x](/docs/payments/adr/0003-third/)');
  });

  it('maps index files to their folder', () => {
    expect(run('[x](../index.md)', from)).toBe('[x](/payments/)');
  });

  it('prefixes links inside a source with its project', () => {
    const fromSource = `${sources[0].contentDir}/adr/0001-first.md`;
    expect(run('[x](../rfc/0002-second.md#a)', fromSource)).toBe('[x](/checkout/rfc/0002-second/#a)');
    expect(run('[x](../index.md)', fromSource)).toBe('[x](/checkout/)');
    expect(run('[x](../../README.md)', fromSource)).toBe('[x](../../README.md)');
  });

  it('leaves external, absolute, anchor and non-markdown links alone', () => {
    const md = '[a](https://example.com/x.md) [b](/abs/x.md) [c](#top) [d](./img.png)';
    expect(run(md, from)).toBe('[a](https://example.com/x.md) [b](/abs/x.md) [c](#top) [d](./img.png)');
  });

  it('leaves links that escape the content directory alone', () => {
    expect(run('[x](../../../README.md)', from)).toBe('[x](../../../README.md)');
  });

  it('ignores files outside the content directory', () => {
    expect(run('[x](./a.md)', '/elsewhere/doc.md')).toBe('[x](./a.md)');
  });
});
