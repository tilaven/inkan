/**
 * Shows placeholders such as `<record title>` or `<project>` as written. Markdown passes any tag-like text
 * through as HTML, and the browser then drops an element it does not know, so the words vanish from the page.
 * Real HTML, SVG and MathML elements, and custom elements (names with a dash), are left as HTML.
 */
import { visit } from 'unist-util-visit';

const KNOWN = new Set(`a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption
cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer
form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu
meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script
search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th
thead time title tr track u ul var video wbr center font big strike tt marquee nobr
svg g path circle ellipse line polyline polygon rect text tspan defs use symbol marker mask pattern clippath
lineargradient radialgradient stop filter foreignobject image desc
math mi mn mo ms mtext mrow msup msub msubsup mfrac msqrt mroot mtable mtr mtd semantics annotation`.split(/\s+/));

const PHRASING = new Set(['paragraph', 'heading', 'tableCell', 'emphasis', 'strong', 'delete', 'link', 'linkReference']);
const TAG = /^<\/?([a-z][a-z0-9]*)(?=[\s/>])[^<>]*>$/i;

export default function remarkLiteralTags() {
  return (tree) => {
    visit(tree, 'html', (node, index, parent) => {
      const name = TAG.exec(node.value.trim())?.[1]?.toLowerCase();
      if (!name || KNOWN.has(name) || !parent || index === undefined) return;
      const text = { type: 'text', value: node.value.trim() };
      parent.children[index] = PHRASING.has(parent.type) ? text : { type: 'paragraph', children: [text] };
    });
  };
}
