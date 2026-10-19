import fs from 'node:fs';

/** Lines taken by the front matter block, which Astro strips before parsing. */
function frontMatterLines(file) {
  const text = file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path, 'utf8') : String(file.value ?? '');
  const m = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? m[0].split('\n').length - 1 : 0;
}

/**
 * Marks top-level blocks with the source lines they span (`data-line`, `data-line-end`, 1-based, in the file
 * including its front matter), so review comments on those lines can be shown next to them.
 */
export default function rehypeSourceLines() {
  return (tree, file) => {
    const offset = frontMatterLines(file);
    for (const node of tree.children) {
      if (node.type !== 'element' || !node.position) continue;
      node.properties = { ...node.properties, dataLine: node.position.start.line + offset, dataLineEnd: node.position.end.line + offset };
    }
  };
}
