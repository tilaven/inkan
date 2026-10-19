---
title: "What is Inkan"
description: "A docs site for Architecture Decision Records and RFCs, built from the Markdown in your repository."
order: 1
---

Inkan turns a folder of Markdown files into a searchable website for **Architecture Decision Records (ADR)** and **RFCs**. You keep writing records in your repository, next to the code and under the same review process. Inkan adds the site: one folder per team, record numbers, statuses, a timeline, a backlog, a decision graph, full-text search, a print export and machine-readable exports for AI tools. It also adds the tooling around the records: a check for CI, commands that change statuses and supersede records, an importer for existing ADR folders, records pulled from other repositories and an MCP server for agents.

It is a CLI with a complete site inside the npm package. Your repository holds only content and one config file.

## Who it is for

- Engineering organisations that want one place for the decisions of every team (SRE, Payments, Platform, DBRE and so on), without one wiki page per team drifting apart.
- Teams that already write ADRs as Markdown and want them published without building a site themselves.
- People who use coding agents and want the decisions available as `llms.txt`, `decisions.json`, `graph.json` and `AGENTS.md`.

You need Node.js 22.22 or newer, a Git repository and a few minutes. See the [quick start](quick-start.md).

## How it works

```text
your repository                          inkan (npm package)
inkan.config.ts   ─┐               bin/cli.mjs        dev | build | preview | init
decisions/               ├──────────►    lib/commands/      new | status | supersede | import | check | sync | export | mcp
                         │               app/               the Astro site, config injected as a virtual module
  sre/_project.yml       │               templates/         adr.md, rfc.md for `inkan new`
  sre/adr/0001-….md      │               starter/           files that `init` copies
  sre/rfc/0001-….md     ─┘
                                         dist/              static HTML, CSS, search index
```

`inkan build` reads your config, validates every record's front matter and writes plain HTML to `dist/`. There is no server and no database: host the output on GitHub Pages, GitLab Pages, S3 or nginx.

## Features

Every feature of Inkan is documented as a record on this site. The record explains why the feature exists, what was decided and how to use it.

### CLI

- [Ship as an npm package with a CLI](cli/adr/0001-ship-as-an-npm-package-with-a-cli.md): `dev`, `build`, `preview`, `--root`, `--port`, `--host`.
- [Scaffold with init and npm create](cli/adr/0002-scaffold-with-init-and-npm-create.md): a working repository in one command, including CI files.
- [Number records with inkan new](cli/adr/0003-number-records-with-inkan-new.md): the next `NNNN-slug.md` from a template.
- [Validate config and content at build time](cli/adr/0004-validate-config-and-content-at-build-time.md): typos in the config and bad front matter fail fast.
- [Change status and supersede from the CLI](cli/adr/0005-change-status-and-supersede-from-the-cli.md): `status` and `supersede` edit front matter in place and link both records.
- [Import from log4brains, MADR and adr-tools](cli/adr/0006-import-from-log4brains-madr-and-adr-tools.md): bring an existing ADR folder in with one command.
- [Check records in CI](cli/adr/0007-check-records-in-ci.md): `check` finds broken references, duplicate numbers, one-sided supersede links and overdue reviews in seconds, with pull request annotations.
- [Mark records reviewed from the CLI](cli/adr/0009-mark-records-reviewed-from-the-cli.md): `reviewed` closes a periodic review in front matter and `reviews` lists what is due.

### Writing records

- [One folder per project](authoring/adr/0001-one-folder-per-project.md) and [record type comes from the folder](authoring/adr/0002-record-type-comes-from-the-folder.md): `decisions/<project>/<type>/NNNN-slug.md`, nothing to register.
- [Metadata in front matter](authoring/adr/0003-metadata-in-front-matter.md), a [configurable status lifecycle](authoring/adr/0004-configurable-status-lifecycle.md) and an [optional author directory](authoring/adr/0005-optional-author-directory.md).
- [Link records by path](authoring/adr/0006-link-records-by-path.md): `supersedes`, `supersededBy`, `related`, or plain relative Markdown links.
- [GitHub-flavoured Markdown with diagrams and math](authoring/adr/0007-github-flavoured-markdown-with-diagrams-and-math.md) and [issue keys turned into links](authoring/adr/0008-turn-issue-keys-into-links.md).
- [Fill date and authors from git](authoring/adr/0009-fill-date-and-authors-from-git.md): a record without `date` or `authors` takes them from its first commit.
- [Reference records from code](authoring/adr/0010-reference-records-from-code.md): a `// @adr sre/adr/0001` comment lists that file on the record.
- [Review decisions on a schedule](authoring/adr/0011-review-decisions-on-a-schedule.md): `reviewEvery: 1 year` on a record, a project or the site brings decided records back for review, on `/reviews/`, in `check` and for agents.

### Site

- [Landing page from config](site/adr/0001-landing-page-from-config.md), a [filterable record index](site/adr/0002-filterable-record-index.md), [timeline and backlog](site/adr/0003-timeline-and-backlog.md), [authors and tags pages](site/adr/0004-authors-and-tags-pages.md), a [decision graph](site/adr/0012-decision-graph.md) of supersedes and related links.
- [Full-text search with Pagefind](site/adr/0005-full-text-search-with-pagefind.md), [header, banner, footer and redirects](site/adr/0006-header-banner-footer-and-redirects.md), [RSS feed and sitemap](site/adr/0007-rss-feed-and-sitemap.md).
- [Print and export](site/adr/0008-print-and-export.md): `/export/` is one print-ready document of every current decision, and `inkan export` writes it as HTML or PDF.
- [README badges](site/adr/0009-readme-badges.md): `/badges/records.svg`, `/badges/accepted.svg` and one badge per project, plus shields.io endpoints.
- [Open Graph cards](site/adr/0011-open-graph-cards.md): every record, team and the site get a generated 1200×630 PNG, so shared links unfurl with a picture.

### Theming

- [OVERPRINT design](theming/adr/0001-overprint-design.md) with [Day and Stage themes](theming/adr/0002-day-and-stage-themes.md).
- [Theme with --inkan-* CSS tokens](theming/adr/0003-theme-with-inkan-css-tokens.md), [brand with logo and favicon](theming/adr/0004-brand-with-logo-and-favicon.md), [generated record covers](theming/adr/0005-generated-record-covers.md).

### Extending

- [Plugins with definePlugin](extending/adr/0001-plugins-with-defineplugin.md), [override components and fill slots](extending/adr/0002-override-components-and-fill-slots.md).
- [Custom pages](extending/adr/0003-custom-pages.md), [MDX components without imports](extending/adr/0004-mdx-components-without-imports.md), [data API and layouts](extending/adr/0005-data-api-and-layouts.md).

### AI and data

- [llms.txt and llms-full.txt](ai/adr/0001-llms-txt-and-llms-full-txt.md), [decisions.json](ai/adr/0002-decisions-json.md), a [Markdown copy of every page](ai/adr/0003-markdown-copy-of-every-page.md) and [AGENTS.md for coding agents](ai/adr/0004-agents-md-for-coding-agents.md).
- [MCP server for agents](ai/adr/0005-mcp-server-for-agents.md): `inkan mcp` lets agents search and read records with filters, from the local folder or a published site.

### Deploying

- [Static HTML output](deploy/adr/0001-static-html-output.md), [GitHub and GitLab Pages](deploy/adr/0002-github-and-gitlab-pages.md), [Docker and nginx](deploy/adr/0003-docker-and-nginx.md), [serve from a sub-path](deploy/adr/0004-serve-from-a-sub-path.md).
- [Records from other repositories](deploy/adr/0005-records-from-other-repositories.md): `sources` and `inkan sync` show the decisions of other repositories as projects of one site.

Ideas that are not built yet are RFCs with `status: proposed`. They show up on the Open decisions page of this site.

## Compared with similar tools

**Zudoku** is a docs framework for API references: a CLI, a site inside the package, one config file, and your repository holds only content. Inkan follows the same model, but the content model is decisions instead of OpenAPI, so it knows about projects, record types, numbers, statuses and the links between records.

**log4brains** is the closest tool in purpose. It also publishes ADRs from Markdown and gave Inkan many of its ideas: numbered files, a timeline, superseding. Inkan differs in a few places: metadata lives in front matter instead of Markdown headings, many projects share one site through folders, and the output includes files made for AI agents. Ideas that are not built yet are written up as RFCs next to the decisions.

## About this site

This site is built with Inkan from the `docs/` folder of the Inkan repository. The config is `docs/inkan.config.ts`, the records are in `docs/decisions/`, and every page you read here renders the way your own records will.

Next: the [quick start](quick-start.md), then the [repository layout](project-structure.md), the [configuration reference](configuration.md) and the [front matter reference](front-matter.md).
