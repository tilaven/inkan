---
title: "Brand with logo and favicon"
description: "How to put your own logo in the header and sidebar and your own favicon in the tab with the logo and favicon options."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [theming, config]
options: [logo, favicon]
related: [theming/adr/0003-theme-with-inkan-css-tokens, theming/adr/0001-overprint-design, site/adr/0006-header-banner-footer-and-redirects]
---

## Context

The first thing a company changes on an internal site is the logo, and the first thing a reader looks for among twenty tabs is the favicon. Both are files that live in the content repository, not in the package, and both have to survive a sub-path deployment and the asset hashing of the build.

## Decision

Inkan takes a `logo` and a `favicon` path in the config, relative to the config file. The logo replaces the built-in mark next to the site title in the header and in the sidebar; the favicon replaces the built-in one in the tab. Both are processed by the build like any other asset. When they are not set, the package's own mark (two overprinted cards and a ribbon, in the process inks) is used for both.

## How to use it

### Point at your files

```ts title="inkan.config.ts"
export default defineConfig({
  title: 'Acme Decisions',
  logo: './brand/logo.svg',
  favicon: './brand/favicon.png',
});
```

```text
inkan.config.ts
brand/
  logo.svg
  favicon.png
  theme.css
decisions/
```

| Option | Default | What it does |
| --- | --- | --- |
| `logo` | `null` (built-in mark) | Image shown at 26 px in the header and 32 px in the sidebar, next to `title`. Path relative to the config file. |
| `favicon` | `null` (built-in mark) | Icon for the browser tab. Path relative to the config file. |

The paths are resolved to absolute paths when the config loads and imported by the site as URLs, so the files end up hashed in `dist/_astro/` and the page references them with the base path included. A missing file fails the build with the path in the message.

### Formats

Any image the browser can display works for the logo; SVG keeps it crisp at both sizes. For the favicon the `type` attribute of the `<link rel="icon">` is derived from the extension:

| Extension | `type` |
| --- | --- |
| `.svg` | `image/svg+xml` |
| `.png` | `image/png` |
| `.ico` | `image/x-icon` |
| `.jpg`, `.jpeg` | `image/jpeg` |

A square image, at least 32 × 32 for PNG, is enough; SVG favicons are supported by current browsers and scale on their own.

### Size and colour

The logo is rendered at a fixed height (26 px in the header, 32 px in the sidebar) with `alt=""`, because the site title is printed next to it; the image is decorative for screen readers. Make the artwork fill its box, or it will look small next to the title.

Since both Day and Stage themes exist, pick a logo that reads on light and dark backgrounds, or embed a `prefers-color-scheme` media query in the SVG the way the default mark does:

```xml title="brand/logo.svg"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <style>
    .k { fill: #0A0D17; }
    @media (prefers-color-scheme: dark) { .k { fill: #F1F4FA; } }
  </style>
  <rect class="k" x="4" y="4" width="32" height="32" rx="4" />
</svg>
```

> [!NOTE]
> A media query inside an `<img>` SVG follows the operating system, not the site's toggle. A logo that works on both themes without switching is the safer choice.

### Changing the title next to the logo

The text next to the logo is the `title` option. To show only the logo, or a wordmark with no text, override the `Header` and `Sidebar` components; see [Override components and fill slots](../../extending/adr/0002-override-components-and-fill-slots.md). The header also shows a pill with the repository provider when `repo.url` is set.

### Open Graph image

There is no option for a social preview image in this release; pages set `og:title`, `og:description` and `og:url` but no `og:image`. Use the `head` option to add one site-wide tag if you need it:

```ts title="inkan.config.ts"
export default defineConfig({
  head: [{ tag: 'meta', attrs: { property: 'og:image', content: 'https://decisions.acme.dev/brand/og.png' } }],
});
```

## Consequences

- Two files and two lines of config brand the site; nothing else changes.
- The logo cannot be sized or positioned from the config; the component override is the escape hatch.
- One favicon for all sizes and themes. There is no generated set of icons for home screens or Windows tiles.
- The default mark uses the process inks, so it matches a retinted site only as long as the inks stay close to the defaults.
- Files referenced from the config must be inside the repository, because the build resolves them relative to the config file.
