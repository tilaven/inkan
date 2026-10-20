import { visit } from 'unist-util-visit';

const fill = (template, params) => template.replace(/\{(\w+)\}/g, (m, key) => (key in params ? String(params[key]) : m));

const hasClass = (node, name) => {
  const list = node.properties?.className;
  return Array.isArray(list) ? list.includes(name) : typeof list === 'string' && list.split(/\s+/).includes(name);
};

/**
 * Wide tables and display math scroll sideways on narrow screens. A scroll container that only the mouse can move
 * locks keyboard users out of it, so each gets a label here (tables wrapped in `div.tblw`, KaTeX `.katex-display`
 * blocks in place) and the page script turns it into a focusable, named region for as long as it overflows.
 * Labels count per document and carry the record title when there is one ("Table 2 in Use Kafka"), so the
 * landmarks stay unique on a page that prints several records, like the export. The templates come from the
 * interface text; `{n}`, `{label}` and `{title}` are the placeholders.
 */
export default function rehypeScrollRegions({ table = 'Table {n}', equation = 'Equation {n}', inRecord = '{label} in {title}' } = {}) {
  return (tree, file) => {
    const title = file?.data?.astro?.frontmatter?.title;
    const name = typeof title === 'string' ? title.trim() : '';
    const label = (template, n) => {
      const text = fill(template, { n });
      return name ? fill(inRecord, { label: text, title: name }) : text;
    };
    let tables = 0;
    let equations = 0;
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'table' && parent && typeof index === 'number') {
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['tblw'], dataScrollLabel: label(table, ++tables) },
          children: [node],
        };
        parent.children[index] = wrapper;
        return 'skip';
      }
      if (hasClass(node, 'katex-display')) {
        node.properties = { ...node.properties, dataScrollLabel: label(equation, ++equations) };
        return 'skip';
      }
    });
  };
}
