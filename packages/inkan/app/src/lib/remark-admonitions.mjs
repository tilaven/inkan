/**
 * Callouts in the syntaxes authors already use elsewhere, all rendered as the same block:
 *   > [!WARNING]                       GitHub alert
 *   > [!warning] Custom title          GitLab alert
 *   :::warning{title="Custom title"}   Zudoku / Docusaurus directive
 *   :::warning[Custom title]           Docusaurus / Starlight directive
 * Output matches GitHub's markup (div.markdown-alert.markdown-alert-<type> > p.markdown-alert-title).
 */
import { directive } from 'micromark-extension-directive';
import { directiveFromMarkdown, directiveToMarkdown } from 'mdast-util-directive';
import { visit, SKIP } from 'unist-util-visit';

/** Type → [label, the type it is styled as]. */
const TYPES = {
  note: ['Note', 'note'],
  tip: ['Tip', 'tip'],
  info: ['Info', 'info'],
  important: ['Important', 'important'],
  warning: ['Warning', 'warning'],
  caution: ['Caution', 'caution'],
  danger: ['Danger', 'danger'],
  sparkles: ['New', 'important'],
  rocket: ['Launch', 'tip'],
  settings: ['Settings', 'note'],
  zap: ['Heads up', 'warning'],
  lock: ['Security', 'danger'],
  megaphone: ['Announcement', 'info'],
};

export const ADMONITION_TYPES = Object.keys(TYPES);

const ALERT = /^\[!(\w+)\][ \t]*/;

const text = (value) => ({ type: 'text', value });

function trimInline(nodes) {
  const out = nodes.filter((n) => n.type !== 'text' || n.value.trim());
  if (out[0]?.type === 'text') out[0] = text(out[0].value.trimStart());
  const last = out.length - 1;
  if (out[last]?.type === 'text') out[last] = text(out[last].value.trimEnd());
  return out;
}

function toCallout(node, type, title, children, extraClass = [], labels = {}) {
  const [fallback, style] = TYPES[type];
  const label = labels[type] ?? fallback;
  const classes = ['markdown-alert', `markdown-alert-${type}`];
  if (style !== type) classes.push(`markdown-alert-${style}`);
  node.data = { ...node.data, hName: 'div', hProperties: { className: [...classes, ...extraClass], dir: 'auto', role: 'note' } };
  node.children = [
    { type: 'paragraph', data: { hProperties: { className: ['markdown-alert-title'], dir: 'auto' } }, children: title.length ? title : [text(label)] },
    ...children,
  ];
}

/** Splits `[!TYPE] title⏎body` in a blockquote's first paragraph into the type, the title and the rest. */
function parseAlert(blockquote) {
  const first = blockquote.children[0];
  if (first?.type !== 'paragraph' || first.children[0]?.type !== 'text') return;
  const match = ALERT.exec(first.children[0].value);
  const type = match?.[1].toLowerCase();
  if (!type || !Object.hasOwn(TYPES, type)) return;

  const inline = [text(first.children[0].value.slice(match[0].length)), ...first.children.slice(1)];
  const title = [];
  let rest = [];
  for (let i = 0; i < inline.length; i++) {
    const n = inline[i];
    if (n.type === 'break') {
      rest = inline.slice(i + 1);
      break;
    }
    const nl = n.type === 'text' ? n.value.indexOf('\n') : -1;
    if (nl >= 0) {
      title.push(text(n.value.slice(0, nl)));
      rest = [text(n.value.slice(nl + 1)), ...inline.slice(i + 1)];
      break;
    }
    title.push(n);
  }
  const body = trimInline(rest);
  const children = body.length ? [{ ...first, children: body }, ...blockquote.children.slice(1)] : blockquote.children.slice(1);
  return { type, title: trimInline(title), children };
}

/** @param {{ labels?: Record<string, string> }} [options] default titles by type, in the site's language */
export default function remarkAdmonitions({ labels } = {}) {
  return (tree) => {
    visit(tree, ['blockquote', 'containerDirective'], (node) => {
      if (node.type === 'blockquote') {
        const alert = parseAlert(node);
        if (alert) toCallout(node, alert.type, alert.title, alert.children, [], labels);
        return;
      }
      const type = node.name.toLowerCase();
      if (!Object.hasOwn(TYPES, type)) return;
      const [head, ...rest] = node.children;
      const labelled = head?.type === 'paragraph' && head.data?.directiveLabel;
      const title = labelled ? head.children : node.attributes?.title ? [text(node.attributes.title)] : [];
      const extra = node.attributes?.class ? node.attributes.class.split(/\s+/).filter(Boolean) : [];
      toCallout(node, type, trimInline(title), labelled ? rest : node.children, extra, labels);
    });
  };
}

/**
 * Only the `:::name` block syntax of remark-directive: its `:name` and `::name` forms would eat
 * `mailto:x@y.z` autolinks and split paragraphs at lines starting with `::`.
 */
export function remarkContainerDirectives() {
  const data = this.data();
  const [container] = directive().flow[58];
  (data.micromarkExtensions ??= []).push({ flow: { 58: [container] } });
  (data.fromMarkdownExtensions ??= []).push(directiveFromMarkdown());
  (data.toMarkdownExtensions ??= []).push(directiveToMarkdown());
}

/** `:::name` blocks no plugin turned into an element keep their fences as text; run after every other remark plugin. */
export function remarkRestoreDirectives() {
  return (tree, file) => {
    const source = String(file.value ?? '');
    visit(tree, 'containerDirective', (node, index, parent) => {
      if (node.data?.hName || !parent || index === undefined) return;
      const raw = source.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0).split('\n');
      const open = raw[0] || `:::${node.name}`;
      const close = raw.length > 1 && /^\s*:{3,}\s*$/.test(raw.at(-1)) ? raw.at(-1).trim() : null;
      const children = node.children.filter((n) => !n.data?.directiveLabel);
      const fence = (value) => ({ type: 'paragraph', children: [text(value)] });
      parent.children.splice(index, 1, fence(open.trim()), ...children, ...(close ? [fence(close)] : []));
      return [SKIP, index + 1];
    });
  };
}
