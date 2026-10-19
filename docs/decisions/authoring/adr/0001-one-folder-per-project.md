---
title: "One folder per project"
description: "How a folder with a small _project.yml becomes a team space with its own page, sidebar section and URL prefix."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, navigation, config]
related: [authoring/adr/0002-record-type-comes-from-the-folder, authoring/adr/0005-optional-author-directory]
---

## Context

A company keeps decisions for many teams: SRE, Payments, Platform, DBRE. Each team wants its own list, its own owners and its own numbering, but nobody wants to register teams in a config file and keep that file in sync with the folders. The repository layout already says which team a record belongs to.

## Decision

A project is a top-level folder inside the content folder (`decisions/` by default). A `_project.yml` in that folder gives it a name, a description, owners and links. The folder name is the project id and the first URL segment of everything in it. A folder without `_project.yml` still works: it is listed under its folder name.

Any Markdown file in a project folder that is not a record becomes a page in that project's sidebar section. Files and folders whose name starts with `_` are never pages.

## How to use it

### The folder

```text
decisions/
  sre/
    _project.yml              project metadata
    index.md                  optional intro shown on the team page
    adr/0001-define-slos.md   records, see "Record type comes from the folder"
    rfc/0001-error-budget.md
    guides/on-call.md         any other page
    _drafts/ideas.md          ignored: starts with "_"
```

`inkan new adr sre "Title"` creates `sre/_project.yml` with a placeholder name when the folder is new. Fill it in afterwards.

### `_project.yml`

```yaml title="decisions/sre/_project.yml"
name: "SRE"
description: "Reliability, on-call and the numbers we promise."
icon: activity
ink: c
motif: rings
owners: [marek, ania]
order: 10
links:
  - label: Runbooks
    url: https://runbooks.acme.example
  - label: On-call guide
    url: /sre/guides/on-call/
```

| Field | Required | What it does |
| --- | --- | --- |
| `name` | yes | Shown in the sidebar, the breadcrumbs, the team page and the landing page. |
| `description` | no | Lede of the team page and the project card on the landing page. |
| `icon` | no | A name from the built-in icon set (below). Accepted and stored; the built-in components do not render it yet, so it is only useful to your own components through the data API. |
| `ink` | no | Process ink for covers and accents: `c` (cyan), `m` (magenta), `y` (yellow), `g` (green), `v` (violet) or `o` (orange). Assigned when absent, so that no other project has the same (ink, motif) pair. |
| `motif` | no | Cover-art motif: a built-in name such as `rings`, `shield` or `browser`, or one a plugin registers. When absent, a motif whose keywords appear in the folder name or `name` is preferred (`security` gets a shield, `frontend` a browser window, `dbre` database discs); otherwise one is assigned together with the ink. See [Generated record covers](../../theming/adr/0005-generated-record-covers.md) for the full list and the keywords. |
| `owners` | no | Author handles, see [Optional author directory](0005-optional-author-directory.md). Shown with avatars on the team page. |
| `order` | no | Sorting on the landing page and in the sidebar. Lower comes first, default `100`, ties are sorted by name. |
| `links` | no | Buttons on the team page. `url` must start with `http://`, `https://` or `/`. |

Built-in icon names: `search`, `sun`, `moon`, `menu`, `x`, `chevron-right`, `arrow-right`, `arrow-left`, `external`, `pencil`, `rss`, `file-plus`, `book`, `heart`, `activity`, `database`, `server`, `cloud`, `settings`, `credit-card`, `shield`, `users`, `layers`, `tag`, `clock`, `inbox`, `list`, `home`, `sparkles`, `github`, `gitlab`. An unknown name falls back to `book`.

`.yaml` works as well as `.yml`. The build fails when a field has the wrong type, for example an `ink` outside the six letters, or when `motif` names a motif nobody registered.

### The team page

Every project gets a page at `/<folder>/`. It shows the owners, one counter per record type, "New ADR" and "New RFC" buttons (when `repo` is configured, they open your repository's web editor with the next number and the template filled in), the `links`, the intro and the records as cards.

The intro is `index.md` or `README.md` in the project folder. `index.md` wins when both exist. It is rendered as part of the team page and does not get a page of its own. Its front matter needs only `title`:

```md title="decisions/sre/index.md"
---
title: SRE
---
We run the platform. Decisions here cover alerting, SLOs and incident process.
```

> [!NOTE]
> A flat file next to a folder with the same name (`sre.md` beside `sre/`) collides with the team page and fails the build. Use `sre/index.md` instead.

### Other pages in a project

Any `.md` or `.mdx` file in a folder that is not a record type is a plain page. It appears in the sidebar under the project, after the record groups, sorted by the `order` front matter field (lowest first, default 0) and then by title.

```md title="decisions/sre/guides/on-call.md"
---
title: On-call guide
description: Who gets paged, when, and what to do.
order: 1
---
```

Pages show an "Edit on github" link and the date of the last commit that touched the file when the site is built inside a git checkout.

Markdown files at the root of the content folder (not in any project) are listed at the top of the sidebar, also sorted by `order`. This site uses them for its own guides.

### URL mapping

The URL is the file path without the extension, lower-cased, with a trailing slash:

| File | URL |
| --- | --- |
| `sre/adr/0001-define-slos.md` | `/sre/adr/0001-define-slos/` |
| `sre/guides/on-call.md` | `/sre/guides/on-call/` |
| `sre/guides/index.md` | `/sre/guides/` |
| `sre/index.md` | rendered on `/sre/` |
| `quick-start.md` (root) | `/quick-start/` |

Path segments are slugified the way GitHub slugs headings: spaces become `-`, punctuation is dropped. A `slug` field in front matter replaces the whole path. The project folder is slugified the same way, and that slug is the project's id everywhere: a folder `Ops Plans/` is the team `ops-plans`, at `/ops-plans/`, with refs like `OPS-PLANS-ADR-0001`. The old address `/projects/<folder>/` redirects to `/<folder>/`.

Project folders cannot use the names of built-in pages: `decisions`, `timeline`, `backlog`, `graph`, `authors`, `tags`, `projects`. The build reports the collision.

## Consequences

- Adding a team is creating a folder. Nothing in `inkan.config.ts` changes.
- The folder name is part of every URL and of every `ref` (`SRE-ADR-0007`). Renaming a folder moves all its records; use `redirects` in the config for the old paths.
- `_project.yml` is optional, so a half-configured repository still builds. The downside is that a typo in the file name (`project.yml` without the underscore) is silently ignored and the folder shows up under its raw name.
- `icon` is validated but not displayed by the built-in components. Treat it as a hook for your own overrides.
