---
title: "Repository layout"
description: "Where every file of an Inkan repository goes and which URL it gets on the site."
order: 3
---

An Inkan repository is content plus one config file. The site structure follows the folder structure, so there is nothing to register when you add a project, a type or a page.

## Annotated tree

```text
my-decisions/
  inkan.config.ts        the only config file (.ts, .mjs, .js or .json)
  package.json                 scripts: dev, build, preview, new, status, supersede, check
  decisions/                   contentDir (default: decisions)
    _authors.yml               optional: handle -> name, team, github/gitlab, avatar
    _landing.md                optional: Markdown for the "content" section of the home page
    handbook.md                a page at the root of the content folder  -> /handbook/
    sre/                       a project: one folder per team or area
      _project.yml             name, description, icon, ink, motif, owners, reviewEvery, order, links, protected
      index.md                 optional intro, rendered on the team page /sre/ (README.md works too)
      adr/                     a record type: the folder name must be a key of docTypes
        0001-define-slos.md    -> /sre/adr/0001-define-slos/
        0002-error-budget.md
      rfc/
        0001-on-call-rota.md   -> /sre/rfc/0001-on-call-rota/
      guides/
        on-call.md             any other Markdown is a page of the project -> /sre/guides/on-call/
    payments/
      _project.yml
      adr/0001-use-postgresql-for-the-ledger.md
  templates/                   templatesDir: your own templates for `inkan new`
    adr.md                     one file per record type; placeholders {{title}} {{date}} {{author}}
  pages/                       pagesDir: extra pages outside the content folder
    stats.astro                an Astro page                   -> /stats/
    guides/index.md            Markdown or MDX, same layout as a record page -> /guides/
  components/                  conventional home for component overrides (components option)
    SidebarBottom.astro
    mdx.ts                     default export: name -> component, for mdxComponents
  plugins/                     conventional home for plugins (plugins option)
    acme.ts
    stamp.ts                   a cover motif, registered by acme.ts under `motifs`
  brand/                       logo, favicon and CSS referenced from the config
  dist/                        output of `inkan build` (ignored by git)
  dist-protected/              with `authentication`: the full site for signed-in users (ignored by git, never published)
  AGENTS.md  Dockerfile  nginx.conf  .github/workflows/decisions.yml  .gitlab-ci.yml
```

Only `inkan.config.*` and the content folder are required. `templates/`, `pages/`, `components/`, `plugins/` and `brand/` are conventions: the first two are default values of `templatesDir` and `pagesDir`, the others are whatever paths you write in the config.

## The content folder

`contentDir` (default `decisions`, relative to the config file) holds everything the site is built from. Rules:

- **Files and folders whose name starts with `_` are not pages.** `_project.yml`, `_authors.yml` and `_landing.md` are read for their special purpose; anything else that starts with `_` is ignored, which makes `_drafts/` a handy parking spot.
- **The first folder level is the project.** A top-level folder that holds Markdown or a `_project.yml` is a project. `_project.yml` is optional: a bare folder is shown by its folder name. See [One folder per project](authoring/adr/0001-one-folder-per-project.md).
- **The second folder level is the record type** when its name is a key of `docTypes` (`adr` and `rfc` by default). Files there are records: they get a number from the file name, a status, a cover and a place on the timeline. See [Record type comes from the folder](authoring/adr/0002-record-type-comes-from-the-folder.md).
- **Any other Markdown file is a plain page.** At the root of the content folder it appears in the sidebar above the projects (this page is one of them). Inside a project it is listed under that project, below its records. Use `order` in front matter to sort pages.
- **`<project>/index.md` or `<project>/README.md` is the project intro.** It is rendered on the team page `/<project>/` and does not get a URL of its own. `index.md` wins when both exist.

Both `.md` and `.mdx` work everywhere Markdown is accepted.

## How paths map to URLs

The URL mirrors the path inside the content folder, with the extension removed and a trailing slash added. Each path segment is slugified the way GitHub slugifies headings: lowercased, punctuation removed, spaces turned into `-`. Keep file names lowercase with hyphens and the URL equals the path.

| File | URL |
| --- | --- |
| `decisions/sre/adr/0001-define-slos.md` | `/sre/adr/0001-define-slos/` |
| `decisions/sre/guides/on-call.md` | `/sre/guides/on-call/` |
| `decisions/sre/guides/index.md` | `/sre/guides/` |
| `decisions/sre/index.md` | rendered on `/sre/` |
| `decisions/handbook.md` | `/handbook/` |
| `pages/stats.astro` | `/stats/` |
| `pages/guides/index.md` | `/guides/` |

A `slug` field in front matter replaces the whole path-derived id, so `slug: sre/adr/slos` serves the file at `/sre/adr/slos/`. The number and type of a record still come from the folder and the file name, so keep records in their type folder.

Every page also has a raw Markdown twin at the same URL without the trailing slash plus `.md`, for example `/sre/adr/0001-define-slos.md`. See [Markdown copy of every page](ai/adr/0003-markdown-copy-of-every-page.md).

## Reserved routes

The app has its own pages, and your content must not use their paths:

| Route | What it is |
| --- | --- |
| `/decisions/`, `/timeline/`, `/backlog/`, `/reviews/`, `/authors/`, `/tags/` | the hub pages |
| `/graph/`, `/graph.json` | the decision graph and its JSON, see [Decision graph](site/adr/0012-decision-graph.md) |
| `/<project>/` | the team page of every project folder |
| `/projects/<project>/` | redirects to `/<project>/` (old address) |
| `/rss.xml`, `/sitemap-index.xml`, `/llms.txt`, `/llms-full.txt`, `/decisions.json`, `/AGENTS.md` | feeds and exports |
| `/export/` | the print-ready document of every current decision, see [Print and export](site/adr/0008-print-and-export.md) |
| `/badges/<name>.svg`, `/badges/<name>.json` | README badges and shields.io endpoints for `records`, `accepted` and every project id, see [README badges](site/adr/0009-readme-badges.md) |
| `/pagefind/`, `/search.json` | the search index (Pagefind), or the records for an external search provider |
| `/404/` | the not-found page |
| `/_auth/` | sign-in, callback, logout and the access-denied page of `inkan serve`, see [Sign-in and protected projects](deploy/adr/0007-sign-in-and-protected-projects.md) |

The build fails with a clear message when a project folder is called `decisions`, `tags`, `graph`, `export` or `badges` (the last one because the badge routes live under it), when a root-level `about.md` has the same id as a project folder `about/` (use `about/index.md` for the intro), or when a page in `pagesDir` or a plugin page would shadow a record, a redirect or a built-in page. The same applies to a project name in `sources`. Pages with parameters (`guides/[slug].astro`) only warn, because the more specific route wins.

Projects listed in `sources` are not folders of the content folder: their records are read from a local folder (`dir`) or from a clone under `node_modules/.inkan/sources/<project>` (`repo`), and appear on the site as `/<project>/...` like any other. A source project must not also exist as a folder in `contentDir`. See [Records from other repositories](deploy/adr/0005-records-from-other-repositories.md).

## Pages outside the content folder

`pagesDir` (default `pages`) is for pages that are not decisions: handbooks, dashboards, statistics.

- `.astro` files become routes at their file path and can use the data API. `pages/stats.astro` is `/stats/`, `pages/about/index.astro` is `/about/`.
- `.md` and `.mdx` files render through the same layout as a record page, with `title`, `description` and `draft` in front matter. They do not appear in the sidebar.
- Files and folders starting with `_` are skipped, so `pages/_partials/` can hold components.

Adding or removing a file in `pagesDir` restarts the dev server so the new route exists. See [Custom pages](extending/adr/0003-custom-pages.md).

## Templates, components and plugins

- `templates/<type>.md` replaces the built-in template of that type for `inkan new` and for the "New ADR" button on team pages. Types without a file in your folder use the package's `adr.md` and `rfc.md`. See [Number records with inkan new](cli/adr/0003-number-records-with-inkan-new.md).
- `components/` is where the example keeps the `.astro` files named in `components` and the module named in `mdxComponents`. See [Override components and fill slots](extending/adr/0002-override-components-and-fill-slots.md) and [MDX components without imports](extending/adr/0004-mdx-components-without-imports.md).
- `plugins/` is where the example keeps modules that export `definePlugin({...})`. See [Plugins with definePlugin](extending/adr/0001-plugins-with-defineplugin.md).

All paths in the config are relative to the config file, which is why the config and the content usually sit at the repository root. They do not have to: this site lives in `docs/` of the Inkan repository, with `docs/inkan.config.ts` and `docs/decisions/`, and edit links still point at the right file because Inkan finds the Git root on its own.

## Build output

`inkan build` writes to `dist/` next to the config file. Caches go to `node_modules/.inkan` (the clones of `repo` sources live in its `sources/` folder, one per project) and `node_modules/.vite-inkan`. The `.gitignore` from `init` excludes `node_modules/` and `dist/`, so the cache is never committed; `inkan export` writes `decisions.html` or `decisions.pdf` into the current folder, which you may want to ignore as well.

With `authentication` in the config, the build writes a second site: `dist/` holds only what anonymous visitors may see, `dist-protected/` holds everything plus `_server.json`, and `inkan serve` picks one per request. Add `dist-protected/` to `.gitignore` and never publish it as static files. A project is marked with `protected: true` in its `_project.yml`. See [Sign-in and protected projects](deploy/adr/0007-sign-in-and-protected-projects.md).
