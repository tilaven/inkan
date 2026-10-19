import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { closest } from './config.mjs';
import { combineFields, mergeFields, projectFieldsSchema, readFields } from './fields.mjs';
import { asList, authorsFile, findRecord, loadAuthors, loadProjects, loadRecords, repoSourceOf, splitFrontMatter } from './records.mjs';
import { unprotectableProjects } from './auth/protect.mjs';
import { isoDay } from './calendar.mjs';
import { isInterval, reviewSchedule } from './reviews.mjs';
import { plural } from './text.mjs';
import { parseReviewers, recordReview } from './rfc-reviews.mjs';

/**
 * @typedef {{ level: 'error' | 'warning', rule: string, message: string, file: string, line?: number, record?: string }} Problem
 * `file` is absolute; `line` is 1-based and points at the offending front matter key when known.
 */

const LINK_KEYS = ['supersedes', 'supersededBy', 'related'];
const DATE_KEYS = ['date', 'reviewBy', 'reviewed'];

/** 1-based line of a top-level front matter key, or undefined. */
export function keyLine(text, key) {
  const fm = splitFrontMatter(text);
  if (!fm) return undefined;
  const lines = fm.yaml.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(`${key}:`) || l.startsWith(`"${key}":`) || l.startsWith(`'${key}':`));
  return i === -1 ? undefined : i + 2;
}

const isDate = (v) => v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)));
const dateOnly = (v) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
const quote = (v) => JSON.stringify(typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));

/** Closest existing id, looked for among the records of the same project and type when the reference names them. */
function suggestId(ref, records) {
  const prefix = /^([^/]+\/[^/]+)\//.exec(ref)?.[1];
  const pool = prefix ? records.filter((r) => `${r.project}/${r.type}` === prefix) : records;
  return closest(ref, pool.map((r) => r.id));
}

/**
 * What every rule works on: the records and projects of a resolved config, their texts, and `error`/`warn` to report with.
 * `broken` and `fieldsOf` are filled by the first site rules and read by the record rules.
 * @typedef {object} Site
 * @property {object} config
 * @property {ReturnType<typeof loadRecords>} records
 * @property {ReturnType<typeof loadProjects>} projects
 * @property {Record<string, any>} statuses
 * @property {string} today `YYYY-MM-DD`
 * @property {Set<string> | null} authors handles of `_authors.yml`, null without the file
 * @property {string | null} authorsPath
 * @property {(r: any) => boolean} fromRepo whether the record comes from a `repo` source
 * @property {ReturnType<typeof reviewSchedule>} schedule
 * @property {ReturnType<typeof mergeFields>} siteFields
 * @property {Map<string, ReturnType<typeof mergeFields> | null>} fieldsOf per project with its own `fields`; null when those are invalid
 * @property {Set<string>} broken ids of records whose front matter does not parse
 * @property {Map<any, string>} texts
 * @property {Problem[]} problems
 * @property {(rule: string, r: any, message: string, key?: string) => void} error
 * @property {(rule: string, r: any, message: string, key?: string) => void} warn
 */

/** @returns {Site} */
function loadSite(config, today) {
  const records = loadRecords(config);
  const projects = loadProjects(config);
  const authorsPath = authorsFile(config.contentDir);
  const texts = new Map(records.map((r) => [r, fs.readFileSync(r.file, 'utf8')]));
  /** @type {Problem[]} */
  const problems = [];
  const report = (level, rule, r, message, key) =>
    problems.push({ level, rule, message, file: r.file, line: key ? keyLine(texts.get(r) ?? '', key) : undefined, record: r.id });
  return {
    config,
    records,
    projects,
    statuses: config.statuses ?? {},
    today: isoDay(today),
    authors: authorsPath ? new Set(Object.keys(loadAuthors(config.contentDir))) : null,
    authorsPath,
    fromRepo: (r) => Boolean(repoSourceOf(config, r.file)),
    schedule: reviewSchedule(config, projects),
    siteFields: mergeFields(config.fields ?? {}),
    fieldsOf: new Map(),
    broken: new Set(),
    texts,
    problems,
    error: (rule, r, message, key) => report('error', rule, r, message, key),
    warn: (rule, r, message, key) => report('warning', rule, r, message, key),
  };
}

/** Front matter must exist, parse cleanly and carry a title; records that fail are skipped by the record rules. */
function frontMatter(site) {
  for (const r of site.records) {
    const fm = splitFrontMatter(site.texts.get(r) ?? '');
    if (!fm) {
      site.error('front-matter', r, 'missing front matter (the file must start with a --- block holding at least a title)');
      site.broken.add(r.id);
      continue;
    }
    const doc = parseDocument(fm.yaml);
    if (!doc.errors.length && r.error) {
      site.error('front-matter', r, `front matter does not parse: ${r.error.split('\n')[0]}`);
      site.broken.add(r.id);
      continue;
    }
    if (doc.errors.length) {
      const first = doc.errors[0];
      const line = first.linePos?.[0]?.line;
      site.problems.push({ level: 'error', rule: 'front-matter', message: `front matter does not parse: ${first.message.split('\n')[0]}`, file: r.file, line: line ? line + 1 : undefined, record: r.id });
      site.broken.add(r.id);
      continue;
    }
    if (typeof r.data.title !== 'string' || !r.data.title.trim()) site.error('title', r, 'front matter has no title', 'title');
  }
}

/** Each project's custom field definitions must be valid and combine with the site's and the other projects'. */
function projectFields(site) {
  const { config, projects, fieldsOf } = site;
  for (const [id, p] of projects) {
    if (p.data?.fields === undefined) continue;
    const parsed = projectFieldsSchema.safeParse(p.data.fields);
    if (parsed.success) fieldsOf.set(id, mergeFields(config.fields ?? {}, parsed.data));
    else {
      fieldsOf.set(id, null);
      for (const i of parsed.error.issues) {
        site.problems.push({ level: 'error', rule: 'project-fields', message: `fields${i.path.length ? `.${i.path.join('.')}` : ''}: ${i.message.replace(/^Invalid input: /, '')}`, file: p.file ?? p.dir });
      }
    }
  }
  // Added one project at a time, so a conflict is reported on the _project.yml that introduces it.
  const combined = [site.siteFields];
  for (const [id, fields] of fieldsOf) {
    if (!fields) continue;
    try {
      combineFields([...combined, fields]);
      combined.push(fields);
    } catch (e) {
      const message = String(e instanceof Error ? e.message : e).replace(/^Invalid fields: /, '');
      site.problems.push({ level: 'error', rule: 'project-fields', message, file: projects.get(id)?.file ?? projects.get(id)?.dir ?? path.join(config.contentDir, id) });
    }
  }
}

/** One number per project and type. */
function numbering(site) {
  const byNumber = new Map();
  for (const r of site.records) {
    if (r.number === null) continue;
    const key = `${r.project}/${r.type}/${r.number}`;
    if (!byNumber.has(key)) byNumber.set(key, []);
    byNumber.get(key).push(r);
  }
  for (const group of byNumber.values()) {
    if (group.length < 2) continue;
    for (const r of group) {
      const others = group.filter((o) => o !== r).map((o) => path.basename(o.file));
      site.error('duplicate-number', r, `number ${r.number} is also used by ${others.join(', ')} (${r.project}/${r.type})`);
    }
  }
}

function fieldValues(r, site) {
  const fields = site.fieldsOf.has(r.project) ? site.fieldsOf.get(r.project) : site.siteFields;
  if (fields) for (const issue of readFields(fields, r.data).issues) site.error('field', r, issue.message, issue.field);
}

function knownStatus(r, site) {
  const { status } = r.data;
  if (status == null || String(status) in site.statuses) return;
  const hint = closest(String(status), Object.keys(site.statuses));
  site.error('status', r, `unknown status ${quote(status)}${hint ? `, did you mean "${hint}"?` : ` (known: ${Object.keys(site.statuses).join(', ')})`}`, 'status');
}

function dateFields(r, site) {
  for (const key of DATE_KEYS) {
    if (r.data[key] != null && !isDate(r.data[key])) site.error('date', r, `${key} ${quote(r.data[key])} is not a date (use YYYY-MM-DD)`, key);
  }
}

function linkTargets(r, site) {
  for (const key of LINK_KEYS) {
    for (const ref of asList(r.data[key])) {
      if (findRecord(site.records, ref)) continue;
      const hint = suggestId(ref, site.records);
      site.error('missing-record', r, `${key} points to ${quote(ref)}, which does not exist${hint ? `, did you mean "${hint}"?` : ''}`, key);
    }
  }
}

/** Supersede links must be mirrored on the other record. */
function supersedeMirrors(r, site) {
  const mirrors = { supersedes: 'supersededBy', supersededBy: 'supersedes' };
  for (const [key, mirror] of Object.entries(mirrors)) {
    for (const ref of asList(r.data[key])) {
      const other = findRecord(site.records, ref);
      if (!other || site.broken.has(other.id)) continue;
      const back = asList(other.data[mirror]).some((v) => findRecord(site.records, v) === r);
      if (!back) site.warn('one-sided-supersede', r, `${key} ${other.id}, but ${other.id} does not list ${mirror}: ${r.id}`, key);
    }
  }
}

function supersededStatus(r, site) {
  const d = r.data;
  if (asList(d.supersededBy).length && 'superseded' in site.statuses && d.status !== 'superseded') {
    site.warn('superseded-status', r, `has supersededBy but its status is ${d.status == null ? 'missing' : quote(d.status)} instead of "superseded"`, 'status');
  }
}

function reviewerEntries(r, site) {
  for (const message of parseReviewers(r.data.reviewers).errors) site.error('reviewers', r, message, 'reviewers');
}

/** Authors, deciders and reviewers of the hub's own records are listed in `_authors.yml` when the file exists. */
function knownAuthors(r, site) {
  if (!site.authors || site.fromRepo(r)) return;
  const d = r.data;
  const handles = [
    ['authors', asList(d.authors)],
    ['deciders', asList(d.deciders)],
    ['reviewers', parseReviewers(d.reviewers).reviewers.map((v) => v.handle)],
  ];
  for (const [key, list] of handles) {
    for (const handle of list) {
      if (site.authors.has(handle)) continue;
      const hint = closest(handle, [...site.authors]);
      site.warn('unknown-author', r, `${key.slice(0, -1)} "${handle}" is not in ${path.basename(String(site.authorsPath))}${hint ? `, did you mean "${hint}"?` : ''}`, key);
    }
  }
}

function reviewBlocked(r, site) {
  const d = r.data;
  const rfcReview = recordReview(d, site.config);
  if (!site.statuses[d.status]?.current || !rfcReview.changesRequested) return;
  const who = rfcReview.reviewers.filter((v) => v.state === 'changes-requested').map((v) => v.handle);
  site.warn('review-blocked', r, `status is "${d.status}" but ${who.join(', ')} still ${who.length === 1 ? 'has' : 'have'} requested changes`, 'reviewers');
}

function reviewOverdue(r, site) {
  const d = r.data;
  if (d.reviewBy == null || !isDate(d.reviewBy) || !site.statuses[d.status]?.open || dateOnly(d.reviewBy) >= site.today) return;
  const rfcReview = recordReview(d, site.config);
  const waiting = rfcReview.status === 'in-review' ? ` (waiting on ${rfcReview.waitingOn.join(', ')})` : '';
  site.warn('review-overdue', r, `review deadline ${dateOnly(d.reviewBy)} has passed but the status is still "${d.status}"${waiting}`, 'reviewBy');
}

function reviewInterval(r, site) {
  const { reviewEvery } = r.data;
  if (reviewEvery != null && !isInterval(reviewEvery)) {
    site.error('review-interval', r, `reviewEvery ${quote(reviewEvery)} is not an interval (use e.g. "1 year", "6 months", "90 days" or "never")`, 'reviewEvery');
  }
}

function reviewDue(r, site) {
  const review = site.schedule(r);
  if (!review || review.due >= site.today) return;
  const why = review.from === 'reviewBy' ? `review date ${review.due}` : `review every ${review.every} (due ${review.due})`;
  site.warn('review-due', r, `${why} has passed; review it and run \`inkan reviewed ${r.id}\``, review.from === 'reviewBy' ? 'reviewBy' : 'reviewed');
}

/** Project metadata: protection needs authentication, intervals parse, `_project.yml` exists and names owners. */
function projectMetadata(site) {
  const { config, projects, records, problems } = site;
  for (const id of unprotectableProjects(config)) {
    const p = projects.get(id);
    problems.push({ level: 'error', rule: 'project-protected', message: `project "${id}" is protected (protected: true) but \`authentication\` is not set in inkan.config, so nobody could sign in to see it`, file: p?.file ?? p?.dir ?? path.join(config.contentDir, id) });
  }
  for (const [id, p] of projects) {
    if (!records.some((r) => r.project === id)) continue;
    if (config.sources?.some((s) => s.repo && s.project === id)) continue;
    if (p.data?.reviewEvery != null && !isInterval(p.data.reviewEvery)) {
      problems.push({ level: 'error', rule: 'review-interval', message: `project "${id}": reviewEvery ${quote(p.data.reviewEvery)} is not an interval`, file: p.file });
    }
    if (!p.file) {
      problems.push({ level: 'warning', rule: 'project-file', message: `project folder "${p.folder}" has no _project.yml (name, description, owners)`, file: p.dir });
    } else if (!asList(p.data?.owners).length) {
      problems.push({ level: 'warning', rule: 'project-owners', message: `project "${id}" has no owners`, file: p.file });
    }
  }
}

/** Rules over the whole site, in order: the first two fill `broken` and `fieldsOf` for the record rules. */
const SITE_RULES = [frontMatter, projectFields, numbering];
/** Rules over each record whose front matter parses, in the order their problems are reported. */
const RECORD_RULES = [fieldValues, knownStatus, dateFields, linkTargets, supersedeMirrors, supersededStatus, reviewerEntries, knownAuthors, reviewBlocked, reviewOverdue, reviewInterval, reviewDue];

/**
 * Runs every rule over the records of a resolved config.
 * @param {object} config resolved config (see loadConfig)
 * @param {{ today?: Date }} [opts] `today` is read as a local calendar day
 * @returns {{ problems: Problem[], records: number, projects: number }}
 */
export function checkSite(config, { today = new Date() } = {}) {
  const site = loadSite(config, today);
  for (const rule of SITE_RULES) rule(site);
  for (const r of site.records) {
    if (site.broken.has(r.id)) continue;
    for (const rule of RECORD_RULES) rule(r, site);
  }
  projectMetadata(site);
  site.problems.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
  return { problems: site.problems, records: site.records.length, projects: site.projects.size };
}

/** Paths relative to the working directory, or to the site root when the file is outside it (`--root`). */
const relativeTo =
  ({ cwd = process.cwd(), root = cwd } = {}) =>
  (file) => {
    let rel = path.relative(cwd, file);
    if (rel.startsWith('..')) rel = path.relative(root, file);
    return rel.split(path.sep).join('/') || '.';
  };

/** `path:line level message` per problem, grouped by file, then a summary line. */
export function formatText({ problems, records, projects }, opts = {}) {
  const rel = relativeTo(opts);
  const out = [];
  let last;
  for (const p of problems) {
    if (last && last !== p.file) out.push('');
    last = p.file;
    out.push(`${rel(p.file)}${p.line ? `:${p.line}` : ''} ${p.level} ${p.message}`);
  }
  if (problems.length) out.push('');
  out.push(summary({ problems, records, projects }));
  return out.join('\n');
}

export function summary({ problems, records, projects }) {
  const errors = problems.filter((p) => p.level === 'error').length;
  const warnings = problems.length - errors;
  const scope = `${plural(records, 'record')} in ${plural(projects, 'project')}`;
  if (!problems.length) return `No problems found (${scope}).`;
  return `${[errors && plural(errors, 'error'), warnings && plural(warnings, 'warning')].filter(Boolean).join(', ')} (${scope}).`;
}

/** GitHub Actions workflow commands, one per problem, with paths relative to the workspace. */
export function formatAnnotations(problems, { workspace }) {
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const prop = (s) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
  return problems.flatMap((p) => {
    const file = path.relative(workspace, p.file).split(path.sep).join('/');
    if (file.startsWith('../') || file.split('/').includes('node_modules')) return [];
    return [`::${p.level} file=${prop(file)}${p.line ? `,line=${p.line}` : ''},title=${prop(`inkan check (${p.rule})`)}::${esc(p.message)}`];
  });
}

export function toJson(result, opts = {}) {
  const rel = relativeTo(opts);
  const errors = result.problems.filter((p) => p.level === 'error').length;
  return {
    ok: errors === 0,
    errors,
    warnings: result.problems.length - errors,
    records: result.records,
    projects: result.projects,
    problems: result.problems.map((p) => ({ ...p, file: rel(p.file) })),
  };
}
