---
title: "Open Graph cards"
description: "The 1200×630 PNG card every record, project and the site get at /og/, how it is drawn at build time, and the og option that sets its theme or turns it off."
status: implemented
date: 2026-10-17
tags: [site, theming, deploy]
related: [site/adr/0007-rss-feed-and-sitemap, theming/adr/0002-day-and-stage-themes, site/adr/0009-readme-badges]
---

## Context

Decisions are shared as links, in Slack, Teams, Discord, LinkedIn and pull request comments. A bare link unfurls into a grey line of text, so the record that was worth sending looks like every other URL. Every record already has a generated cover, but a cover is an inline SVG that unfurlers do not render: they read `og:image` and want a raster image at an absolute URL. A hosted image service or a headless browser would add an account or a heavy dependency to what is otherwise a static build.

## Decision

Every build writes Open Graph cards as 1200×630 PNG files under `/og/` and points the page `<head>` at them.

- A record gets `/og/<record id>.png`, for example `/og/sre/adr/0001-define-slos.png`.
- A team page gets `/og/<project>.png`.
- Every other page uses the site card, `/og/index.png`.

[satori](https://github.com/vercel/satori) lays the card out and [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) rasterises it, so no browser is needed. Text becomes paths, which means the cards do not depend on fonts installed on the build machine. The cards are controlled by the `og` option; `og: false` turns them off.

## How to use it

### Set the public URL

`og:image` must be an absolute URL, and unfurlers cannot reach `localhost`. Set `url` to the address the site is served from:

```ts title="inkan.config.ts"
export default defineConfig({
  url: 'https://decisions.acme.dev',
});
```

With `base` set, the cards sit under the sub-path: `https://acme.dev/docs/og/index.png`. No further setup is needed; cards are on by default.

### The cards

| Card | File | Shows |
| --- | --- | --- |
| Record | `/og/<record id>.png` | Project and type eyebrow, the big record number, the title, the status sticker, the status label and date, the site title, and the record's generated cover on the right |
| Team | `/og/<project>.png` | Project name, description, record counts per type, the project's cover |
| Site | `/og/index.png` | Site title, tagline, counts, and the covers of the three busiest projects fanned out |

The cover is the one the record shows on the site, with the project's motif and ink. The status sticker uses the same colours as the record page.

### Tags on the page

Every page gets these tags in `<head>`, with `og:image` resolved against `url` and `base`:

| Tag | Value |
| --- | --- |
| `og:image` | Absolute URL of the card |
| `og:image:type`, `og:image:width`, `og:image:height` | `image/png`, `1200`, `630` |
| `og:image:alt` | The full page title |
| `twitter:card` | `summary_large_image` |
| `twitter:image`, `twitter:title`, `twitter:description` | Same image, the page title and its description |

`og:title`, `og:description` and the rest of the existing tags are unchanged.

### Choose the theme

```ts title="inkan.config.ts"
export default defineConfig({
  og: { theme: 'dark' },
});
```

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `og.theme` | `'light' \| 'dark'` | `'light'` | `light` prints the cards on Day paper, `dark` on the Stage theme. See [Day and Stage themes](../../theming/adr/0002-day-and-stage-themes.md). |

`og: false` writes no `/og/` files and no `og:image` or `twitter:image` tags. The other Open Graph tags stay.

### Build cost and caching

Rendering a card takes about 0.3 to 0.4 seconds of CPU. Cards render in parallel on all cores before the endpoints are built, and each finished PNG is cached by a hash of its content in `node_modules/.inkan/og`. A build only redraws cards whose record, cover or settings changed; old files are never read again and go away with `node_modules`. In CI, restore that folder after `npm ci` (which empties `node_modules`) and key it on the lockfile, so a new renderer starts fresh:

```yaml title=".github/workflows/docs.yml"
- run: npm ci
- uses: actions/cache@v4
  with:
    path: node_modules/.inkan/og
    key: og-${{ hashFiles('package-lock.json') }}-${{ hashFiles('decisions/**') }}
    restore-keys: og-${{ hashFiles('package-lock.json') }}-
- run: npm run build
```

### Limits

- Cards are printed with the default Day (or Stage) ink values. `--inkan-ink-*` overrides from `customCss` do not reach them, because the cards are drawn at build time, not by a browser reading your CSS.
- The card fonts are static instances of the site fonts and cover Latin and Latin Extended. Text in other scripts, such as CJK, has no glyphs and is not drawn correctly. Use `og: false` for such a site.
- Unfurlers cache images. After a record is renamed, Slack and LinkedIn can show the old card until their cache expires or you re-scrape the link.

## Consequences

- Links to records unfurl with a picture in every chat tool and social network, with no image service and no browser in the build.
- The card is derived from the record, so it is never out of date after a deploy and needs no manual work.
- A cold build is slower by the card count times 0.3 to 0.4 seconds of CPU. A warm cache removes almost all of it.
- The design of the cards is fixed. Only the theme is configurable; a different layout needs your own page that emits `og:image` through the `head` option.
- Sites in scripts outside Latin turn cards off or accept missing glyphs.
