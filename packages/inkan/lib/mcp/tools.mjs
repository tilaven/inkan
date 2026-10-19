import { findRecord, findRecords, today } from '../records.mjs';
import { daysBetween, urgency } from '../calendar.mjs';
import { handleKey } from '../rfc-reviews.mjs';

/** @typedef {import('./source.mjs').Source} Source */
/** @typedef {import('./source.mjs').McpRecord} McpRecord */

const str = (description) => ({ type: 'string', description });
const SEARCH_LIMIT = 20;
const MAX_LIMIT = 200;
const BODY_CONCURRENCY = 8;
const REVIEW_WINDOW = 30;

/** Items for which `test` holds, running at most `limit` tests at once. */
async function filterLimited(items, limit, test) {
  const keep = new Array(items.length).fill(false);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      keep[i] = await test(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return items.filter((_, i) => keep[i]);
}

/** Thrown by a tool for input problems; reported to the client as a tool error, not a protocol error. */
export class ToolError extends Error {}

/** Reviewers and review state of a record, or nothing when nobody was asked to review it. */
const reviewFields = (r) => (r.reviewers?.length ? { reviewers: r.reviewers, rfcReview: r.rfcReview } : {});

/** `alice (approved), bob (pending)` */
const reviewersText = (reviewers) => reviewers.map((v) => `${v.handle} (${v.state})`).join(', ');

/** Compact summary of a record, as returned by search_records. */
export const summary = (r) => ({
  id: r.id,
  ref: r.ref,
  title: r.title,
  status: r.status,
  date: r.date,
  project: r.project,
  type: r.type,
  tags: r.tags,
  fields: r.fields,
  description: r.description,
  ...reviewFields(r),
});

/**
 * Checks the arguments against the tool's input schema (the subset of JSON Schema the tools use:
 * flat objects of strings, integers and booleans).
 */
export function validateArgs(schema, args = {}) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw new ToolError('arguments must be an object');
  const out = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    if (prop.type === 'string' && typeof v !== 'string') throw new ToolError(`${key} must be a string`);
    if (prop.type === 'boolean' && typeof v !== 'boolean') throw new ToolError(`${key} must be a boolean`);
    if (prop.type === 'integer' && !Number.isInteger(v)) throw new ToolError(`${key} must be an integer`);
    if (prop.minimum !== undefined && v < prop.minimum) throw new ToolError(`${key} must be at least ${prop.minimum}`);
    out[key] = prop.type === 'string' ? v.trim() : v;
  }
  for (const key of schema.required ?? []) if (out[key] === undefined || out[key] === '') throw new ToolError(`${key} is required`);
  return out;
}

const counts = (values) => {
  const map = new Map();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
};

const lower = (s) => String(s).toLowerCase();

/** `risk=high` as a test on a record's fields: the value, or one item of a list, equals `high` (case-insensitive). */
function fieldFilter(spec) {
  const at = spec.indexOf('=');
  const name = spec.slice(0, at).trim();
  if (at < 1 || !name) throw new ToolError('field must look like "name=value", e.g. "risk=high"');
  const wanted = lower(spec.slice(at + 1).trim());
  return (r) => Object.entries(r.fields ?? {}).some(([k, v]) => lower(k) === lower(name) && [v].flat().some((x) => lower(x) === wanted));
}

const definition = ({ name, label, type, values, unit, description }) => ({ name, label, type, values: values ?? null, unit: unit ?? null, description: description ?? null });

/** The record that currently stands in for `record`: follows `supersededBy` links to the end of the chain. */
export function resolveCurrent(records, record) {
  let cur = record;
  const seen = new Set([cur.id]);
  while (cur.supersededBy.length) {
    const next = findRecord(records, cur.supersededBy[0]);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    cur = next;
  }
  return cur;
}

const link = (records, query) => {
  const r = findRecord(records, query);
  return r ? { id: r.id, ref: r.ref, title: r.title, status: r.status } : { id: query, missing: true };
};

const reviewText = (v) => [`due ${v.due}`, v.reviewed && `last ${v.reviewed}`, v.every && `every ${v.every}`].filter(Boolean).join(', ');

function metaValue(key, v) {
  if (key === 'reviewers') return reviewersText(v);
  if (key === 'rfcReview') return `${v.status}${v.waitingOn.length ? `, waiting on ${v.waitingOn.join(', ')}` : ''}`;
  if (key === 'review') return reviewText(v);
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x.id)).join(', ') : typeof v === 'object' ? v.id : v;
}

/** Markdown rendering of get_record's result: a YAML block of metadata followed by the body. */
export function recordText(result) {
  const { body, fields = {}, ...meta } = result;
  const lines = Object.entries(meta)
    .filter(([, v]) => v != null && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${metaValue(k, v)}`);
  for (const [name, v] of Object.entries(fields)) lines.push(`${name}: ${Array.isArray(v) ? v.join(', ') : v}`);
  return ['```yaml', ...lines, '```', '', String(body).trim(), ''].join('\n');
}

/**
 * Tool definitions: `inputSchema` is what tools/list advertises, `run(args, source)` returns the structured result
 * and optionally `text`, the rendering sent as the text content (defaults to compact JSON).
 */
export const tools = [
  {
    name: 'list_projects',
    description: 'Projects (teams) that own decision records, with the number of records in each.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(_args, source) {
      return { projects: await source.projects() };
    },
  },
  {
    name: 'search_records',
    description:
      'Finds decision records (ADRs, RFCs, …) by project, type, status, tag, author, custom field or free text. Every filter is optional; ' +
      'results are newest first. Use get_record for the full text of a hit.',
    inputSchema: {
      type: 'object',
      properties: {
        project: str('Project id (folder name), e.g. "sre".'),
        type: str('Record type, e.g. "adr" or "rfc".'),
        status: str('Status, e.g. "accepted", "proposed", "superseded".'),
        tag: str('Tag the record must carry.'),
        author: str('Author handle.'),
        field: str('Custom field value as "name=value", e.g. "risk=high". Lists match when one item equals the value; booleans are true/false. See list_fields.'),
        query: str('Case-insensitive text to look for in the title, description and body.'),
        current_only: { type: 'boolean', description: 'Only records whose status describes how things are done today (e.g. accepted, implemented).' },
        limit: { type: 'integer', minimum: 1, description: `Page size (default ${SEARCH_LIMIT}, max ${MAX_LIMIT}).` },
        offset: { type: 'integer', minimum: 0, description: 'Number of hits to skip.' },
      },
      additionalProperties: false,
    },
    async run(args, source) {
      const all = await source.records();
      const hasField = args.field ? fieldFilter(args.field) : () => true;
      let hits = all.filter(
        (r) =>
          hasField(r) &&
          (!args.project || lower(r.project) === lower(args.project)) &&
          (!args.type || lower(r.type) === lower(args.type)) &&
          (!args.status || lower(r.status ?? '') === lower(args.status)) &&
          (!args.tag || r.tags.some((t) => lower(t) === lower(args.tag))) &&
          (!args.author || r.authors.some((a) => lower(a) === lower(args.author))) &&
          (!args.current_only || source.isCurrent(r)),
      );
      if (args.query) {
        const q = lower(args.query);
        const inIndex = (r) => lower(`${r.title}\n${r.description ?? ''}\n${r.tags.join(' ')}`).includes(q);
        const inBody = new Set(await filterLimited(hits.filter((r) => !inIndex(r)), BODY_CONCURRENCY, async (r) => lower(await r.body()).includes(q)));
        hits = hits.filter((r) => inIndex(r) || inBody.has(r));
      }
      const offset = args.offset ?? 0;
      const limit = Math.min(args.limit ?? SEARCH_LIMIT, MAX_LIMIT);
      return { total: hits.length, offset, limit, records: hits.slice(offset, offset + limit).map(summary) };
    },
  },
  {
    name: 'get_record',
    description:
      'Full record: metadata, the Markdown body and its lineage (what it supersedes, what superseded it and which record is current now). ' +
      'Accepts an id ("sre/adr/0001-define-slos"), a short id ("sre/adr/1") or a reference ("SRE-ADR-0001").',
    inputSchema: {
      type: 'object',
      properties: { id: str('Record id, short id or reference.') },
      required: ['id'],
      additionalProperties: false,
    },
    async run(args, source) {
      const all = await source.records();
      const hits = findRecords(all, args.id);
      if (hits.length > 1) throw new ToolError(`"${args.id}" is ambiguous: ${hits.map((h) => h.id).join(', ')}.`);
      const r = hits[0];
      if (!r) throw new ToolError(`No record matches "${args.id}". Use search_records to find ids.`);
      const current = resolveCurrent(all, r);
      const { body, file, reviewers, rfcReview, ...meta } = r;
      return {
        ...meta,
        ...reviewFields(r),
        current: source.isCurrent(r),
        supersedes: r.supersedes.map((q) => link(all, q)),
        supersededBy: r.supersededBy.map((q) => link(all, q)),
        currentRecord: current.id === r.id ? null : { id: current.id, ref: current.ref, title: current.title, status: current.status },
        body: await body(),
      };
    },
    text: recordText,
  },
  {
    name: 'due_reviews',
    description:
      'Decision records that are overdue for a periodic review or due soon, most overdue first. ' +
      '`days` is negative when the review date has passed. Use all to list every scheduled review.',
    inputSchema: {
      type: 'object',
      properties: {
        project: str('Only records of this project.'),
        within: { type: 'integer', minimum: 0, description: `Include reviews due within this many days (default ${REVIEW_WINDOW}); overdue ones are always included.` },
        all: { type: 'boolean', description: 'List every record with a review schedule, however far away.' },
      },
      additionalProperties: false,
    },
    async run(args, source) {
      const within = args.within ?? REVIEW_WINDOW;
      const now = today();
      const records = (await source.records())
        .filter((r) => r.review && (!args.project || lower(r.project) === lower(args.project)))
        .map((r) => ({ r, days: daysBetween(now, r.review.due) }))
        .filter(({ days }) => args.all || days <= within)
        .sort((a, b) => a.r.review.due.localeCompare(b.r.review.due) || a.r.id.localeCompare(b.r.id));
      return {
        today: now,
        within: args.all ? null : within,
        total: records.length,
        records: records.map(({ r, days }) => ({ ...summary(r), review: r.review, days, urgency: urgency(days, within) })),
      };
    },
  },
  {
    name: 'rfc_reviews',
    description:
      'Open records that have reviewers, with each reviewer\'s answer and whose move it is. With a reviewer handle, only the records ' +
      'whose review is waiting on that person.',
    inputSchema: {
      type: 'object',
      properties: { reviewer: str('Reviewer handle: only records waiting on this person.') },
      additionalProperties: false,
    },
    async run(args, source) {
      const records = (await source.records()).filter(
        (r) => r.rfcReview && r.rfcReview.status !== 'closed' && (!args.reviewer || r.rfcReview.waitingOn.some((h) => handleKey(h) === handleKey(args.reviewer))),
      );
      return { total: records.length, records: records.map(summary) };
    },
  },
  {
    name: 'list_fields',
    description:
      'Custom metadata fields of the records (e.g. risk, cost): name, label, type, allowed values, unit and description, ' +
      'plus the projects that define their own set. Use them with the field filter of search_records; values are in each record\'s fields.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(_args, source) {
      if (!source.fields) throw new ToolError('Field definitions are not published by a remote site; records still carry their values in "fields".');
      const { fields, projects } = await source.fields();
      return { fields: fields.map(definition), projects: Object.fromEntries(Object.entries(projects).map(([id, list]) => [id, list.map(definition)])) };
    },
  },
  {
    name: 'list_tags',
    description: 'Every tag with the number of records carrying it.',
    inputSchema: { type: 'object', properties: { project: str('Only count records of this project.') }, additionalProperties: false },
    async run(args, source) {
      const records = (await source.records()).filter((r) => !args.project || lower(r.project) === lower(args.project));
      return { tags: counts(records.flatMap((r) => r.tags)) };
    },
  },
  {
    name: 'list_authors',
    description: 'Every author handle with the number of records they wrote.',
    inputSchema: { type: 'object', properties: { project: str('Only count records of this project.') }, additionalProperties: false },
    async run(args, source) {
      const records = (await source.records()).filter((r) => !args.project || lower(r.project) === lower(args.project));
      return { authors: counts(records.flatMap((r) => r.authors)) };
    },
  },
];

export const RESOURCE_SCHEME = 'decision://';

export const resourceTemplates = [
  {
    uriTemplate: `${RESOURCE_SCHEME}{id}`,
    name: 'Decision record',
    description: 'Markdown of one record by id, e.g. decision://sre/adr/0001-define-slos',
    mimeType: 'text/markdown',
  },
];

/** @param {Source} source */
export async function listResources(source) {
  return (await source.records()).map((r) => ({
    uri: `${RESOURCE_SCHEME}${r.id.split('/').map(encodeURIComponent).join('/')}`,
    name: r.ref ?? r.id,
    title: r.title,
    description: [r.status, r.description].filter(Boolean).join(': ') || undefined,
    mimeType: 'text/markdown',
  }));
}

/** Markdown of the record behind `uri`, or undefined when there is none. */
export async function readResource(source, uri) {
  if (!uri.startsWith(RESOURCE_SCHEME)) return undefined;
  let id;
  try {
    id = decodeURIComponent(uri.slice(RESOURCE_SCHEME.length));
  } catch {
    return undefined;
  }
  const r = findRecord(await source.records(), id);
  if (!r) return undefined;
  return { uri, mimeType: 'text/markdown', text: recordText({ ...summary(r), review: r.review, authors: r.authors, deciders: r.deciders, supersedes: r.supersedes, supersededBy: r.supersededBy, ...reviewFields(r), body: await r.body() }) };
}
