/**
 * Lets authors link records the same way they do on GitHub/GitLab:
 *   [see](../rfc/0001-error-budget-policy.md#proposal)
 * The link works when browsing the repo and is rewritten to the site URL here.
 */
import path from 'node:path';
import { visit } from 'unist-util-visit';

/**
 * @param {{ contentDir: string, base?: string, sources?: { project: string, contentDir: string }[] }} options
 * Files of a source live one level up (`<type>/<file>.md`), so their URLs get the project in front.
 */
export default function remarkMdLinks({ contentDir, base = '/', sources = [] }) {
  const roots = [
    { dir: path.resolve(contentDir), project: '' },
    ...sources.map((s) => ({ dir: path.resolve(s.contentDir), project: `${s.project}/` })),
  ];
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const inside = (dir, file) => file === dir || file.startsWith(dir + path.sep);
  return (tree, file) => {
    if (!file.path) return;
    const from = path.resolve(file.path);
    const root = roots.find((r) => inside(r.dir, from));
    if (!root) return;
    visit(tree, ['link', 'definition'], (node) => {
      const m = /^([^:#?]+\.mdx?)(#.*)?$/i.exec(node.url ?? '');
      if (!m || node.url.startsWith('/')) return;
      const target = path.resolve(path.dirname(from), m[1]);
      const rel = path.relative(root.dir, target).split(path.sep).join('/');
      if (rel.startsWith('..')) return;
      const slug = `${root.project}${rel}`.replace(/\.mdx?$/i, '').replace(/(^|\/)index$/i, '').toLowerCase();
      node.url = `${prefix}${slug}${slug ? '/' : ''}${m[2] ?? ''}`;
    });
  };
}
