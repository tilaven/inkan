---
title: "OVERPRINT design"
description: "The design system behind every Inkan site: risograph inks on paper, die-cut status stickers, photocards, foil for records in force, self-hosted fonts and a print stylesheet."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [theming, content]
related: [theming/adr/0002-day-and-stage-themes, theming/adr/0003-theme-with-inkan-css-tokens, theming/adr/0005-generated-record-covers, authoring/adr/0004-configurable-status-lifecycle]
---

## Context

Architecture decisions are the most documented and least cared-for artefact in a company. A generic docs theme (purple gradient, glass cards, one accent colour) tells the reader the content is interchangeable. The site needed a look that treats each record as an object worth keeping, that uses colour as information rather than decoration, and that reads the same in a browser, on a phone and on paper. It also had to be cheap to ship: no images, no runtime dependencies, no font CDN.

## Decision

Inkan ships one design system, OVERPRINT. Its rules:

- **Two physics.** Day is ink on paper: flat process inks that overprint with `multiply`. Stage is light on black: the same hues, brighter, blended with `screen`. See [Day and Stage themes](0002-day-and-stage-themes.md).
- **Colour is information.** Each project has one process ink (cyan, magenta, yellow, green, violet, orange). Foil appears only on records whose status describes the current state.
- **Status is never colour alone.** Every status has a die-cut sticker with its own silhouette and glyph.
- **A record is a photocard** (55 × 85 mm proportions): cover art and title plate on the front, the record as JSON on the back.
- **Everything is code-native**: SVG covers and stickers, CSS foil, variable fonts shipped in the package. No generated images.

## How to use it

You do not configure OVERPRINT; it is what every site looks like. This record explains the parts you will see so that the other theming records make sense.

### Inks and projects

Six inks are defined as tokens and picked per project, either pinned in `_project.yml` or assigned so that no two projects share an ink and motif pair (see [Generated record covers](0005-generated-record-covers.md)):

| Ink | Token | Day | Stage |
| --- | --- | --- | --- |
| `c` cyan | `--inkan-ink-c` | `#00AEEF` | `#2BD4FF` |
| `m` magenta | `--inkan-ink-m` | `#FF2D8F` | `#FF4FA6` |
| `y` yellow | `--inkan-ink-y` | `#FFE000` | `#FFEA4A` |
| `g` green | `--inkan-ink-g` | `#00B35A` | `#2BEA8A` |
| `v` violet | `--inkan-ink-v` | `#7B4DFF` | `#9A78FF` |
| `o` orange | `--inkan-ink-o` | `#FF6B1A` | `#FF8A3D` |

The ink colours a project's dot in the filters, its sidebar section, the ring around its owners' avatars, the underline of its name on cards and the covers of its records. Where two projects' inks overlap (lineage links, overprinted sticker plates) the blend mode mixes them like real ink.

### Status stickers

Each of the nine default statuses has a sticker: a silhouette cut from a 72 × 72 box and a glyph.

| Status | Silhouette | Glyph |
| --- | --- | --- |
| `draft` | rounded square | three dots |
| `proposed` | arrow tag | diagonal arrow |
| `in-review` | circle | magnifier |
| `accepted` | 12-point rosette | check |
| `implemented` | 10-point star | double check |
| `rejected` | octagon | cross |
| `withdrawn` | notched ticket | return arrow |
| `deprecated` | hexagon | exclamation mark |
| `superseded` | two overprinted plates | arrow to the right |

Stickers appear in the sidebar, on cards, in filters, on timeline rows and in search results. A custom status in `statuses` borrows a built-in sticker with `sticker: 'accepted'`, or gets the fallback: a rounded square with the first letter of its label, filled with its `color`. Covers of records that no longer describe the current state get a treatment baked in: rejected goes grey, withdrawn fades, deprecated goes sun-faded, superseded is dimmed, draft is pale.

### Photocards and foil

The `RecordCard` renders a record as a card with the cover, the team chip, the number, the sticker, the title, tags, authors and date. On a record's own page the card in the right rail flips to its JSON back, which shows the same fields the site writes to `decisions.json`. Cards tilt slightly with the pointer; both effects respect `prefers-reduced-motion`.

Only a status with `current: true` (by default `accepted` and `implemented`) gets a foil number and a foil ring: a holographic spectrum for accepted, gold for implemented. Everything else is matte. On a record page the big outlined number carries the same foil and its sheen follows the pointer. The rule teaches itself: foil means "this is how things are now".

### Type

Four families, all shipped as `woff2` inside the package with their SIL Open Font License texts, so a site renders the same offline and no request leaves the page for a font CDN:

| Role | Font | Token |
| --- | --- | --- |
| Display (titles, numbers) | Anybody, variable weight and width | `--inkan-font-display` |
| Body | Instrument Sans | `--inkan-font-text` |
| Captions, paths, counters, code | Martian Mono | `--inkan-font-mono` |
| Math | STIX Two Text (via KaTeX) | |
| Hangul labels | Noto Sans KR, subset to the 29 syllables the stickers use | `--inkan-font-ko` |

### Print

A `@media print` stylesheet is part of the site CSS. Printing a record hides the sidebar, header, rail, pager, banner, footer and action buttons, turns the page black on white, draws foil numbers as plain outlines, prints external link URLs after the link text and keeps code blocks, callouts, figures, tables and formulas from breaking across pages.

## Consequences

- The whole look ships as CSS, SVG and five fonts. A built site has no image assets for its chrome.
- Status is readable without colour (shape, glyph and label), which also covers colour-blind readers and monochrome print.
- Teams cannot pick arbitrary accent colours per project; they pick one of six inks. Everything else is retinted through tokens, see [Theme with --inkan-* CSS tokens](0003-theme-with-inkan-css-tokens.md).
- Foil and blend modes rely on modern CSS (`mix-blend-mode`, `color-mix`, registered custom properties). Old browsers get flat colour.
- The Hangul subset only holds the syllables in use; Korean text in your own records will fall back to a system font.
