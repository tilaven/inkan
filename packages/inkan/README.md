# Inkan

**A docs site for Architecture Decision Records (ADR) and RFCs, built from Markdown in your repo.**
As easy to set up as Zudoku, focused on decisions instead of API references.

- Plain Markdown (GitHub/GitLab flavoured), Mermaid, code highlighting, math, callouts (`> [!NOTE]` alerts and `:::note` admonitions)
- One repo for all teams: a folder per project (SRE, Payments, Infra, DBRE…) defined by a small `_project.yml`
- Custom metadata fields (risk, cost, data class…) declared in the config or per project, validated at build time, filterable on the index and exposed in `decisions.json` and the MCP server
- Full-text search (built-in Pagefind, or Algolia, Meilisearch, Typesense and your own provider), filters by project, type, status, **tag** and **author**, timeline and decision backlog
- Landing page out of the box, configurable from one file
- Shared links unfurl in Slack, Teams and the like with a card drawn from the record's cover
- Static HTML output: host it on GitHub/GitLab Pages, S3, nginx – no server, no database
- Analytics without writing script tags: Plausible, Umami or Google Analytics 4 with page views, search queries and page actions (`inkan/analytics` plugin)
- Made for AI too: `llms.txt`, `llms-full.txt`, `decisions.json`, `AGENTS.md`, every page as raw Markdown
- Extensible like Zudoku: plugins, custom pages, component overrides and slots, MDX components, redirects

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
pages/handbook.md              ← optional: your own pages (.md, .mdx, .astro) at /handbook/
templates/adr.md               ← optional: your own templates for `inkan new`
```

New project = new folder. New record = new file. Nothing else to register.

## Commands

| Command | What it does |
| --- | --- |
| `inkan dev` | Dev server with hot reload (`--port`, `--host`, `--public`) |
| `inkan build` | Static site in `dist/` (fails on invalid front matter) |
| `inkan preview` | Serve `dist/` locally, including search |
| `inkan serve` | Production server for `dist/`, with [sign-in](#sign-in-and-protected-projects) when `authentication` is set (`--port`, default 8080) |
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

Your own keys (`risk: high`, `cost: 40`) are declared under `fields` in the config or a `_project.yml`; see the
[Custom metadata fields](https://github.com/tilaven/inkan/blob/main/docs/decisions/authoring/adr/0012-custom-metadata-fields.md) ADR.

Links between records can also be plain relative Markdown links (`[see](../rfc/0001-x.md)`):
they work when browsing the repo on GitHub/GitLab and on the site.

### Callouts

GitHub and GitLab alerts and Zudoku/Docusaurus admonitions render as the same block:

```md
> [!WARNING]
> Keys expire after 24 hours.

> [!note] Custom title (GitLab)
> Body.

:::danger{title="Do not"}
Never rewrite an accepted record.
:::

:::tip[Bracket title]
Nested callouts use more colons on the outer block (`::::`).
:::
```

Types: `note`, `tip`, `info`, `important`, `warning`, `caution`, `danger`, plus Zudoku's `sparkles`, `rocket`,
`settings`, `zap`, `lock` and `megaphone`. Blocks get `.markdown-alert.markdown-alert-<type>` for custom CSS.
Only the `:::` block form is parsed, so `word:name` and `::` in prose stay plain text. `:::` blocks with other
names are left for remark plugins (set `data.hName` to claim one); unclaimed ones keep their fences as text.

## Configuration

Everything lives in `inkan.config.ts` (or `.mjs`, `.js`, `.json`). Every option is optional; relative paths are
resolved from the config file. The config is validated on start and errors name the key, e.g.
`inkan.config.ts: statuses.accepted.label: expected string, received number`.

```ts
import { defineConfig } from 'inkan';

export default defineConfig({
  title: 'Acme Decisions',
  url: 'https://decisions.acme.dev',
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
  customCss: ['./brand/theme.css'],
  navigation: [{ label: 'Handbook', href: '/handbook/' }],
  redirects: { '/old-page': '/decisions/' },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `title`, `tagline`, `description` | "Inkan", … | Site name, hero text and `<meta name="description">` |
| `url` | `http://localhost:4321` | Public URL, used for llms.txt, RSS, sitemap and canonical links |
| `base` | `/` | Sub-path when not served from the domain root; `BASE_PATH` env var overrides it |
| `repo` | – | `{ url, branch, provider: 'github' \| 'gitlab' }`; enables "Edit page" and "New record" links |
| `contentDir` | `decisions` | Folder with the records |
| `templatesDir` | `templates` | Your templates for `inkan new` (`adr.md`, `rfc.md`, …) |
| `pagesDir` | `pages` | Your own `.astro`, `.md` and `.mdx` pages, see [Custom pages](#custom-pages) |
| `logo`, `favicon` | built-in | SVG/PNG files |
| `customCss` | `[]` | CSS files loaded on every page; override any `--inkan-*` token |
| `theme.default` | `system` | Theme before the reader picks one: `system`, `light` or `dark` |
| `navigation` | `[]` | `{ label, href }[]` added to the header after the built-in links; site-relative `href`s starting with `/` get the base path, full URLs are untouched (same for `footer.links`) |
| `banner` | `null` | `{ message, dismissible }` strip above the header; `message` may hold inline HTML |
| `footer` | – | `{ copyright, links }`; inline HTML allowed in `copyright` |
| `redirects` | `{}` | Old path → new path, e.g. after moving a record |
| `search` | Pagefind | Search provider and its options, or `false` for no search, see [Search](#search) |
| `head` | `[]` | `{ tag, attrs, content }[]` added to every page's `<head>` |
| `components` | `{}` | Your `.astro` files replacing built-in components or filling slots, see [Overriding components](#overriding-components-and-slots) |
| `mdxComponents` | – | Module whose default export maps names to components for every MDX file |
| `plugins` | `[]` | See [Plugins](#plugins) |
| `issueLinks` | `[]` | `{ pattern, url }[]`: issue keys matching the regex become links, `$1` is the first group |
| `docTypes` | `adr`, `rfc` | `{ label, plural, description }` per type; the type is the folder name. Replaces the defaults |
| `statuses` | nine built-ins | `{ label, open?, current?, sticker?, color? }` per status. Replaces the defaults |
| `landing` | – | `title`, `tagline`, `actions: { text, link, variant }[]` and `sections` (`stats`, `projects`, `latest`, `content`, `agents`) |
| `sources` | `[]` | Records from other repositories or folders, one project each, see [Sources](#records-from-other-repositories) |
| `git` | `{ dates: true, authors: true, history: true }` | Fill a missing `date` / `authors` from the commit that added the record; `history` lists the status changes on the record page |
| `og` | `{ theme: 'light' }` | Open Graph cards drawn from the covers (`/og/*.png`) so shared links unfurl with a picture; `theme: 'dark'` prints them on Stage, `false` turns them off |
| `codeRefs` | whole repo except Markdown, marker `@adr` | `{ include, exclude, marker }` for [code references](#code-references); `false` turns the scan off |
| `reviewers` | `{ approvals: null }` | Approvals needed for an RFC review to count as approved; `null` means every reviewer. See [RFC reviews](#rfc-reviews) |
| `export` | current statuses | `{ statuses, title }` of the [print / export](#print-and-export) document |
| `reviews` | `{ every: null, soon: 30 }` | `{ every, statuses, soon }` for [periodic reviews](#periodic-reviews): the interval for every decided record (`'1 year'`), which statuses get reviews (default: the current ones) and the due-soon window in days |

Types for every option are in `lib/index.d.ts`.

## Search

The search button in the header and <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> open the search palette. It takes its results from a provider:

```ts
export default defineConfig({
  search: { type: 'pagefind', maxResults: 8 },
});
```

| `type` | Options | Index |
| --- | --- | --- |
| `pagefind` (default) | `ranking: { termFrequency, pageLength, termSimilarity, termSaturation }` | Built into `dist/pagefind` by `inkan build`, no service needed |
| `algolia` | `appId`, `apiKey`, `indexName`, `params` | Your Algolia index |
| `meilisearch` | `host`, `apiKey`, `indexUid`, `params` | Your Meilisearch index |
| `typesense` | `host`, `apiKey`, `collection`, `queryBy`, `params` | Your Typesense collection |
| `custom` | `module`, `options` | Anything your module talks to |

Every provider takes `maxResults` (default 8) and `enabled`; `search: false` removes search. `params` go straight to the service's
search request, e.g. `{ filters: 'status:accepted' }` for Algolia. Use a search-only API key, because it ends up in the browser.

With an external provider, `inkan build` writes `dist/search.json` instead of the Pagefind index: one record per page with
`id`, `objectID`, `url`, `title`, `description`, `content` (plain text), `project`, `type`, `status`, `ref`, `tags`, `authors` and
`date`. Push it to your service after each build, for example in CI:

```sh
# Meilisearch
curl -X POST "$MEILI_HOST/indexes/decisions/documents?primaryKey=id" \
  -H "Authorization: Bearer $MEILI_ADMIN_KEY" -H 'Content-Type: application/json' --data-binary @dist/search.json

# Typesense (create the collection with title, description, content and tags fields first)
jq -c '.[]' dist/search.json | curl -X POST "$TYPESENSE_HOST/collections/decisions/documents/import?action=upsert" \
  -H "X-TYPESENSE-API-KEY: $TYPESENSE_ADMIN_KEY" --data-binary @-

# Algolia
curl -X POST "https://$ALGOLIA_APP_ID.algolia.net/1/indexes/decisions/batch" \
  -H "X-Algolia-Application-Id: $ALGOLIA_APP_ID" -H "X-Algolia-API-Key: $ALGOLIA_ADMIN_KEY" \
  --data-binary "$(jq '{requests: map({action: "updateObject", body: .})}' dist/search.json)"
```

An index with another shape works too: the palette reads `url` (or `href`), `title`, `description` and `content` from each hit.

A `custom` provider is a browser module whose default export turns `options` into an object with a `search` method.
Throw `SearchUnavailableError` to show a message in the palette instead of a generic error:

```ts
// search.ts, with search: { type: 'custom', module: './search.ts', options: { endpoint: 'https://search.acme.example' } }
import { SearchUnavailableError, type SearchProviderFactory } from 'inkan/search';

const acme: SearchProviderFactory<{ endpoint: string }> = ({ endpoint }) => ({
  async search(query, { limit, signal }) {
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`, { signal });
    if (!res.ok) throw new SearchUnavailableError(`Search answered ${res.status}.`);
    const { hits, total } = await res.json();
    return { hits, total }; // hits: { url, title, excerpt?, project?, type?, status?, ref? }[]
  },
});

export default acme;
```

A plugin can set `search` in its `config` hook, so a provider can ship as its own package.

## Beyond the site

### Records from other repositories

Teams can keep their records next to their code. Each entry in `sources` shows up as a project, exactly like a folder
in `decisions/`:

```ts
sources: [
  { project: 'checkout', repo: 'git@github.com:acme/checkout.git', branch: 'main' }, // path defaults to docs/decisions
  { project: 'search', dir: '../search-service', path: 'adrs' },                      // a local folder, no fetching
],
```

The source folder holds `<type>/NNNN-title.md` files and an optional `_project.yml` (a `<path>/<project>/<type>/`
layout works too). `inkan sync` makes a shallow, sparse clone into `node_modules/.inkan/sources/`;
`dev` runs it when the cache is missing and `build` refreshes it on every run (`--offline` keeps the cache). Relative
links and images keep working, and "Edit", "New ADR" and the `source` fields in `decisions.json` point at the source
repository. `check`, `status` and `mcp` see sourced records too.

| Key | Meaning |
| --- | --- |
| `project` | Folder-style name of the project the source appears as (required) |
| `repo` / `dir` | Exactly one: a git remote (URL, `git@host:org/x.git`, or a local path relative to the project root) or a local folder |
| `provider` | `'github'` or `'gitlab'`, for `repo` sources; guessed from the URL unless set, so name it for self-hosted GitLab |
| `branch` | Branch to follow (`repo` only); defaults to the remote's default branch |
| `path` | Records folder inside the source, default `docs/decisions` |

`repo`, `branch` and `path` must not start with `-`. Dates and authors are not inferred from git for `repo` sources
(their clones are shallow); `dir` sources are read from their own repository.

### Metadata from git

When a record omits `date` or `authors`, they come from the commit that added the file (one `git log` per build).
Git authors are matched to `_authors.yml` handles by `email`, handle, name or `github`/`gitlab` login; otherwise the git
name is shown. Turn it off with `git: { dates: false, authors: false }`.

Every record page also lists who changed its `status` and when, newest first, with a link to the commit diff on GitHub/GitLab
(from `repo.url`, for files in the hub's own repository). Records of `repo` sources have no history. Turn it off with `git: { history: false }`.

### Code references

Code can point back at a record with a comment such as `// @adr sre/adr/0001`, `# @adr SRE-ADR-0001` or
`-- @adr platform/adr/0009-move-the-event-bus-to-kafka`. The repository (`git ls-files`, so ignored files are skipped)
is scanned once per build; each record lists the files and lines that mention it, linked to GitHub/GitLab, and
`decisions.json` carries `codeRefs`. References to unknown records are reported as build warnings.

### Lifecycle and import

`inkan status <record> <status>` and `inkan supersede <old> <new>` edit front matter in place and keep
comments, key order and quoting. `<record>` may be an id (`sre/adr/0001-use-slos`), a short id (`sre/adr/1`), a ref
(`SRE-ADR-0001`) or a file path. `inkan import` converts log4brains, MADR (2.x header lists and 3/4 front
matter) and adr-tools records: the first heading becomes the title, status, date, deciders and tags move into front
matter, `Superseded by` / `Supersedes` links become `supersededBy` / `supersedes`, links between imported files are
rewritten, original numbers are kept when free, and existing files are never overwritten. Records fetched from a `repo`
source are read-only here: change them in their own repository.

### RFC reviews

List `reviewers` in front matter and the record header shows each answer and a count like "2 of 3 approvals". The review is `in-review` (waiting on pending reviewers), `changes-requested` (waiting on the authors), `approved` (waiting on the deciders, or the authors) or `closed`. `/rfc-reviews/` lists open records by group with their `reviewBy` deadlines; pick your handle there (or add `?me=<handle>` to a URL) to see "Waiting on you" badges. This is a convenience in the browser, not authentication. `inkan rfc-review <record> <reviewer> approve|request-changes|reset` writes the answer into the front matter, and `inkan rfc-review --for <handle>` lists what waits on someone. The MCP server has an `rfc_reviews` tool.

### Checks in CI

`inkan check` validates records without building. Errors (exit 1): references in `supersedes`, `supersededBy`
or `related` that do not exist, duplicate numbers per project and type, front matter that does not parse or has no
`title`, unknown statuses and invalid dates. Warnings: one-sided supersede links, records with `supersededBy` that are
not `superseded`, projects without `_project.yml` or `owners`, authors and reviewers missing from `_authors.yml`, records with a current status while a reviewer still requests changes (`review-blocked`), open RFCs past
their `reviewBy` date and decided records whose periodic review is overdue. Unreadable `reviewers` entries are errors. `--strict` makes warnings fail,
`--format json` prints a report, and on GitHub Actions every problem becomes an annotation on its file and line. The CI
files `init` creates run it before the build.

### Periodic reviews

Decided records (`accepted`, `implemented`, or `reviews.statuses`) come back up for review. `reviewBy` on such a record
is the date of the next review; `reviewEvery: 1 year` (also `6 months`, `90 days`, `2w`) schedules it from the last
`reviewed` date or, before any review, from the record's `date`. Set the interval once for a project in `_project.yml`
or for the site with `reviews: { every: '1 year' }`; a record or project with `reviewEvery: never` opts out, and a
record's own value wins over the project's, which wins over the site's. `/reviews/` lists what is overdue, due soon
(`reviews.soon` days, default 30) and scheduled, the record header shows "Next review" and "Reviewed", and a "Periodic reviews"
link appears in the sidebar as soon as anything is scheduled.

`inkan reviewed <record>` writes today's `reviewed` date (`--date` for another day) and the next review:
`--next YYYY-MM-DD` sets `reviewBy`, `--every <interval>` sets `reviewEvery`, and without `--next` the `reviewBy` is
removed when an interval applies, otherwise the command asks for one. `inkan reviews` lists overdue and
soon-due reviews (`--within <days>`, `--all`, `--json`); `inkan check` warns about overdue ones (`review-due`)
and rejects malformed intervals (`review-interval`). `decisions.json` and `get_record` carry
`review: { due, reviewed, every } | null`, and the MCP tool `due_reviews` returns the due list to agents.

### Print and export

`/export/` (linked from the footer) is one print-ready document with every current decision: a cover, a table of
contents and each record in full, grouped by project, one record per A4 page. `inkan export` writes it as a
single self-contained `decisions.html` (CSS, fonts, images and diagrams inlined), `--pdf` as an A4 PDF with page numbers
(`--out`, `--no-build`). Diagrams and the PDF need the optional `playwright-core` package and a Chromium:
`npm install playwright-core && npx playwright-core install chromium`, or point `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
at a Chrome binary.

### README badges

Every site serves `/badges/records.svg`, `/badges/accepted.svg` (records with a current status) and
`/badges/<project>.svg`, e.g. `![Decisions](https://decisions.acme.dev/badges/records.svg)`. The same names with `.json`
are shields.io endpoints. `badges` cannot be used as a project folder name.

### Sign-in and protected projects

Show some content only to signed-in people, with the same `authentication` option as Zudoku. Mark a project with
`protected: true` in its `_project.yml`, and/or list paths in `protectedRoutes`:

```ts
export default defineConfig({
  url: 'https://decisions.acme.dev',
  authentication: { type: 'github', clientId: 'Iv1.0123', allow: { groups: ['acme'] } }, // openid, auth0, entra, gitlab, github
  protectedRoutes: ['/handbook/*'],
});
```

`inkan build` then writes the public site to `dist/` (protected content removed from pages, search, `llms.txt`,
`decisions.json`, RSS and `.md` copies) and the full site to `dist-protected/`. `inkan serve` serves both and
enforces sign-in on the server. Secrets come from `INKAN_AUTH_SECRET` (32+ characters) and
`INKAN_AUTH_CLIENT_SECRET`; register `<url><base>_auth/callback/` with the provider. `inkan dev` shows
everything with lock marks, `dev --public` shows what anonymous visitors see. Whole-site protection without code is
still possible at the edge. See the `deploy` project of the docs: *Sign-in and protected projects* and *Protect the
site at the edge*.

### MCP server for AI agents

`inkan mcp` serves records over the Model Context Protocol (stdio), so agents can query with filters instead of
reading `llms-full.txt`. It reads the content folder live (`--root`) or a published site (`--url`). Tools:
`list_projects`, `search_records` (project, type, status, tag, author, text, `current_only`, paging), `get_record`
(Markdown plus the supersede chain, the record that is current now and its `review`), `list_tags`, `list_fields` (local sites only),
`list_authors` and `due_reviews` (project, within, all); every record is also a `decision://<id>` resource.

```sh
claude mcp add inkan -- npx inkan mcp --root .
```

```json
{ "mcpServers": { "inkan": { "command": "npx", "args": ["inkan", "mcp", "--url", "https://decisions.acme.dev"] } } }
```

## Extending

### Plugins

A plugin is a plain object (wrap it in `definePlugin` for type hints). Every field is optional:

```ts
// plugins/acme.ts
import { definePlugin } from 'inkan';
import remarkToc from 'remark-toc';

export default definePlugin({
  name: 'acme',
  // Change the resolved config (defaults applied, paths absolute); runs in plugin order.
  config: (config) => ({ ...config, description: `${config.description} Maintained by Platform Engineering.` }),
  remarkPlugins: [remarkToc],           // also rehypePlugins, vitePlugins, integrations (Astro)
  head: [{ tag: 'meta', attrs: { name: 'acme:owner', content: 'platform-engineering' } }],
  navigation: [{ label: 'On-call', href: '/on-call/' }],
  // Extra routes: an .astro page or an endpoint, as an absolute path or file URL.
  pages: [{ pattern: '/on-call', entrypoint: new URL('./on-call.astro', import.meta.url) }],
});
```

`config` hooks run every time the config is loaded, including each dev-server restart, so they must be
idempotent: return a new object or set values, do not append to arrays unconditionally. `head` and `navigation`
are validated again after the hooks ran. Unknown plugin keys are kept but reported as a warning.

```ts
// inkan.config.ts
import acme from './plugins/acme.ts';
export default defineConfig({ plugins: [acme] });
```

### Custom pages

Files in `pages/` (`pagesDir`) are served at their path: `pages/handbook.md` → `/handbook/`,
`pages/team/index.mdx` → `/team/`, `pages/stats.astro` → `/stats/`, `pages/people/[handle].astro` → dynamic route.
Files and folders starting with `_` are ignored. Markdown pages need `title` (and may set `description`, `draft`
and `slug`) in their front matter and use the reading layout. `.astro` pages import the package's layouts and data:
`Page` is the wide layout (sidebar + content), `Docs` adds the right rail with "On this page" (pass `headings`).
Both take `title`, `description`, `eyebrow`, `accent` (the trailing words of the title that get the ink underline),
`lede` (inline HTML) and `crumbs`:

```astro
---
import Page from 'inkan/layouts/Page';
import { getDecisions } from 'inkan/data';
const decisions = await getDecisions();
---
<Page title="Records by status" accent="status" eyebrow="Custom page" lede="Live counts computed at build time.">
  <p>{decisions.length} records.</p>
</Page>
```

- `inkan/layouts/Page`: wide layout (sidebar + content). Props: `title`, `description`, `lede`, `head`.
- `inkan/layouts/Docs`: reading layout with a table of contents. Props: `title`, `description`, `headings`.
- `inkan/data`: `getDecisions`, `getAllProjects`, `getPages`, `url` (prefixes the base path), `markdownUrl`,
  `countBy`, `statusInfo`, `formatDate`, `site`, `docTypes`, `statuses`, and the `Decision` type.

A page whose route is taken by a built-in page, a record, a redirect or another page fails the build with a message
naming both; a page with parameters (`[id]`) next to such a route only warns, since the more specific route wins.
Link to pages from the header with `navigation`.

### Overriding components and slots

Point `components.<Name>` at your own `.astro` file. It receives the same props as the built-in one.
Slots render nothing until you fill them.

| Components | Slots (empty by default) |
| --- | --- |
| `Header`, `Footer`, `Banner`, `Sidebar`, `RecordHeader`, `RecordFooter`, `RecordHistory`, `RecordCard`, `PageActions`, `LandingHero` | `HeadEnd`, `HeaderEnd`, `SidebarTop`, `SidebarBottom`, `RecordTop`, `RecordBottom` |

```ts
export default defineConfig({
  components: { SidebarBottom: './components/SidebarBottom.astro', Footer: './components/Footer.astro' },
});
```

Inside your component, `import.meta.env.BASE_URL` is the base path and `inkan/data` exports the data helpers
(`getDecisions`, `getAllProjects`, `url`, …).

### MDX components

Records and pages may be `.mdx` files with imports and JSX. Components listed in your `mdxComponents` module are
available everywhere without an import:

```ts
// components/mdx.ts
import Callout from './Callout.astro';
export default { Callout };
```

```mdx
<Callout title="Escalation">No owner within a day? Post in #architecture.</Callout>
```

### Markdown export

Every record and Markdown page is also served raw at its URL without the trailing slash plus `.md`:
`/sre/adr/0001-define-slos/` → `/sre/adr/0001-define-slos.md`. The whole file is published, front matter included,
so keep anything private out of it. `llms.txt` links to these files.
On record pages the **Copy page** menu copies that Markdown, opens it, or hands it to Claude or ChatGPT.
Replace or hide the menu with `components.PageActions`.

### Custom CSS tokens

The look is driven by `--inkan-*` custom properties on `:root` (colours, fonts, radii, inks for the project covers).
Put overrides in a file listed in `customCss`; use `[data-theme='dark']` for the dark theme:

```css
:root { --inkan-accent: #0b5fff; --inkan-font: 'Inter Variable', system-ui, sans-serif; }
[data-theme='dark'] { --inkan-accent: #7aa2ff; }
```

The full list is in `app/src/styles/tokens.css` of the package.

## Deploying

`inkan build` writes plain HTML/CSS (plus small scripts for search, diagrams and filters) to `dist/`.
`init` adds ready workflows for **GitHub Pages** and **GitLab Pages**. Anything that serves static files works.
Set `BASE_PATH=/sub/path` when the site is not at the domain root. To put the site behind a login without
`inkan serve`, the `deploy/oauth2-proxy` folder of the Inkan repository has compose files with oauth2-proxy and nginx.

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
examples/company-decisions     demo content: 5 teams, 13 records
```

```bash
npm install
npm run dev      # runs the example against the local package
```

Visual baselines in `e2e/__screenshots__/` are rendered in Docker so that fonts match everywhere; update them
with `npm run test:visual:docker:update`, never with a native Playwright run. `scripts/og-fonts.py` regenerates the
static WOFF fonts for Open Graph cards after a web font changes.

## License

MIT
