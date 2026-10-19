# Inkan

**A docs site for Architecture Decision Records (ADR) and RFCs, built from Markdown in your repo.**
As easy to set up as Zudoku, focused on decisions instead of API references.

- Plain Markdown (GitHub/GitLab flavoured), Mermaid, code highlighting, math, callouts (`> [!NOTE]` alerts and `:::note` admonitions)
- One repo for all teams: a folder per project (SRE, Payments, Infra, DBRE…) defined by a small `_project.yml`
- Custom metadata fields (risk, cost, data class…) declared in the config or per project, validated at build time, filterable on the index and exposed in `decisions.json` and the MCP server
- Full-text search (built-in Pagefind, or Algolia, Meilisearch, Typesense and your own provider), filters by project, type, status, **tag** and **author**, timeline and decision backlog
- Landing page out of the box, configurable from one file
- Static HTML output: host it on GitHub/GitLab Pages, S3, nginx – no server, no database
- Analytics without writing script tags: Plausible, Umami or Google Analytics 4 with page views, search queries and page actions (`inkan/analytics` plugin)
- Made for AI too: `llms.txt`, `llms-full.txt`, `decisions.json`, `AGENTS.md`

## Documentation

The docs live in [`docs/`](docs) and are an Inkan site themselves: every feature is described as an ADR
(why it exists, what was decided, how to use it). Run them with `npm run docs:dev`.

## Quick start

```bash
npm create inkan@latest my-decisions
cd my-decisions
npm install
npm run dev          # http://localhost:4321
```

Or add it to an existing repository:

```bash
npm install -D inkan
npx inkan init
```

## Your repository

```
inkan.config.ts                ← the only config file
decisions/
  _authors.yml                 ← optional: handle → name, team, avatar
  _landing.md                  ← optional: extra section on the home page
  sre/
    _project.yml               ← name, description, icon, owners, links
    adr/0001-define-slos.md    ← type = folder name (adr, rfc, or your own)
    rfc/0001-error-budget.md
    guides/on-call.md          ← any other Markdown page works too
templates/adr.md               ← optional: your own templates for `inkan new`
```

New project = new folder. New record = new file. Nothing else to register.

## Commands

| Command | What it does |
| --- | --- |
| `inkan dev` | Dev server with hot reload (`--port`, `--host`) |
| `inkan build` | Static site in `dist/` (fails on invalid front matter) |
| `inkan preview` | Serve `dist/` locally, including search |
| `inkan new adr sre "Title"` | Next numbered record from a template (`--author`) |
| `inkan init [dir]` | Config, sample project, AGENTS.md, CI files for GitHub and GitLab, Dockerfile and nginx.conf |
| `inkan status sre/adr/1 accepted` | Change a record's status in place (`--date`, `--dry-run`) |
| `inkan supersede <old> <new>` | Link two records as superseded / superseding, both files at once (`--date`, `--dry-run`) |
| `inkan import <dir> --project <name>` | Convert log4brains, MADR or adr-tools records (`--type`, `--format`, `--dry-run`) |
| `inkan rfc-review <record> <reviewer> approve` | Record a reviewer's answer (`approve`, `request-changes`, `reset`; `--note`, `--dry-run`); `--for <handle>` lists records waiting on someone |
| `inkan reviewed <record>` | Record a periodic review of a decided record (`--next`, `--every`, `--date`, `--dry-run`) |
| `inkan reviews` | List decided records whose review is overdue or due soon (`--within`, `--all`, `--json`) |
| `inkan check` | Validate references, numbering, statuses, review schedules and project metadata (`--strict`, `--format json`) |
| `inkan notify` | Post to Slack, Teams or a webhook when records become `accepted` (`--since`, `--dry-run`) |
| `inkan sync` | Fetch the records listed in `sources` |
| `inkan export` | All current decisions as one self-contained HTML file, or a PDF with `--pdf` |
| `inkan mcp` | MCP server (stdio) for AI agents, over the content folder or a published site (`--url`) |

## Front matter

```yaml
---
title: Use Stripe as the primary payment provider   # required
description: One-line summary for lists, search and llms.txt
status: accepted          # draft | proposed | in-review | accepted | implemented | rejected | withdrawn | deprecated | superseded
date: 2026-01-18
authors: [piotr.nowak]
deciders: [tomasz.wojcik]
tags: [payments, vendor]
supersedes: [team-payments/adr/0000-old-choice]     # path inside decisions/, no extension
supersededBy: []
related: [dbre/adr/0001-postgresql-as-default-database]
reviewBy: 2026-11-15      # open record: decision deadline (backlog); decided record: next review
reviewEvery: 1 year       # periodic review of a decided record (or set it per project / site)
reviewed: 2026-10-01      # last review, written by `inkan reviewed`
reviewers:                # RFC reviewers: list of handles, or handle: pending | approved | changes-requested
  ania: approved
  marek: pending
draft: false              # true hides the page from production builds
---
```

Links between records can also be plain relative Markdown links (`[see](../rfc/0001-x.md)`):
they work when browsing the repo on GitHub/GitLab and on the site.

## Configuration

```ts
// inkan.config.ts
import { defineConfig } from 'inkan';

export default defineConfig({
  title: 'Acme Decisions',
  tagline: 'Architecture decisions from every team.',
  url: 'https://decisions.acme.dev',
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
  contentDir: 'decisions',
  locale: 'pl',                                // interface language: 'en' and 'pl' built in, others via translations
  logo: './brand/logo.svg',
  customCss: ['./brand/theme.css'],            // override any --inkan-* CSS variable
  issueLinks: [{ pattern: '\\b(PAY-\\d+)\\b', url: 'https://acme.atlassian.net/browse/$1' }],
  docTypes: { adr: { … }, rfc: { … }, postmortem: { label: 'PM', plural: 'Postmortems', description: 'Postmortem' } },
  statuses: { … },                             // replaces the default list
  reviews: { every: '1 year', soon: 30 },      // periodic review of every decided record
  landing: { sections: ['stats', 'projects', 'latest', 'content', 'agents'] },
});
```

All options with their defaults are in [`packages/inkan/lib/index.d.ts`](packages/inkan/lib/index.d.ts).

## Covers and motifs

Every record gets a riso-style cover, generated at build time as inline SVG from the record's id: a motif drawn with
the team's ink on a random card stock, deterministic per record so a cover never changes between builds. Each project
is assigned an (ink, motif) pair no other project has, so teams stay distinct until every pair is in use.

Motifs carry team keywords, so a project called `security`, `frontend` or `dbre` gets the matching picture (a shield,
a browser window, database discs) without any configuration. Pin either or both in `_project.yml`; what you leave out
is chosen so the pair stays unique. Pinned projects are
reserved first, so adding a pin can change the pair of an unpinned project.

```yaml
# decisions/payments/_project.yml
name: Payments
ink: m          # c, m, y, g, v or o
motif: ticker   # a built-in or a plugin motif
```

A plugin adds motifs with `motifs`. A motif is a function that draws on a canvas with ink classes (`a` main ink,
`b` alt ink, `k` black, `p` paper, `sa`/`sk` strokes, `n` no fill, `x` blend) instead of colours, so one print works
in both themes. `record` and `project` are seeded random generators: use the first for what varies per record, the
second for what all covers of a team share.

```ts
// plugins/stamp.ts
import { defineMotif } from 'inkan';
import { circle, n } from 'inkan/covers';

export default defineMotif((c, record, project) => {
  const cx = c.w * (project() < 0.5 ? 0.3 : 0.7);
  const cy = c.h * (0.3 + record() * 0.1);
  c.halftone({ spacing: 5, angle: 0.6, maxR: 2.6, cls: 'a', field: { cx, cy, r: c.w, pow: 1.3, amp: 1.1 } });
  c.add(circle(cx, cy, c.w * 0.3, ' class="b x"'));
  c.add(`<path class="sk n" stroke-width="2" d="M${n(cx - 40)} ${n(cy)}H${n(cx + 40)}"/>`);
}, { keywords: ['audit', 'controls'] });

// plugins/acme.ts
import { definePlugin } from 'inkan';

export default definePlugin({ name: 'acme', motifs: { stamp: new URL('./stamp.ts', import.meta.url) } });
```

Motif names are lowercase (`/^[a-z][a-z0-9-]*$/`); a plugin may replace a built-in name. An unknown `motif:` fails
the build and lists the available names.

## Deploying

`inkan build` writes plain HTML/CSS (plus small scripts for search, diagrams and filters) to `dist/`.
`init` adds ready workflows for **GitHub Pages** and **GitLab Pages**. Anything that serves static files works.
Set `BASE_PATH=/sub/path` when the site is not at the domain root.

## How it works

Inkan is a CLI with a complete site inside the package, built on [Astro](https://astro.build) as a
static HTML compiler. Your repository only holds content and `inkan.config.ts`; the CLI runs Astro with
the app from the package and your config injected as a virtual module (the same model Zudoku uses with Vite).
Search is [Pagefind](https://pagefind.app), code blocks are [Expressive Code](https://expressive-code.com),
diagrams are [Mermaid](https://mermaid.js.org).

## This repository

```
packages/inkan          the CLI + site (published to npm)
packages/create-inkan   `npm create inkan`
examples/company-decisions     demo content
docs                           the documentation site, written as ADRs
```

```bash
npm install
npm run dev        # runs the example against the local package
npm run docs:dev   # runs the documentation site
```

## License

MIT
