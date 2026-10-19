---
title: "RSS feed and sitemap"
description: "The /rss.xml feed of new records and the generated sitemap, and why the url option must be set for both."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, deploy, ai]
related: [ai/adr/0001-llms-txt-and-llms-full-txt, ai/adr/0002-decisions-json, deploy/adr/0001-static-html-output]
---

## Context

People who should know about a decision rarely visit the archive; they live in feed readers, chat rooms and crawlers. An archive that can only be browsed is read by its authors. The site needs a standard way to push "a new record exists" and a standard way for crawlers and tools to discover every page, without a server to compute either.

## Decision

Every build writes an RSS 2.0 feed at `/rss.xml` with the newest records and a sitemap at `/sitemap-index.xml`. Both are linked from the `<head>` of every page so readers and crawlers discover them. Both need absolute URLs, which come from the `url` option.

## How to use it

### Set the public URL

```ts title="inkan.config.ts"
export default defineConfig({
  url: 'https://decisions.acme.dev',
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `url` | `'http://localhost:4321'` | Public origin of the site. Used for the feed, the sitemap, canonical and Open Graph URLs, and the absolute links in `llms.txt`. |
| `base` | `'/'` | Sub-path when the site is not at the root; `BASE_PATH` in the environment overrides it. Feed and sitemap links include it. |

> [!WARNING]
> Leave `url` at its default and the feed and sitemap point at `http://localhost:4321`. Set it before the first deploy.

### The feed

`/rss.xml` holds the 50 newest records, in the same order as the index (by `date`, newest first). Each item:

| Field | Value |
| --- | --- |
| title | `[SRE-ADR-0007] Define SLOs per user journey`: the reference in brackets, then the title. Records without a number use the type label. |
| link | The record's page. |
| pubDate | The record's `date`. |
| description | The status label and the `description`, joined with a dash. |
| category | The project id, the type id and every tag. |
| author | The `authors` handles, comma-separated. |

The feed's title is `<title> – new records` and its description is the site `description`. Only records (files inside a type folder such as `adr/` or `rfc/`) are in the feed; guides and team intros are not.

Subscribe with any reader, or wire it to a chat room: most chat tools have an RSS integration that posts each new item to a channel. Because the items are sorted by `date`, a record whose date is changed to today appears as new.

### The sitemap

The sitemap is produced by Astro's sitemap integration for every built page: records, pages, team pages, the index, timeline, backlog, authors and tags. It is written as `sitemap-index.xml` plus `sitemap-0.xml` (more parts for very large sites). Pages with `draft: true` are not built, so they are not listed. Point search engines at `https://decisions.acme.dev/sitemap-index.xml`, or let them find it through the `<link rel="sitemap">` in the page head.

### What is in `<head>`

Every page carries:

```html
<link rel="canonical" href="https://decisions.acme.dev/sre/adr/0007-define-slos/" />
<link rel="alternate" type="application/rss+xml" title="Acme Decisions – new records" href="/rss.xml" />
<link rel="sitemap" href="/sitemap-index.xml" />
<meta property="og:title" content="0007 Define SLOs per user journey · Acme Decisions" />
<meta property="og:url" content="https://decisions.acme.dev/sre/adr/0007-define-slos/" />
```

The paths include the base path when one is set. Extra head tags, for example a verification tag for a search console, go in the `head` option:

```ts title="inkan.config.ts"
export default defineConfig({
  head: [{ tag: 'meta', attrs: { name: 'google-site-verification', content: 'abc123' } }],
});
```

### Alongside the machine-readable files

The feed is listed in the "For agents" section of the landing page together with `llms.txt`, `llms-full.txt` and `decisions.json`. Use the feed for "what changed", `decisions.json` for "what is the full state"; see [decisions.json](../../ai/adr/0002-decisions-json.md).

## Consequences

- No server is involved: both files are rebuilt with the site, so they are exactly as fresh as the last deploy.
- The feed is driven by `date`, not by git history. A record with no `date` sorts last and never surfaces as new.
- The feed is capped at 50 items and has no per-project variant; filter in the reader by category (`sre`, `rfc`, a tag) when you need a slice.
- A wrong `url` silently produces a feed and sitemap full of unreachable links. Check `dist/rss.xml` once after the first build.
- There is no Atom or JSON Feed output.
