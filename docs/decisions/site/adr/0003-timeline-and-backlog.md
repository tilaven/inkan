---
title: "Timeline and backlog"
description: "What the /timeline/ and /backlog/ pages show, how open statuses and reviewBy dates drive the backlog, and how the pages stay light with many records."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, navigation, content]
related: [authoring/adr/0004-configurable-status-lifecycle, authoring/adr/0003-metadata-in-front-matter, site/adr/0002-filterable-record-index]
---

## Context

Two questions come up constantly and the filterable index answers neither well: "what happened when" and "what is still waiting for a decision". The first wants records in date order with the quiet years compressed. The second wants only the open proposals, sorted by their review deadline, with overdue ones impossible to miss. Both views must come from the front matter that is already there.

## Decision

Inkan builds two pages from the records' `date`, `status` and `reviewBy` fields:

- `/timeline/`: every dated record, newest first, grouped by year and month.
- `/backlog/`: every record whose status is open, ordered by `reviewBy`, with D-day tags computed in the browser so a static page never shows yesterday's countdown.

Which statuses count as open is part of the status configuration, not of these pages.

## How to use it

### Timeline

Nothing to configure. A record appears on the timeline when it has a `date` in its front matter; records without a date are left out. Records are grouped by the month of that date, newest month first, with a year heading whenever the year changes and a record count per month.

```yaml
---
title: Define SLOs per user journey
status: accepted
date: 2026-03-14
---
```

Each month shows its records as photocards. Past 150 dated records, years older than the two most recent collapse to compact rows (status sticker, team, number and title) so the page stays light while the recent history keeps its cards.

### Backlog

A record is on the backlog when its status has `open: true`. With the default statuses that is `draft`, `proposed` and `in-review`. Records with a `reviewBy` date come first, soonest deadline first; the rest are listed under "No deadline".

```yaml
---
title: Error budgets for the checkout flow
status: in-review
date: 2026-10-01
reviewBy: 2026-11-15
---
```

Each row shows the day and month of the deadline, the sticker and status label, the team and number, the title, the description and the authors. In the browser the row gets a tag and a sentence from the reader's current date:

| Days until `reviewBy` | Tag | Text | Row state |
| --- | --- | --- | --- |
| more than 7 | `D-12` | `in 12 days` | normal |
| 1 to 7 | `D-3` | `in 3 days` | `is-soon` |
| 0 | `D-DAY` | `today` | `is-soon` |
| negative | `D+4` | `4 days late` | `is-overdue` |

The eyebrow of the page gains "today is 16 Oct 2026" and the lede says how many rows are past due, or "Nothing is overdue." The same `D-n` chip appears next to "Review by" on the record's own page, with the text ("4 days late") for screen readers and the word "overdue" on a late chip, so lateness is not shown by colour alone. The chip and the sentence come from the dictionary (`due.tagToday`, `due.tagBefore`, `due.tagAfter`, `due.today`, `due.in`, `due.late`), so a Polish site shows `DZIŚ` and `za 3 dni`.

### Choosing your own open statuses

The backlog follows the `open` flag of each status, so a custom lifecycle changes it without further configuration:

```ts title="inkan.config.ts"
export default defineConfig({
  statuses: {
    idea: { label: 'Idea', open: true, sticker: 'draft' },
    proposed: { label: 'Proposed', open: true },
    accepted: { label: 'Accepted', current: true },
    retired: { label: 'Retired', sticker: 'deprecated' },
  },
});
```

With this config the backlog lists `idea` and `proposed` records. The "Open decisions" link in the sidebar carries the number of open records, and the landing page counts overdue review dates among them.

> [!NOTE]
> The backlog only reads `reviewBy` on open records. On a decided record the same field is the date of its next periodic review, listed on `/reviews/` instead; see [Review decisions on a schedule](../../authoring/adr/0011-review-decisions-on-a-schedule.md). How the backlog, `/reviews/` and `/rfc-reviews/` differ is in [Open decisions, periodic reviews and RFC reviews](0016-open-decisions-periodic-reviews-and-rfc-reviews.md).

### Where the pages are linked

Both pages are in the header (Records, Timeline, Open decisions), in the sidebar hub (with the open count next to Open decisions) and among the default landing actions. All three places take the base path into account when the site is served from a sub-path.

## Consequences

- Both views need no maintenance: dates and statuses in the front matter are the only input.
- Undated records are invisible on the timeline. Add a `date` to every record you want in the history.
- Countdowns are computed in the reader's time zone from calendar days, as `inkan check` computes them on its machine, so a deadline flips to overdue at the reader's midnight. Without JavaScript the ISO date is shown and no row is marked overdue.
- The timeline compacts old years only beyond 150 records; below that, every month shows full cards.
- The backlog has no per-team view. Use the index with `?status=proposed&project=sre` for that.
