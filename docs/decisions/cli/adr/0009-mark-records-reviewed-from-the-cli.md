---
title: "Mark records reviewed from the CLI"
description: "How inkan reviewed writes the reviewed date and the next review into front matter, and how inkan reviews lists what is overdue or due soon."
status: accepted
date: 2026-10-17
tags: [cli, content, lifecycle]
related: [authoring/adr/0011-review-decisions-on-a-schedule, cli/adr/0005-change-status-and-supersede-from-the-cli, cli/adr/0007-check-records-in-ci, ai/adr/0005-mcp-server-for-agents]
---

## Context

[Review decisions on a schedule](../../authoring/adr/0011-review-decisions-on-a-schedule.md) gives decided records a review date. Closing a review is a front matter edit: set `reviewed` to today, drop a `reviewBy` that has just been honoured, perhaps change the interval. Done by hand, the edit is easy to get wrong in the same ways a status change is, and a review that leaves `reviewBy` in the past is reported as overdue again on the next `check`. The other half of the loop, finding out what is due, needs the site or a `jq` query over `decisions.json`; a weekly job and a quick look before a team meeting want it from the terminal.

## Decision

Two commands, built like `status` and `supersede`:

- `inkan reviewed <record>` records a review: it sets `reviewed` (today unless `--date` says otherwise), sets `reviewBy` from `--next`, sets `reviewEvery` from `--every`, and, without `--next`, removes `reviewBy` once an interval takes over. It refuses records whose status is not a review status.
- `inkan reviews` lists the records whose review is overdue or due within a window, soonest first, with `--all` for every scheduled record and `--json` for scripts.

Both resolve records by the spellings every command accepts, rewrite only the keys they change, and refuse records from a `repo` source. `--dry-run` prints the diff.

## How to use it

### Record a review

```bash
npx inkan reviewed dbre/adr/0001
```

```text
dbre/adr/0001-standardize-on-postgresql-16: reviewed 2026-10-17, next review 2027-10-17
```

What the command writes depends on what the record already has:

| Record before | Flags | Keys written |
| --- | --- | --- |
| An interval applies (own `reviewEvery`, the project's, or `reviews.every`) | none | `reviewed: <today>`; its `reviewBy`, past or future, is removed so the interval takes over. Pass `--next` to keep a fixed date. |
| No interval | none | Nothing: the command exits with code 1 and asks for `--next` or `--every`, because the record would drop off the schedule. |
| Any | `--next 2027-04-01` | `reviewed: <today>` and `reviewBy: 2027-04-01`. |
| Any | `--every 6 months` | `reviewed: <today>` and `reviewEvery: 6 months`; its `reviewBy` is removed. |

| Option | What it does |
| --- | --- |
| `--next YYYY-MM-DD` | Sets `reviewBy` to a fixed date for the next review. |
| `--every <interval>` | Sets `reviewEvery` on the record (`1 year`, `6 months`, `90 days`, `2w`, or `never` to opt the record out). |
| `--date YYYY-MM-DD` | Writes this date as `reviewed` instead of today (the local calendar day). For reviews done earlier and recorded late. |
| `--dry-run` | Prints the diff and changes nothing. |
| `--root <dir>` | Folder with `inkan.config.*`, as for every command. |

The record must be in a review status (`reviews.statuses`, by default `accepted` and `implemented`). A proposed RFC is not reviewed this way: its `reviewBy` is a decision deadline, and the command exits with code 1 and the list of review statuses. Decide on the record with `inkan status` first; see [Change status and supersede from the CLI](0005-change-status-and-supersede-from-the-cli.md).

The front matter is edited key by key, the way `status` does it: comments, key order, quoting and line endings survive.

### List what is due

```bash
npx inkan reviews
```

```text
2026-09-30  17 days late  DBRE-ADR-0001  Standardize on PostgreSQL 16
2026-11-15  in 29 days    PAYMENTS-ADR-0003  Use Stripe as the primary payment provider

1 overdue, 1 due within 30 days.
```

| Option | What it does |
| --- | --- |
| `--within <days>` | The window after today that counts as due soon. Default: `reviews.soon` from the config (30). |
| `--all` | Lists every scheduled record, the ones due later too. |
| `--json` | Prints the list as JSON instead of text: one object per record with `id`, `ref`, `title`, `project`, `status`, `due`, `reviewed`, `every`, `days` (negative when overdue) and `urgency` (`overdue`, `soon` or `later`). |
| `--root <dir>` | Folder with `inkan.config.*`. |

The list comes from the same rule as the site and `check`: `reviewBy`, or the interval after `reviewed` or `date`, for records in a review status. Records from `sources` are included. With nothing due the output is one line saying so. A job that should fail on overdue reviews runs `inkan check --strict`, where an overdue review is the `review-due` warning; see [Check records in CI](0007-check-records-in-ci.md).

### In scripts and agents

```bash
npx inkan reviews --json > due-reviews.json
```

The same list is one MCP tool away for agents, `due_reviews`, see [MCP server for agents](../../ai/adr/0005-mcp-server-for-agents.md). A weekly workflow that runs `inkan reviews` and posts the output is in [Review decisions on a schedule](../../authoring/adr/0011-review-decisions-on-a-schedule.md).

> [!NOTE]
> Records that come from a `repo` entry in `sources` are listed by `reviews` but refused by `reviewed`, like every command that writes; record the review in that repository.

## Consequences

- Closing a review is one command that leaves the record in a state `check` accepts: no `reviewBy` in the past, an interval or a next date in place.
- The command does not change `status`. A review that finds the decision no longer holds continues with `status`, `supersede` or a new record, which is a deliberate second step.
- Refusing a record without an interval and without `--next` or `--every` is stricter than `status`; it stops a review from silently taking the record off the schedule.
- `reviews` reads the files, so it sees uncommitted edits, and it reads the config, so a custom `reviews.statuses` is honoured. A published site offers the same through `decisions.json` and the MCP server's `--url` mode.
