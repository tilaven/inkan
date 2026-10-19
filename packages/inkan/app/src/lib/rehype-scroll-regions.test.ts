import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { describe, expect, it } from 'vitest';
import rehypeScrollRegions from './rehype-scroll-regions.mjs';

type Options = Parameters<typeof rehypeScrollRegions>[0];
const run = (html: string, title?: string, options?: Options) => {
  const tree = fromHtml(html, { fragment: true });
  (rehypeScrollRegions(options) as (t: unknown, f: unknown) => void)(tree, { data: { astro: { frontmatter: { title } } } });
  return toHtml(tree);
};

describe('rehypeScrollRegions', () => {
  it('wraps each table and labels it uniquely', () => {
    const out = run('<p>a</p><table><tr><td>1</td></tr></table><table><tr><td>2</td></tr></table>');
    expect(out).toBe(
      '<p>a</p>' +
        '<div class="tblw" data-scroll-label="Table 1"><table><tbody><tr><td>1</td></tr></tbody></table></div>' +
        '<div class="tblw" data-scroll-label="Table 2"><table><tbody><tr><td>2</td></tr></tbody></table></div>',
    );
  });

  it('labels display math in place', () => {
    const out = run('<span class="katex-display"><span class="katex">x</span></span><p>t</p>');
    expect(out).toBe('<span class="katex-display" data-scroll-label="Equation 1"><span class="katex">x</span></span><p>t</p>');
  });

  it('names regions after the record so several records on one page stay distinct', () => {
    const out = run('<table><tr><td>1</td></tr></table><span class="katex-display">x</span>', 'Use Kafka');
    expect(out).toContain('data-scroll-label="Table 1 in Use Kafka"');
    expect(out).toContain('data-scroll-label="Equation 1 in Use Kafka"');
  });

  it('takes the label templates from the dictionary', () => {
    const out = run('<table><tr><td>1</td></tr></table>', 'Kafka', { table: 'Tabela {n}', inRecord: '{label} w rekordzie {title}' });
    expect(out).toContain('data-scroll-label="Tabela 1 w rekordzie Kafka"');
  });

  it('leaves inline math and nested content alone', () => {
    const html = '<p><span class="katex">x</span></p><ul><li>no table</li></ul>';
    expect(run(html)).toBe(html);
  });
});
