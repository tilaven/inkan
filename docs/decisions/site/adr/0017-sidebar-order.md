---
title: "Sidebar order"
description: "Records under each project in the sidebar are listed newest first by default; the sidebar.sort option switches to oldest first or record number order."
status: implemented
date: 2026-10-20
authors: [tilaven]
deciders: [tilaven]
tags: [site, config]
options: [sidebar.sort]
related: [authoring/adr/0001-one-folder-per-project, site/adr/0003-timeline-and-backlog]
---

## Context

The sidebar lists every project with its records, grouped by type. Listed by record number, the records a team wrote last week sit at the bottom of a long list, while the ones people open most are usually the latest. A team with a hundred decisions has to scroll past all of them to reach what was just accepted.

Some archives read better in number order, for example when records are a numbered series that people cite by number, so the old order has to stay available.

## Decision

The sidebar lists records newest first. "Newest" means the record `date` (from front matter, or from git when `git.dates` is on). Records with the same date are ordered by number, highest first, and records without a date come last.

The `sidebar.sort` option picks the order:

| Value | Order |
| --- | --- |
| `newest` (default) | By `date`, latest first, then by number from the highest. |
| `oldest` | By `date`, earliest first, then by number from the lowest. |
| `number` | By record number, as earlier versions of Inkan did. |

Plain pages inside a project keep their `order` from front matter. The previous and next links at the bottom of a record follow the record number whatever the sidebar shows, so "previous" always means the record before it in the series.

## How to use it

Leave the option out to get the newest records at the top. To go back to number order:

```ts title="inkan.config.ts"
import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  sidebar: { sort: 'number' },
});
```

## Consequences

- New decisions show up at the top of their project, where people look first.
- Sites upgrading from an earlier version see a different sidebar order until they set `sidebar: { sort: 'number' }`.
- A record without a `date` sinks to the end of its group in both date orders, which is a nudge to date it.
