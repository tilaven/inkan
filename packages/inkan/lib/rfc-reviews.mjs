/**
 * RFC review: who is asked to review a record, what each reviewer said, and whose move it is.
 *
 * `reviewers` in front matter takes a list of handles (everyone pending) or a map of handle to state,
 * where a state is a word or `{ state, date, note }`:
 *
 *   reviewers: [alice, bob]
 *   reviewers:
 *     alice: approved
 *     bob: { state: changes-requested, date: 2026-10-12, note: Needs a rollback plan }
 *
 * List items may also be one-key maps (`- bob: approved`), so a list can be upgraded one line at a time.
 */

import { asList } from './records.mjs';

export const REVIEW_STATES = ['pending', 'approved', 'changes-requested'];

/**
 * @typedef {'pending' | 'approved' | 'changes-requested'} ReviewState
 * @typedef {{ handle: string, state: ReviewState, date?: string, note?: string }} Review
 * @typedef {'none' | 'in-review' | 'changes-requested' | 'approved' | 'closed'} ReviewStatus
 * @typedef {{
 *   reviewers: Review[], approved: number, changesRequested: number, pending: number, required: number,
 *   status: ReviewStatus, waitingOn: string[]
 * }} ReviewSummary
 */

/** Handles compare without case and a leading `@`, as on the site: `@Marek` and `marek` are one person. */
export const handleKey = (handle) => String(handle ?? '').trim().replace(/^@/, '').toLowerCase();

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
const dateText = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? undefined : String(v));

/** One reviewer from a handle and its state value; `errors` collects what cannot be read. */
function entry(handle, value, errors) {
  const h = String(handle).trim().replace(/^@/, '');
  if (!h) {
    errors.push('reviewer with an empty handle');
    return null;
  }
  const raw = isObject(value) ? value : { state: value };
  const unknown = Object.keys(raw).filter((k) => !['state', 'date', 'note'].includes(k));
  if (unknown.length) errors.push(`reviewer "${h}" has unknown key${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')} (use state, date, note)`);
  const state = raw.state == null ? 'pending' : String(raw.state).trim().toLowerCase();
  if (!REVIEW_STATES.includes(state)) {
    errors.push(`reviewer "${h}" has unknown state "${raw.state}" (use ${REVIEW_STATES.join(', ')})`);
    return null;
  }
  return {
    handle: h,
    state,
    ...(raw.date != null && { date: dateText(raw.date) }),
    ...(raw.note != null && { note: String(raw.note) }),
  };
}

/**
 * Reads a `reviewers` front matter value. Never throws: problems come back in `errors`, and the readable
 * reviewers are still returned, each handle once (compared with `handleKey`; the last mention wins).
 * @returns {{ reviewers: Review[], errors: string[] }}
 */
export function parseReviewers(value) {
  const errors = [];
  const out = new Map();
  const add = (handle, state) => {
    const r = entry(handle, state, errors);
    if (r) out.set(handleKey(r.handle), r);
  };
  if (value == null) return { reviewers: [], errors };
  if (typeof value === 'string') add(value);
  else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' || typeof item === 'number') add(item);
      else if (isObject(item) && Object.keys(item).length === 1) add(...Object.entries(item)[0]);
      else errors.push(`reviewers item ${JSON.stringify(item)} is not a handle or "handle: state"`);
    }
  } else if (isObject(value)) {
    for (const [handle, state] of Object.entries(value)) add(handle, state);
  } else errors.push(`reviewers must be a list of handles or a map of handle to state, not ${JSON.stringify(value)}`);
  return { reviewers: [...out.values()], errors };
}

/**
 * Where a record's review stands.
 * - `in-review`: waiting on the reviewers who have not answered.
 * - `changes-requested`: someone asked for changes, so it waits on the authors.
 * - `approved`: enough approvals; it waits on the deciders (or the authors) to settle the status.
 * - `closed`: the record is no longer open; `none`: nobody was asked.
 * @param {{ reviewers: Review[], authors?: string[], deciders?: string[], open: boolean, approvals?: number | null }} input
 * @returns {ReviewSummary}
 */
export function reviewSummary({ reviewers, authors = [], deciders = [], open, approvals = null }) {
  const count = (state) => reviewers.filter((r) => r.state === state).length;
  const approved = count('approved');
  const changesRequested = count('changes-requested');
  const pending = count('pending');
  const required = Math.min(approvals ?? reviewers.length, reviewers.length);
  const base = { reviewers, approved, changesRequested, pending, required };
  if (!reviewers.length) return { ...base, status: 'none', waitingOn: [] };
  if (!open) return { ...base, status: 'closed', waitingOn: [] };
  if (changesRequested) return { ...base, status: 'changes-requested', waitingOn: [...new Set(authors)] };
  if (approved >= required) return { ...base, status: 'approved', waitingOn: [...new Set(deciders.length ? deciders : authors)] };
  return { ...base, status: 'in-review', waitingOn: reviewers.filter((r) => r.state === 'pending').map((r) => r.handle) };
}

/**
 * The `reviewers` value with one reviewer's state set, in map form. An existing reviewer is matched with `handleKey`
 * and keeps its spelling; other reviewers keep what they had;
 * a reviewer reset to `pending` without a note is written as a bare `pending`.
 * @param {unknown} value
 * @param {string} handle
 * @param {string} state
 * @param {{ date?: string, note?: string }} [opts]
 */
export function setReview(value, handle, state, { date, note } = {}) {
  if (!REVIEW_STATES.includes(state)) throw new Error(`Unknown review state "${state}" (use ${REVIEW_STATES.join(', ')})`);
  const { reviewers, errors } = parseReviewers(value);
  if (errors.length) throw new Error(errors[0]);
  /** @type {Map<string, { handle: string, state: string, date?: string, note?: string }>} */
  const next = new Map(reviewers.map((r) => [handleKey(r.handle), r]));
  const key = handleKey(handle);
  if (!key) throw new Error('Reviewer handle is empty');
  next.set(key, { handle: next.get(key)?.handle ?? String(handle).trim().replace(/^@/, ''), state, ...(date && state !== 'pending' && { date }), ...(note && { note }) });
  return Object.fromEntries(
    [...next.values()].map(({ handle: h, state: s, date: d, note: n }) => [h, d || n ? { state: s, ...(d && { date: d }), ...(n && { note: n }) } : s]),
  );
}

/** Review summary of a record's raw front matter, with open statuses and the approvals rule taken from the config. */
export function recordReview(data, config) {
  return reviewSummary({
    reviewers: parseReviewers(data.reviewers).reviewers,
    authors: asList(data.authors),
    deciders: asList(data.deciders),
    open: Boolean(config.statuses?.[data.status]?.open),
    approvals: config.reviewers?.approvals ?? null,
  });
}
