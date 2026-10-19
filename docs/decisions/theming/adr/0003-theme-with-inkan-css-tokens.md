---
title: "Theme with --inkan-* CSS tokens"
description: "The public theming API: every colour, font and shape is a --inkan-* custom property you override from your own CSS files listed in customCss."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [theming, config]
options: [customCss]
related: [theming/adr/0001-overprint-design, theming/adr/0002-day-and-stage-themes, theming/adr/0004-brand-with-logo-and-favicon, extending/adr/0002-override-components-and-fill-slots]
---

## Context

Every company wants the site in its own colours and most want to stop there. Forking the stylesheet or writing selectors against generated class names breaks on the next release. The theme needs a stable surface: a set of named values that the site promises to read everywhere, and a way to load a file that changes them.

## Decision

All colours, fonts, radii and motion values of the site are CSS custom properties prefixed `--inkan-`, declared on `:root` in `tokens.css`. They are the public theming API. The `customCss` option lists CSS files from your repository that are loaded after the built-in styles, so a plain `:root { --inkan-...: ... }` block retints the whole site, including cards, covers, code blocks and diagrams.

## How to use it

### Load your CSS

```ts title="inkan.config.ts"
export default defineConfig({
  customCss: ['./brand/theme.css'],
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `customCss` | `[]` | CSS files, relative to the config file, imported after the site's own CSS and in the given order. |

The files go through the build like any other asset: hashed, minified and bundled into the page CSS. Changing one in `dev` hot-reloads the page. Anything valid in CSS is allowed, but overriding tokens is the supported path; selectors against the site's class names may break between releases.

### The token groups

The full list is in `app/src/styles/tokens.css` inside the package. The groups and their most useful members:

| Group | Tokens | Notes |
| --- | --- | --- |
| Surfaces | `--inkan-bg`, `--inkan-bg-2`, `--inkan-surface`, `--inkan-surface-2`, `--inkan-fg`, `--inkan-fg-2`, `--inkan-fg-3`, `--inkan-rule`, `--inkan-rule-strong`, `--inkan-paper`, `--inkan-scrim` | Page, panels, three text strengths, hairlines, card stock. |
| Process inks | `--inkan-ink-c`, `--inkan-ink-m`, `--inkan-ink-y`, `--inkan-ink-g`, `--inkan-ink-v`, `--inkan-ink-o`, `--inkan-ink-k`, `--inkan-ink-m-text`, `--inkan-ink-g-text`, `--inkan-blend`, `--inkan-on-ink`, `--inkan-on-ink-v` | Project colours and how they mix (`multiply` in Day, `screen` in Stage). The `-text` variants are the magenta and green that pass AA as small text and glyphs in Day; `--inkan-on-ink` is the text printed on an ink, and violet gets its own because key text on it falls short of AA in Day. |
| Status hues | `--inkan-st-draft`, `--inkan-st-proposed`, `--inkan-st-in-review`, `--inkan-st-rejected`, `--inkan-st-withdrawn`, `--inkan-st-deprecated`, `--inkan-st-superseded` | Sticker fills. Accepted and implemented use foil. |
| Foil | `--inkan-foil-1` to `--inkan-foil-5`, `--inkan-foil-key`, `--inkan-foil-shadow` | The holographic spectrum and the outline that keeps it legible on light paper. |
| Code | `--inkan-code-key`, `--inkan-code-str`, `--inkan-code-num`, `--inkan-code-com`, `--inkan-code-bg` | Syntax colours for code blocks. |
| Focus and links | `--inkan-focus`, `--inkan-link` | Focus ring and link colour. |
| Geometry | `--inkan-card-ratio`, `--inkan-radius-ui`, `--inkan-radius-pill` | Photocard proportions (55/85), control radius (4px), pills. |
| Type | `--inkan-font-display`, `--inkan-font-text`, `--inkan-font-mono`, `--inkan-font-ko` | Font stacks. |
| Motion | `--inkan-beat`, `--inkan-ease-travel`, `--inkan-ease-pop`, `--inkan-ease-snap` | One beat is 500 ms; the easings are shared by every transition. |

The dark theme redefines the surfaces, inks, blend mode, foil outline, some status hues, focus, link and code colours. Geometry, type and motion are the same in both themes.

### A realistic override

A brand with a warm paper, its own blue as the first ink, a different display font and a link colour:

```css title="brand/theme.css"
/* Day */
:root {
  --inkan-bg: #F8F5EE;
  --inkan-bg-2: #EEE9DD;
  --inkan-surface: #FFFDF8;
  --inkan-paper: #F6F2E8;
  --inkan-ink-c: #0057B8;        /* brand blue replaces cyan for projects using ink "c" */
  --inkan-link: #0057B8;
  --inkan-focus: #0057B8;
  --inkan-font-display: "Archivo", "Anybody", sans-serif;
  --inkan-radius-ui: 2px;
}

/* Stage: same brand on black. Both selectors are needed, see the Day and Stage record. */
:root[data-theme="dark"],
:root:not([data-theme="light"]) {
  --inkan-ink-c: #4D9BFF;
  --inkan-link: #8AB8FF;
}
```

> [!WARNING]
> Wrap the second block in `@media (prefers-color-scheme: dark)` when you use the `:root:not([data-theme="light"])` form, as `tokens.css` does. Outside that media query it would also apply to Day for readers without JavaScript.

If you replace a font, load it in the same file with `@font-face` or from a host you control; the built-in fonts stay available as fallbacks.

### What reads the tokens

Everything. The tokens are consumed by the page chrome, the Markdown styles, the photocards, the generated covers (`--inkan-ink-*`, `--inkan-paper`, `--inkan-blend`), the status stickers, the Expressive Code blocks (`--inkan-code-*`) and the Mermaid diagrams (`--inkan-fg`, `--inkan-surface`, `--inkan-bg-2`, `--inkan-rule-strong`). Changing an ink changes the covers of every project that uses it.

Project sections and cards also set a local `--ink` from their project's ink class (`.ink-c` … `.ink-o`). Your own components can use `var(--ink)` to pick up the current project colour.

## Consequences

- Retinting a site is one CSS file and no fork. Token names are kept stable across releases; class names are not a contract.
- Overrides must be written twice when they differ between Day and Stage.
- The six ink slots are fixed; you can recolour them but not add a seventh.
- Contrast is your responsibility after an override. The defaults pass AA for text; a pale ink used for text will not.
- `customCss` is bundled, so a change needs a rebuild in production; there is no runtime theme file to swap.
