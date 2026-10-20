---
title: "Custom pages"
description: "Add your own pages next to the records: Markdown and MDX files render through the docs layout, .astro files get full control, and the file path is the URL."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [pages, content, extending]
options: [pagesDir]
related: [extending/adr/0005-data-api-and-layouts, extending/adr/0004-mdx-components-without-imports, site/adr/0006-header-banner-footer-and-redirects]
---

## Context

A decision site needs a few pages that are not decisions: a handbook on how to write records, an on-call page,
a statistics dashboard. Markdown files inside the content folder already become pages, but they are grouped
under a project and listed in the sidebar as part of the archive. Some pages belong to the site, not to a team,
and some need code, not prose.

## Decision

A folder outside the content directory, `pagesDir` (default `pages`), holds your own pages. The file path is
the URL. `.md` and `.mdx` files render through the same route and layout as the records, with the site's
Markdown features and your MDX components. `.astro` files are injected as routes and can import the package's
layouts and data helpers. Files and folders starting with `_` are ignored.

## How to use it

```text
pages/
  handbook.md          -> /handbook/
  on-call.mdx          -> /on-call/
  stats.astro          -> /stats/
  guides/index.md      -> /guides/
  guides/review.md     -> /guides/review/
  _drafts/ideas.md     -> ignored
```

| Option | Default | What it does |
| --- | --- | --- |
| `pagesDir` | `'pages'` | Folder with your pages, relative to the config file. The folder may be absent. |

### Markdown and MDX pages

Front matter needs a `title`; `description` and `draft` are optional. Nothing else is read, so a page cannot
have a status or authors; that is what records are for.

```md title="pages/handbook.md"
---
title: Decision handbook
description: How Acme writes, reviews and retires architecture decisions.
---

## When to write a record

Write an **ADR** when a choice is hard to reverse. Write an **RFC** when you want feedback before deciding.
```

| Field | Required | What it does |
| --- | --- | --- |
| `title` | yes | Page title, breadcrumb and `<title>` |
| `description` | no | Lede under the title, meta description, entry in `llms.txt` |
| `draft` | no | `true` hides the page from production builds; it still renders in `dev` |
| `slug` | no | Replaces the path-derived URL, for example `slug: help` serves `pages/faq/long-name.md` at `/help/` |

The page renders in the reading layout with the eyebrow "Page", a table of contents in the right rail, an
"Edit on github" link when `repo` is configured, and a "Last updated" date from git. It is indexed by search,
listed in a `## Pages` section of `/llms.txt`, and served as raw Markdown at `/handbook.md`.

Markdown pages are not added to the sidebar. Link them from the header with `navigation` or from
`_landing.md`:

```ts title="inkan.config.ts"
navigation: [{ label: 'Handbook', href: '/handbook/' }],
```

### Astro pages

An `.astro` file becomes a route at its path. It can use the two layouts the package exports and the data API:

```astro title="pages/stats.astro"
---
import Page from '@tilaven/inkan/layouts/Page';
import { countBy, getDecisions } from '@tilaven/inkan/data';

const decisions = await getDecisions();
const byStatus = countBy(decisions.map((d) => d.status ?? 'none'));
---
<Page title="Records by status" accent="status" eyebrow="Custom page" lede="Live counts computed at build time.">
  <table>
    <thead><tr><th>Status</th><th>Records</th></tr></thead>
    <tbody>{byStatus.map(([status, count]) => <tr><td>{status}</td><td>{count}</td></tr>)}</tbody>
  </table>
</Page>
```

Dynamic routes work too: `pages/by-tag/[tag].astro` with a `getStaticPaths()` export, as in any Astro project.

### Layouts

| Import | Shape | Props |
| --- | --- | --- |
| `@tilaven/inkan/layouts/Page` | Sidebar and one wide content column; used by the index, timeline and team pages | `title`, `description?`, `image?`, `crumbs?`, `head?` (default `true`), `eyebrow?`, `accent?`, `lede?`, `sidebar?` (default `true`), `ink?` |
| `@tilaven/inkan/layouts/Docs` | Sidebar, reading column and a sticky right rail with "On this page"; used by records | `title`, `description?`, `image?`, `crumbs?`, `headings?`, `head?` (default `false`), `eyebrow?`, `accent?`, `lede?`, `status?`, `ink?` |

`accent` is the word of the title to underline. `ink` is a project ink class such as `ink-c`. Both layouts
take a default slot and a `lede` slot for markup under the title; `Page` adds a `head` slot inside the page
head, `Docs` adds `rail` and `rail-end` slots. See [Data API and layouts](0005-data-api-and-layouts.md).

### Rules and checks

- A page whose route matches a built-in page (`/decisions/`, `/timeline/`, `/authors/`, `/rss.xml`, a project
  folder, ...), a record, a redirect source or another page fails the build with `inkan: page routes must be unique.`
  A route with a parameter only warns.
- Adding or removing a file in `pagesDir` restarts the dev server so the routes are recomputed. Edits hot-reload.
- `pages/index.astro` would claim `/`, which the landing page owns; it fails the collision check.
- Pages in `pagesDir` are not records: no status, no number, no place in `decisions.json` or the timeline.

## Consequences

- Prose pages cost one Markdown file; code pages cost one `.astro` file. Both live outside the archive and do not disturb numbering or statistics.
- Markdown pages are reachable only through links you add, by design. A page that should sit in a team's sidebar belongs in `decisions/<project>/` instead.
- `.astro` pages use Astro directly, so Astro's API surface and its upgrades become part of your site.
- Collisions fail the build rather than silently shadowing a built-in page.
