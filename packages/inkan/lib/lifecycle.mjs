import fs from 'node:fs';
import path from 'node:path';
import { closest } from './config.mjs';
import { findRecords, repoSourceOf, today } from './records.mjs';
import { isoDate } from './reviews.mjs';

/** `--<flag> YYYY-MM-DD` validated as a real calendar date. */
export function dateArg(flag, value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isoDate(value) !== value) throw new Error(`--${flag} must be a date like 2026-10-17.`);
  return value;
}

/** `date` to write for `--date`: today when the flag is bare, the given day otherwise; undefined without the flag. */
export const dateFlag = (flags) => (flags.date === undefined ? undefined : flags.date === true ? today() : dateArg('date', flags.date));

/** `findRecords` that explains why nothing (or too much) matched. */
export function resolveRecord(records, query) {
  const hits = findRecords(records, query);
  if (hits.length === 1) return hits[0];
  const q = String(query).trim();
  if (hits.length > 1) throw new Error(`"${q}" is ambiguous: ${hits.map((r) => r.id).join(', ')}. Use the full id.`);
  const hint = closest(q, records.map((r) => r.id)) ?? closest(q, records.map((r) => r.ref).filter(Boolean));
  throw new Error(`No record matches "${q}".${hint ? ` Did you mean "${hint}"?` : ''}`);
}

/** Records fetched from a `repo` source live in a read-only clone: edit them in their own repository. */
export function assertEditable(config, record) {
  const source = repoSourceOf(config, record.file);
  if (source) throw new Error(`${record.id} comes from the "${source.project}" source (${source.repo}) and cannot be edited here; change it in that repository.`);
}

/** Unified-style diff of two texts (only changed lines, with `-`/`+` markers), for `--dry-run`. */
export function diffLines(before, after, file) {
  const a = before.split('\n');
  const b = after.split('\n');
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  for (let i = 0, j = 0; i < a.length || j < b.length; ) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (i < a.length && (j >= b.length || lcs[i + 1][j] >= lcs[i][j + 1])) out.push(`- ${a[i++]}`);
    else out.push(`+ ${b[j++]}`);
  }
  return [`--- ${file}`, ...out].join('\n');
}

/** Writes `text` to `file`, or prints the diff when `dryRun` is set. */
export function writeOrPreview(file, before, after, dryRun, log = console.log) {
  if (before === after) return false;
  if (dryRun) log(diffLines(before, after, path.relative(process.cwd(), file) || file));
  else fs.writeFileSync(file, after);
  return true;
}

export const unique = (list) => [...new Set(list)];
