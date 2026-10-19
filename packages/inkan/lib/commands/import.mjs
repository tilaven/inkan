import fs from 'node:fs';
import path from 'node:path';
import { closest, loadConfig } from '../config.mjs';
import { unique } from '../lifecycle.mjs';
import { assertProjectName, loadProjects, markdownFiles, parseFrontMatter, projectId, slugify, updateFrontMatter, yamlScalar } from '../records.mjs';
import { plural } from '../text.mjs';

const USAGE = 'Usage: inkan import <dir|file...> --project <name> [--type adr] [--format auto|log4brains|madr|adr-tools] [--dry-run]';
const FORMATS = ['auto', 'log4brains', 'madr', 'adr-tools'];
const SKIP = new Set(['readme', 'index', 'template']);
const LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
/** Status spellings other tools use, mapped to ours (only when that status is configured). */
const SYNONYMS = { approved: 'accepted', pending: 'proposed', wip: 'draft', declined: 'rejected', obsolete: 'deprecated', done: 'implemented' };

const splitList = (v) => (Array.isArray(v) ? v.map(String) : String(v ?? '').split(/\s*,\s*/)).map((s) => s.trim().replace(/^@/, '')).filter(Boolean);

function toDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isNaN(t) || !/\d{4}/.test(s) ? undefined : new Date(t).toISOString().slice(0, 10);
}

/** Lines before the first `## ` heading (the preamble) and the rest. */
function splitPreamble(body) {
  const lines = body.split('\n');
  const at = lines.findIndex((l) => /^##\s/.test(l));
  return at < 0 ? [lines, []] : [lines.slice(0, at), lines.slice(at)];
}

/** Detects the dialect of one file; "madr" covers log4brains and MADR 2–4. */
export function detectFormat(text) {
  const { body } = parseFrontMatter(text);
  const [preamble] = splitPreamble(body);
  if (/^##\s+Status\s*$/m.test(body) && preamble.some((l) => /^Date:\s*\S/.test(l))) return 'adr-tools';
  return 'madr';
}

/**
 * @typedef {object} Parsed
 * @property {string} title
 * @property {number | null} number
 * @property {string | undefined} status raw, mapped by the caller
 * @property {string | undefined} date
 * @property {string} body
 * @property {Record<string, string[]>} data deciders, tags, consulted, informed
 * @property {string[]} supersedes link targets, resolved by the caller
 * @property {string[]} supersededBy
 * @property {string[]} related
 */

/**
 * Converts one source file; `null` when it has neither a `# ` heading nor a front-matter title.
 * @returns {Parsed | null}
 */
export function parseSource(text, format) {
  const { data: fm, body: raw } = parseFrontMatter(text);
  const lines = raw.split('\n');
  const headingAt = lines.findIndex((l) => /^#\s+\S/.test(l));
  let title = headingAt >= 0 ? lines[headingAt].replace(/^#\s+/, '').trim() : fm.title ? String(fm.title) : null;
  if (!title) return null;
  if (headingAt >= 0) lines.splice(headingAt, 1);
  let number = null;
  const numbered = /^(\d+)\.\s+(.+)$/.exec(title);
  if (numbered) {
    number = Number(numbered[1]);
    title = numbered[2];
  }

  /** @type {Parsed} */
  const out = {
    title,
    number,
    status: fm.status != null ? String(fm.status) : undefined,
    date: toDate(fm.date),
    body: '',
    data: {},
    supersedes: [],
    supersededBy: [],
    related: [],
  };
  const [preamble, rest] = splitPreamble(lines.join('\n'));
  const keep = [];
  if (format === 'adr-tools') {
    for (const line of preamble) {
      const m = /^Date:\s*(.+)$/.exec(line);
      if (m) out.date ??= toDate(m[1]);
      else keep.push(line);
    }
    let inStatus = false;
    const body = [];
    for (const line of rest) {
      if (/^##\s/.test(line)) inStatus = /^##\s+Status\s*$/.test(line);
      if (!inStatus) body.push(line);
      else if (!/^##\s/.test(line) && line.trim()) {
        const l = line.trim();
        if (/^supersedes\b/i.test(l)) out.supersedes.push(...linkTargets(l));
        else if (/^(amended|extended|clarified|related)/i.test(l)) out.related.push(...linkTargets(l));
        else out.status ??= l;
      }
    }
    out.body = [...keep, ...body].join('\n');
  } else {
    for (const line of preamble) {
      const m = /^[*-]\s+([A-Za-z][A-Za-z -]*?):\s*(.*)$/.exec(line);
      const key = m ? m[1].toLowerCase().replace(/[\s-]+/g, '') : '';
      if (!m) keep.push(line);
      else if (key === 'status') out.status ??= m[2];
      else if (key === 'date') out.date ??= toDate(m[2]);
      else if (key === 'deciders' || key === 'decisionmakers') out.data.deciders = splitList(m[2]);
      else if (key === 'tags') out.data.tags = splitList(m[2]);
      else if (key === 'consulted' || key === 'informed') out.data[key] = splitList(m[2]);
      else keep.push(line);
    }
    for (const [key, value] of Object.entries(fm)) {
      const k = key.toLowerCase().replace(/[\s-]+/g, '');
      if (k === 'deciders' || k === 'decisionmakers') out.data.deciders = splitList(value);
      else if (k === 'tags') out.data.tags = splitList(value);
      else if (k === 'consulted' || k === 'informed') out.data[k] = splitList(value);
    }
    out.body = [...keep, ...rest].join('\n');
  }
  if (out.status) {
    const by = /^superseded\s+by\b(.*)$/i.exec(out.status.trim());
    if (by) out.supersededBy = linkTargets(by[1]);
  }
  out.body = out.body.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return out;
}

const linkTargets = (text) => [...text.matchAll(LINK)].map((m) => m[2]);

/** Maps a source status ("Accepted", "superseded by [..](..)") to a configured status key. */
export function mapStatus(raw, statuses) {
  if (!raw) return undefined;
  const word = raw.trim().toLowerCase().replace(/[^a-z].*$/, '');
  if (!word) return undefined;
  const key = word in statuses ? word : SYNONYMS[word] in statuses ? SYNONYMS[word] : closest(word, Object.keys(statuses));
  return key ?? undefined;
}

/** Source files: folders are walked, README/index/template files skipped. */
function collect(inputs, root) {
  const files = [];
  for (const input of inputs) {
    const p = path.resolve(root, input);
    if (!fs.existsSync(p)) throw new Error(`${input}: no such file or folder`);
    if (fs.statSync(p).isDirectory()) files.push(...markdownFiles(p));
    else files.push(p);
  }
  return unique(files).filter((f) => !SKIP.has(path.basename(f).replace(/\.mdx?$/, '').toLowerCase()));
}

/** Number and slug hints from a file name: `0001-x.md` -> number; `20200927-x.md` (log4brains) -> date. */
function fromName(file) {
  const base = path.basename(file).replace(/\.mdx?$/, '');
  const m = /^(\d+)[-_. ]*(.*)$/.exec(base);
  if (!m) return { slug: slugify(base) };
  const digits = m[1];
  const slug = slugify(m[2]) || undefined;
  if (digits.length === 8 && /^(19|20)\d{6}$/.test(digits)) {
    return { slug, date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` };
  }
  return { slug, number: Number(digits) };
}

/**
 * `inkan import <dir|file...> --project <name>`: converts log4brains / MADR / adr-tools records
 * into `<contentDir>/<project>/<type>/NNNN-slug.md`. Existing files are never overwritten.
 */
export async function run({ args, flags, root, log = console.log, warn = console.warn }) {
  const project = typeof flags.project === 'string' ? flags.project : null;
  if (!args.length || !project) throw new Error(USAGE);
  const format = flags.format ?? 'auto';
  if (!FORMATS.includes(format)) throw new Error(`Unknown format "${format}". Known: ${FORMATS.join(', ')}.`);
  const config = await loadConfig(root);
  const type = flags.type ?? 'adr';
  if (!config.docTypes[type]) throw new Error(`Unknown type "${type}". Known: ${Object.keys(config.docTypes).join(', ')}.`);
  if (config.sources.some((s) => s.project === projectId(project))) throw new Error(`"${project}" is fetched from a source; import into a different project name.`);
  // Same rule as `inkan new`: an existing folder by its name or slug, otherwise a plain new name.
  const folder = loadProjects(config).get(projectId(project))?.folder;
  if (!folder) assertProjectName(project);
  const dryRun = Boolean(flags['dry-run']);
  const dir = path.join(config.contentDir, folder ?? project, type);
  const rel = (f) => path.relative(process.cwd(), f) || f;

  const existing = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.mdx?$/.test(f)) : [];
  const taken = new Set(existing.map((f) => Number(/^(\d+)/.exec(f)?.[1])).filter((n) => n));
  const existingSlugs = new Map(existing.map((f) => [f.replace(/^\d+-?/, '').replace(/\.mdx?$/, ''), f]));
  let next = Math.max(0, ...taken) + 1;
  const freeNumber = () => {
    while (taken.has(next)) next++;
    taken.add(next);
    return next;
  };

  /** @type {Array<Parsed & { file: string, slug: string, dialect: string, name: string, id: string }>} */
  const items = [];
  const skipped = [];
  for (const file of collect(args, root)) {
    const text = fs.readFileSync(file, 'utf8');
    const dialect = format === 'auto' ? detectFormat(text) : format === 'adr-tools' ? 'adr-tools' : 'madr';
    const parsed = parseSource(text, dialect);
    if (!parsed) {
      skipped.push(`${rel(file)}: no heading`);
      continue;
    }
    const hint = fromName(file);
    const slug = hint.slug ?? slugify(parsed.title);
    if (existingSlugs.has(slug)) {
      skipped.push(`${rel(file)}: already imported as ${existingSlugs.get(slug)}`);
      continue;
    }
    existingSlugs.set(slug, rel(file));
    items.push({ file, slug, dialect, name: '', id: '', ...parsed, number: parsed.number ?? hint.number ?? null, date: parsed.date ?? hint.date });
  }
  // Original numbers win when free; the rest get the next free number in file order.
  for (const item of items) {
    if (item.number && !taken.has(item.number)) taken.add(item.number);
    else item.number = null;
  }
  for (const item of items) {
    item.number ??= freeNumber();
    item.name = `${String(item.number).padStart(4, '0')}-${item.slug}.md`;
    item.id = `${projectId(project)}/${type}/${item.name.replace(/\.md$/, '')}`;
  }

  const byPath = new Map(items.map((i) => [i.file, i]));
  const resolveLink = (from, target) => {
    const clean = target.split(/[#?]/)[0];
    if (!clean || /^[a-z]+:/i.test(clean) || clean.startsWith('/')) return null;
    return byPath.get(path.resolve(path.dirname(from), clean)) ?? null;
  };
  const toIds = (item, targets, what) =>
    targets.flatMap((t) => {
      const hit = resolveLink(item.file, t);
      if (!hit) warn(`${rel(item.file)}: ${what} link "${t}" points outside this import; left out`);
      return hit ? [hit.id] : [];
    });

  if (!dryRun) fs.mkdirSync(dir, { recursive: true });
  const projectFile = path.join(config.contentDir, folder ?? project, '_project.yml');
  if (!fs.existsSync(projectFile) && !dryRun) {
    fs.writeFileSync(projectFile, `name: ${yamlScalar(project)}\ndescription:\nowners: []\n`);
    log(`Created ${rel(projectFile)} – fill in the project details.`);
  }

  for (const item of items) {
    const status = mapStatus(item.status, config.statuses);
    if (item.status && !status) warn(`${rel(item.file)}: status "${item.status}" is not configured; left out`);
    const body = item.body.replace(LINK, (whole, text, target) => {
      const hit = resolveLink(item.file, target);
      return hit ? `[${text}](./${hit.name}${/#.*/.exec(target)?.[0] ?? ''})` : whole;
    });
    const list = (v) => (v?.length ? v : undefined);
    const data = {
      title: item.title,
      status,
      date: item.date,
      deciders: list(item.data.deciders),
      consulted: list(item.data.consulted),
      informed: list(item.data.informed),
      tags: list(item.data.tags),
      supersedes: list(toIds(item, item.supersedes, 'supersedes')),
      supersededBy: list(toIds(item, item.supersededBy, 'superseded by')),
      related: list(toIds(item, item.related, 'related')),
    };
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    // Built on an empty file: a `---` rule at the top of the body must stay in the body.
    const out = updateFrontMatter('', changes, rel(item.file)) + body;
    const target = path.join(dir, item.name);
    if (fs.existsSync(target)) {
      skipped.push(`${rel(item.file)}: ${rel(target)} exists`);
      continue;
    }
    if (!dryRun) fs.writeFileSync(target, out);
    log(`${dryRun ? 'Would write' : 'Wrote'} ${rel(target)}  <- ${rel(item.file)} (${item.dialect}${status ? `, ${status}` : ''})`);
  }
  for (const s of skipped) log(`Skipped ${s}`);
  const written = items.length - skipped.filter((s) => s.includes(' exists')).length;
  log(`${dryRun ? 'Would import' : 'Imported'} ${plural(written, 'record')} into ${rel(dir)}${skipped.length ? `, skipped ${skipped.length}` : ''}.`);
  return 0;
}
