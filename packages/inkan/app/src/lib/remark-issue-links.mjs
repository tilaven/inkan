/** Links issue keys (e.g. PAY-123) to the tracker configured in inkan.config → issueLinks. */
import { visit, SKIP } from 'unist-util-visit';

/** @param {{ rules?: { pattern: string, url: string }[] }} [options] */
export default function remarkIssueLinks({ rules = [] } = {}) {
  const compiled = rules.map((r) => ({ re: new RegExp(r.pattern, 'g'), url: r.url }));
  return (tree) => {
    if (!compiled.length) return;
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || parent.type === 'link' || parent.type === 'linkReference') return;
      const matches = compiled.flatMap(({ re, url }) =>
        [...node.value.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0], href: url.replace(/\$(\d)/g, (_, i) => m[+i] ?? '') })),
      ).sort((a, b) => a.start - b.start);
      if (!matches.length) return;
      const out = [];
      let pos = 0;
      for (const m of matches) {
        if (m.start < pos) continue;
        if (m.start > pos) out.push({ type: 'text', value: node.value.slice(pos, m.start) });
        out.push({ type: 'link', url: m.href, data: { hProperties: { className: ['issue'] } }, children: [{ type: 'text', value: m.text }] });
        pos = m.end;
      }
      if (pos < node.value.length) out.push({ type: 'text', value: node.value.slice(pos) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}
