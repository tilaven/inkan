---
title: "Configurable status lifecycle"
description: "The built-in statuses, what the open and current flags switch on, and how to define your own statuses with stickers and colours."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, config, theming]
options: [statuses]
related: [authoring/adr/0003-metadata-in-front-matter, site/adr/0003-timeline-and-backlog]
---

## Context

Teams disagree on lifecycle vocabulary. One wants `accepted`, another `approved`; some track `in-review`, some do not. A fixed list either forces a vocabulary or leaves the status field unchecked. At the same time a few behaviours depend on the meaning of a status, not on its name: which records are still being decided, and which ones describe the system as it is today.

## Decision

Statuses are a map in `inkan.config.ts`. Each status has a label and two optional flags: `open` (still being decided) and `current` (describes how things are now). The site reads only these flags; it never hard-codes a status name except to pick a sticker.

The package ships nine statuses. Setting `statuses` in the config replaces that list, so the vocabulary is entirely yours. A record whose `status` is not in the map fails the build.

## How to use it

### Default statuses

| Status | Label | `open` | `current` | Typical use |
| --- | --- | --- | --- | --- |
| `draft` | Draft | yes | | Being written. |
| `proposed` | Proposed | yes | | Ready for discussion. |
| `in-review` | In review | yes | | Under formal review. |
| `accepted` | Accepted | | yes | Decided, may not be built yet. |
| `implemented` | Implemented | | yes | Decided and in production. |
| `rejected` | Rejected | | | Decided against. |
| `withdrawn` | Withdrawn | | | Pulled by the authors. |
| `deprecated` | Deprecated | | | No longer recommended, no replacement. |
| `superseded` | Superseded | | | Replaced by another record, see `supersededBy`. |

### What `open` does

- The record is listed on `/backlog/`, sorted by `reviewBy`. Records without a date go in a "No deadline" group.
- The backlog counter in the sidebar and the overdue count in the backlog lede include it.
- The landing page's "Review overdue" counter does not count it: that number is the overdue periodic reviews of decided records, as on `/reviews/`.

### What `current` does

- The record number in the header and on its card gets a foil finish. `implemented` gets gold foil, every other current status gets holographic foil. This is the visual meaning of "this is how things are".
- The landing page's stats count it as a decision in force, per site and per project.
- The record gets periodic reviews: it is listed on `/reviews/` and reported by `inkan check` when `reviewBy`, `reviewEvery` or `reviews.every` schedules it. `reviews.statuses` in the config picks other statuses instead of the current ones. See [Review decisions on a schedule](0011-review-decisions-on-a-schedule.md).

A status with neither flag is terminal and quiet: it is shown with its sticker and can be filtered, nothing more.

Every status, flagged or not, appears in the status filter on `/decisions/` with its count and can be linked with `/decisions/?status=accepted`.

### Defining your own statuses

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';

export default defineConfig({
  statuses: {
    idea: { label: 'Idea', open: true, sticker: 'draft' },
    proposed: { label: 'Proposed', open: true },
    approved: { label: 'Approved', current: true, sticker: 'accepted' },
    live: { label: 'Live', current: true, sticker: 'implemented' },
    declined: { label: 'Declined', sticker: 'rejected' },
    archived: { label: 'Archived', color: '#8a8f98' },
  },
});
```

| Field | Required | What it does |
| --- | --- | --- |
| `label` | yes | Text shown everywhere the status appears. |
| `open` | no | Backlog membership and review tracking, see above. |
| `current` | no | Foil on the record number. |
| `sticker` | no | Borrow the die-cut sticker of a built-in status: `draft`, `proposed`, `in-review`, `accepted`, `implemented`, `rejected`, `withdrawn`, `deprecated` or `superseded`. |
| `color` | no | Fill colour of the fallback sticker, any CSS colour. Used only when the status has no built-in sticker. |

Sticker resolution, in order: the `sticker` field when it names a built-in; the status key itself when it is a built-in name (so a custom map that keeps `accepted` keeps its sticker); otherwise a generic sticker with the first letter of the label, filled with `color`.

> [!WARNING]
> `statuses` replaces the defaults. The example above removes `draft`, `accepted` and the others; any record still using them fails the build with a list of the allowed values. Either keep the built-in keys in your map or rename the statuses in the files.

A smaller change, such as adding one status, still needs the full map:

```ts
statuses: {
  draft: { label: 'Draft', open: true },
  proposed: { label: 'Proposed', open: true },
  'in-review': { label: 'In review', open: true },
  accepted: { label: 'Accepted', current: true },
  implemented: { label: 'Implemented', current: true },
  rejected: { label: 'Rejected' },
  withdrawn: { label: 'Withdrawn' },
  deprecated: { label: 'Deprecated' },
  superseded: { label: 'Superseded' },
  'on-hold': { label: 'On hold', open: true, sticker: 'in-review' },
},
```

Unknown fields on a status (`colour`, `icon`) are rejected with a "did you mean" hint when a known key is close.

### Changing a status

Edit the `status` line of the record. For `superseded`, also fill `supersededBy` on the old record and `supersedes` on the new one so the lineage shows on both; see [Link records by path](0006-link-records-by-path.md). The timeline and backlog update on the next build.

## Consequences

- One vocabulary per site, enforced at build time. Filters and the backlog are never polluted by `Accepted` next to `accepted`.
- Behaviour follows the two flags, so renaming statuses costs nothing. A status that is both `open` and `current` is allowed but confusing; avoid it.
- Replacing rather than merging means the common case "add one status" repeats nine lines. The trade-off buys the ability to remove statuses.
- Only nine sticker shapes exist. A tenth custom status gets the letter sticker, which looks plainer than the built-ins.
