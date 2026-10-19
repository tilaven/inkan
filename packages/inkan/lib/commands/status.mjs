import fs from 'node:fs';
import { closest, loadConfig } from '../config.mjs';
import { assertEditable, dateFlag, resolveRecord, writeOrPreview } from '../lifecycle.mjs';
import { loadRecords, updateFrontMatter } from '../records.mjs';

const USAGE = 'Usage: inkan status <record> <status> [--date [YYYY-MM-DD]] [--dry-run]';

/** `inkan status <record> <status>`: changes one record's status, keeping the file's formatting. */
export async function run({ args, flags, root, log = console.log }) {
  const [query, status, ...extra] = args;
  if (!query || !status || extra.length) throw new Error(USAGE);
  const config = await loadConfig(root);
  const known = Object.keys(config.statuses);
  if (!known.includes(status)) {
    const hint = closest(status, known);
    throw new Error(`Unknown status "${status}".${hint ? ` Did you mean "${hint}"?` : ''} Known: ${known.join(', ')}.`);
  }
  const record = resolveRecord(loadRecords(config), query);
  assertEditable(config, record);
  const from = record.data.status ?? '(none)';
  const changes = { status };
  const date = dateFlag(flags);
  if (date) changes.date = date;
  const before = fs.readFileSync(record.file, 'utf8');
  const after = updateFrontMatter(before, changes, record.id);
  if (!writeOrPreview(record.file, before, after, flags['dry-run'], log)) {
    log(`${record.id}: already ${status}`);
    return 0;
  }
  log(`${record.id}: ${from} -> ${status}${changes.date ? ` (date ${changes.date})` : ''}${flags['dry-run'] ? ' [dry run]' : ''}`);
  return 0;
}
