---
title: "Review RFCs with reviewers"
description: "List reviewers in front matter, record each answer as pending, approved or changes-requested, and let Inkan work out whose move it is."
status: implemented
date: 2026-10-17
tags: [content, lifecycle, config]
related: [authoring/adr/0003-metadata-in-front-matter, authoring/adr/0004-configurable-status-lifecycle, authoring/adr/0005-optional-author-directory, cli/adr/0010-answer-a-review-from-the-cli, site/adr/0014-rfc-reviews-page-and-waiting-on-you, cli/adr/0007-check-records-in-ci]
---

## Context

An RFC is open until people have read it, and the front matter only said when comments were due (`reviewBy`). Who was asked, who has answered and who still holds the RFC up lived in a pull request thread or in someone's head. Once the RFC was merged as `proposed`, nobody could tell from the site whether it was waiting on a reviewer, on its authors or on the person who decides.

## Decision

A record may list `reviewers` in its front matter. Each reviewer has one state: `pending`, `approved` or `changes-requested`, with an optional date and note. From the states, Inkan derives a review status and the people the record waits on. The states are written by hand or with `inkan rfc-review`; nothing is stored outside the file, so the review is part of the pull request and of git history.

`reviewBy` keeps its meaning: on an open RFC it is the comment deadline. The review status says whose move it is; `reviewBy` says by when.

## How to use it

### Write the reviewers

A list of handles asks everyone and records no answers yet:

```yaml
reviewers: [ania, marek, jules]
```

A map gives each handle a state. The state is a word, or a map with `state`, `date` and `note`:

```yaml title="decisions/sre/rfc/0002-move-on-call-to-follow-the-sun.md"
status: proposed
authors: [ania]
deciders: [sam]
reviewBy: 2026-11-15
reviewers:
  marek: approved
  jules:
    state: changes-requested
    date: 2026-10-12
    note: Needs a rollback plan
  noor: pending
```

A list may also hold one-key maps, so you can upgrade a list one line at a time:

```yaml
reviewers:
  - ania: approved
  - marek
  - jules
```

| State | Meaning |
| --- | --- |
| `pending` | Asked, no answer yet. The default for a bare handle. |
| `approved` | Happy for the RFC to go ahead. |
| `changes-requested` | Blocks the RFC until the authors respond and the reviewer answers again. |

Handles are the ones in `_authors.yml`, like `authors` and `deciders`. A handle counts once; the last mention wins.

### Review status

| Status | When | Waiting on |
| --- | --- | --- |
| `in-review` | Not enough approvals and nobody asked for changes | Reviewers who are still `pending` |
| `changes-requested` | At least one reviewer asked for changes | The authors |
| `approved` | Approvals reach the number required | The deciders, or the authors when there are no deciders. They settle the record's `status`. |
| `closed` | The record's status is no longer open | Nobody |

A record without `reviewers` has no review. The record header shows a "Reviewers" row with each reviewer's state and a count such as "2 of 3 approvals".

### How many approvals

By default every reviewer must approve. To accept a quorum, set the number in the config:

```ts title="inkan.config.ts"
export default defineConfig({
  reviewers: { approvals: 2 },
});
```

With `approvals: 2` and three reviewers, the second approval makes the review `approved`. A number larger than the reviewer list is capped at the list. `null` is the default: all reviewers. A `changes-requested` answer wins over approvals until that reviewer answers again.

### Checks

`inkan check` reports a `reviewers` error for entries it cannot read or states it does not know, warns about reviewers missing from `_authors.yml`, and warns with `review-blocked` when a record already has a current status such as `accepted` while a reviewer still requests changes. See [Check records in CI](../../cli/adr/0007-check-records-in-ci.md).

## Consequences

- The review is plain front matter: it shows in diffs, survives a change of hosting and needs no service.
- Nothing stops a record from being accepted with open reviews. The site and `check` make it visible; the decision stays with people.
- A review state is a claim typed into a file. A reviewer who edits their own line is trusted, as with `deciders`.
- The review status never moves the record's `status`. Authors or deciders change it themselves, so the lifecycle in [Configurable status lifecycle](0004-configurable-status-lifecycle.md) stays the only source of status.
- An approval stays after the RFC changes. Reset it with `inkan rfc-review <record> <reviewer> reset` when a change should be read again.
