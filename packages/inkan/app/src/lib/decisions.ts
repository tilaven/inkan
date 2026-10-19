import { getCollection, type CollectionEntry } from 'astro:content';
import path from 'node:path';
import { gitHistory, loadAuthors, matchAuthor, realpath, statusHistory } from '../../../lib/git.mjs';
import { blobUrl, commitDiffUrl, scanCodeRefs, type CodeRef } from '../../../lib/coderefs.mjs';
import { loadProjects, loadRecords, slugify } from '../../../lib/records.mjs';
import { isoDate, nextReview, reviewOptions } from '../../../lib/reviews.mjs';
import { reviewSummary, type ReviewSummary } from '../../../lib/rfc-reviews.mjs';
import { combineFields, projectFields, readFields, type Field, type FieldValue } from '../../../lib/fields.mjs';
import { docTypes, openStatuses, site, statuses, type DocType, type Status } from './config';
import { hidden, hiddenRef } from './auth';
import { initials } from './card';
import { once, relativeInside } from './once';
import { assignStyles, fallbackStyle, type Ink, type ProjectStyle } from './inks';

export type { ProjectStyle, Field, FieldValue };
export { slugify };

export type DocEntry = CollectionEntry<'docs'>;
export type ProjectEntry = CollectionEntry<'projects'>;

/** A change of a record's status, from the commit that made it. */
export interface HistoryEntry {
  /** Status after the commit; absent when the commit removed it. */
  status?: Status;
  date: Date;
  /** Handle from the author directory, else the git name. */
  author: string;
  /** Full commit hash. */
  commit: string;
  /** The file's diff in that commit, on the repository's web UI. */
  href?: string;
}

export interface Review {
  due: string;
  reviewed: string | null;
  every: string | null;
  from: 'reviewBy' | 'interval';
}

export interface Decision {
  id: string;
  href: string;
  title: string;
  description?: string;
  project: string;
  type: DocType | null;
  /** Number taken from the file name (`0007-foo.md` -> 7). */
  number: number | null;
  /** Human reference like `SRE-ADR-0007`. */
  ref: string | null;
  status?: Status;
  date?: Date;
  authors: string[];
  deciders: string[];
  tags: string[];
  supersedes: string[];
  supersededBy: string[];
  related: string[];
  /** RFC reviewers, their answers and whose move it is (see lib/rfc-reviews.mjs). */
  rfcReview: ReviewSummary;
  /** Fields missing from the front matter and filled from the file's first commit. */
  inferred: ('date' | 'authors')[];
  /** Next periodic review of a decided record; null when it has no schedule. */
  review: Review | null;
  /** `@adr` comments in the repository that mention this record. */
  codeRefs: CodeRef[];
  /** Values of the custom fields defined for the record's project, by field name. */
  fields: Record<string, FieldValue>;
  /** Status changes from git, oldest first (empty outside git, for `repo` sources, or with `git.history: false`). */
  history: HistoryEntry[];
  entry: DocEntry;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => `${base}/${path.replace(/^\//, '')}`;

/** URL of a project's team page. */
export const projectHref = (id: string) => url(`${id}/`);

export function toDecision(entry: DocEntry): Decision {
  const [project = '', typeDir = '', file = ''] = entry.id.split('/');
  const type = typeDir in docTypes ? (typeDir as DocType) : null;
  const num = type ? /^(\d+)/.exec(file)?.[1] : undefined;
  const number = num ? Number(num) : null;
  const d = entry.data;
  const history = site.git.dates || site.git.authors ? fileHistory(entry) : undefined;
  const inferred: Decision['inferred'] = [];
  let date = d.date;
  if (!date && site.git.dates && history) {
    date = history.created;
    inferred.push('date');
  }
  let authors = d.authors;
  if (!authors.length && site.git.authors && history) {
    authors = [matchAuthor(history.author, authorDirectory())].filter(Boolean);
    if (authors.length) inferred.push('authors');
  }
  const { values, issues } = readFields(fieldsOf(project), d);
  if (issues.length) {
    const file = path.relative(site.root, absolutePath(entry)).split(path.sep).join('/');
    throw new Error(`Invalid fields in ${file}:\n  ${issues.map((i) => i.message).join('\n  ')}`);
  }
  return {
    id: entry.id,
    href: url(`${entry.id}/`),
    title: d.title,
    description: d.description,
    project,
    type,
    number,
    ref:
      type && num
        ? `${project.toUpperCase()}-${docTypes[type].label}-${num.padStart(4, '0')}`
        : null,
    status: d.status as Status | undefined,
    date,
    authors,
    deciders: d.deciders,
    tags: d.tags,
    supersedes: visibleIds(d.supersedes),
    supersededBy: visibleIds(d.supersededBy),
    related: visibleIds(d.related),
    rfcReview: reviewSummary({
      reviewers: d.reviewers,
      authors,
      deciders: d.deciders,
      open: Boolean(d.status && openStatuses.includes(d.status)),
      approvals: site.reviewers.approvals,
    }),
    inferred,
    review: nextReview({ ...d, date: isoDate(date) }, reviewOptions(site, getProjectFiles(), project)),
    codeRefs: getCodeRefs().get(entry.id) ?? [],
    fields: values,
    history: recordHistory(entry),
    entry,
  };
}

const getFields = once(() => projectFields(site));

/** Custom fields of a project's records, in display order. */
export const fieldsOf = (project: string): Field[] => getFields().projects.get(project) ?? getFields().site;

/** Every custom field of the projects this build shows, one definition per name (enum and list values merged). */
export const allFields = once((): Field[] => {
  const { site: own, projects } = getFields();
  return combineFields([own, ...[...projects].filter(([id]) => !hidden(projectHref(id))).map(([, fields]) => fields)]);
});

/** Every Markdown page (records and other pages). Drafts are hidden in production builds, protected pages in the public one. */
export async function getDocs(): Promise<DocEntry[]> {
  return getCollection('docs', (e) => !(import.meta.env.PROD && e.data.draft) && !hidden(url(`${e.id}/`)));
}

/** Ids like `sre/adr/0001-x` (or `.md` paths) of records this build may name. */
const visibleIds = (ids: string[]) => ids.filter((id) => !hiddenRef(id));

/** All ADR/RFC records (pages that are not in a type folder are skipped), newest first. */
export async function getDecisions(): Promise<Decision[]> {
  const docs = await getDocs();
  return docs
    .map(toDecision)
    .filter((d) => d.type !== null)
    .sort(
      (a, b) =>
        (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
}

/** Decided records with a review schedule, earliest due date first. */
export async function getReviews(): Promise<(Decision & { review: Review })[]> {
  const scheduled = (await getDecisions()).filter((d): d is Decision & { review: Review } => d.review !== null);
  return scheduled.sort((a, b) => a.review.due.localeCompare(b.review.due) || a.id.localeCompare(b.id));
}

export async function getProjects(): Promise<ProjectEntry[]> {
  const projects = await getCollection('projects', (p) => !hidden(projectHref(p.id)));
  return projects.sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

/** The author directory; the public site leaves out people whose team is a protected project. */
export async function getAuthorDirectory() {
  const [authors, projects] = await Promise.all([getCollection('authors'), getCollection('projects', (p) => hidden(projectHref(p.id)))]);
  const hiddenTeams = new Set(projects.flatMap((p) => [p.id.toLowerCase(), p.data.name.toLowerCase()]));
  return new Map(authors.filter((a) => !hiddenTeams.has(a.data.team?.trim().toLowerCase() ?? '')).map((a) => [a.id, a.data]));
}

export async function authorName(handle: string) {
  return (await getAuthorDirectory()).get(handle)?.name ?? handle;
}

/** Counts how often each value occurs, sorted by count then name. */
export function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const statusInfo = (s?: string) => (s && s in statuses ? statuses[s as Status] : undefined);

export const formatDate = (d?: Date) =>
  d ? d.toISOString().slice(0, 10) : '';

/** Link to the explorer pre-filtered by a facet. */
export const filterHref = (facet: 'tag' | 'author' | 'project' | 'status' | 'type' | (string & {}), value: string) =>
  url(`decisions/?${facet}=${encodeURIComponent(value)}`);

/**
 * Link that opens the repo's web editor with a new, pre-filled record
 * (GitHub fills name and content; GitLab fills the file name).
 */
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export function newRecordUrl(repo: { url: string; branch: string; provider: 'github' | 'gitlab' }, dir: string, fileName: string, content: string) {
  if (repo.provider === 'gitlab') {
    return `${repo.url}/-/new/${repo.branch}/${encodePath(dir)}?file_name=${encodeURIComponent(fileName)}`;
  }
  return `${repo.url}/new/${repo.branch}/${encodePath(dir)}?filename=${encodeURIComponent(fileName)}&value=${encodeURIComponent(content)}`;
}

/** Any content entry backed by a file (records, user pages, the landing extra). */
export type FileEntry = { id: string; filePath?: string };

/** Absolute path of an entry's source file. `filePath` is relative to the Astro root (the app). */
export const absolutePath = (entry: FileEntry) => path.resolve(site.appDir, entry.filePath ?? '');

type Source = (typeof site.sources)[number];
/** Repository a record belongs to: its `repo` source, or the hub's own repo. */
export interface RecordRepo {
  url: string;
  branch: string;
  provider: 'github' | 'gitlab';
  /** Folder of the records inside that repository (`decisions` or the source's `path`). */
  dir: string;
}

const inside = (dir: string, file: string) => file === dir || file.startsWith(dir + path.sep);

/** The `repo` source an entry was fetched from; `dir` sources live in the hub repo and count as local. */
export function sourceOf(entry: FileEntry): Source | undefined {
  const file = absolutePath(entry);
  return site.sources.find((s) => s.repo && inside(s.contentDir, file));
}

/** Repository and records folder of a project: the source it comes from, or the hub's repo. */
export function projectRepo(project: string): RecordRepo | undefined {
  const source = site.sources.find((s) => s.project === project);
  if (source?.repo) {
    return source.web ? { url: source.web, branch: source.branch ?? source.head ?? 'main', provider: source.provider ?? 'github', dir: source.recordsPath } : undefined;
  }
  if (!site.repo.url) return undefined;
  // A `dir` source is part of the hub's repo, just not under contentDir.
  const dir = source ? relativeInside(site.repoRoot, source.contentDir) : `${site.contentPath}/${getProjectFiles().get(project)?.folder ?? project}`;
  return dir === undefined ? undefined : { ...site.repo, dir };
}

/**
 * Where the source file is: a path relative to the repository root (`decisions/sre/adr/0001-x.md`), or for a record
 * from a `repo` source its web URL in that repository (falling back to `<repo> <path>` when no web URL is known).
 */
export function sourcePath(entry: FileEntry) {
  const source = sourceOf(entry);
  if (!source) return path.relative(site.repoRoot, absolutePath(entry)).split(path.sep).join('/');
  const file = `${source.recordsPath}/${path.relative(source.contentDir, absolutePath(entry)).split(path.sep).join('/')}`;
  const repo = projectRepo(source.project);
  return (repo && blobUrl(repo, file)) || `${source.repo} ${file}`;
}

/** Name of the host the "Edit" link opens. */
export const editProvider = (entry: FileEntry) => sourceOf(entry)?.provider ?? site.repo.provider;

/** Path of the file inside its repository: the source repository for sourced records, else the hub's. */
export function repoFile(entry: FileEntry) {
  const source = sourceOf(entry);
  // Files outside the repository (a `dir` source next to it) have no path there.
  return source
    ? `${source.recordsPath}/${path.relative(source.contentDir, absolutePath(entry)).split(path.sep).join('/')}`
    : relativeInside(site.repoRoot, absolutePath(entry));
}

/** "Edit this page" link on GitHub/GitLab: in the source repository for sourced records, else in the hub's repo. */
export function editUrl(entry: FileEntry) {
  const source = sourceOf(entry);
  const repo = source ? projectRepo(source.project) : site.repo.url ? { ...site.repo, dir: '' } : undefined;
  if (!repo) return undefined;
  const file = repoFile(entry);
  if (!file) return undefined;
  return repo.provider === 'gitlab' ? `${repo.url}/-/edit/${repo.branch}/${encodePath(file)}` : `${repo.url}/edit/${repo.branch}/${encodePath(file)}`;
}

/** Folders whose files get dates and authors from git: the hub's own, plus `dir` sources that may sit in other repositories. */
const historyDirs = () => [site.contentDir, site.pagesDir, ...site.sources.filter((s) => !s.repo).map((s) => s.contentDir)];
const getHistory = once(() => gitHistory(historyDirs()));

/** First and last commit of a content file or user page, from one `git log` per repository and build (undefined outside git). */
function fileHistory(entry: FileEntry) {
  const history = getHistory();
  if (!history) return undefined;
  const file = absolutePath(entry);
  return history.get(realpath(file)) ?? history.get(file);
}

const getStatusHistory = once(() => (site.git.history ? statusHistory(historyDirs()) : null));

/** Who changed the record's status and when; links to the commit when the file is in the hub's own repository. */
function recordHistory(entry: FileEntry): HistoryEntry[] {
  const history = getStatusHistory();
  if (!history || sourceOf(entry)) return [];
  const file = absolutePath(entry);
  return (history.get(realpath(file)) ?? history.get(file) ?? []).map((c) => ({
    status: c.status ?? undefined,
    date: c.date,
    author: matchAuthor(c.author, authorDirectory()),
    commit: c.commit,
    href: c.root === site.repoRoot ? commitDiffUrl(site.repo, c.commit, c.path) : undefined,
  }));
}

let authors: ReturnType<typeof loadAuthors> | undefined;
const authorDirectory = () => (authors ??= loadAuthors(site.contentDir));

/** Date of the last commit touching the file (undefined outside git). */
export const lastUpdated = (entry: FileEntry): Date | undefined => fileHistory(entry)?.updated;

const getProjectFiles = once(() => loadProjects(site));

let codeRefs: Map<string, CodeRef[]> | undefined;
/** `@adr` comments found in the repository, by record id. Scanned once per build; unknown references are reported. */
export function getCodeRefs(): Map<string, CodeRef[]> {
  if (!codeRefs) {
    const { refs, unresolved } = scanCodeRefs(site, loadRecords(site));
    codeRefs = refs;
    const marker = site.codeRefs === false ? '@adr' : site.codeRefs.marker;
    for (const u of unresolved) console.warn(`inkan: ${u.file}:${u.line}: "${marker} ${u.ref}" matches no record`);
  }
  return codeRefs;
}

/** Link to a code reference in the repository's web UI (undefined without a configured repo). */
export const codeRefUrl = (ref: CodeRef) => blobUrl(site.repo, ref.file, ref.line);

let projectStyles: Promise<Map<string, ProjectStyle>> | undefined;
export function getProjectStyles(): Promise<Map<string, ProjectStyle>> {
  projectStyles ??= getAllProjects().then((projects) => assignStyles(projects.map((p) => ({ id: p.id, name: p.name, ink: p.data?.ink, motif: p.data?.motif }))));
  return projectStyles;
}

export const projectStyle = (id: string, name = id): ProjectStyle => fallbackStyle(id, name);

export interface Person {
  handle: string;
  name: string;
  initials: string;
  team?: string;
  /** Ink of the project the author's team maps to, if any. */
  ink?: Ink;
}

/** A team name like "Payments" matched to a project by exact id or name (case-insensitive). */
export function projectForTeam(team: string | undefined, projects: Iterable<ProjectStyle>) {
  const t = team?.trim().toLowerCase();
  if (!t) return undefined;
  for (const p of projects) if (p.id.toLowerCase() === t || p.name.toLowerCase() === t) return p;
  return undefined;
}

export function person(people: Map<string, Person>, handle: string): Person {
  return people.get(handle) ?? { handle, name: handle, initials: initials(handle) };
}

let people: Promise<Map<string, Person>> | undefined;
/** The author directory joined with the ink of each author's team. Computed once per build. */
export function getPeople(): Promise<Map<string, Person>> {
  people ??= (async () => {
    const projects = [...(await getProjectStyles()).values()];
    const authors = await getAuthorDirectory();
    return new Map(
      [...authors].map(([handle, a]) => [
        handle,
        { handle, name: a.name, initials: initials(a.name), team: a.team, ink: projectForTeam(a.team, projects)?.ink },
      ]),
    );
  })();
  return people;
}

/** All projects: those with a _project.yml plus bare folders, in display order. */
export async function getAllProjects() {
  const defined = await getProjects();
  const known = new Set(defined.map((p) => p.id));
  const folders = [...new Set((await getDocs()).filter((d) => d.id.includes('/')).map((d) => d.id.split('/')[0]))]
    .filter((id) => !known.has(id))
    .sort();
  return [
    ...defined.map((p) => ({ id: p.id, name: p.data.name, folder: getProjectFiles().get(p.id)?.folder ?? p.id, data: p.data })),
    ...folders.map((id) => {
      const folder = getProjectFiles().get(id)?.folder ?? id;
      return { id, name: folder, folder, data: undefined };
    }),
  ];
}
