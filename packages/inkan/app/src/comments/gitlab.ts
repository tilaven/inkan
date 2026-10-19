/** Pure helpers for the GitLab comments provider; the component fetches, these build URLs and pick results. */
import { escapeRegExp } from '../../../lib/regex.mjs';
import { t } from '../lib/i18n';

export type GitLabKind = 'issues' | 'merge_requests';

export interface GitLabTarget {
  kind: GitLabKind;
  project: string;
  iid: number;
}

export interface GitLabIssue {
  iid: number;
  title: string;
  web_url?: string;
}

export interface GitLabNote {
  id: string;
  body: string;
  createdAt: string;
  url?: string | null;
  author?: { name?: string; username?: string; webUrl?: string | null; avatarUrl?: string | null } | null;
}

export interface GitLabThread {
  webUrl?: string | null;
  notes: GitLabNote[];
  /** Older notes exist beyond the ones fetched. */
  more: boolean;
}

export const trimHost = (host: string) => host.replace(/\/+$/, '');
const trimPath = (path: string) => path.replace(/^\/+|\/+$/g, '');

/** `https://gitlab.com/group/repo/-/issues/12` (or `/work_items/12`) → the issue; null when not on `host` or not an issue/MR. */
export function parseDiscussionUrl(url: string | undefined, host: string): GitLabTarget | null {
  if (!url) return null;
  let u: URL;
  let h: URL;
  try {
    u = new URL(url);
    h = new URL(trimHost(host));
  } catch {
    return null;
  }
  if (u.origin !== h.origin) return null;
  const m = /^\/(.+?)\/-\/(issues|work_items|merge_requests)\/(\d+)\/?$/.exec(u.pathname);
  if (!m) return null;
  return { kind: m[2] === 'merge_requests' ? 'merge_requests' : 'issues', project: m[1], iid: Number(m[3]) };
}

export const webUrl = (host: string, { project, kind, iid }: GitLabTarget) =>
  `${trimHost(host)}/${trimPath(project)}/-/${kind}/${iid}`;

export function newIssueUrl({ host, project, title, pageUrl, labels = [] }: { host: string; project: string; title: string; pageUrl: string; labels?: string[] }) {
  const description = [pageUrl, ...(labels.length ? ['', ...labels.map((l) => `/label ~"${l.replace(/["\r\n]/g, '')}"`)] : [])].join('\n');
  const q = new URLSearchParams({ 'issue[title]': title, 'issue[description]': description });
  return `${trimHost(host)}/${trimPath(project)}/-/issues/new?${q}`;
}

const api = (host: string, project: string) => `${trimHost(host)}/api/v4/projects/${encodeURIComponent(trimPath(project))}`;

export function searchUrl({ host, project, ref, title }: { host: string; project: string; ref?: string | null; title: string }) {
  const q = new URLSearchParams({ search: ref || title, in: 'title', state: 'all', per_page: '20' });
  return `${api(host, project)}/issues?${q}`;
}

/** Notes fetched per record: the newest ones, shown oldest first. */
export const NOTES_PAGE = 100;

/**
 * GraphQL GET url for the newest comments of an issue or merge request. The REST notes endpoint needs a token on
 * gitlab.com, GraphQL answers anonymous reads of public projects, and a GET needs no CORS preflight.
 */
export function notesUrl(host: string, { project, kind, iid }: GitLabTarget) {
  const field = kind === 'merge_requests' ? 'mergeRequest' : 'issue';
  const query = `query($path: ID!, $iid: String!) { project(fullPath: $path) { item: ${field}(iid: $iid) { webUrl notes(last: ${NOTES_PAGE}, filter: ONLY_COMMENTS) { pageInfo { hasPreviousPage } nodes { id body createdAt url author { name username webUrl avatarUrl } } } } } }`;
  const q = new URLSearchParams({ query, variables: JSON.stringify({ path: trimPath(project), iid: String(iid) }) });
  return `${trimHost(host)}/api/graphql?${q}`;
}

/** The thread in a `notesUrl` response; avatar paths are made absolute against `host`. Null when it is missing. */
export function readNotes(json: unknown, host: string): GitLabThread | null {
  const item = (json as { data?: { project?: { item?: any } | null } } | null)?.data?.project?.item;
  if (!item?.notes) return null;
  const notes = ((item.notes.nodes ?? []) as GitLabNote[])
    .filter((n) => n && typeof n.body === 'string')
    .map((n) => (n.author?.avatarUrl ? { ...n, author: { ...n.author, avatarUrl: absolute(n.author.avatarUrl, host) } } : n));
  return { webUrl: item.webUrl, notes, more: !!item.notes.pageInfo?.hasPreviousPage };
}

function absolute(path: string, host: string) {
  try {
    return new URL(path, `${trimHost(host)}/`).href;
  } catch {
    return undefined;
  }
}

/** The first issue titled with the ref (`SRE-RFC-0001: …`), or titled exactly like the record when it has no ref. */
export function pickIssue<T extends { title: string }>(issues: T[], { ref, title }: { ref?: string | null; title: string }): T | undefined {
  if (ref) {
    const re = new RegExp(`^\\s*${escapeRegExp(ref)}(?![a-z0-9])`, 'i');
    return issues.find((i) => re.test(i.title));
  }
  const want = title.trim().toLowerCase();
  return issues.find((i) => i.title.trim().toLowerCase() === want);
}

/** Only http(s) URLs make it into the DOM. */
export function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export const isoDate = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value);

export const commentCount = (n: number, more = false) =>
  more ? t('comments.latest', { count: n, provider: 'GitLab' }) : n === 0 ? t('comments.none') : t('comments.count', { count: n, provider: 'GitLab' });
