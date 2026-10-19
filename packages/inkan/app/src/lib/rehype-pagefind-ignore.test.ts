import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { describe, expect, it } from 'vitest';
import rehypePagefindIgnore from './rehype-pagefind-ignore.mjs';

const plugin = rehypePagefindIgnore() as (t: unknown) => void;

describe('rehypePagefindIgnore', () => {
  it('marks a parsed Mermaid block', () => {
    const tree = fromHtml('<pre class="mermaid">flowchart LR</pre><pre>code</pre>', { fragment: true });
    plugin(tree);
    expect(toHtml(tree)).toBe('<pre class="mermaid" data-pagefind-ignore="">flowchart LR</pre><pre>code</pre>');
  });

  it('marks a raw Mermaid block', () => {
    const tree = { type: 'root', children: [{ type: 'raw', value: '<pre class="mermaid">flowchart LR</pre>' }] };
    plugin(tree);
    expect(tree.children[0].value).toBe('<pre class="mermaid" data-pagefind-ignore>flowchart LR</pre>');
  });
});
