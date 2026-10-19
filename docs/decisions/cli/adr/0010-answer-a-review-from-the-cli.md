---
title: "Answer a review from the CLI"
description: "inkan rfc-review writes a reviewer's state into front matter in place, and --for lists the open records waiting on a person."
status: implemented
date: 2026-10-17
tags: [cli, content, lifecycle]
related: [authoring/adr/0013-review-rfcs-with-reviewers, cli/adr/0005-change-status-and-supersede-from-the-cli, cli/adr/0007-check-records-in-ci, site/adr/0014-rfc-reviews-page-and-waiting-on-you]
---

## Context

[Review RFCs with reviewers](../../authoring/adr/0013-review-rfcs-with-reviewers.md) puts each reviewer's answer in front matter. Editing a map by hand is easy once and error-prone the tenth time: the date is forgotten, a list has to become a map, a note needs quoting. Reviewers also want the opposite question answered from a terminal or a script: what is waiting on me?

## Decision

`inkan rfc-review` does both. Like `status` and `supersede`, it edits the file in place and keeps the rest of the front matter as written (comments, key order, quoting); the `reviewers` block itself is rewritten in map form, so comments inside it are dropped, and `--dry-run` shows the change without writing it.

## How to use it

### Answer

```bash
npx inkan rfc-review sre/rfc/2 marek approve
npx inkan rfc-review sre/rfc/2 jules request-changes --note "Needs a rollback plan"
npx inkan rfc-review sre/rfc/2 jules reset
```

| Action | Writes |
| --- | --- |
| `approve` | `approved` and today's date |
| `request-changes` | `changes-requested` and today's date |
| `reset` | `pending`, with no date |

`--note "…"` stores a short note next to the state. `<record>` is anything `inkan status` accepts: id, short id, reference or file path. A list of handles is rewritten as a map; other reviewers keep their state, date and note. A reviewer who is not listed yet is added. The command refuses a record whose reviewers it cannot read, and a record from a `repo` source, which is read-only here.

### What is waiting on someone

```bash
npx inkan rfc-review --for marek
npx inkan rfc-review --for marek --format json
```

The text form is one line per open record whose review waits on that handle: reference, title, review status and `reviewBy`. The JSON form prints the same records as an array, for scripts and chat bots. A handle is waited on as the review status says: pending reviewers, the authors when changes were requested, the deciders (or authors) once approved. Nothing waiting is not an error: the exit code is 0.

## Consequences

- Answering a review is one command and one commit, and the date is not forgotten.
- The state is written for the reviewer you name. The CLI does not check who is running it; git blame and the pull request show who changed the line.
- A list of reviewers becomes a map on the first answer, which touches every line of the field in the diff.
- `--for` reads the files, not the site, so it sees uncommitted answers and works without a build.
