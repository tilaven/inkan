---
title: "Data API and layouts"
description: "The inkan/data module and the two exported layouts: everything a custom page or a component override needs to read records, projects and authors."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [data, pages, components, extending]
related: [extending/adr/0003-custom-pages, extending/adr/0002-override-components-and-fill-slots, ai/adr/0002-decisions-json]
---

## Context

Custom pages and component overrides need the same data the built-in pages use: the list of records with
their status and type, the projects, the author directory, the site config and the URL helpers that respect
`base`. Reaching into `node_modules/@tilaven/inkan/app/src/lib/...` works until the next release moves a file.

## Decision

The package exports one stable module, `@tilaven/inkan/data`, that re-exports the helpers the app itself uses,
and two layouts, `@tilaven/inkan/layouts/Page` and `@tilaven/inkan/layouts/Docs`. The root export `@tilaven/inkan`
holds `defineConfig`, `definePlugin` and `defineMotif`, `@tilaven/inkan/covers` the drawing helpers for
plugin motifs (see [Generated record covers](../../theming/adr/0005-generated-record-covers.md)) and
`@tilaven/inkan/search` the `SearchProviderFactory`, `SearchProvider`, `SearchContext`, `SearchResults` and
`SearchHit` types plus `SearchUnavailableError` for custom search providers (see
[Full-text search with pluggable providers](../../site/adr/0005-full-text-search-with-pagefind.md)).
Everything else inside the app is private and may change between releases.

## How to use it

```astro
---
import Page from '@tilaven/inkan/layouts/Page';
import { getDecisions, getProjects, site, url } from '@tilaven/inkan/data';
---
```

### Config values

| Export | Meaning |
| --- | --- |
| `site` | The resolved config: `title`, `url`, `base`, `repo`, `navigation`, `footer`, `docTypes`, `statuses`, `landing`, absolute `contentDir` and `pagesDir`, and more |
| `docTypes` | `site.docTypes`: `{ adr: { label, plural, description }, ... }` |
| `statuses` | `site.statuses`: `{ accepted: { label, open?, current?, sticker?, color? }, ... }` |
| `openStatuses` | Status ids marked `open: true` (still being decided) |
| `currentStatuses` | Status ids marked `current: true` (describe how things are now) |

### Records, projects and people

| Export | Meaning |
| --- | --- |
| `getDocs()` | Every Markdown file in the content folder as a collection entry; drafts are dropped in production builds |
| `getDecisions()` | Records only (files inside a type folder), as `Decision` objects, newest first |
| `toDecision(entry)` | Turns a doc entry into a `Decision`: `id`, `href`, `project`, `type`, `number`, `ref`, `status`, `date`, `authors`, `deciders`, `tags`, `supersedes`, `supersededBy`, `related`, `entry` |
| `getProjects()` | Projects with a `_project.yml`, sorted by `order` then name |
| `getAllProjects()` | Those plus bare folders without a `_project.yml`, as `{ id, name, data }` |
| `getAuthorDirectory()` | `Map<handle, { name, github?, gitlab?, team?, avatar? }>` from `_authors.yml` |
| `authorName(handle)` | Display name from the directory, or the handle itself |
| `getPages()` | The Markdown and MDX pages from `pagesDir` |

### Small helpers

| Export | Meaning |
| --- | --- |
| `url(path)` | Prefixes `base`: `url('decisions/')` is `/decisions/` or `/sub/decisions/` |
| `filterHref(facet, value)` | Link to the record index filtered by `tag`, `author`, `project`, `status` or `type` |
| `statusInfo(status)` | The `StatusConfig` of a status id, or `undefined` |
| `countBy(values)` | `[value, count][]` sorted by count then name |
| `formatDate(date)` | `YYYY-MM-DD`, or an empty string |
| `editUrl(entry)` | "Edit this page" link on GitHub or GitLab, or `undefined` without `repo` |
| `sourcePath(entry)` | Path of the source file relative to the repository root, such as `decisions/sre/adr/0001-x.md` |
| `markdownUrl(entry)` | URL of the raw Markdown copy, `<id>.md` |

Types: `Decision`, `DocEntry`, `ProjectEntry`, `PageEntry`.

### Example: a statistics page

```astro title="pages/stats.astro"
---
import Page from '@tilaven/inkan/layouts/Page';
import { countBy, currentStatuses, getDecisions, getProjects, filterHref } from '@tilaven/inkan/data';

const decisions = await getDecisions();
const projects = await getProjects();
const inForce = decisions.filter((d) => d.status && currentStatuses.includes(d.status)).length;
const byProject = countBy(decisions.map((d) => d.project));
const byTag = countBy(decisions.flatMap((d) => d.tags)).slice(0, 10);
---
<Page title="Archive statistics" accent="statistics" eyebrow="Custom page" lede={`${decisions.length} records, ${inForce} in force, ${projects.length} projects.`}>
  <h2>Records per project</h2>
  <table>
    <thead><tr><th>Project</th><th>Records</th></tr></thead>
    <tbody>
      {byProject.map(([id, n]) => <tr><td><a href={filterHref('project', id)}>{projects.find((p) => p.id === id)?.data.name ?? id}</a></td><td>{n}</td></tr>)}
    </tbody>
  </table>
  <h2>Top tags</h2>
  <ul>{byTag.map(([tag, n]) => <li><a href={filterHref('tag', tag)}>{tag}</a> ({n})</li>)}</ul>
</Page>
```

All of this runs at build time. The page is static HTML like every other page.

### Layouts

`Page` is the wide layout (sidebar plus one content column). `Docs` is the reading layout (sidebar, content
column, right rail with the table of contents built from `headings`). Their props and slots are listed in
[Custom pages](0003-custom-pages.md). Both wrap the shared shell, so your page gets the header, banner,
footer, theme and search for free.

## Consequences

- One import path to remember; the module is the contract between your pages and the package.
- The helpers return the same objects the app renders, so a custom page cannot drift from the built-in index.
- Everything is build-time data. A page that needs live numbers has to fetch them in the browser.
- The `entry` on a `Decision` is an Astro content entry; its shape follows Astro's content layer, which is outside Inkan's control.
