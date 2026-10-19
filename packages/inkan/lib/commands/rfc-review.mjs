import fs from 'node:fs';
import path from 'node:path';
import { closest, loadConfig } from '../config.mjs';
import { assertEditable, resolveRecord, writeOrPreview } from '../lifecycle.mjs';
import { authorsFile, loadAuthors, loadRecords, today, updateFrontMatter } from '../records.mjs';
import { handleKey, parseReviewers, recordReview, setReview } from '../rfc-reviews.mjs';

const USAGE = 'Usage: inkan rfc-review <record> <reviewer> <approve|request-changes|reset> [--note "…"] [--dry-run]\n       inkan rfc-review --for <handle> [--format json]';

const VERDICTS = {
  approve: 'approved',
  'request-changes': 'changes-requested',
  reset: 'pending',
  approved: 'approved',
  'changes-requested': 'changes-requested',
  pending: 'pending',
};

const WHY = {
  'in-review': 'review',
  'changes-requested': 'changes requested',
  approved: 'approved, ready to decide',
};

const PHRASE = { approved: 'approved', 'changes-requested': 'requested changes', pending: 'reset to pending' };

/** Open records whose review waits on `handle`. Drafts are left out, as on the site. */
export function waitingOn(config, handle) {
  const key = handleKey(handle);
  return loadRecords(config).flatMap((record) => {
    if (record.data.draft === true) return [];
    const review = recordReview(record.data, config);
    if (!review.waitingOn.some((h) => handleKey(h) === key)) return [];
    const reviewBy = record.data.reviewBy;
    return [{
      id: record.id,
      ref: record.ref,
      title: String(record.data.title ?? record.id),
      why: WHY[review.status],
      reviewBy: reviewBy == null ? null : reviewBy instanceof Date ? reviewBy.toISOString().slice(0, 10) : String(reviewBy).slice(0, 10),
    }];
  });
}

/**
 * `inkan rfc-review <record> <reviewer> <verdict>` records one reviewer's answer in the front matter;
 * `inkan rfc-review --for <handle>` lists the open records waiting on that person.
 */
export async function run({ args, flags, root, log = console.log }) {
  const config = await loadConfig(root);
  if (!args.length) {
    if (!flags.for) throw new Error(USAGE);
    const rows = waitingOn(config, String(flags.for));
    if (flags.format === 'json') log(JSON.stringify(rows, null, 2));
    else if (!rows.length) log(`Nothing is waiting on ${flags.for}.`);
    else for (const r of rows) log(`${r.ref ?? r.id}  ${r.title}  (${r.why}${r.reviewBy ? `, review by ${r.reviewBy}` : ''})`);
    return 0;
  }

  const [query, reviewer, verdict] = args;
  if (!reviewer || !verdict) throw new Error(USAGE);
  const state = VERDICTS[verdict];
  if (!state) {
    const hint = closest(verdict, Object.keys(VERDICTS));
    throw new Error(`Unknown verdict "${verdict}".${hint ? ` Did you mean "${hint}"?` : ''} Use approve, request-changes or reset.`);
  }
  const record = resolveRecord(loadRecords(config), query);
  assertEditable(config, record);
  const { errors } = parseReviewers(record.data.reviewers);
  if (errors.length) throw new Error(`${record.id}: ${errors[0]}`);

  const authors = authorsFile(config.contentDir);
  if (authors && !Object.keys(loadAuthors(config.contentDir)).some((h) => handleKey(h) === handleKey(reviewer))) {
    log(`warning: reviewer "${reviewer}" is not in ${path.basename(authors)}`);
  }
  const note = typeof flags.note === 'string' ? flags.note : undefined;
  const reviewers = setReview(record.data.reviewers, reviewer, state, { date: today(), note });
  const before = fs.readFileSync(record.file, 'utf8');
  const after = updateFrontMatter(before, { reviewers }, record.id);
  if (!writeOrPreview(record.file, before, after, flags['dry-run'], log)) {
    log(`${record.id}: ${reviewer} already ${state}`);
    return 0;
  }
  const { approved, required } = recordReview({ ...record.data, reviewers }, config);
  log(`${record.id}: ${reviewer} ${PHRASE[state]} (${approved} of ${required} approvals)${flags['dry-run'] ? ' [dry run]' : ''}`);
  return 0;
}
