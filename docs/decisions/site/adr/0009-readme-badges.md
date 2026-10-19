---
title: "README badges"
description: "The /badges/*.svg images and /badges/*.json shields.io endpoints every site serves, what each one counts, and the Markdown to put them in a README."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [site, deploy, content]
related: [ai/adr/0002-decisions-json, site/adr/0007-rss-feed-and-sitemap, authoring/adr/0004-configurable-status-lifecycle]
---

## Context

The README of a service repository is where developers start, and the decision site is one link away that nobody clicks. A badge next to the build status makes the archive visible where people already look, and a number that changes ("accepted 42") is a nudge that the archive is alive. Services such as shields.io render badges from a JSON endpoint, but a static site can also serve the image itself, so the README works with and without a third party.

## Decision

Every build writes a set of badges under `/badges/`: one for all records, one for current decisions and one per project. Each badge exists twice, as a flat SVG in the shields.io style (`.svg`) and as shields.io endpoint JSON (`.json`). The badges are static files, so their numbers are those of the last build. `badges` is a reserved name and cannot be used as a project folder.

## How to use it

### The badges

| File | Label | Message | Colour |
| --- | --- | --- | --- |
| `/badges/records.svg` | `records`, or the plural of the only record type when `docTypes` has one entry (`Decisions`) | Number of records of every type and status | blue |
| `/badges/accepted.svg` | `accepted` | Number of records whose status has `current: true` (`accepted` and `implemented` by default) | brightgreen |
| `/badges/<project>.svg` | The project's name from `_project.yml` | Number of records in that project, any status | blue |

`<project>` is the project id, that is the folder name under the content folder or the `project` of a `sources` entry. Drafts are not counted in production builds, because they are not part of the site. A project whose id is `records` or `accepted` gets no badge of its own.

With `base` set, the files sit under the sub-path: `/docs/badges/records.svg`.

### Markdown snippets

Direct image, no third party:

```markdown
[![Decisions](https://decisions.acme.dev/badges/records.svg)](https://decisions.acme.dev/)
[![Accepted](https://decisions.acme.dev/badges/accepted.svg)](https://decisions.acme.dev/decisions/?status=accepted)
[![SRE decisions](https://decisions.acme.dev/badges/sre.svg)](https://decisions.acme.dev/sre/)
```

Through shields.io, when you want its styles or want all badges of a README to look the same:

```markdown
![Decisions](https://img.shields.io/endpoint?url=https%3A%2F%2Fdecisions.acme.dev%2Fbadges%2Frecords.json)
![Accepted](https://img.shields.io/endpoint?url=https%3A%2F%2Fdecisions.acme.dev%2Fbadges%2Faccepted.json&style=flat-square)
```

The `url` parameter must be URL-encoded. shields.io accepts its usual parameters (`style`, `logo`, `labelColor`) next to `url`, and its own `label` and `color` override the ones in the JSON.

### The JSON

`/badges/records.json` is a shields.io endpoint document:

```json
{ "schemaVersion": 1, "label": "records", "message": "42", "color": "blue" }
```

Anything that reads the shields.io endpoint schema can use it, including an internal badge service or a dashboard that polls the number.

### The SVG

The image is a 20 px high flat badge: grey label on the left, coloured message on the right, rounded corners, the same gradient and shadow as shields.io. It uses the Verdana font stack and embeds nothing, so it is a few hundred bytes. Text widths are estimated per character and fixed with `textLength`, so the layout is the same in every renderer. The `<title>` and `aria-label` read "label: message" for screen readers and tooltips.

### Where the numbers come from

Badges are generated from the same record list as the index page, so the numbers match the stats in the hero of the landing page and the counts in `decisions.json`. They change when the site is rebuilt and deployed. There is no option to add a badge, change a colour or count a different status; a plugin page can produce its own badge from `decisions.json` or the data API when you need one.

> [!NOTE]
> GitHub caches README images through its camo proxy. After a deploy, a badge in a README can show the old number for a few minutes.

## Consequences

- Any README can show the state of the archive with one image URL and no account on a badge service.
- The numbers are as fresh as the last deploy. A site that is rebuilt on every merge keeps them current; a nightly build lags by a day.
- `badges` and the two fixed names are taken. A project folder called `badges` fails the build with a collision error.
- The badge set is fixed. Per-status or per-tag badges need a custom page.
