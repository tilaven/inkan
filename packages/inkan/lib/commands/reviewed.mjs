import fs from 'node:fs';
import { loadConfig } from '../config.mjs';
import { assertEditable, dateArg, resolveRecord, writeOrPreview } from '../lifecycle.mjs';
import { loadProjects, loadRecords, today, updateFrontMatter } from '../records.mjs';
import { isInterval, isoDate, reviewSchedule, reviewStatuses } from '../reviews.mjs';

const USAGE = 'Usage: inkan reviewed <record> [--next YYYY-MM-DD] [--every <interval>] [--date YYYY-MM-DD] [--dry-run]';

/**
 * `inkan reviewed <record>`: records that a decision was reviewed today (or on --date) and schedules the next review,
 * either on the date given with --next or from the record's, project's or site's interval.
 */
export async function run({ args, flags, root, log = console.log }) {
  const [query, ...extra] = args;
  if (!query || extra.length || flags.every === true || flags.next === true) throw new Error(USAGE);
  const config = await loadConfig(root);
  const record = resolveRecord(loadRecords(config), query);
  assertEditable(config, record);
  const statuses = reviewStatuses(config);
  const status = record.data.status;
  if (!status || !statuses.includes(String(status))) {
    throw new Error(`${record.id} is ${status ? `"${status}"` : 'without a status'}; only records with status ${statuses.map((s) => `"${s}"`).join(', ')} are reviewed periodically.`);
  }

  const reviewed = flags.date === undefined ? today() : dateArg('date', flags.date);
  if (reviewed > today()) throw new Error(`--date ${reviewed} is in the future.`);
  const changes = { reviewed };
  if (flags.every !== undefined) {
    const every = String(flags.every).trim();
    if (!isInterval(every)) throw new Error(`--every "${every}" is not an interval (use e.g. "1 year", "6 months", "90 days" or "never").`);
    changes.reviewEvery = every;
  }
  if (flags.next !== undefined) {
    const next = dateArg('next', flags.next);
    if (next <= reviewed) throw new Error(`--next ${next} must be after the review date ${reviewed}.`);
    changes.reviewBy = next;
  }

  const schedule = reviewSchedule(config, loadProjects(config));
  const merged = { ...record.data, ...changes };
  if (flags.next === undefined && record.data.reviewBy != null) {
    delete merged.reviewBy;
    if (!schedule({ ...record, data: merged })) {
      throw new Error(`${record.id} has reviewBy ${isoDate(record.data.reviewBy) ?? record.data.reviewBy} but no review interval; pass --next <date> or --every <interval>.`);
    }
    changes.reviewBy = undefined;
  }

  const before = fs.readFileSync(record.file, 'utf8');
  const after = updateFrontMatter(before, changes, record.id);
  const next = schedule({ ...record, data: merged });
  const outcome = next ? `next review ${next.due}` : 'no further review scheduled';
  if (!writeOrPreview(record.file, before, after, flags['dry-run'], log)) {
    log(`${record.id}: already reviewed ${reviewed}, ${outcome}`);
    return 0;
  }
  log(`${record.id}: reviewed ${reviewed}, ${outcome}${flags['dry-run'] ? ' [dry run]' : ''}`);
  return 0;
}
