---
title: "RFC reviews page and Waiting on you"
description: "What the /rfc-reviews/ page lists, and how a static site shows each person the records that wait on them without a login."
status: implemented
date: 2026-10-17
tags: [site, navigation, lifecycle]
related: [authoring/adr/0013-review-rfcs-with-reviewers, site/adr/0003-timeline-and-backlog, site/adr/0016-open-decisions-periodic-reviews-and-rfc-reviews, site/adr/0004-authors-and-tags-pages, cli/adr/0010-answer-a-review-from-the-cli]
---

## Context

The backlog sorts open records by `reviewBy`. It does not say who has to act. With reviewers in front matter that is known for every record, but the site is static HTML on any host: it has no accounts and does not know who is reading it. People still want one answer: what is waiting on me?

## Decision

A page at `/rfc-reviews/` lists the open records that have reviewers, in three groups: In review, Changes requested and Approved. Each row shows the reviewers' states, the "2 of 3 approvals" count, the people it waits on and the `reviewBy` deadline. Cards and backlog rows carry a small review chip, and the sidebar and header have an "RFC reviews" link once any open record has reviewers.

"Waiting on you" works without a server. The viewer picks who they are on `/rfc-reviews/`; the choice is stored in the browser, and every record whose review waits on that handle gets a "Waiting on you" badge. `?me=<handle>` in any URL shows that page as that person, so a link in a chat message can open a record as its reviewer; it applies to that page only and never replaces what the reader picked.

## How to use it

### Read the page

Records in each group are sorted by `reviewBy`, with records without one last and ties broken by id. A deadline in the past is marked overdue; the day count is computed in the browser, as on the backlog. Closed records (accepted, rejected, …) are not listed, and neither are open records without `reviewers`.

### Say who you are

On `/rfc-reviews/` choose your handle from the list of handles used in `reviewers`, `authors` and `deciders`. Records waiting on you then carry the badge everywhere on the site. To share a view, add the handle to any URL:

```text
https://decisions.acme.dev/sre/rfc/0002-move-on-call-to-follow-the-sun/?me=marek
```

Clear the choice on the same page. It does not change the build output: the same HTML serves everyone.

## Consequences

- No server and no login: the identity lives in the visitor's browser and goes nowhere.
- It is a convenience, not authentication. Anyone can type any handle, and the page shows nothing that is not already public on the site. Do not use it to hide records.
- The badge needs JavaScript. Without it the page still lists every record and its states.
- A person who uses two browsers picks their handle twice, or shares a `?me=` link.
- Handles not in `_authors.yml` can still be picked if they appear in a record.
