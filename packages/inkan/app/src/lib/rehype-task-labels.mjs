import { visit } from 'unist-util-visit';

/** GFM task-list checkboxes are read-only and unlabelled; name them by their state for screen readers. */
export default function rehypeTaskLabels({ done = 'Done', notDone = 'Not done' } = {}) {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'input' || node.properties?.type !== 'checkbox') return;
      node.properties.ariaLabel = node.properties.checked ? done : notDone;
    });
  };
}
