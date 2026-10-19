import { visit } from 'unist-util-visit';

/** Keeps Mermaid source (`<pre class="mermaid">`, which the diagram integration inserts as raw HTML) out of the search index. */
export default function rehypePagefindIgnore() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type === 'raw') node.value = node.value.replace(/<pre class="mermaid">/g, '<pre class="mermaid" data-pagefind-ignore>');
      else if (node.type === 'element' && node.tagName === 'pre' && node.properties?.className?.includes('mermaid')) node.properties.dataPagefindIgnore = '';
    });
  };
}
