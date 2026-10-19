import fs from 'node:fs';
import { loadConfig } from '../config.mjs';
import { assertEditable, dateFlag, resolveRecord, writeOrPreview } from '../lifecycle.mjs';
import { asList, findRecord, loadRecords, updateFrontMatter } from '../records.mjs';

const USAGE = 'Usage: inkan supersede <old> <new> [--date [YYYY-MM-DD]] [--dry-run]';

/**
 * `inkan supersede <old> <new>`: marks <old> as superseded by <new> and links both ways.
 * `--date` also stamps `date` on <old>, the record whose status changes, as `inkan status --date` does.
 * Safe to run twice; the records may live in different projects.
 */
export async function run({ args, flags, root, log = console.log }) {
  const [oldQuery, newQuery, ...extra] = args;
  if (!oldQuery || !newQuery || extra.length) throw new Error(USAGE);
  const config = await loadConfig(root);
  const records = loadRecords(config);
  const oldRecord = resolveRecord(records, oldQuery);
  const newRecord = resolveRecord(records, newQuery);
  if (oldRecord.id === newRecord.id) throw new Error(`${oldRecord.id} cannot supersede itself.`);
  assertEditable(config, oldRecord);
  assertEditable(config, newRecord);
  const dryRun = flags['dry-run'];
  const suffix = dryRun ? ' [dry run]' : '';
  const date = dateFlag(flags);

  const oldChanges = { supersededBy: withLink(records, oldRecord.data.supersededBy, newRecord.id) };
  const hasSuperseded = 'superseded' in config.statuses;
  if (hasSuperseded) oldChanges.status = 'superseded';
  if (date) oldChanges.date = date;
  const oldBefore = fs.readFileSync(oldRecord.file, 'utf8');
  if (writeOrPreview(oldRecord.file, oldBefore, updateFrontMatter(oldBefore, oldChanges, oldRecord.id), dryRun, log)) {
    const from = oldRecord.data.status ?? '(none)';
    const status = hasSuperseded && from !== 'superseded' ? `${from} -> superseded, ` : '';
    log(`${oldRecord.id}: ${status}supersededBy += ${newRecord.id}${date ? ` (date ${date})` : ''}${suffix}`);
  } else log(`${oldRecord.id}: already superseded by ${newRecord.id}`);

  const newBefore = fs.readFileSync(newRecord.file, 'utf8');
  const newChanges = { supersedes: withLink(records, newRecord.data.supersedes, oldRecord.id) };
  if (writeOrPreview(newRecord.file, newBefore, updateFrontMatter(newBefore, newChanges, newRecord.id), dryRun, log)) {
    log(`${newRecord.id}: supersedes += ${oldRecord.id}${suffix}`);
  } else log(`${newRecord.id}: already supersedes ${oldRecord.id}`);
  return 0;
}

/** `values` plus `id`, unless one of them already names that record (by any spelling). */
const withLink = (records, values, id) => {
  const list = asList(values);
  return list.some((v) => v === id || findRecord(records, v)?.id === id) ? list : [...list, id];
};
