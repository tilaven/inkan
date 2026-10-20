---
title: "Landing page from config"
description: "How the home page is assembled from the landing option in inkan.config.ts and an optional _landing.md, from a decision archive to a product page."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, config, content]
options: [landing, landing.image, landing.command, landing.features]
related: [site/adr/0002-filterable-record-index, authoring/adr/0001-one-folder-per-project, ai/adr/0001-llms-txt-and-llms-full-txt]
---

## Context

A decision archive needs a front door that works on day one: a title, a sentence that says what the site is, a few buttons and the numbers that tell a visitor whether the archive is alive. Most teams do not want to write a custom page for that, but every team wants to rename a button, drop a section or add a paragraph of their own. The landing page therefore has to come out of the box and still be shaped from the one config file.

Not every Inkan site is an internal archive. A platform team documenting its own tool, or an open source project like Inkan itself, needs the home page to say what the thing is: a picture, a pitch, the command to try it and what it can do. Record counts mean little to a first-time visitor there.

## Decision

Inkan renders the home page from the `landing` option in `inkan.config.ts`. The hero shows the title, the tagline, up to three kinds of buttons and, when configured, a picture and a command to copy. Below it, `landing.sections` lists which blocks appear and in which order. Free Markdown for the page lives in `<contentDir>/_landing.md` and is rendered by the `content` section.

Everything on the page is derived from the records in the repository. There are no hand-maintained numbers.

The same options turn the page into a product page: drop `stats`, set an eyebrow, a picture and a command, and list feature cards. The home page of this site is built that way.

## How to use it

### The hero

The hero reads `landing.title` and `landing.tagline`; when they are not set it falls back to `title` and `tagline` of the site. The eyebrow line shows the date of the last commit in the repository (`built from git, 16 Oct 2026`); outside git it shows the build time. The lede starts with the record and team counts (`42 records from 5 teams.`) followed by the tagline; without `stats` in `sections` it is the tagline alone.

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
| `landing.eyebrow` | `null` ("Decision archive" and the date) | Small line above the title. |
| `landing.image` | `null` | `{ src, dark?, alt }`: a picture beside the text, below it on narrow screens. |
| `landing.command` | `null` | A shell command under the buttons with a copy button. |
| `landing.features` | `[]` | Cards for the `features` section: `{ title, text, link? }`. |

Each action has `text`, `link` and an optional `variant`: `primary`, `secondary` or `ghost`. A `link` that starts with `/` gets the site's base path prefixed, so the same config works under a sub-path. A link with a scheme (`https://...`) is left alone. An action without a `variant` renders as `secondary`.

### A product page

```ts title="inkan.config.ts"
export default defineConfig({
  title: 'Inkan',
  landing: {
    eyebrow: '印鑑 · ADR & RFC sites',
    tagline: 'Decisions deserve a home as good as your API docs.',
    image: { src: './assets/hero-light.webp', dark: './assets/hero-dark.webp', alt: 'A fan of five record cards.' },
    command: 'npm create @tilaven/inkan@latest my-decisions',
    actions: [{ text: 'Quick start', link: '/quick-start/', variant: 'primary' }],
    features: [
      { title: 'Plain Markdown', text: 'Records live in your repo, reviewed in pull requests like code.', link: '/authoring/' },
      { title: 'Built for agents', text: 'llms.txt, decisions.json and an MCP server.', link: '/ai/' },
    ],
    sections: ['features', 'content', 'projects', 'latest'],
  },
});
```

`image.src` and `image.dark` are paths relative to the config file and go through the build like the logo, so the files get hashed names and long cache headers. The Day theme shows `src`, the Stage theme `dark`; without `dark`, both themes show `src`, so pick a picture with a transparent background. `alt` is required: describe what the picture shows, or pass an empty string when it is only decoration. The same picture and the landing tagline go into the site's Open Graph card and the home page's `og:description`, so a link to the site unfurls with them in Slack, Teams, Messenger or Facebook; see [Open Graph cards](0011-open-graph-cards.md).

The command is shown as a shell line with a copy button. It wraps on narrow screens instead of scrolling.

Feature cards take the project inks in turn (cyan, magenta, yellow, green, violet, orange). A card with a `link` is a link as a whole; the link follows the same rules as action links. Text is plain, without Markdown.

### The sections

| Name | What it renders |
| --- | --- |
| `features` | The `landing.features` cards under a "Features" heading. Hidden when the list is empty. |
| `stats` | Four numbers inside the hero: Decisions, Teams, In force (records whose status has `current: true`) and Review overdue. The overdue count is the number of decided records whose next periodic review is past, the same records `/reviews/` lists as overdue, and links to that page. It is recomputed in the browser from the due dates, so a static build does not go stale. |
| `projects` | One card per project folder, with its cover, description, record count, how many are in force, and the owners' avatars. A ghost card at the end says how to add a team. |
| `latest` | The four newest records as photocards. Hidden when there are no records. |
| `content` | The Markdown of `_landing.md`, see below. Hidden when the file does not exist. |
| `agents` | The machine-readable endpoints the build writes: `/llms.txt`, `/llms-full.txt`, `/decisions.json`, `/graph.json`, `/AGENTS.md` (only when an `AGENTS.md` exists in the content folder or next to the config) and `/rss.xml`. |

Unknown names are ignored. The order of the list is the order on the page.

### Extra Markdown with `_landing.md`

Put a file named `_landing.md` (or `_landing.mdx`) at the top of your content folder. Files starting with `_` are never records, so it does not show up in the sidebar or the index. Its body is rendered under a "Content" heading wherever `content` sits in `sections`. Front matter `title` and `description` replace the heading and the hint next to it.

```text
decisions/
  _landing.md        ← rendered by the "content" section
  _authors.yml
  sre/
    _project.yml
    adr/0001-define-slos.md
```

The file needs no front matter, but a heading of your own reads better:

```md title="decisions/_landing.md"
---
title: Try it, right now
description: two commands, one minute
---
```

 It supports the same Markdown as records: callouts, code blocks, Mermaid, tables and MDX components when you use the `.mdx` extension.

> [!TIP]
> Want a text-first home page? Set `sections: ['content', 'latest']` and write the page in `_landing.md`. The hero stays; only the blocks below it change.

### Replacing the hero

The hero is the `LandingHero` component. If the config options are not enough, point `components.LandingHero` at your own `.astro` file; it receives `title`, `eyebrow`, `lede`, `actions`, `command`, `image` (with built URLs) and `stats` as props. The rest of the page is not overridable; use a custom page in `pagesDir` for a completely different home page.

## Consequences

- One config file shapes the page; there is nothing to copy into the repository to get started.
- The hero copy, picture, command and buttons are configurable. The section headings ("Features", "Teams", "Latest", "For agents") are fixed in this release; only the `content` heading comes from `_landing.md`.
- Feature cards are plain text with a link, not Markdown, so they stay short. Longer prose belongs in `_landing.md`.
- Section names are plain strings and not validated, so a typo silently hides a block.
- The `_landing.md` section sits in a fixed slot. For a page that is mostly prose, a custom page is the better tool.
- Counts and dates come from the content and from git, so a build outside a git checkout shows the build time instead of the last commit date.
