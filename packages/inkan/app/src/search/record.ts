import type { SearchHit } from './types';

export interface SearchRecord {
  id: string;
  objectID: string;
  url: string;
  title: string;
  description: string | null;
  content: string;
  project: string | null;
  type: string | null;
  status: string | null;
  ref: string | null;
  tags: string[];
  authors: string[];
  date: string | null;
}

const EXCERPT_LENGTH = 160;

const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

function excerptFrom(text: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length > EXCERPT_LENGTH ? `${chars.slice(0, EXCERPT_LENGTH).join('').trimEnd()}…` : flat;
}

export function toHit(doc: Partial<SearchRecord> & Record<string, unknown>, excerptHtml?: string): SearchHit {
  const url = str(doc.url) ?? str(doc.href) ?? '';
  const plain = str(doc.description) ?? excerptFrom(str(doc.content) ?? '');
  const hit: SearchHit = { url, title: str(doc.title) ?? url };
  if (excerptHtml) {
    hit.excerpt = excerptHtml;
    hit.marked = true;
  } else if (plain) {
    hit.excerpt = plain;
  }
  for (const key of ['project', 'type', 'status', 'ref'] as const) {
    const value = str(doc[key]);
    if (value) hit[key] = value;
  }
  return hit;
}

/** Meilisearch primary keys allow only `[A-Za-z0-9_-]`; `/` becomes `__` and a literal `_` stays distinct from it. */
export function recordId(id: string) {
  return id.replace(/[^A-Za-z0-9-]/g, (char) =>
    char === '/' ? '__' : `_${char.codePointAt(0)!.toString(16).padStart(2, '0')}_`,
  );
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntity(match: string, name: string) {
  const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : name.startsWith('#') ? Number(name.slice(1)) : NaN;
  if (Number.isNaN(code)) return ENTITIES[name.toLowerCase()] ?? match;
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
}

export function plainText(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/^ {0,3}(```|~~~)\s*mermaid\b[\s\S]*?^ {0,3}\1\s*$/gm, '')
    .replace(/^ {0,3}(```|~~~).*$/gm, '')
    .replace(/^ {0,3}\|?[\s:|-]*-{3,}[\s:|-]*$/gm, '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/^\[[^\]]+\]:\s.*$/gm, '')
    .replace(/^ {0,3}#{1,6}\s+/gm, '')
    .replace(/^ {0,3}>\s?/gm, '')
    .replace(/^ {0,3}([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/(\*\*|__|\*|~~|`)/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim();
}
