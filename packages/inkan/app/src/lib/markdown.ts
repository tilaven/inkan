/** Raw Markdown export: every record and page is also served at `<url without trailing slash>.md`. */
import fs from 'node:fs';
import { asList, updateFrontMatter } from '../../../lib/records.mjs';
import { hiddenRef, variant } from './auth';
import { absolutePath, url, type FileEntry } from './decisions';

/** URL of the raw Markdown (front matter included) of a decision, record entry or page entry. */
export const markdownUrl = (item: { id: string }) => url(`${item.id || 'index'}.md`);

const LINK_KEYS = ['supersedes', 'supersededBy', 'related'] as const;

/** The file as written, except that the public site's copies do not name protected records. */
export function rawMarkdown(entry: FileEntry & { collection?: string; data?: Record<string, unknown> }) {
  const text = fs.readFileSync(absolutePath(entry), 'utf8');
  if (variant !== 'public' || entry.collection !== 'docs') return text;
  const changes: Record<string, string[] | undefined> = {};
  for (const key of LINK_KEYS) {
    const ids = asList(entry.data?.[key]);
    const kept = ids.filter((id) => !hiddenRef(id));
    if (kept.length !== ids.length) changes[key] = kept.length ? kept : undefined;
  }
  return Object.keys(changes).length ? updateFrontMatter(text, changes, entry.id) : text;
}
