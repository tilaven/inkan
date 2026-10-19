---
title: "Review decisions on a schedule"
description: "Decided records come back up for review on a date or an interval: the reviewBy, reviewed and reviewEvery fields, the /reviews/ page, the check rule, the CLI commands and the MCP tool."
status: accepted
date: 2026-10-17
reviewEvery: 1 year
tags: [content, config, cli, site, ai, lifecycle]
related: [authoring/adr/0004-configurable-status-lifecycle, authoring/adr/0003-metadata-in-front-matter, site/adr/0003-timeline-and-backlog, site/adr/0016-open-decisions-periodic-reviews-and-rfc-reviews, cli/adr/0007-check-records-in-ci, cli/adr/0009-mark-records-reviewed-from-the-cli, ai/adr/0005-mcp-server-for-agents, ai/adr/0002-decisions-json]
---

## Context

An ADR is written once, accepted, and then left alone. Two years later the vendor it chose has changed its pricing, the team that wrote it has moved on, and the record still says `accepted` because nobody was asked to look at it again. Decisions rot quietly: a wrong record looks exactly like a right one. The site tracks `reviewBy` for open records, so a proposal cannot sit past its deadline unnoticed, but once a record is decided its date stops meaning anything. Teams that do review their decisions keep the schedule somewhere else, in a calendar or a spreadsheet, where it drifts away from the records.

The lifecycle, the backlog and `inkan check` already know which records are in force. What was missing is a way to say "look at this again in a year" that lives in the record itself, and the places that read it: a page, a check rule, a command and a tool for agents.

This record is its own example: it carries `reviewEvery: 1 year` in its front matter, so it is due a year after its date and appears under "Scheduled" on this site.

## Decision

Decided records get a review schedule from three front matter fields and one interval that can be set once for a project or a site:

- `reviewBy` on a decided record is the date of the next review. On an open record it keeps its meaning of decision deadline, tracked on `/backlog/`.
- `reviewed` is the date of the last review.
- `reviewEvery` is an interval such as `1 year`. It can be set on the record, in `_project.yml` or as `reviews.every` in the config, in that order of precedence. `never` (or `false`) opts out.

A record is due on `reviewBy`, or `reviewEvery` after `reviewed` (or after its `date` when it has never been reviewed). Which statuses get reviews follows the lifecycle: `reviews.statuses` in the config, by default the ones with `current: true` (`accepted` and `implemented`).

The schedule is read in four places: the `/reviews/` page lists what is overdue, due soon and scheduled; `inkan check` warns about overdue reviews; `inkan reviewed` and `inkan reviews` mark a review done and list what is due; the MCP server offers `due_reviews` and a `review` field on every record, which `decisions.json` carries too. Nothing changes status by itself: a review is a human reading the record and deciding whether it still holds.

## How to use it

### Schedule one record

Add `reviewBy` to a decided record for a one-off date, or `reviewEvery` for a recurring review:

```yaml title="decisions/payments/adr/0003-use-stripe-as-the-primary-payment-provider.md"
---
title: "Use Stripe as the primary payment provider"
status: accepted
date: 2026-01-18
reviewBy: 2026-11-15
---
```

```yaml title="decisions/dbre/adr/0001-standardize-on-postgresql-16.md"
---
title: "Standardize on PostgreSQL 16"
status: implemented
date: 2026-03-02
reviewEvery: 1 year
---
```

The first record is due on 15 November 2026. The second is due on 2 March 2027, then on 2 March 2028 once it has been reviewed, and so on.

### Schedule a project or the whole site

Most teams want one rule for everything rather than a field in every file. Set it once in `_project.yml` for a project, or in the config for the site:

```yaml title="decisions/dbre/_project.yml"
name: "DBRE"
owners: [marek]
reviewEvery: 6 months
```

```ts title="inkan.config.ts"
export default defineConfig({
  reviews: { every: '1 year', soon: 30 },
});
```

With `reviews.every` set, every record in a review status is scheduled from its `date` (which may come from git when the front matter has none; see [Fill date and authors from git](0009-fill-date-and-authors-from-git.md)). A record or project that should not be reviewed opts out:

```yaml
reviewEvery: never
```

| Option | Where | Default | What it does |
| --- | --- | --- | --- |
| `reviews.every` | config | `null` | Interval for every record in a review status. `null` or `false` schedules only records that carry `reviewBy` or `reviewEvery` themselves. |
| `reviews.statuses` | config | statuses with `current: true` | Which statuses get reviews. Records in other statuses are never scheduled, whatever their fields say. |
| `reviews.soon` | config | `30` | Days before the due date from which a review counts as "due soon", on the page and in the CLI. |
| `reviewEvery` | `_project.yml` | none | Interval for the project's records. Overrides `reviews.every`. |
| `reviewEvery` | record | none | Interval for this record. Overrides the project and the site. |
| `reviewBy` | record | none | Fixed date of the next review (on a decided record). |
| `reviewed` | record | none | Date of the last review. Written by `inkan reviewed`, or by hand. |

### Intervals

An interval is a count and a unit, in the long or the short form:

| Unit | Long form | Short form |
| --- | --- | --- |
| days | `90 days`, `1 day` | `90d` |
| weeks | `2 weeks` | `2w` |
| months | `6 months`, `1 month` | `6m`, `6mo` |
| years | `1 year`, `2 years` | `1y`, `2yr` |

The count must be a whole number above zero; the space is optional and the plural `s` is too. Month and year steps clamp to the end of shorter months: a record reviewed on 31 January with `reviewEvery: 1 month` is due on 28 February, not on 3 March. Anything else, such as `quarterly` or `1.5 years`, fails the build and is reported by `check` as `review-interval`; write `3 months` or `18 months` instead.

### Which date wins

The next review is computed from the fields in this order:

1. The record is in a review status; otherwise there is no schedule, and `reviewBy` on an open record is a decision deadline for the backlog.
2. `reviewBy` is the due date, unless `reviewed` is on or after it. A fixed date wins over the interval until it has been honoured.
3. Otherwise the interval, taken from the record's `reviewEvery`, then the project's, then `reviews.every`, counted from `reviewed`, or from `date` when the record was never reviewed. `never` at any level stops the lookup: a project with `reviewEvery: never` is not scheduled even when the site sets `reviews.every`.
4. No interval, or no date to count from: no schedule.

| `reviewBy` | `reviewed` | interval | `date` | Next review |
| --- | --- | --- | --- | --- |
| `2026-11-15` | none | any | any | `2026-11-15` |
| `2026-11-15` | `2026-11-20` | `1 year` | any | `2027-11-20` |
| `2026-11-15` | `2026-11-20` | none | any | none (the fixed date was honoured) |
| none | `2026-04-01` | `6 months` | any | `2026-10-01` |
| none | none | `1 year` | `2026-03-02` | `2027-03-02` |
| none | none | `1 year` | none | none |

A review is overdue when its due date is before today, due soon when it is within `reviews.soon` days, and scheduled otherwise.

### Mark a review done

Read the record, decide whether it still holds, then record the review:

```bash
npx inkan reviewed dbre/adr/0001
```

This sets `reviewed` to today. When the record has an interval, the next review follows from it; a `reviewBy` that was just honoured is removed. Without an interval the command asks for one, `--every 1 year`, or for the next date, `--next 2027-10-01`. A record that no longer holds is a status change, not a review: run `inkan status` or `inkan supersede` instead. The command is described in [Mark records reviewed from the CLI](../../cli/adr/0009-mark-records-reviewed-from-the-cli.md).

### The reviews page

`/reviews/` lists every scheduled record in three groups: "Overdue", "Due soon" and "Scheduled". The groups are computed in the browser from the reader's date, so a static build does not go stale. Each row shows the due date, the sticker, the team and number, the title and the interval. A "Periodic reviews" link appears in the sidebar hub as soon as any record has a schedule, and the header of a scheduled record shows "Next review" with the date and "Reviewed" with the last review date.

With nothing scheduled, the page says so and the sidebar link is not shown. A site that never sets `reviews.every`, `reviewEvery` or `reviewBy` on a decided record looks exactly as before.

### In CI

`inkan check` reports an overdue review as a `review-due` warning and a malformed interval as a `review-interval` error:

```text
decisions/dbre/adr/0001-standardize-on-postgresql-16.md warning review every 1 year (due 2027-03-02) has passed; review it and run `inkan reviewed dbre/adr/0001-standardize-on-postgresql-16`
```

The starter workflow already runs `check` on every pull request, so an overdue review shows up as an annotation there and, with `--strict`, fails the job. See [Check records in CI](../../cli/adr/0007-check-records-in-ci.md).

A review that only fails pull requests is easy to postpone. Add a scheduled job that lists what is due, so the team sees it even in a quiet week:

```yaml title=".github/workflows/reviews.yml"
name: Decision reviews
on:
  schedule:
    - cron: '0 8 * * 1' # Monday 08:00 UTC
  workflow_dispatch:

jobs:
  reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # dates may come from git history
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npx inkan reviews --within 30 | tee reviews.txt
      - run: npx inkan check --strict # fails the job when a review is overdue
```

Replace the last step with whatever reaches your team: `gh issue create --body-file reviews.txt`, a message to a chat channel, or nothing but the job log. `inkan reviews --json` prints the same list for scripts, and `inkan mcp` serves it to agents as `due_reviews`.

### For agents and scripts

`decisions.json` carries a `review` field per record: `{ "due": "2027-03-02", "reviewed": null, "every": "1 year" }`, or `null` when the record has no schedule. The MCP server returns the same object from `get_record` and lists what is due with the `due_reviews` tool (`project`, `within`, `all`). An agent that works in the repository can therefore answer "which decisions should we look at this month" without reading every file. See [decisions.json](../../ai/adr/0002-decisions-json.md) and [MCP server for agents](../../ai/adr/0005-mcp-server-for-agents.md).

## Consequences

- Every decision in force has a date by which someone looks at it again, and that date lives in the record, in the same pull request flow as everything else.
- One line in the config schedules an entire archive. Teams that do not want this see no change: without `reviews.every`, a project interval or fields on the records, nothing is scheduled.
- `reviewBy` means two things, decided by the status. It keeps old records and the backlog working, at the cost of a field whose meaning depends on another field. Records that are accepted with a stale `reviewBy` from their proposal days become due at once; run `inkan reviewed` once to move on to the interval.
- A review is a date, not a verdict. The site cannot tell a careful review from a quick `inkan reviewed`; that stays with the people and the pull request review.
- Dates inferred from git make records from imports and old files schedulable without edits, and also make them due early: a file added in a migration commit counts from that commit. Write `date` or `reviewed` where that is wrong.
- Intervals are calendar steps in UTC, so a review due on the 31st moves to the 30th or 28th in shorter months and stays there once `reviewed` is written on that day.
- "Today" is the local calendar day everywhere: of the machine for `check`, `inkan reviews` and MCP, of the reader for `/reviews/`. A CI runner in UTC and a reader in another time zone can still disagree for a few hours around midnight.
