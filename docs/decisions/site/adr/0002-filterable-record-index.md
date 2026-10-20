---
title: "Filterable record index"
description: "The /decisions/ page with its facet filters mirrored in the URL, the cards and table views, and the team pages at /<project>/."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, navigation, content]
related: [site/adr/0004-authors-and-tags-pages, authoring/adr/0001-one-folder-per-project, authoring/adr/0003-metadata-in-front-matter, authoring/adr/0004-configurable-status-lifecycle, authoring/adr/0012-custom-metadata-fields]
---

## Context

An archive with a few hundred records is browsed by slicing: "everything the Payments team accepted", "all RFCs tagged kafka", "what did Anna write". The slices have to be shareable, because they end up in chat messages, review tickets and agent prompts. A page that holds its state in JavaScript only loses the slice on reload. At the same time, the page must stay fast when a company has thousands of records.

## Decision

Inkan ships one index page, `/decisions/`, that lists every record and filters it by project, type, status, author, tag and free text. The filter state lives in the query string and is written back to the address bar on every change, so a filtered view is a plain link. The index is static HTML; the filtering happens in the browser without a server.

Every project also gets a team page at `/<project>/` with its records grouped by type.

## How to use it

### Filters and the URL

The filter field and a **Filters** button sit at the top of the page. The button opens the facets: one chip group per facet, with a count on every chip. Click a chip to add its value; click it again to remove it. While the facets are closed, every active value shows as a pill under the filter field (remove it with one click), and the button shows how many are active. Values inside one facet are OR-ed, facets are AND-ed. The free-text field matches every word against the title, the tags and the description.

| Query parameter | Example | Meaning |
| --- | --- | --- |
| `project` | `?project=sre,payments` | Project folder ids. |
| `type` | `?type=rfc` | Record type ids (the folder name: `adr`, `rfc` or your own). |
| `status` | `?status=accepted,implemented` | Status ids as spelled in the front matter. |
| `author` | `?author=anna.kowalska` | Handles from `authors` or `deciders`: records the person wrote or signed off. |
| `tag` | `?tag=kafka` | Tags from `tags`. |
| `q` | `?q=rate+limit` | Words that must all occur in the title, tags or description. |
| `view` | `?view=table` | `table` for the table view; absent means cards. |
| custom field | `?risk=high,medium`, `?cost=10..50` | One parameter per custom field, named after it. Chips take values, number and date fields a range (`10..50`, `..50`, `2025-01-01..`). See [Custom metadata fields](../../authoring/adr/0012-custom-metadata-fields.md). |

Lists can be comma-separated or repeated (`tag=a&tag=b`). A comma inside a value is written as `%2C`. The order of parameters does not matter.

The links on the rest of the site use the same scheme: a tag on a record header goes to `/decisions/?tag=kafka`, an author name to `/decisions/?author=anna.kowalska`, a status to `/decisions/?status=accepted`.

> [!TIP]
> Hand a filtered view to a coding agent: `https://decisions.acme.dev/decisions/?project=payments&status=accepted` is a stable, bookmarkable description of "the Payments decisions in force".

### Cards and table

Two layouts of the same list. Cards show each record as a photocard. The table has a status sticker, number, title, team and type, date and tags; clicking anywhere on a row opens the record. The choice is kept in the URL (`view=table`) and nowhere else.

To keep the page light at scale, the first 120 cards are in the HTML and the rest wait in chunks of 60 that mount as you scroll. The table always holds every record, which is also what the filter reads, so a filter applied to the cards view mounts the chunks that hold matches immediately.

Only the ten most used tags are visible at first; a `+N more` chip reveals the rest, and it opens on its own when the URL already selects a hidden tag.

### What the facets show

- **Team**: every project, from `_project.yml` files and bare folders alike, with its ink dot.
- **Type**: the keys of `docTypes`, labelled with their `label`.
- **Status**: the keys of `statuses`, each with its sticker.
- **People**: handles that appear in at least one `authors` or `deciders` list, counted once per record; the display name comes from `_authors.yml` when there is one.
- **Tag**: every tag used, most frequent first.
- **Custom fields**: one group per filterable field in `fields`: chips for text, enum, list and boolean fields, a min and max range for number and date fields. A field with `column: true` also gets a column in the table.

No configuration is needed. A new folder, status or tag appears on the next build.

### Team pages

Each project folder is served at `/<project>/`:

```text
decisions/payments/_project.yml   →  /payments/
decisions/payments/index.md       →  intro text at the top of /payments/
decisions/payments/adr/0001-x.md  →  /payments/adr/0001-x/
```

The page shows the project's name, description and owners from `_project.yml`, one stat per record type that links to the pre-filtered index, the project's `links` as pills, and the records grouped by type as cards. An `index.md` or `README.md` directly inside the project folder is rendered as the team intro and is not a page of its own.

When `repo.url` is set, the page also shows a `+ New ADR · 0008` button per type that opens the repository's web editor with the next number and the record template already filled in. See [Header, banner, footer and redirects](0006-header-banner-footer-and-redirects.md).

The older address `/projects/<project>/` redirects permanently to `/<project>/`.

> [!NOTE]
> Because team pages live at the root, a project folder may not be called `decisions`, `timeline`, `backlog`, `authors`, `tags` or another built-in route. The build stops with a clear message if it is.

## Consequences

- Filtered views are plain URLs: they survive reloads, can be shared and can be generated by hand.
- Filtering is client-side, so it needs JavaScript. Without it the page still lists every record as cards.
- The free-text field searches titles, tags and descriptions only; full-text search over the bodies is a separate feature, see [Full-text search with pluggable providers](0005-full-text-search-with-pagefind.md).
- Every record is in the HTML twice (table rows and cards). The chunked cards keep the first paint small, but very large archives still ship a large page.
- Facet values are not validated against the content, so an unknown value in the URL simply matches nothing.
