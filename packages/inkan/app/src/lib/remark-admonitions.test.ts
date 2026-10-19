import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkAdmonitions, { remarkContainerDirectives, remarkRestoreDirectives } from './remark-admonitions.mjs';

function html(markdown: string) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkContainerDirectives)
      .use(remarkAdmonitions)
      .use(remarkRestoreDirectives)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  ).replace(/\n/g, '');
}

const callout = (cls: string, title: string, body: string) =>
  `<div class="${cls}" dir="auto" role="note"><p class="markdown-alert-title" dir="auto">${title}</p>${body}</div>`;

describe('remark-admonitions', () => {
  it('renders GitHub alerts', () => {
    expect(html('> [!WARNING]\n> Rotate the keys first.')).toBe(
      callout('markdown-alert markdown-alert-warning', 'Warning', '<p>Rotate the keys first.</p>'),
    );
  });

  it('renders GitLab alerts with a custom title', () => {
    expect(html('> [!note] Read *this*\n> Body\n>\n> More')).toBe(
      callout('markdown-alert markdown-alert-note', 'Read <em>this</em>', '<p>Body</p><p>More</p>'),
    );
  });

  it('keeps a body that starts after a hard break', () => {
    expect(html('> [!TIP]  \n> Body')).toBe(callout('markdown-alert markdown-alert-tip', 'Tip', '<p>Body</p>'));
  });

  it('leaves plain and unknown blockquotes alone', () => {
    expect(html('> [!NOPE]\n> x')).toBe('<blockquote><p>[!NOPE]x</p></blockquote>');
    expect(html('> quote')).toBe('<blockquote><p>quote</p></blockquote>');
    expect(html('> [!constructor]\n> x')).toBe('<blockquote><p>[!constructor]x</p></blockquote>');
  });

  it('renders Zudoku directives with a title attribute', () => {
    expect(html(':::danger{title="Do not"}\nDrop the **table**.\n:::')).toBe(
      callout('markdown-alert markdown-alert-danger', 'Do not', '<p>Drop the <strong>table</strong>.</p>'),
    );
  });

  it('renders bracket labels, extra classes and themed types', () => {
    expect(html(':::tip[Use `npx`]\nok\n:::')).toBe(callout('markdown-alert markdown-alert-tip', 'Use <code>npx</code>', '<p>ok</p>'));
    expect(html(':::rocket{.wide}\nok\n:::')).toBe(
      callout('markdown-alert markdown-alert-rocket markdown-alert-tip wide', 'Launch', '<p>ok</p>'),
    );
  });

  it('nests directives and alerts', () => {
    expect(html('::::info\n:::warning\nin\n:::\n> [!CAUTION]\n> x\n::::')).toBe(
      callout(
        'markdown-alert markdown-alert-info',
        'Info',
        callout('markdown-alert markdown-alert-warning', 'Warning', '<p>in</p>') +
          callout('markdown-alert markdown-alert-caution', 'Caution', '<p>x</p>'),
      ),
    );
  });

  it('leaves prose with colons alone', () => {
    expect(html('See note:important{x} and a:b at 10:30.')).toBe('<p>See note:important{x} and a:b at 10:30.</p>');
    expect(html('Line one\n::two\nline three')).toBe('<p>Line one::twoline three</p>');
    expect(html('mailto:foo@bar.com')).toBe('<p>mailto:<a href="mailto:foo@bar.com">foo@bar.com</a></p>');
  });

  it('keeps the fences of unknown directives as text', () => {
    expect(html(':::toString\nx\n:::')).toBe('<p>:::toString</p><p>x</p><p>:::</p>');
    expect(html(':::details[Open]{x=1}\n**hi**\n:::')).toBe('<p>:::details[Open]{x=1}</p><p><strong>hi</strong></p><p>:::</p>');
  });
});
