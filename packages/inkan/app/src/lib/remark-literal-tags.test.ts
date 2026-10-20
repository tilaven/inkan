import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkLiteralTags from './remark-literal-tags.mjs';

function run(markdown: string) {
  return String(
    unified().use(remarkParse).use(remarkGfm).use(remarkLiteralTags).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeStringify).processSync(markdown),
  ).trim();
}

describe('remark-literal-tags', () => {
  it('keeps placeholders inside a paragraph', () => {
    expect(run('Named "Table 1 in <record title>".')).toBe('<p>Named "Table 1 in &#x3C;record title>".</p>');
  });

  it('keeps a placeholder on its own line', () => {
    expect(run('<project>')).toBe('<p>&#x3C;project></p>');
  });

  it('keeps placeholders in table cells and list items', () => {
    const html = run('| Id |\n| --- |\n| <project>/<type> |\n\n- <owner>');
    expect(html).toContain('<td>&#x3C;project>/&#x3C;type></td>');
    expect(html).toContain('<li>&#x3C;owner></li>');
  });

  it('keeps the source position for line anchors', () => {
    const tree = unified().use(remarkParse).use(remarkLiteralTags).runSync(unified().use(remarkParse).parse('Intro\n\n<project>'));
    expect(tree.children[1]).toMatchObject({ type: 'paragraph', position: { start: { line: 3 } } });
  });

  it('leaves real HTML and custom elements alone', () => {
    expect(run('Press <kbd>K</kbd> or <my-widget></my-widget>.')).toBe('<p>Press <kbd>K</kbd> or <my-widget></my-widget>.</p>');
    expect(run('<svg>\n\n<feGaussianBlur stdDeviation="2"/>\n\n</svg>')).not.toContain('&#x3C;feGaussianBlur');
    expect(run('<details>\n<summary>More</summary>\n\nBody\n\n</details>')).toContain('<summary>More</summary>');
  });
});
