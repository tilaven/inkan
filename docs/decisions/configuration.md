---
title: "Configuration reference"
description: "Every option of inkan.config with its type, default and a one-line explanation."
order: 4
---

All configuration lives in one file next to your content. Inkan looks for, in this order, `inkan.config.ts`, `inkan.config.mjs`, `inkan.config.js` and `inkan.config.json` in the folder it runs in (or in `--root`). No file at all is valid: every option has a default.

```ts title="inkan.config.ts"
import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  title: 'Acme Decisions',
  url: 'https://decisions.acme.dev',
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
});
```

`defineConfig` only returns what you pass in; it exists so your editor can type-check the object against `InkanConfig` from `lib/index.d.ts`. In a `.mjs` or `.js` file you can use it the same way, or export a plain object. A `.json` file holds the same keys as the object and may carry a `$schema` key, which is accepted and dropped; the package does not ship a JSON schema file yet.

Every key is optional. Unknown keys are an error with a "did you mean" hint, so a typo cannot silently do nothing. Nested objects (`repo`, `theme`, `footer`, `landing`, `git`, `codeRefs`, `og`, `export`, `reviews`, `reviewers`) are merged with the defaults key by key; `docTypes` and `statuses` replace the default maps as a whole. See [Validate config and content at build time](cli/adr/0004-validate-config-and-content-at-build-time.md).

All paths are relative to the config file.

## Site

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `title` | `string` | `'Inkan'` | Site name in the header, the landing hero, page titles and feeds. |
| `tagline` | `string` | `'Architecture Decision Records and RFCs for every team, in one place.'` | One line under the title on the landing page. |
| `description` | `string` | `'Central, searchable record of architecture decisions (ADR) and proposals (RFC).'` | Default `<meta name="description">`, RSS description and the lead of `llms.txt`. |
| `url` | `string` | `'http://localhost:4321'` | Public URL of the deployed site. Used for absolute links in `llms.txt`, RSS, the sitemap and Open Graph images. |
| `base` | `string` | `'/'` | Sub-path when the site is not at the domain root, e.g. `'/decisions'`. The `BASE_PATH` environment variable overrides it. |
| `locale` | `string` | `'en'` | Interface language as a BCP 47 tag. `'en'` and `'pl'` are built in; any other tag takes its text from `translations`. Also sets `<html lang>`, date formats and the default `tagline`, `description`, status and type labels. |
| `translations` | `Record<string, Record<string, Message>>` | `{}` | Interface text by language and key, e.g. `{ pl: { 'nav.backlog': 'Kolejka' } }`. Wins over the built-in and plugin text. |
| `repo.url` | `string` | `''` | Repository that holds the content. Enables "Edit this page" and "New ADR / New RFC" buttons. |
| `repo.branch` | `string` | `'main'` | Branch those links point at. |
| `repo.provider` | `'github' \| 'gitlab'` | `'github'` | Decides the URL format of edit and new-file links. |

See [Interface in your language](site/adr/0015-interface-in-your-language.md) for the keys and plural forms.

`BASE_PATH` matters in CI: the workflow and pipeline that `init` creates set `BASE_PATH=/<repository name>` for project pages. See [Serve from a sub-path](deploy/adr/0004-serve-from-a-sub-path.md) and [GitHub and GitLab Pages](deploy/adr/0002-github-and-gitlab-pages.md).

## Content paths

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `contentDir` | `string` | `'decisions'` | Folder with the records, projects, `_authors.yml` and `_landing.md`. |
| `templatesDir` | `string` | `'templates'` | Folder with your own `<type>.md` templates for `inkan new`. Built-in `adr.md` and `rfc.md` fill the gaps. |
| `pagesDir` | `string` | `'pages'` | Folder with your own `.astro`, `.md` and `.mdx` pages, served at their file path. |

See [One folder per project](authoring/adr/0001-one-folder-per-project.md), [Number records with inkan new](cli/adr/0003-number-records-with-inkan-new.md) and [Custom pages](extending/adr/0003-custom-pages.md). The [repository layout](project-structure.md) shows how the three folders fit together.

## Look

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `logo` | `string \| null` | `null` | SVG or PNG shown in the header instead of the built-in mark. |
| `favicon` | `string \| null` | `null` | SVG or PNG used as the favicon. |
| `customCss` | `string[]` | `[]` | CSS files loaded on every page after the built-in styles. Override any `--inkan-*` token here. |
| `theme.default` | `'system' \| 'light' \| 'dark'` | `'system'` | Theme used before the reader picks one. `light` is Day, `dark` is Stage. |
| `og` | `false \| { theme? }` | `{ theme: 'light' }` | Open Graph cards (1200×630 PNG at `/og/`) for records, teams and the site, plus the `og:image` and `twitter:*` tags. `false` writes no cards and no image tags. Needs `url` for absolute image URLs. |
| `og.theme` | `'light' \| 'dark'` | `'light'` | Paper of the cards: `light` is Day, `dark` is Stage. |

See [Open Graph cards](site/adr/0011-open-graph-cards.md), [Brand with logo and favicon](theming/adr/0004-brand-with-logo-and-favicon.md), [Theme with --inkan-* CSS tokens](theming/adr/0003-theme-with-inkan-css-tokens.md) and [Day and Stage themes](theming/adr/0002-day-and-stage-themes.md).

## Navigation

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `navigation` | `{ label, href }[]` | `[]` | Links in the header, after the built-in ones. Plugins may append more. |
| `banner` | `{ message, dismissible? } \| null` | `null` | A strip above the header. `message` may contain inline HTML; `dismissible` defaults to `false`. |
| `footer.copyright` | `string` | `''` | Text in the footer. Inline HTML allowed. |
| `footer.links` | `{ label, href }[]` | `[]` | Links in the footer. |
| `redirects` | `Record<string, string>` | `{}` | Old path to new path, e.g. `{ '/adr': '/decisions/' }`. Site-relative targets get `base` prepended. |
| `search` | `false \| SearchConfig` | `{ type: 'pagefind' }` | Search provider behind the palette. `false` removes search. |
| `search.enabled` | `boolean` | `true` | `false` removes the search button, the shortcut and the index step. |
| `search.maxResults` | `number` | `8` | Most hits the palette shows, 1 to 50. |
| `search.type` | `'pagefind' \| 'algolia' \| 'meilisearch' \| 'typesense' \| 'custom'` | `'pagefind'` | Which index answers queries. The other keys depend on it; unknown keys for the chosen type are rejected. |
| `search.ranking` | `{ termFrequency?, pageLength?, termSimilarity?, termSaturation? }` | not set | Pagefind ranking weights (`type: 'pagefind'` only). |
| `search.appId`, `search.apiKey`, `search.indexName`, `search.params?` | `string`, `string`, `string`, `Record<string, unknown>` | required | `type: 'algolia'`. `params` is merged into the search request. |
| `search.host`, `search.indexUid`, `search.apiKey?`, `search.params?` | `string` (URL), `string`, `string`, `Record<string, unknown>` | required | `type: 'meilisearch'`. |
| `search.host`, `search.apiKey`, `search.collection`, `search.queryBy?`, `search.params?` | `string` (URL), `string`, `string`, `string`, `Record<string, string \| number \| boolean>` | `queryBy: 'title,description,content,tags'` | `type: 'typesense'`. |
| `search.module`, `search.options?` | `string`, `Record<string, unknown>` | required, `{}` | `type: 'custom'`: a browser module whose default export is a `SearchProviderFactory`, relative to the config file. |
| `comments` | `false \| CommentsConfig` | not set (off) | Discussion section below records. `false` or no key means no comments. |
| `comments.enabled` | `boolean` | `true` | `false` removes the section everywhere. |
| `comments.types` | `string[]` | `['rfc']` | Record types (keys of `docTypes`) that get comments. |
| `comments.statuses` | `string[]` | every status | Only records with one of these statuses get comments. |
| `comments.provider` | `'giscus' \| 'gitlab' \| 'custom'` | required | Which service holds the conversation. The other keys depend on it; unknown keys for the chosen provider are rejected. |
| `comments.repoId`, `comments.category`, `comments.categoryId`, `comments.repo?` | `string` | required, `repo` from `repo.url` | `provider: 'giscus'`. Get the ids from [giscus.app](https://giscus.app). `repo` is `owner/name`. |
| `comments.mapping?`, `comments.strict?`, `comments.reactions?`, `comments.inputPosition?`, `comments.lang?`, `comments.theme?` | `'specific' \| 'pathname' \| 'url' \| 'title' \| 'og:title'`, `boolean`, `boolean`, `'top' \| 'bottom'`, `string`, `{ light?, dark? }` | `'specific'`, `true`, `true`, `'top'`, `'en'`, `{ light: 'light', dark: 'dark' }` | giscus widget settings. `theme` takes giscus theme names or CSS URLs for Day and Stage. |
| `comments.project?`, `comments.host?`, `comments.labels?` | `string`, `string`, `string[]` | from `repo.url`, origin of `repo.url` (else `'https://gitlab.com'`), `[]` | `provider: 'gitlab'`. `project` is `group/sub/repo`; `labels` go on issues started from the page. |
| `comments.component`, `comments.options?` | `string`, `Record<string, unknown>` | required, `{}` | `provider: 'custom'`: an `.astro` file relative to the config file, rendered inside the section and given `options`. |
| `head` | `{ tag, attrs?, content? }[]` | `[]` | Extra tags for every page's `<head>`, e.g. an analytics script. Plugins may append more. |

```ts title="inkan.config.ts"
export default defineConfig({
  navigation: [{ label: 'Handbook', href: '/handbook/' }],
  banner: { message: 'Decision review every Thursday, 14:00 in <b>#architecture</b>.', dismissible: true },
  footer: { copyright: '© Acme', links: [{ label: 'Status', href: 'https://status.acme.dev' }] },
  redirects: { '/sre/adr/0001': '/sre/adr/0001-define-slos/' },
  head: [{ tag: 'script', attrs: { defer: true, 'data-domain': 'decisions.acme.dev', src: 'https://plausible.io/js/script.js' } }],
});
```

See [Header, banner, footer and redirects](site/adr/0006-header-banner-footer-and-redirects.md), [Full-text search with pluggable providers](site/adr/0005-full-text-search-with-pagefind.md) and [Comments under RFCs](site/adr/0010-comments-under-rfcs.md).

## Extending

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `components` | `Partial<Record<ComponentName, string>>` | `{}` | Your `.astro` file for a built-in component or an empty slot. Names: `Header`, `Footer`, `Banner`, `Sidebar`, `RecordHeader`, `RecordFooter`, `RecordCard`, `PageActions`, `LandingHero`, `HeadEnd`, `HeaderEnd`, `SidebarTop`, `SidebarBottom`, `RecordTop`, `RecordBottom`. |
| `mdxComponents` | `string \| null` | `null` | Module whose default export maps names to components available in every MDX file without an import. |
| `plugins` | `InkanPlugin[]` | `[]` | Plugins made with `definePlugin`: a `config` hook, remark/rehype/Vite plugins, Astro integrations, extra pages, cover motifs, head tags and navigation links. |

See [Override components and fill slots](extending/adr/0002-override-components-and-fill-slots.md), [MDX components without imports](extending/adr/0004-mdx-components-without-imports.md) and [Plugins with definePlugin](extending/adr/0001-plugins-with-defineplugin.md).

## Content model

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `issueLinks` | `{ pattern, url }[]` | `[]` | Regular expressions whose matches in record text become links; `$1` in `url` is the first capture group. |
| `docTypes` | `Record<string, { label, plural, description }>` | `adr`, `rfc` | Record types. The key is the folder name inside a project. Replaces the defaults. |
| `statuses` | `Record<string, StatusConfig>` | nine built-in statuses | Allowed values of `status` in front matter. Replaces the defaults. |
| `fields` | `Record<string, FieldConfig>` | `{}` | Custom front matter fields for every project: shown on the record, filterable on `/decisions/`, validated at build time. A `_project.yml` can add, redefine or remove (`false`) fields. |

Default `docTypes`:

```ts
docTypes: {
  adr: { label: 'ADR', plural: 'Decisions', description: 'Architecture Decision Record' },
  rfc: { label: 'RFC', plural: 'Proposals', description: 'Request for Comments' },
}
```

Default `statuses`, with the two flags that give a status its meaning:

| Key | Label | `open` | `current` |
| --- | --- | --- | --- |
| `draft` | Draft | yes | |
| `proposed` | Proposed | yes | |
| `in-review` | In review | yes | |
| `accepted` | Accepted | | yes |
| `implemented` | Implemented | | yes |
| `rejected` | Rejected | | |
| `withdrawn` | Withdrawn | | |
| `deprecated` | Deprecated | | |
| `superseded` | Superseded | | |

A `StatusConfig` has `label` (required), `open` (listed on the backlog, `reviewBy` is tracked), `current` (describes how things are now; gets periodic reviews unless `reviews.statuses` says otherwise), `sticker` (borrow the sticker of a built-in status, e.g. `'accepted'`) and `color` (sticker colour for a custom status without a built-in sticker).

> [!WARNING]
> `docTypes` and `statuses` replace the default maps instead of merging with them. Copy the defaults you want to keep. After the change, every record whose `status` is not in the new map fails the build.

A `FieldConfig` has `type` (`text`, `number`, `boolean`, `date`, `enum`, `list` or `url`; default `text`), `label`, `description`, `values` (required for `enum`, optional for `list`), `required`, `filter` (default `true`), `column` (table view column), `unit` (numbers only) and `default` (written by `inkan new`). Field names cannot be built-in front matter keys.

```ts title="inkan.config.ts"
export default defineConfig({
  fields: {
    risk: { type: 'enum', values: ['low', 'medium', 'high'], column: true },
    cost: { type: 'number', unit: 'k€/year' },
  },
});
```

See [Custom metadata fields](authoring/adr/0012-custom-metadata-fields.md), [Turn issue keys into links](authoring/adr/0008-turn-issue-keys-into-links.md), [Record type comes from the folder](authoring/adr/0002-record-type-comes-from-the-folder.md) and [Configurable status lifecycle](authoring/adr/0004-configurable-status-lifecycle.md).

## Sources

Records kept in other repositories or folders, shown as one project each, exactly like a folder in `contentDir`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `sources` | `Source[]` | `[]` | One entry per external project. A project listed here must not also exist as a folder in `contentDir`. |
| `sources[].project` | `string` | required | Folder-style name the source appears as: letters, digits, `-` and `_`. |
| `sources[].repo` | `string` | not set | Git remote to fetch: an https or ssh URL, `git@host:org/repo.git`, or a local path. Exactly one of `repo` or `dir`. |
| `sources[].dir` | `string` | not set | A local folder, relative to the config file. Read in place, nothing is fetched. |
| `sources[].branch` | `string` | the remote's default branch | Branch to follow. `repo` only. |
| `sources[].provider` | `'github' \| 'gitlab'` | guessed from `repo` | Decides the edit and "New ADR" link format for that source. Set it for self-hosted GitLab. `repo` only. |
| `sources[].path` | `string` | `'docs/decisions'` | Records folder inside the source. A `<path>/<project>/<type>/` layout is accepted too. |

```ts title="inkan.config.ts"
export default defineConfig({
  sources: [
    { project: 'checkout', repo: 'git@github.com:acme/checkout.git', branch: 'main' },
    { project: 'search', dir: '../search-service', path: 'adrs' },
  ],
});
```

`repo`, `branch` and `path` must not start with `-`, and `path` must stay inside the source. `inkan sync` fetches `repo` sources into `node_modules/.inkan/sources/<project>`; `build` refreshes them (`--offline` keeps the cache) and `dev` fetches the missing ones. See [Records from other repositories](deploy/adr/0005-records-from-other-repositories.md).

## Git, code references, export and reviews

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `git.dates` | `boolean` | `true` | A record without `date` takes the date of the commit that added the file. |
| `git.authors` | `boolean` | `true` | A record without `authors` takes the author of that commit, matched to `_authors.yml` by email, handle, name or `github`/`gitlab` login. |
| `git.history` | `boolean` | `true` | Every record page lists each change of its `status`: who made it, when, and a link to the commit diff. |
| `codeRefs` | `false \| { include?, exclude?, marker? }` | `{ include: ['**/*'], exclude: ['**/*.{md,mdx}'], marker: '@adr' }` | Scan the repository for comments such as `// @adr sre/adr/0001` and list them on the record. `false` turns the scan off. |
| `codeRefs.include` | `string[]` | `['**/*']` | Glob patterns of files to scan (`**` crosses folders, `{a,b}` picks one; a pattern without `/` matches a file name anywhere). |
| `codeRefs.exclude` | `string[]` | `['**/*.{md,mdx}']` | Patterns to skip. `node_modules`, `dist` and `.git` are always skipped, as are files git ignores. |
| `codeRefs.marker` | `string` | `'@adr'` | The word before the record reference. |
| `reviewers.approvals` | `number \| null` | `null` | Approvals an RFC needs before its review counts as `approved`. `null` means every reviewer must approve; a number above the reviewer count is capped. See [Review RFCs with reviewers](authoring/adr/0013-review-rfcs-with-reviewers.md). |
| `export.statuses` | `string[]` | every status with `current: true` | Statuses included on the `/export/` page and in `inkan export`. |
| `export.title` | `string` | `''` (uses `<title>: decisions`) | Title on the cover page of the export. |
| `reviews.every` | `string \| false \| null` | `null` | Periodic review interval for every decided record: `'1 year'`, `'6 months'`, `'90 days'`, `'2 weeks'` or the short forms `'1y'`, `'6m'`, `'90d'`, `'2w'`. A project's `reviewEvery` in `_project.yml` and a record's own `reviewEvery` override it. `null` or `false` schedules only records that carry `reviewBy` or `reviewEvery` themselves. |
| `reviews.statuses` | `string[]` | every status with `current: true` | Statuses whose records get periodic reviews. |
| `reviews.soon` | `number` | `30` | Days before the due date from which a review counts as due soon, on `/reviews/` and in `inkan reviews` (the MCP tool `due_reviews` uses 30 unless asked for another window). |
| `notify.statuses` | `string[]` | `['accepted']` | Statuses that `inkan notify` announces. Each must be a key of `statuses`. |
| `notify.channels` | `NotifyChannel[]` | `[]` | Slack, Teams or webhook channels, added to the ones named by `INKAN_SLACK_WEBHOOK`, `INKAN_TEAMS_WEBHOOK` and `INKAN_WEBHOOK`. |
| `notify.channels[].type` | `'slack' \| 'teams' \| 'webhook'` | required | Message format. |
| `notify.channels[].url` | `string` | not set | Webhook URL. Read it from `process.env`; a channel without one is skipped. |
| `notify.channels[].name` | `string` | the type | Label in the command output. |
| `notify.channels[].projects` / `types` / `statuses` | `string[]` | all | Filters per channel. `statuses` replaces `notify.statuses` for that channel. |
| `notify.channels[].headers` / `body` | `Record<string, string>` / `function` | not set | `webhook` only: extra headers, and a function that builds the JSON body from `{ site, events }`. |

```ts title="inkan.config.ts"
export default defineConfig({
  git: { dates: true, authors: false },
  codeRefs: { include: ['src/**', 'infra/**'], marker: '@decision' },
  export: { statuses: ['accepted', 'implemented', 'deprecated'], title: 'Acme architecture decisions' },
  reviews: { every: '1 year', soon: 45 },
  notify: { channels: [{ type: 'slack', url: process.env.SLACK_WEBHOOK, projects: ['platform'] }] },
});
```

See [Fill date and authors from git](authoring/adr/0009-fill-date-and-authors-from-git.md), [Show status history from git](site/adr/0013-status-history-from-git.md), [Reference records from code](authoring/adr/0010-reference-records-from-code.md), [Print and export](site/adr/0008-print-and-export.md), [Notify chat when a decision is accepted](cli/adr/0008-notify-chat-when-a-decision-is-accepted.md) and [Review decisions on a schedule](authoring/adr/0011-review-decisions-on-a-schedule.md).

## Landing

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `landing.title` | `string \| null` | `null` (uses `title`) | Heading of the hero. |
| `landing.tagline` | `string \| null` | `null` (uses `tagline`) | Text under the heading. |
| `landing.eyebrow` | `string \| null` | `null` ("Decision archive" and the last commit date) | Small line above the heading. |
| `landing.image` | `{ src, dark?, alt } \| null` | `null` | Picture beside the hero text. `dark` is used in the Stage theme. Paths are relative to the config file. |
| `landing.command` | `string \| null` | `null` | Shell command under the buttons, with a copy button. |
| `landing.features` | `{ title, text, link? }[]` | `[]` | Cards of the `features` section. |
| `landing.actions` | `{ text, link, variant? }[]` | Browse all records, Timeline, Open decisions | Buttons in the hero. `variant` is `'primary'`, `'secondary'` or `'ghost'`. |
| `landing.sections` | `string[]` | `['stats', 'projects', 'latest', 'content', 'agents']` | Blocks below the hero, in this order. Remove one to hide it. |

Section names: `stats` adds the record counts to the hero and the lede, `features` shows the `landing.features` cards, `projects` lists the project cards, `latest` the newest records, `content` renders `<contentDir>/_landing.md`, `agents` lists the machine-readable endpoints. Any other name renders nothing.

```ts title="inkan.config.ts"
export default defineConfig({
  landing: {
    actions: [
      { text: 'Quick start', link: '/quick-start/', variant: 'primary' },
      { text: 'All records', link: '/decisions/', variant: 'secondary' },
    ],
    sections: ['stats', 'content', 'projects', 'latest'],
  },
});
```

See [Landing page from config](site/adr/0001-landing-page-from-config.md).

## Access

Sign-in for the projects and paths that only some people may read. Without `authentication` nothing here has an effect and the build is one static `dist/`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `authentication` | `{ type, clientId, ... } \| null` | `null` | Identity provider: `type` is `'openid'`, `'auth0'`, `'entra'`, `'gitlab'` or `'github'`; `clientId`; `issuer` (`openid`), `domain` (`auth0`), `tenantId` (`entra`) or `url` (self-managed `gitlab`, GitHub Enterprise); optional `scopes`, `allow: { emails, domains, groups }` (email and domain rules count only for addresses the provider confirmed as verified), `trustEmail` (count them anyway for a provider that never says, default `false`), `groupsClaim`, `maxAge` (seconds, default 28800), `redirectToAfterSignIn`, `redirectToAfterSignOut`. Secrets come from environment variables, never from the config. |
| `protectedRoutes` | `string[]` | `[]` | Paths only signed-in users see, relative to `base`. `*` matches anything and `/handbook/*` includes `/handbook/`. Whole projects are protected with `protected: true` in their `_project.yml`. |

```ts title="inkan.config.ts"
export default defineConfig({
  url: 'https://decisions.acme.dev',
  authentication: { type: 'gitlab', clientId: 'a1b2c3', allow: { groups: ['acme/platform'] } },
  protectedRoutes: ['/handbook/*'],
});
```

The build then writes the public site to `dist/` and the full one to `dist-protected/`, and `inkan serve` enforces sign-in. See [Sign-in and protected projects](deploy/adr/0007-sign-in-and-protected-projects.md).

## Resolved config

Plugins and `.astro` pages see the resolved config, not your file: defaults applied, every path absolute, plus `root`, `configFile`, `repoRoot` (the Git top level, or `root` outside Git), `contentPath` (content folder relative to `repoRoot`, used in edit links), `messages` (the interface text resolved for `locale`, set after the plugin hooks ran) and `templates` (type to template text). `sources` is resolved too: each entry becomes a `ResolvedSource` with the clone or folder as `root`, the absolute `contentDir`, the derived `web` URL and `provider`. Its type is `ResolvedConfig` in `lib/index.d.ts`. See [Data API and layouts](extending/adr/0005-data-api-and-layouts.md).
