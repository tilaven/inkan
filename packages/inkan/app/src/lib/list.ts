/**
 * Filter state of the records index, mirrored in the query string
 * (`?status=accepted,draft&project=sre&risk=high&cost=10..50&q=kafka&view=table`). Pure and
 * browser-safe: the page's client script imports it too.
 */
export const FACETS = ['status', 'project', 'type', 'author', 'tag'] as const;
export type Facet = (typeof FACETS)[number];
export type View = 'cards' | 'table';

/** A custom field the index filters on: chips (any of a set of values) or a `min..max` range. */
export interface FieldSpec {
  name: string;
  kind: 'chips' | 'range';
}

/** Bounds as written in the query string; an empty bound is open. */
export interface Range {
  min: string;
  max: string;
}

export interface ListState {
  facets: Record<Facet, Set<string>>;
  /** Chip field filters by field name. */
  chips: Record<string, Set<string>>;
  /** Range field filters by field name. */
  ranges: Record<string, Range>;
  q: string;
  view: View;
}

export interface ListRecord {
  id: string;
  project: string;
  type: string;
  status: string;
  authors: string[];
  tags: string[];
  /** Custom field values: chip fields as strings (`true`/`false` for booleans), range fields as a number or `YYYY-MM-DD`. */
  fields: Record<string, string[] | number | string>;
  /** Lower-cased title, tags and description, for the free-text filter. */
  text: string;
}

const emptyFacets = () => Object.fromEntries(FACETS.map((f) => [f, new Set<string>()])) as Record<Facet, Set<string>>;

export const emptyState = (fields: FieldSpec[] = []): ListState => ({
  facets: emptyFacets(),
  chips: Object.fromEntries(fields.filter((f) => f.kind === 'chips').map((f) => [f.name, new Set<string>()])),
  ranges: Object.fromEntries(fields.filter((f) => f.kind === 'range').map((f) => [f.name, { min: '', max: '' }])),
  q: '',
  view: 'cards',
});

const decode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
};

/** `10..50`, `10..`, `..50`, or a single value meaning exactly that. */
export function parseRange(raw: string): Range {
  const at = raw.indexOf('..');
  const [min, max] = at < 0 ? [raw, raw] : [raw.slice(0, at), raw.slice(at + 2)];
  return { min: bound(min), max: bound(max) };
}

/** A number or a `YYYY-MM-DD` date; anything else leaves that side of the range open. */
const bound = (s: string) => {
  const v = s.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) || (v !== '' && Number.isFinite(Number(v))) ? v : '';
};

const rangeSet = (r: Range) => r.min !== '' || r.max !== '';
const serializeRange = (r: Range) => (r.min === r.max ? encodeURIComponent(r.min) : `${encodeURIComponent(r.min)}..${encodeURIComponent(r.max)}`);

/**
 * Reads the state from a query string. Facet and chip values may be repeated (`tag=a&tag=b`) or
 * comma-separated (`tag=a,b`); a comma inside a value is `%2C`, so lists are split before decoding.
 * Field names are query parameters of their own and never collide with the built-in ones.
 */
export function parseState(search: string, fields: FieldSpec[] = []): ListState {
  const state = emptyState(fields);
  const sets = new Map<string, Set<string>>([...FACETS.map((f) => [f, state.facets[f]] as const), ...Object.entries(state.chips)]);
  for (const pair of search.replace(/^\?/, '').split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    const raw = eq < 0 ? '' : pair.slice(eq + 1);
    const set = sets.get(key);
    if (set) {
      for (const part of raw.split(',')) {
        const v = decode(part).trim();
        if (v) set.add(v);
      }
    } else if (Object.hasOwn(state.ranges, key)) {
      const r = parseRange(decode(raw));
      if (rangeSet(r)) state.ranges[key] = r;
    } else if (key === 'q') state.q = decode(raw).trim();
    else if (key === 'view' && decode(raw) === 'table') state.view = 'table';
  }
  return state;
}

/**
 * The query string (without `?`) for a state; empty when nothing is set. Built-in facets first, then fields in
 * `fields` order, then `q` and `view`. Lists are comma-joined, commas in values encoded.
 */
export function serializeState(state: ListState, fields: FieldSpec[] = []): string {
  const parts: string[] = [];
  const list = (name: string, set: Set<string>) => set.size && parts.push(`${name}=${[...set].map(encodeURIComponent).join(',')}`);
  for (const f of FACETS) list(f, state.facets[f]);
  for (const f of fields) {
    if (f.kind === 'chips') list(f.name, state.chips[f.name] ?? new Set());
    else if (state.ranges[f.name] && rangeSet(state.ranges[f.name])) parts.push(`${f.name}=${serializeRange(state.ranges[f.name])}`);
  }
  if (state.q) parts.push(`q=${encodeURIComponent(state.q).replace(/%20/g, '+')}`);
  if (state.view === 'table') parts.push('view=table');
  return parts.join('&');
}

export const isFiltered = (state: ListState) =>
  state.q !== '' ||
  FACETS.some((f) => state.facets[f].size > 0) ||
  Object.values(state.chips).some((s) => s.size > 0) ||
  Object.values(state.ranges).some(rangeSet);

/** Numbers compare numerically, dates as `YYYY-MM-DD` strings. */
export function inRange(v: number | string, { min, max }: Range): boolean {
  if (typeof v === 'number') return (!min || v >= Number(min)) && (!max || v <= Number(max));
  return (!min || v >= min) && (!max || v <= max);
}

/**
 * Every chosen facet must match (one of its values), every active field filter must match the record's value
 * (a record without the field fails), and every word of `q` must occur in the record text.
 */
export function matches(r: ListRecord, state: ListState): boolean {
  const { facets } = state;
  if (facets.project.size && !facets.project.has(r.project)) return false;
  if (facets.type.size && !facets.type.has(r.type)) return false;
  if (facets.status.size && !facets.status.has(r.status)) return false;
  if (facets.author.size && !r.authors.some((a) => facets.author.has(a))) return false;
  if (facets.tag.size && !r.tags.some((t) => facets.tag.has(t))) return false;
  for (const [name, set] of Object.entries(state.chips)) {
    if (!set.size) continue;
    const v = r.fields[name];
    if (!Array.isArray(v) || !v.some((x) => set.has(x))) return false;
  }
  for (const [name, range] of Object.entries(state.ranges)) {
    if (!rangeSet(range)) continue;
    const v = r.fields[name];
    if (v === undefined || Array.isArray(v) || !inRange(v, range)) return false;
  }
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => r.text.includes(w));
}

export const recordText = (r: { title: string; tags: string[]; description?: string }) =>
  [r.title, ...r.tags.map((t) => `#${t}`), r.description ?? ''].join(' ').toLowerCase();
