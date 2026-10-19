import { loadConfig } from '../config.mjs';
import { loadProjects, loadRecords, today } from '../records.mjs';
import { daysBetween, urgency } from '../calendar.mjs';
import { reviewSchedule } from '../reviews.mjs';
import { plural } from '../text.mjs';

const USAGE = 'Usage: inkan reviews [--within <days>] [--all] [--json]';

const when = (days) => (days < 0 ? `${plural(-days, 'day')} late` : days === 0 ? 'today' : `in ${plural(days, 'day')}`);

/** `inkan reviews`: records that are overdue or soon due for review, most overdue first. Always exits 0; `check` is the gate. */
export async function run({ flags, root, log = console.log }) {
  const config = await loadConfig(root);
  if (flags.within !== undefined && !/^\d+$/.test(String(flags.within))) throw new Error(USAGE);
  const soon = flags.within === undefined ? (config.reviews?.soon ?? 30) : Number(flags.within);
  const now = today();
  const schedule = reviewSchedule(config, loadProjects(config));
  const rows = loadRecords(config)
    .filter((r) => !r.data.draft)
    .flatMap((r) => {
      const review = schedule(r);
      if (!review) return [];
      const days = daysBetween(now, review.due);
      return [
        {
          id: r.id,
          ref: r.ref,
          title: String(r.data.title ?? r.id),
          project: r.project,
          status: String(r.data.status),
          due: review.due,
          reviewed: review.reviewed,
          every: review.every,
          days,
          urgency: urgency(days, soon),
        },
      ];
    })
    .filter((row) => flags.all || row.days <= soon)
    .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));

  if (flags.json) {
    log(JSON.stringify(rows, null, 2));
    return 0;
  }
  const width = Math.max(0, ...rows.map((row) => when(row.days).length));
  for (const row of rows) log(`${row.due}  ${when(row.days).padEnd(width)}  ${row.ref ?? row.id}  ${row.title}`);
  const overdue = rows.filter((row) => row.urgency === 'overdue').length;
  if (!rows.length) log(flags.all ? 'No records have a review scheduled.' : `No reviews due within ${plural(soon, 'day')}.`);
  else if (flags.all) log(`\n${plural(rows.length, 'review')} scheduled, ${overdue} overdue.`);
  else log(`\n${overdue} overdue, ${rows.length - overdue} due within ${plural(soon, 'day')}.`);
  return 0;
}
