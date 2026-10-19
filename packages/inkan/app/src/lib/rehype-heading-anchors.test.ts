import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { describe, expect, it } from 'vitest';
import rehypeHeadingAnchors from './rehype-heading-anchors.mjs';

const run = (html: string, label?: string) => {
  const tree = fromHtml(html, { fragment: true });
  (rehypeHeadingAnchors(label ? { label } : undefined) as (t: unknown) => void)(tree);
  return toHtml(tree);
};

describe('rehypeHeadingAnchors', () => {
  it('names the heading by its own text and the link by the section', () => {
    expect(run('<h2 id="summary">Summary</h2>')).toBe(
      '<h2 id="summary" aria-labelledby="summary-label"><span id="summary-label">Summary</span>' +
        '<a class="anchor" href="#summary" aria-label="Link to section: Summary" data-pagefind-ignore="">#</a></h2>',
    );
  });

  it('keeps inline markup inside the heading text', () => {
    const out = run('<h3 id="use-kafka">Use <code>kafka</code></h3>', 'Link do sekcji: {heading}');
    expect(out).toContain('<span id="use-kafka-label">Use <code>kafka</code></span>');
    expect(out).toContain('aria-label="Link do sekcji: Use kafka"');
  });

  it('leaves headings without an id and other elements alone', () => {
    const html = '<h2>Plain</h2><p id="p">text</p>';
    expect(run(html)).toBe(html);
  });
});
