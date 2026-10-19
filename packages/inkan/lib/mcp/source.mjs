import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.mjs';
import { defaults } from '../defaults.mjs';
import { projectFields, readFields } from '../fields.mjs';
import { asList, loadProjects, loadRecords, parseFrontMatter } from '../records.mjs';
import { reviewSchedule } from '../reviews.mjs';
import { recordReview } from '../rfc-reviews.mjs';

/**
 * @typedef {{ id: string, ref: string | null, title: string, description: string | null, type: string, project: string,
 *   number: number | null, status: string | null, date: string | null, authors: string[], deciders: string[], tags: string[],
 *   fields: Record<string, string | number | boolean | string[]>, supersedes: string[], supersededBy: string[], related: string[], url: string | null, source: string | null,
 *   review: { due: string, reviewed: string | null, every: string | null } | null,
 *   reviewers: import('../rfc-reviews.mjs').Review[], rfcReview: McpRfcReview | null,
 *   file: string | null, body: () => Promise<string> }} McpRecord
 * @typedef {{ status: string, approved: number, required: number, waitingOn: string[] }} McpRfcReview
 * @typedef {{ id: string, name: string, description: string | null, owners: string[], records: number }} McpProject
 * @typedef {{ mode: 'local' | 'remote', label: string, records: () => Promise<McpRecord[]>, projects: () => Promise<McpProject[]>,
 *   isCurrent: (record: McpRecord) => boolean,
 *   fields?: () => Promise<{ fields: import('../fields.mjs').Field[], projects: Record<string, import('../fields.mjs').Field[]> }> }} Source
 */

const isoDate = (v) => (v == null || v === '' ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const text = (v) => (v == null || v === '' ? null : String(v));
const reviewOf = (r) => {
  const due = isoDate(r?.due);
  return due ? { due, reviewed: isoDate(r.reviewed), every: text(r.every) } : null;
};
/** The RFC review of a record, or null when nobody was asked to review it. */
const rfcReviewOf = ({ reviewers, approved, required, status, waitingOn }) => (reviewers.length ? { status, approved, required, waitingOn } : null);
const byDate = (a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id);

/**
 * Reads the content folder on every call, so edits show up without restarting the server.
 * @returns {Source}
 */
export function localSource(root) {
  let statuses = defaults.statuses;
  const config = async () => {
    const cfg = await loadConfig(root, { warn: (m) => console.error(m) });
    statuses = cfg.statuses;
    return cfg;
  };
  return {
    mode: /** @type {const} */ ('local'),
    label: root,
    async records() {
      const cfg = await config();
      const fields = projectFields(cfg);
      const projects = loadProjects(cfg);
      const schedule = reviewSchedule(cfg, projects);
      return loadRecords(cfg)
        .filter((r) => !r.data.draft)
        .map((r) => ({
          id: r.id,
          ref: r.ref,
          title: text(r.data.title) ?? r.id,
          description: text(r.data.description),
          type: r.type,
          project: r.project,
          number: r.number,
          status: text(r.data.status),
          date: isoDate(r.data.date),
          authors: asList(r.data.authors),
          deciders: asList(r.data.deciders),
          tags: asList(r.data.tags),
          fields: readFields(fields.projects.get(r.project) ?? fields.site, r.data).values,
          supersedes: asList(r.data.supersedes),
          supersededBy: asList(r.data.supersededBy),
          related: asList(r.data.related),
          url: cfg.url ? new URL(`${cfg.base.replace(/\/$/, '')}/${r.id}/`, cfg.url).toString() : null,
          source: path.relative(cfg.repoRoot, fs.realpathSync(r.file)).split(path.sep).join('/'),
          review: reviewOf(schedule(r)),
          reviewers: recordReview(r.data, cfg).reviewers,
          rfcReview: rfcReviewOf(recordReview(r.data, cfg)),
          file: r.file,
          body: async () => r.body,
        }))
        .sort(byDate);
    },
    async projects() {
      const cfg = await config();
      const records = loadRecords(cfg);
      return [...loadProjects(cfg).values()]
        .map((p) => ({
          id: p.id,
          name: text(p.data?.name) ?? p.id,
          description: text(p.data?.description),
          owners: asList(p.data?.owners),
          order: Number(p.data?.order ?? 100),
          records: records.filter((r) => r.project === p.id && !r.data.draft).length,
        }))
        .filter((p) => p.records || p.name !== p.id)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(({ order, ...p }) => p);
    },
    async fields() {
      const { site, projects } = projectFields(await config());
      return { fields: site, projects: Object.fromEntries([...projects].filter(([, f]) => f !== site)) };
    },
    isCurrent: (r) => Boolean(r.status && statuses[r.status]?.current),
  };
}

const currentByDefault = new Set(Object.entries(defaults.statuses).filter(([, s]) => s.current).map(([k]) => k));

/**
 * Reads a published site: `<url>/decisions.json` for the index, `<url>/<id>.md` for bodies and `<url>/llms.txt`
 * for project names. Responses are cached for `ttl` ms.
 * @returns {Source}
 */
export function remoteSource(url, { ttl = 30_000, timeout = 10_000, fetchImpl = globalThis.fetch } = {}) {
  const base = url.replace(/\/+$/, '') + '/';
  const cache = new Map();
  const get = async (file, parse) => {
    const hit = cache.get(file);
    if (hit && hit.until > Date.now()) return hit.value;
    const res = await fetchImpl(new URL(file, base), { signal: AbortSignal.timeout(timeout) }).catch((e) => {
      throw new Error(e?.name === 'TimeoutError' ? `${base}${file} did not answer within ${timeout / 1000}s` : `${base}${file}: ${e?.message ?? e}`);
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${base}${file}`);
    const value = await parse(res);
    cache.set(file, { value, until: Date.now() + ttl });
    return value;
  };
  const index = async () => {
    const rows = await get('decisions.json', (r) => r.json());
    if (!Array.isArray(rows)) throw new Error(`${base}decisions.json is not a list of records`);
    return rows;
  };
  return {
    mode: /** @type {const} */ ('remote'),
    label: base,
    async records() {
      return (await index())
        .map((d) => {
          const num = /^(\d+)/.exec(String(d.id).split('/').pop() ?? '')?.[1];
          return {
            id: String(d.id),
            ref: text(d.ref),
            title: text(d.title) ?? String(d.id),
            description: text(d.description),
            type: String(d.type ?? d.id.split('/')[1] ?? ''),
            project: String(d.project ?? d.id.split('/')[0] ?? ''),
            number: num ? Number(num) : null,
            status: text(d.status),
            date: isoDate(d.date),
            authors: asList(d.authors),
            deciders: asList(d.deciders),
            tags: asList(d.tags),
            fields: d.fields && typeof d.fields === 'object' && !Array.isArray(d.fields) ? d.fields : {},
            supersedes: asList(d.supersedes),
            supersededBy: asList(d.supersededBy),
            related: asList(d.related),
            reviewers: Array.isArray(d.reviewers) ? d.reviewers : [],
            rfcReview: Array.isArray(d.reviewers) && d.reviewers.length && d.rfcReview ? rfcReviewOf({ ...d.rfcReview, reviewers: d.reviewers }) : null,
            url: text(d.url),
            source: text(d.source),
            review: reviewOf(d.review),
            file: null,
            body: () => get(`${d.id}.md`, async (r) => parseFrontMatter(await r.text()).body),
          };
        })
        .sort(byDate);
    },
    async projects() {
      const records = await index();
      const names = new Map();
      try {
        const lines = (await get('llms.txt', (r) => r.text())).split('\n');
        lines.forEach((line, i) => {
          const m = /^## (.+) \(([^()]+)\)$/.exec(line);
          if (m) names.set(m[2], { name: m[1], description: lines[i + 2]?.startsWith('- ') ? null : text(lines[i + 2]?.trim()) });
        });
      } catch (e) {
        console.error(`inkan mcp: ${e instanceof Error ? e.message : e}`);
      }
      const ids = [...new Set(records.map((d) => String(d.project)))].sort();
      return ids.map((id) => ({
        id,
        name: names.get(id)?.name ?? id,
        description: names.get(id)?.description ?? null,
        owners: [],
        records: records.filter((d) => d.project === id).length,
      }));
    },
    isCurrent: (r) => currentByDefault.has(r.status ?? ''),
  };
}
