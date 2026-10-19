import { definePlugin } from 'astro-expressive-code';

/**
 * Expressive Code turns a code block that overflows sideways into a focusable `region` at runtime, without a name.
 * Several on one page are then identical landmarks. The block's title or language goes on the `<pre>` as
 * `data-label` here, and the module below copies it into `aria-label` for as long as the block is a region
 * (`aria-label` on a plain `<pre>` is prohibited by ARIA).
 */
const syncLabels = (template) => `
  const blocks = () => document.querySelectorAll('.expressive-code pre[data-label]');
  const sync = (pre) => {
    if (pre.getAttribute('role') !== 'region') return pre.removeAttribute('aria-label');
    const n = [...blocks()].indexOf(pre) + 1;
    pre.setAttribute('aria-label', ${JSON.stringify(template)}.replace('{n}', n).replace('{name}', pre.dataset.label));
  };
  new MutationObserver((records) => records.forEach((r) => r.target.matches?.('.expressive-code pre[data-label]') && sync(r.target)))
    .observe(document.body, { attributes: true, attributeFilter: ['role'], subtree: true });
  blocks().forEach(sync);
`;

export function codeLabel(block) {
  const title = typeof block.props.title === 'string' ? block.props.title.trim() : '';
  if (title) return title;
  return block.language && block.language !== 'plaintext' ? block.language : 'text';
}

/** @param {{ label?: string }} [options] `label` is the region name, with `{n}` and `{name}` placeholders. */
export function pluginCodeLabels({ label = 'Code block {n}: {name}' } = {}) {
  return definePlugin({
    name: 'Code block labels',
    hooks: {
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        const pre = findPre(renderData.blockAst);
        if (pre) pre.properties = { ...pre.properties, dataLabel: codeLabel(codeBlock) };
      },
    },
    jsModules: [syncLabels(label)],
  });
}

function findPre(node) {
  if (node.type === 'element' && node.tagName === 'pre') return node;
  for (const child of node.children ?? []) {
    const found = findPre(child);
    if (found) return found;
  }
  return undefined;
}
