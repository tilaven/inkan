import { visit } from 'unist-util-visit';

const HEADINGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);

const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

/**
 * Appends a "#" link to every heading that has an id, without putting the link into the heading's accessible name:
 * the heading is named by a span holding its own text, and the link by `label` ("Link to section: {heading}").
 * The link stays out of the search index.
 */
export default function rehypeHeadingAnchors({ label = 'Link to section: {heading}' } = {}) {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (!HEADINGS.has(node.tagName) || !node.properties?.id) return;
      const id = String(node.properties.id);
      const text = textOf(node).trim();
      const span = { type: 'element', tagName: 'span', properties: { id: `${id}-label` }, children: node.children };
      const link = {
        type: 'element',
        tagName: 'a',
        properties: { className: ['anchor'], href: `#${id}`, ariaLabel: label.replace('{heading}', () => text), dataPagefindIgnore: '' },
        children: [{ type: 'text', value: '#' }],
      };
      node.properties.ariaLabelledBy = span.properties.id;
      node.children = [span, link];
    });
  };
}
