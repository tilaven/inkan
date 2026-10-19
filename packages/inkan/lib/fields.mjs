import path from 'node:path';
import { z } from 'astro/zod';
import { loadProjects } from './records.mjs';

export const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'enum', 'list', 'url'];

/** Field names: a letter, then letters, digits, `-` and `_`. They are front matter keys and query parameters. */
export const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Built-in front matter keys, the index's own query parameters and the keys records carry in decisions.json and MCP. */
export const RESERVED_FIELDS = [
  'title', 'description', 'status', 'date', 'authors', 'deciders', 'tags', 'supersedes', 'supersededBy', 'related',
  'reviewBy', 'reviewed', 'reviewEvery', 'review', 'order', 'draft', 'slug', 'fields', 'project', 'type', 'author', 'tag', 'q', 'view',
  'id', 'ref', 'number', 'url', 'markdown', 'source', 'file', 'body', 'current', 'currentRecord', 'codeRefs',
];

/** Types filtered with chips (one per value); `number` and `date` get a range, `url` no filter. */
export const CHIP_TYPES = ['text', 'enum', 'list', 'boolean'];
export const RANGE_TYPES = ['number', 'date'];

export const fieldSchema = z
  .object({
    type: z.enum(FIELD_TYPES, { error: `type must be one of ${FIELD_TYPES.join(', ')}` }).default('text'),
    label: z.string().min(1).optional(),
    description: z.string().optional(),
    /** Allowed values: required for `enum`, optional for `list`. */
    values: z.array(z.string().min(1)).min(1).optional(),
    required: z.boolean().optional(),
    /** Show a filter for the field on the records index (default true; never for `url`). */
    filter: z.boolean().optional(),
    /** Add a column to the index's table view. */
    column: z.boolean().optional(),
    /** Unit printed after a `number`, e.g. `k€/year`. */
    unit: z.string().min(1).optional(),
    /** Written into new records by `inkan new`. */
    default: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.type === 'enum' && !f.values) ctx.addIssue({ code: 'custom', path: ['values'], message: 'enum fields need a list of values' });
    if (f.values && f.type !== 'enum' && f.type !== 'list') ctx.addIssue({ code: 'custom', path: ['values'], message: 'only applies to enum and list fields' });
    if (f.unit && f.type !== 'number') ctx.addIssue({ code: 'custom', path: ['unit'], message: 'only applies to number fields' });
    const parsed = f.default === undefined ? undefined : parseValue(f, f.default);
    if (parsed && 'error' in parsed) ctx.addIssue({ code: 'custom', path: ['default'], message: parsed.error });
  });

const checkNames = (map, ctx) => {
  for (const name of Object.keys(map)) {
    if (!FIELD_NAME.test(name)) ctx.addIssue({ code: 'custom', path: [name], message: 'field names start with a letter and use letters, digits, - and _' });
    else if (RESERVED_FIELDS.includes(name)) ctx.addIssue({ code: 'custom', path: [name], message: `"${name}" is a built-in key and cannot be a field` });
  }
};

/** `fields` in inkan.config: every project gets them. */
export const fieldsSchema = z.record(z.string(), fieldSchema).superRefine(checkNames);

/** `fields` in `_project.yml`: adds fields, redefines a site field, or turns one off with `false`. */
export const projectFieldsSchema = z.record(z.string(), z.union([z.literal(false), fieldSchema])).superRefine(checkNames);

/**
 * @typedef {{ type: 'text' | 'number' | 'boolean' | 'date' | 'enum' | 'list' | 'url', label?: string, description?: string,
 *   values?: string[], required?: boolean, filter?: boolean, column?: boolean, unit?: string, default?: unknown }} FieldDef
 * @typedef {string | number | boolean | string[]} FieldValue
 * @typedef {FieldDef & { name: string, label: string }} Field
 */

/** Title-cased name, for fields without a `label`: `riskLevel` → `Risk level`, `data-class` → `Data class`. */
export const fieldLabel = (name) => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const withName = (name, def) => ({ ...def, type: def.type ?? 'text', name, label: def.label ?? fieldLabel(name) });

/**
 * The fields of one project: the site's, then the project's own (which replace a site field of the same name,
 * or remove it with `false`), in that order.
 * @returns {Field[]}
 */
export function mergeFields(site = {}, project = {}) {
  const out = new Map(Object.entries(site).map(([name, def]) => [name, withName(name, def)]));
  for (const [name, def] of Object.entries(project)) {
    if (def === false) out.delete(name);
    else out.set(name, withName(name, def));
  }
  return [...out.values()];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `YYYY-MM-DD` of a YAML date or a string naming a real calendar day (`2026-02-30` is not one). */
const dateString = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = typeof v === 'string' ? v.trim() : '';
  return DATE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s ? s : null;
};
const show = (v) => JSON.stringify(v instanceof Date ? v.toISOString().slice(0, 10) : v);
const oneOf = (values, v) => values.find((x) => x === v) ?? values.find((x) => x.toLowerCase() === v.toLowerCase());

/**
 * Checks and normalises one front matter value: numbers from numeric strings, dates as `YYYY-MM-DD`,
 * enum values in their configured spelling, a single list item as a list.
 * @returns {{ value: FieldValue } | { error: string }}
 */
export function parseValue(def, raw) {
  const type = def.type ?? 'text';
  switch (type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      return Number.isFinite(n) ? { value: n } : { error: `${show(raw)} is not a number` };
    }
    case 'boolean':
      if (typeof raw === 'boolean') return { value: raw };
      if (raw === 'true' || raw === 'false') return { value: raw === 'true' };
      return { error: `${show(raw)} is not true or false` };
    case 'date': {
      const d = dateString(raw);
      return d ? { value: d } : { error: `${show(raw)} is not a date (use YYYY-MM-DD)` };
    }
    case 'enum': {
      const v = typeof raw === 'string' || typeof raw === 'number' ? oneOf(def.values ?? [], String(raw).trim()) : undefined;
      return v ? { value: v } : { error: `${show(raw)} is not one of ${(def.values ?? []).join(', ')}` };
    }
    case 'list': {
      const items = Array.isArray(raw) ? raw : [raw];
      if (items.some((i) => typeof i !== 'string' && typeof i !== 'number')) return { error: `${show(raw)} is not a list of values` };
      const out = [];
      for (const item of items.map((i) => String(i).trim()).filter(Boolean)) {
        const v = def.values ? oneOf(def.values, item) : item;
        if (!v) return { error: `${show(item)} is not one of ${def.values.join(', ')}` };
        if (!out.includes(v)) out.push(v);
      }
      return { value: out };
    }
    case 'url': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      return /^(https?:\/\/\S+|\/(?![/\\])\S*)$/i.test(s) ? { value: s } : { error: `${show(raw)} is not a URL (start it with http://, https:// or /)` };
    }
    default:
      if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
        // One line: values end up in YAML-like `name: value` lines for agents.
        const s = String(raw).replace(/\s+/g, ' ').trim();
        return s ? { value: s } : { error: 'is empty' };
      }
      if (raw instanceof Date) return { value: raw.toISOString().slice(0, 10) };
      return { error: `${show(raw)} is not a single value` };
  }
}

const empty = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * The declared fields of a record, read from its front matter. Undeclared keys are ignored.
 * @param {Field[]} fields
 * @param {Record<string, unknown>} data
 * @returns {{ values: Record<string, FieldValue>, issues: { field: string, message: string }[] }}
 */
export function readFields(fields, data) {
  /** @type {Record<string, FieldValue>} */
  const values = {};
  const issues = [];
  for (const f of fields) {
    const raw = data?.[f.name];
    if (empty(raw)) {
      if (f.required) issues.push({ field: f.name, message: `${f.name} is required` });
      continue;
    }
    const parsed = parseValue(f, raw);
    if ('error' in parsed) issues.push({ field: f.name, message: `${f.name}: ${parsed.error}` });
    else values[f.name] = parsed.value;
  }
  return { values, issues };
}

/** Values a filter compares: chips match these strings (`true`/`false` for booleans). */
export const filterValues = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [String(v)]);

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 6 });

/** A value as shown on a page: units after numbers, `words` for booleans, lists comma-joined. */
export function formatValue(def, value, words = { yes: 'Yes', no: 'No' }) {
  if (value === undefined) return '';
  if (def.type === 'boolean') return value ? words.yes : words.no;
  if (def.type === 'number') return `${numberFormat.format(Number(value))}${def.unit ? ` ${def.unit}` : ''}`;
  return Array.isArray(value) ? value.join(', ') : String(value);
}

const describe = (where, error) => {
  const issues = error.issues.map((i) => `${where}: fields${i.path.length ? `.${i.path.join('.')}` : ''}: ${i.message.replace(/^Invalid input: /, '')}`);
  return new Error(`Invalid fields:\n  ${issues.join('\n  ')}`);
};

/**
 * Fields of every project of a resolved config, keyed by project id, from `fields` in the config and in each
 * `_project.yml`. Projects without their own fields get the site's; `site` holds those for folders not on disk.
 * @throws {Error} when a `_project.yml` defines fields badly, or one name has two different types
 * @returns {{ site: Field[], projects: Map<string, Field[]>, all: Field[] }}
 */
export function projectFields(config) {
  const site = mergeFields(config.fields ?? {});
  const projects = new Map();
  for (const [id, p] of loadProjects(config)) {
    if (p.data?.fields === undefined) {
      projects.set(id, site);
      continue;
    }
    const parsed = projectFieldsSchema.safeParse(p.data.fields);
    if (!parsed.success) throw describe(p.file ? path.relative(config.root ?? process.cwd(), p.file) : id, parsed.error);
    projects.set(id, mergeFields(config.fields ?? {}, parsed.data));
  }
  return { site, projects, all: combineFields([site, ...projects.values()]) };
}

/**
 * One definition per field name across projects, for the index's filters: the first definition's label,
 * every project's enum/list values, a column when any project asks for one and no filter when any project
 * turns it off. Two projects may not give one name different types or units.
 * @param {Field[][]} lists
 */
export function combineFields(lists) {
  const out = new Map();
  for (const list of lists) {
    for (const f of list) {
      const seen = out.get(f.name);
      if (!seen) {
        out.set(f.name, { ...f, values: f.values && [...f.values] });
        continue;
      }
      if (seen.type !== f.type) throw new Error(`Invalid fields: "${f.name}" is a ${seen.type} field in one project and a ${f.type} field in another`);
      if (seen.unit !== f.unit) throw new Error(`Invalid fields: "${f.name}" is measured in ${seen.unit ?? 'no unit'} in one project and in ${f.unit ?? 'no unit'} in another`);
      if (f.values) seen.values = [...new Set([...(seen.values ?? []), ...f.values])];
      if (f.column) seen.column = true;
      if (f.filter === false) seen.filter = false;
    }
  }
  return [...out.values()];
}
