---
title: "Full-text search with pluggable providers"
description: "One search palette with a choice of index behind it: the built-in Pagefind index, Algolia, Meilisearch, Typesense or your own provider module, plus the search.json the build writes for external services."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, search, deploy, plugins]
options: [search]
related: [deploy/adr/0001-static-html-output, site/adr/0002-filterable-record-index, cli/adr/0004-validate-config-and-content-at-build-time, extending/adr/0001-plugins-with-defineplugin]
---

## Context

A decision archive is useful in proportion to how fast it answers "did we ever decide anything about X". The filter page covers titles, tags and descriptions, but the reason behind a decision is in the body. Search over the bodies must work on a static host with no server and no account, because that is how most archives start. Larger organisations already run a search service and want the archive in it, with the same ranking, synonyms and analytics as the rest of their docs. Both cases need the same palette; only the index behind it differs.

## Decision

Inkan has one search entry point: a button in the header and the `⌘K` / `Ctrl K` shortcut open a palette. The palette asks a *provider* for results. The default provider is [Pagefind](https://pagefind.app): `inkan build` indexes the finished HTML and writes the index to `dist/pagefind/`, so search runs from static files. Alternatively the `search` option names Algolia, Meilisearch, Typesense or a custom module; the build then writes `dist/search.json`, a flat list of records you push into that service, and the palette queries the service from the browser. `search: false` removes search altogether.

## How to use it

### The palette

| Where | How |
| --- | --- |
| Header | The "Search records…" button, shown as an icon only on screens up to 720px wide. |
| Keyboard | `Ctrl K`, or `⌘K` on Apple devices, anywhere on the page. The button shows the shortcut for your platform. |

Inside the palette `↑` and `↓` move through the results, `Enter` opens the selected one and `Esc` or a click outside closes it. With an empty query the palette lists the seven newest records under "Recent decisions". A query is sent 120 ms after the last keystroke; a newer query aborts the one in flight. Each result shows the status sticker, the title, the project and type, an excerpt with the matches marked and the record reference (`SRE-ADR-0007`). The footer says how many results there are in all, for example `8 of 23 results`.

The palette shows at most `maxResults` hits (default 8, between 1 and 50). Hits whose `url` is not an `http(s)` page are dropped.

### Choosing a provider

```ts title="inkan.config.ts"
export default defineConfig({
  search: { type: 'pagefind', maxResults: 8 },
});
```

Every provider accepts these two options:

| Option | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | `false` removes the button, the shortcut and the index step. `search: false` is the short form. |
| `maxResults` | `8` | Most hits the palette shows, 1 to 50. |

Without `type` the provider is `pagefind`. The schema is strict: a key that does not belong to the chosen provider fails the build, for example `search.apiKey: unknown option` with `type: 'pagefind'`, and `search.type: type must be one of pagefind, algolia, meilisearch, typesense, custom` for anything else. A plugin may set `search` in its `config` hook; the result is validated again after the hooks ran, so a plugin that forgets `host` fails with `search.host` in the message.

#### Pagefind (default)

```ts title="inkan.config.ts"
export default defineConfig({
  search: {
    type: 'pagefind',
    ranking: { termFrequency: 1.0, pageLength: 0.75, termSimilarity: 1.0, termSaturation: 1.4 },
  },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `ranking` | not set | Pagefind's ranking weights. All four keys are optional numbers; unknown keys are rejected. |

The index is produced by the build, not by the dev server. In `inkan dev` the palette opens, but a query shows "Search works after `inkan build`; run `inkan preview` to try it." The build log ends with `Search index: N pages`. Deploy the whole `dist/` folder; the page loads `pagefind.js` from `<base>/pagefind/`, so a sub-path deployment needs no extra step.

Every record body and every Markdown page is indexed. Navigation, the record header, the right rail, the footer and the pager are excluded. Each record also carries Pagefind metadata and filters: `title`, `ref`, `project` (the project name), `type` and `status` (their labels) and one `tag` entry per tag. A custom page can call the Pagefind JS API at `<base>/pagefind/pagefind.js` with filters such as `{ project: 'SRE' }`.

#### Algolia, Meilisearch, Typesense

| `type` | Required | Optional |
| --- | --- | --- |
| `algolia` | `appId`, `apiKey`, `indexName` | `params`: any key of the Algolia search request, e.g. `{ filters: 'status:accepted' }` |
| `meilisearch` | `host` (a URL), `indexUid` | `apiKey`, `params`: any key of the Meilisearch search request |
| `typesense` | `host` (a URL), `apiKey`, `collection` | `queryBy` (default `'title,description,content,tags'`), `params`: query parameters as strings, numbers or booleans |

```ts title="inkan.config.ts"
export default defineConfig({
  search: { type: 'meilisearch', host: 'https://search.acme.dev', apiKey: process.env.MEILI_SEARCH_KEY, indexUid: 'decisions' },
});
```

> [!WARNING]
> `apiKey` is written into the page and sent from the browser. Use a search-only key, never an admin key.

The palette asks the service for `maxResults` hits with `<mark>` highlighting on `content` and `description`; `params` is merged into that request last, so it can override anything. A hit is read as a record (see below): `url` (or `href`), `title`, `description`, `content` and the `project`, `type`, `status` and `ref` fields, so an index with another shape works as long as those names match. When the service cannot be reached or answers with an error, the palette says so and names the options to check.

External providers work in `inkan dev` too, because the browser talks to the service directly.

#### search.json

With any provider other than `pagefind`, the build writes `dist/search.json` instead of the Pagefind index (in `dev` it is served at `/search.json`). The file is a JSON array with one record per built record and per Markdown page:

| Field | Value |
| --- | --- |
| `id`, `objectID` | The record id with `/` replaced by `__`, e.g. `sre__adr__0001-define-slos`; pages are `page__<id>`. Both fields hold the same value, so Algolia, Meilisearch and Typesense find a primary key. |
| `url` | Link to the page, including `base`. |
| `title`, `description` | From the front matter; `description` is `null` when missing. |
| `content` | The body as plain text: front matter, Mermaid diagrams, HTML tags, comments, link targets and Markdown markup (headings, emphasis, list markers, table rules) are removed. Code inside fences stays as text. |
| `project` | The project id (the folder name), or `null` for pages. |
| `type`, `status`, `ref` | Type id, status id and reference, or `null`. |
| `tags`, `authors` | Arrays, empty for pages. |
| `date` | `YYYY-MM-DD` or `null`. |

Push it to the service after every build, for example in the CI job that deploys `dist/`:

```bash
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

Drafts are not built, so they are not in the file. `/search.json` is a reserved route, like `/pagefind/`.

#### A custom provider

```ts title="inkan.config.ts"
export default defineConfig({
  search: { type: 'custom', module: './search.ts', options: { endpoint: 'https://search.acme.example' } },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `module` | required | A browser module, relative to the config file (a `file:` URL is accepted too). Its default export is a `SearchProviderFactory`. |
| `options` | `{}` | Passed to the factory as is. |

The module runs in the browser. It gets `options` and returns an object with a `search` method and an optional `preload`, which the palette calls when it opens so the first query is fast. The types come from `@tilaven/inkan/search`, together with `SearchUnavailableError`: throw it to show your own message in the palette (text in backticks renders as code) instead of the generic "Search failed. Try again."

```ts title="search.ts"
import { SearchUnavailableError, type SearchProviderFactory } from '@tilaven/inkan/search';

const acme: SearchProviderFactory<{ endpoint: string }> = ({ endpoint }) => ({
  async search(query, { limit, signal, base }) {
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`, { signal });
    if (!res.ok) throw new SearchUnavailableError(`Search answered ${res.status}. Check \`endpoint\`.`);
    const { hits, total } = await res.json();
    return { hits, total }; // hits: SearchHit[], total: matches in the index
  },
});

export default acme;
```

| Type | Shape |
| --- | --- |
| `SearchProviderFactory<Options>` | `(options: Options) => SearchProvider` |
| `SearchProvider` | `{ search(query, ctx: SearchContext): Promise<SearchResults>; preload?(ctx: { base }): void \| Promise<void> }` |
| `SearchContext` | `{ limit: number; signal: AbortSignal; base: string }`. `limit` is `maxResults`, `signal` aborts when a newer query replaces this one, `base` is the site's base path ending in `/`. |
| `SearchResults` | `{ hits: SearchHit[]; total: number }`. `total` may be larger than `hits.length`; the footer shows both. |
| `SearchHit` | `{ url: string; title: string; excerpt?: string; marked?: boolean; project?: string; type?: string; status?: string; ref?: string }`. `url` includes `base`. Set `marked: true` when `excerpt` is HTML whose only markup is `<mark>`; otherwise it is plain text and the palette marks the query terms itself. `project` is the project id, used to show the project's name and colour. |

The same types are also exported from the root module `@tilaven/inkan` (`SearchConfig`, `SearchRecord`, `SearchHit`, `SearchProvider`, `SearchProviderFactory`, `SearchContext`, `SearchResults`). To ship a provider as a package, let a plugin set `search` in its `config` hook; give `module` an absolute path or a `file:` URL (`new URL('./search.ts', import.meta.url).href`), because a relative path is resolved against the site's config file, not the plugin.

### Drafts and hidden pages

Pages with `draft: true` are not built in production, so they are in neither index. Files and folders starting with `_` are never pages and never indexed.

## Consequences

- The default needs no service, no key and no tracking; the Pagefind index is only available after a build, so reviewing it locally means `build` then `preview`.
- Pagefind indexes the rendered HTML, so anything hidden from the DOM is not found; `search.json` is built from the Markdown source, so an external index sees the text before rendering, without MDX components or diagrams.
- An external provider puts a search key in the page and makes every query a request to a third party; the archive's text lives in that service as well.
- Keeping an external index current is your CI's job; the build only writes `search.json`.
- Custom providers are a browser contract, not a build-time one: the module cannot read the content folder, it can only call something that already holds the records.
- The free-text field on the record index page stays metadata-only, see [Filterable record index](0002-filterable-record-index.md).
