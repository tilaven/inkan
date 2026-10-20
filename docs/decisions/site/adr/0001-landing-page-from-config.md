---
title: "Landing page from config"
description: "How the home page is assembled from the landing option in inkan.config.ts and an optional _landing.md."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, config, content]
options: [landing]
related: [site/adr/0002-filterable-record-index, authoring/adr/0001-one-folder-per-project, ai/adr/0001-llms-txt-and-llms-full-txt]
---

## Context

A decision archive needs a front door that works on day one: a title, a sentence that says what the site is, a few buttons and the numbers that tell a visitor whether the archive is alive. Most teams do not want to write a custom page for that, but every team wants to rename a button, drop a section or add a paragraph of their own. The landing page therefore has to come out of the box and still be shaped from the one config file.

## Decision

Inkan renders the home page from the `landing` option in `inkan.config.ts`. The hero shows the title, the tagline and up to three kinds of buttons. Below it, `landing.sections` lists which blocks appear and in which order. Free Markdown for the page lives in `<contentDir>/_landing.md` and is rendered by the `content` section.

Everything on the page is derived from the records in the repository. There are no hand-maintained numbers.

## How to use it

### The hero

The hero reads `landing.title` and `landing.tagline`; when they are not set it falls back to `title` and `tagline` of the site. The eyebrow line shows the date of the last commit in the repository (`built from git, 16 Oct 2026`); outside git it shows the build time. The lede starts with the record and team counts (`42 records from 5 teams.`) followed by the tagline.

```ts title="inkan.config.ts"
import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  title: 'Acme Decisions',
  tagline: 'Architecture decisions from every team.',
  landing: {
    title: 'Why did we do it like that?',
    tagline: 'Every architecture decision at Acme, with its reasons.',
    actions: [
      { text: 'Browse all records', link: '/decisions/', variant: 'primary' },
      { text: 'Timeline', link: '/timeline/', variant: 'ghost' },
      { text: 'Handbook', link: 'https://handbook.acme.dev', variant: 'secondary' },
    ],
    sections: ['stats', 'projects', 'latest', 'content', 'agents'],
  },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `landing.title` | `null` (uses `title`) | Display title in the hero. The last word gets the accent underline. |
| `landing.tagline` | `null` (uses `tagline`) | Sentence after the record and team counts in the lede. |
| `landing.actions` | Browse all records (primary), Timeline (ghost), Open decisions (ghost) | Buttons under the lede. An empty list removes them. |
| `landing.sections` | `['stats', 'projects', 'latest', 'content', 'agents']` | Blocks below the hero, in this order. Remove a name to hide the block. |

Each action has `text`, `link` and an optional `variant`: `primary`, `secondary` or `ghost`. A `link` that starts with `/` gets the site's base path prefixed, so the same config works under a sub-path. A link with a scheme (`https://...`) is left alone. An action without a `variant` renders as `secondary`.

### The sections

| Name | What it renders |
| --- | --- |
| `stats` | Four numbers inside the hero: Decisions, Teams, In force (records whose status has `current: true`) and Review overdue. The overdue count is the number of decided records whose next periodic review is past, the same records `/reviews/` lists as overdue, and links to that page. It is recomputed in the browser from the due dates, so a static build does not go stale. |
| `projects` | One card per project folder, with its cover, description, record count, how many are in force, and the owners' avatars. A ghost card at the end says how to add a team. |
| `latest` | The four newest records as photocards. Hidden when there are no records. |
| `content` | The Markdown of `_landing.md`, see below. Hidden when the file does not exist. |
| `agents` | The machine-readable endpoints the build writes: `/llms.txt`, `/llms-full.txt`, `/decisions.json`, `/graph.json`, `/AGENTS.md` (only when an `AGENTS.md` exists in the content folder or next to the config) and `/rss.xml`. |

Unknown names are ignored. The order of the list is the order on the page.

### Extra Markdown with `_landing.md`

Put a file named `_landing.md` (or `_landing.mdx`) at the top of your content folder. Files starting with `_` are never records, so it does not show up in the sidebar or the index. Its body is rendered under a "Content" heading wherever `content` sits in `sections`.

```text
decisions/
  _landing.md        ← rendered by the "content" section
  _authors.yml
  sre/
    _project.yml
    adr/0001-define-slos.md
```

The file needs no front matter. It supports the same Markdown as records: callouts, code blocks, Mermaid, tables and MDX components when you use the `.mdx` extension.

> [!TIP]
> Want a text-first home page? Set `sections: ['content', 'latest']` and write the page in `_landing.md`. The hero stays; only the blocks below it change.

### Replacing the hero

The hero is the `LandingHero` component. If the config options are not enough, point `components.LandingHero` at your own `.astro` file; it receives `title`, `eyebrow`, `lede`, `actions` and `stats` as props. The rest of the page is not overridable; use a custom page in `pagesDir` for a completely different home page.

## Consequences

- One config file shapes the page; there is nothing to copy into the repository to get started.
- The hero copy and the buttons are configurable, but the section headings ("Teams", "Latest", "Content", "For agents") are fixed in this release.
- Section names are plain strings and not validated, so a typo silently hides a block.
- The `_landing.md` section sits in a fixed slot. For a page that is mostly prose, a custom page is the better tool.
- Counts and dates come from the content and from git, so a build outside a git checkout shows the build time instead of the last commit date.
