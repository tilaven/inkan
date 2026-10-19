import fs from 'node:fs';
import path from 'node:path';
import { isMap, parseDocument, stringify } from 'yaml';
import { docId, slugSegment } from './pages.mjs';

const FRONT_MATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/**
 * The leading `---` block of a Markdown file: its YAML text and total length. Null when there is none, or when
 * the block holds no mapping (a `---` rule at the top of the body is not front matter).
 */
export function splitFrontMatter(text) {
  const m = FRONT_MATTER.exec(text);
  if (!m) return null;
  const yaml = m[1] ?? '';
  const { contents } = parseDocument(yaml);
  if (contents != null && !isMap(contents)) return null;
  return { yaml, length: m[0].length };
}

/** Splits a Markdown file into its front matter (plain object) and body. */
export function parseFrontMatter(text) {
  const fm = splitFrontMatter(text);
  if (!fm) return { data: {}, body: text };
  const body = text.slice(fm.length);
  try {
    return { data: parseDocument(fm.yaml).toJS() ?? {}, body };
  } catch (e) {
    // Broken YAML (e.g. an unresolved `*alias`) must not stop the whole site; `check` reports the file.
    return { data: {}, body, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * `value` as a YAML scalar: as written when it reads back unchanged, else double-quoted.
 * With `inList`, it must also survive inside a flow list (`[a, b]`), where a comma or a bracket splits it.
 */
export function yamlScalar(value, { inList = false } = {}) {
  const s = String(value);
  try {
    if (parseDocument(`v: ${s}`).toJS()?.v === s && (!inList || sameList(parseDocument(`v: [${s}]`).toJS()?.v, s))) return s;
  } catch {}
  return JSON.stringify(s);
}

const sameList = (list, item) => Array.isArray(list) && list.length === 1 && list[0] === item;

/** Project folder names: letters, digits, `-` and `_`, as for `sources`. */
export const PROJECT_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

/** Id of the project in a folder: the URL slug its records get (`Ops Plans` -> `ops-plans`). */
export const projectId = (folder) => slugSegment(folder);

/** Throws unless `name` can be a project folder. */
export function assertProjectName(name) {
  if (!PROJECT_NAME.test(name)) throw new Error(`Invalid project name "${name}": use letters, digits, - and _.`);
}

/**
 * Sets (or, with `undefined`, removes) front matter keys and keeps the rest of the file as written:
 * comments, key order, quoting and line endings survive. `file` only names the file in errors.
 */
export function updateFrontMatter(text, changes, file = 'file') {
  const fm = splitFrontMatter(text);
  const doc = parseDocument(fm?.yaml ?? '');
  if (doc.errors.length) throw new Error(`${file}: front matter does not parse (${doc.errors[0].message.split('\n')[0]})`);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) doc.delete(key);
    else doc.set(key, doc.createNode(value, { flow: Array.isArray(value) }));
  }
  const eol = text.slice(0, text.indexOf('\n') + 1).endsWith('\r\n') ? '\r\n' : '\n';
  const yaml = doc.toString({ flowCollectionPadding: false, lineWidth: 0 }).trimEnd().replace(/\r?\n/g, eol);
  return `---${eol}${yaml}${eol}---${eol}${fm ? text.slice(fm.length) : text}`;
}

export { stringify as stringifyYaml };

/** URL-safe slug: lowercase ASCII, dashes, diacritics folded. */
export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export { today } from './calendar.mjs';

/** Path of the author directory in `contentDir`, or null. */
export const authorsFile = (contentDir) => ['_authors.yml', '_authors.yaml'].map((f) => path.join(contentDir, f)).find((f) => fs.existsSync(f)) ?? null;

/**
 * `_authors.yml` as `{ handle: { name, email?, github?, gitlab? } }`, as the content collection's file() loader reads it:
 * a list of entries with an `id`, or a map keyed by handle. `{}` without the file.
 */
export function loadAuthors(contentDir) {
  const file = authorsFile(contentDir);
  if (!file) return {};
  const data = parseDocument(fs.readFileSync(file, 'utf8')).toJS();
  if (Array.isArray(data)) return Object.fromEntries(data.filter((a) => a && typeof a === 'object' && a.id != null).map(({ id, ...rest }) => [String(id), rest]));
  return data && typeof data === 'object' ? data : {};
}

/** The `repo` source whose clone holds `file` (read-only: edits are lost on the next sync), or undefined. */
export const repoSourceOf = (config, file) =>
  (config.sources ?? []).find((s) => {
    const rel = path.relative(s.root, file);
    return s.repo && !rel.startsWith('..') && !path.isAbsolute(rel);
  });

/** Accepts one value or a list, like the content schema does. */
export const asList = (v) => (v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);

const isContent = (name) => !name.startsWith('_') && !name.startsWith('.');

/** Markdown files under `dir`, skipping `_`-prefixed files and folders (same rule as the content collection). */
export function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (!isContent(entry.name)) continue;
      const file = path.join(d, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.mdx?$/.test(entry.name)) out.push(file);
    }
  };
  walk(dir);
  return out.sort();
}

/** Content folders of a resolved config: `[project | null, dir]`, the local one first, then each source. */
const contentRoots = (config) => [[null, config.contentDir], ...(config.sources ?? []).map((s) => [s.project, s.contentDir])];

const readProjectFile = (dir) => {
  const file = ['_project.yml', '_project.yaml'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!file) return { file: null, data: null };
  try {
    return { file, data: parseDocument(fs.readFileSync(file, 'utf8')).toJS() ?? {} };
  } catch {
    return { file, data: {} };
  }
};

/**
 * Reads every record (`<project>/<type>/<file>.md`) of a resolved config without Astro, sources included.
 * `id` matches the site's, so links and `supersedes` values line up.
 */
export function loadRecords(config) {
  const records = [];
  for (const [source, dir] of contentRoots(config)) {
    for (const file of markdownFiles(dir)) {
      const local = path.relative(dir, file).split(path.sep).join('/');
      const rel = source ? `${source}/${local}` : local;
      const parts = rel.split('/');
      if (parts.length !== 3 || !(parts[1] in config.docTypes)) continue;
      const [folder, type, name] = parts;
      const project = projectId(folder);
      const { data, body, error } = parseFrontMatter(fs.readFileSync(file, 'utf8'));
      const slug = data.slug ? String(data.slug).replace(/^\/+|\/+$/g, '') : null;
      const num = /^(\d+)/.exec(name)?.[1];
      records.push({
        id: source && slug ? `${source}/${slug}` : docId(rel, slug),
        file,
        project,
        type,
        number: num ? Number(num) : null,
        ref: num ? `${project.toUpperCase()}-${config.docTypes[type].label}-${num.padStart(4, '0')}` : null,
        data,
        body,
        ...(error && { error }),
      });
    }
  }
  return records;
}

/**
 * Projects (`<project>/_project.yml`, and one per source) keyed by id. `folder` is the name on disk, `dir` its path.
 * Folders whose names share a slug are one project (the build refuses that; the first in sort order wins here).
 */
export function loadProjects(config) {
  const projects = new Map();
  if (fs.existsSync(config.contentDir)) {
    const folders = fs.readdirSync(config.contentDir, { withFileTypes: true }).filter((e) => e.isDirectory() && isContent(e.name)).map((e) => e.name).sort();
    for (const folder of folders) {
      const id = projectId(folder);
      const dir = path.join(config.contentDir, folder);
      if (!projects.has(id)) projects.set(id, { id, folder, dir, ...readProjectFile(dir) });
    }
  }
  for (const s of config.sources ?? []) projects.set(s.project, { id: s.project, folder: s.project, dir: s.contentDir, ...readProjectFile(s.contentDir) });
  return projects;
}

/**
 * Records matching an id (`sre/adr/0001-x`), short id (`sre/adr/0001`, `sre/adr/1`), ref (`SRE-ADR-0001`)
 * or file path. More than one means the query is ambiguous (e.g. duplicate numbers).
 */
export function findRecords(records, query) {
  const q = String(query).trim().replace(/\\/g, '/').replace(/\.mdx?$/, '').replace(/\/$/, '');
  const file = path.resolve(String(query));
  const exact = records.filter((r) => r.id === q || r.file === file || r.ref?.toLowerCase() === q.toLowerCase());
  if (exact.length) return exact;
  const short = /^(.+)\/([^/]+)\/0*(\d+)$/.exec(q);
  return short
    ? records.filter((r) => r.project === projectId(short[1]) && r.type === short[2] && r.number === Number(short[3]))
    : records.filter((r) => r.id.endsWith(`/${q}`));
}

/** The one record `findRecords` finds; undefined when nothing or more than one record matches. */
export function findRecord(records, query) {
  const hits = findRecords(records, query);
  return hits.length === 1 ? hits[0] : undefined;
}
