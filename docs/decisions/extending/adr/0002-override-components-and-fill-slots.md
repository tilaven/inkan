---
title: "Override components and fill slots"
description: "Replace a built-in component such as the header or the record card with your own .astro file, or fill one of the empty slots without touching the rest."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [components, theming, extending]
options: [components]
related: [extending/adr/0005-data-api-and-layouts, theming/adr/0003-theme-with-inkan-css-tokens]
---

## Context

CSS tokens change how the site looks, but not what it shows. Teams want a notice under the sidebar, an extra
button in the top bar, an analytics snippet in `<head>`, or a different record header, without forking the
app that ships inside the package. Astro has no runtime component registry, so the override has to be
resolved at build time.

## Decision

The app imports every replaceable component from a virtual module, `virtual:inkan/components/<Name>`.
The `components` option in the config maps a name to a path of your own `.astro` file; that file is what the
virtual module resolves to. Without an override, the built-in `app/src/components/<Name>.astro` is used, and
for the six slot names, which have no built-in file, an empty component renders nothing.

## How to use it

```ts title="inkan.config.ts"
export default defineConfig({
  components: {
    SidebarBottom: './components/SidebarBottom.astro',
    Footer: './components/Footer.astro',
  },
});
```

Paths are relative to the config file. Edits to the file hot-reload in the dev server; adding or removing an
entry in `components` restarts it. A name outside the list below is rejected as an unknown option.

### Replaceable components

These have a built-in implementation that your file replaces completely. Props are what the app passes; your
component may ignore them.

| Name | Where it renders | Props |
| --- | --- | --- |
| `Header` | Top bar: menu button, brand, breadcrumbs, top navigation, search, theme toggle, repo link | `crumbs?: Crumb[]`, `sidebar?: boolean` |
| `Footer` | Bottom of every page, reads `footer` from the config | none |
| `Banner` | Strip above the header, reads `banner` from the config | none |
| `Sidebar` | Archive navigation: brand, hub links, projects and their records | none |
| `RecordHeader` | Head of a record: number, status sticker, title, metadata, lineage | `d: Decision`, `project: { id: string; name: string }` |
| `RecordFooter` | Actions under a record: edit link, copy link, raw Markdown | `d: Decision` |
| `PageActions` | The "Copy page" menu in the record header: copy the Markdown or the link, open the Markdown, hand the page to Claude or ChatGPT. Point it at an empty component to hide it | `d: { id: string }` |
| `RecordCard` | The cover card on the landing page, the index, the timeline, team pages and the record rail | `decision: Decision`, `project: ProjectStyle`, `width?`, `lod?`, `flippable?`, `people?`, `class?` |
| `LandingHero` | Hero of the home page | `title`, `eyebrow`, `lede`, `actions`, `stats?` |

The `Decision` and `ProjectStyle` types come from `@tilaven/inkan/data`, see
[Data API and layouts](0005-data-api-and-layouts.md).

### Slots

Slots render nothing until you point them at a file. They receive no props except where noted.

| Name | Where it renders | Props |
| --- | --- | --- |
| `HeadEnd` | Last thing inside `<head>`, after the tags from `head` in the config | none |
| `HeaderEnd` | End of the top bar's tool group, after the repo link | none |
| `SidebarTop` | Under the brand, above the navigation | none |
| `SidebarBottom` | After the project tree, at the bottom of the sidebar | none |
| `RecordTop` | Above the record header, inside the searchable body | `d: Decision` |
| `RecordBottom` | Under the record body, above the footer actions | `d: Decision` |

### Example: a note at the bottom of the sidebar

From `examples/company-decisions/components/SidebarBottom.astro`:

```astro title="components/SidebarBottom.astro"
---
/** Replaces the empty SidebarBottom slot: a link to the company handbook under the navigation. */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
---
<p class="sidebar-note">Not sure where a decision belongs? Read the <a href={`${base}/handbook/`}>handbook</a>.</p>

<style>
  .sidebar-note { margin: 1rem 0 0; padding-top: 1rem; border-top: 1px solid var(--inkan-border); font-size: var(--inkan-text-xs); color: var(--inkan-fg-muted); }
</style>
```

Two habits worth keeping: build links with `import.meta.env.BASE_URL` or the `url()` helper so they survive a
sub-path deployment, and style with `--inkan-*` tokens so the component follows the Day and Stage themes.

### Example: analytics in the head

For Plausible, Umami or Google Analytics there is a ready-made plugin, see [Analytics with Plausible, Umami or Google Analytics](0006-analytics-plugin.md). The slot is the way to go for any other tool:

```astro title="components/HeadEnd.astro"
<script is:inline defer data-domain="decisions.acme.dev" src="https://plausible.io/js/script.js"></script>
```

> [!TIP]
> A single tag is also possible without a component: `head: [{ tag: 'script', attrs: { defer: true, src: '...' } }]`
> in the config. Use the slot when you need markup or logic.

### Replacing a built-in component

Start from a copy of the original in `node_modules/@tilaven/inkan/app/src/components/<Name>.astro`. Internal
imports such as `../lib/config` will not resolve from your repository; use `@tilaven/inkan/data` for the same
values (`site`, `url`, `editUrl`, `markdownUrl`, and so on).

## Consequences

- Any of the fifteen names can be swapped with one line of config. Nothing else in the app changes.
- A replaced component is yours to maintain. When an Inkan release changes the props of `RecordCard` or `RecordHeader`, your file has to follow.
- Slots have fixed positions. A new position means a new slot name in Inkan, not a config change.
- Components resolve at build time, so one site cannot pick a different header per page through this mechanism. A custom page can import any component directly instead.
- Overrides see only what `@tilaven/inkan/data` exports plus the props they receive; app internals stay private.
