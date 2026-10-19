/** Pure helpers for review comments pinned to paragraphs; the component fetches, these build URLs and pick results. */

import { httpUrl, trimHost } from './gitlab';

export type ReviewTarget =
  | { provider: 'github'; owner: string; repo: string; number: number; url: string }
  | { provider: 'gitlab'; host: string; project: string; iid: number; url: string };

export interface ReviewComment {
  /** Line in the file on the new side; for an outdated comment the line it was left on. */
  line: number;
  outdated: boolean;
  body: string;
  author: { name: string; url?: string; avatar?: string };
  url?: string;
  createdAt: string;
}

export interface Block {
  start: number;
  end: number;
}

/** `https://github.com/o/r/pull/12/files` or `https://<host>/<group/repo>/-/merge_requests/7/diffs` → the PR/MR; null otherwise. */
export function parseReviewUrl(url: string | undefined): ReviewTarget | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.hostname === 'github.com' || u.hostname === 'www.github.com') {
    const m = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/.exec(u.pathname);
    if (!m) return null;
    return { provider: 'github', owner: m[1], repo: m[2], number: Number(m[3]), url: `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}` };
  }
  const m = /^\/(.+?)\/-\/merge_requests\/(\d+)(?:\/|$)/.exec(u.pathname);
  if (!m) return null;
  return { provider: 'gitlab', host: u.origin, project: m[1], iid: Number(m[2]), url: `${u.origin}/${m[1]}/-/merge_requests/${m[2]}` };
}

/** Review comments fetched per request. */
export const REVIEW_PAGE = 100;

/** GitHub pages followed per record; anonymous readers get 60 API requests an hour. */
export const REVIEW_PAGES = 5;

/** The REST (GitHub) or GraphQL GET (GitLab, same shape as `notesUrl` in ./gitlab) url for the review comments of the PR/MR. */
export function reviewRequestUrl(t: ReviewTarget): string {
  if (t.provider === 'github') {
    return `https://api.github.com/repos/${encodeURIComponent(t.owner)}/${encodeURIComponent(t.repo)}/pulls/${t.number}/comments?per_page=${REVIEW_PAGE}`;
  }
  const query = `query($path: ID!, $iid: String!) { project(fullPath: $path) { mergeRequest(iid: $iid) { notes(last: ${REVIEW_PAGE}, filter: ONLY_COMMENTS) { nodes { body createdAt url author { name username webUrl avatarUrl } position { filePath newLine oldLine } } } } } }`;
  const q = new URLSearchParams({ query, variables: JSON.stringify({ path: t.project, iid: String(t.iid) }) });
  return `${trimHost(t.host)}/api/graphql?${q}`;
}

/** The `rel="next"` url of a GitHub `Link` header, or null. */
export function nextPage(link: string | null | undefined): string | null {
  const m = /<([^>]+)>;\s*rel="next"/.exec(link ?? '');
  return m ? httpUrl(m[1]) ?? null : null;
}

/** The comments on `file` in a `reviewRequestUrl` response, sorted by line then date. Anything malformed is dropped. */
export function readReviewComments(t: ReviewTarget, json: unknown, file: string): ReviewComment[] {
  const comments = t.provider === 'github' ? readGitHub(json, file) : readGitLab(json, file, t.host);
  return comments.sort((a, b) => a.line - b.line || a.createdAt.localeCompare(b.createdAt));
}

const isLine = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const text = (v: unknown) => (typeof v === 'string' ? v : '');

function readGitHub(json: unknown, file: string): ReviewComment[] {
  if (!Array.isArray(json)) return [];
  const out: ReviewComment[] = [];
  for (const item of json as any[]) {
    if (!item || item.path !== file || item.side === 'LEFT' || typeof item.body !== 'string') continue;
    const line = item.line ?? item.original_line;
    if (!isLine(line)) continue;
    out.push({
      line,
      outdated: item.line == null,
      body: item.body,
      author: { name: text(item.user?.login), url: httpUrl(item.user?.html_url), avatar: httpUrl(item.user?.avatar_url) },
      url: httpUrl(item.html_url),
      createdAt: text(item.created_at),
    });
  }
  return out;
}

function readGitLab(json: unknown, file: string, host: string): ReviewComment[] {
  const nodes = (json as { data?: { project?: { mergeRequest?: { notes?: { nodes?: unknown } } | null } | null } } | null)?.data?.project
    ?.mergeRequest?.notes?.nodes;
  if (!Array.isArray(nodes)) return [];
  const out: ReviewComment[] = [];
  for (const n of nodes as any[]) {
    if (!n || n.position?.filePath !== file || typeof n.body !== 'string') continue;
    const line = n.position.newLine;
    if (!isLine(line)) continue;
    const author = n.author ?? {};
    out.push({
      line,
      outdated: false,
      body: n.body,
      author: { name: text(author.name || author.username), url: httpUrl(author.webUrl), avatar: httpUrl(absolute(author.avatarUrl, host)) },
      url: httpUrl(n.url),
      createdAt: text(n.createdAt),
    });
  }
  return out;
}

function absolute(path: unknown, host: string) {
  if (typeof path !== 'string' || !path) return undefined;
  try {
    return new URL(path, `${trimHost(host)}/`).href;
  } catch {
    return undefined;
  }
}

/**
 * Comments grouped by the index of the block whose lines contain them. A line between blocks goes to the block
 * above it, a line before the first block to the first, a line after the last to the last.
 */
export function pinComments<T extends { line: number }>(blocks: Block[], comments: T[]): Map<number, T[]> {
  const pins = new Map<number, T[]>();
  if (!blocks.length) return pins;
  for (const c of comments) {
    let at = 0;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].start <= c.line) at = i;
      else break;
    }
    const list = pins.get(at);
    if (list) list.push(c);
    else pins.set(at, [c]);
  }
  return pins;
}

/** The PR/MR diff opened at the line (GitHub) or at the file (GitLab); the bare diff where hashing is unavailable. */
export async function lineUrl(t: ReviewTarget, file: string, line: number): Promise<string> {
  const diff = t.provider === 'github' ? `${t.url}/files` : `${t.url}/diffs`;
  if (!globalThis.crypto?.subtle) return diff;
  if (t.provider === 'github') return `${diff}#diff-${await hex('SHA-256', file)}R${line}`;
  return `${diff}#${await hex('SHA-1', file)}`;
}

async function hex(algorithm: 'SHA-1' | 'SHA-256', value: string) {
  const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
