---
title: "Record type comes from the folder"
description: "Why adr/ and rfc/ folders define the record type, how to add your own types with docTypes and how numbers and refs are derived from file names."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, config, navigation]
options: [docTypes]
related: [authoring/adr/0001-one-folder-per-project, authoring/adr/0003-metadata-in-front-matter, cli/adr/0003-number-records-with-inkan-new]
---

## Context

An ADR and an RFC share a format but have different lifecycles and are listed separately. Putting `type: adr` in every file is one more field to forget, and it says nothing a reader browsing the repository on GitHub can see at a glance. Some teams also need a third kind of record, such as postmortems, without forking the tool.

## Decision

The second path segment of a record decides its type: `sre/adr/0001-x.md` is an ADR, `sre/rfc/0001-y.md` is an RFC. The set of known types is the `docTypes` option in `inkan.config.ts`. It ships with `adr` and `rfc`; giving your own map replaces the defaults entirely.

The number of a record is the leading digits of its file name. Together with the project id and the type label it forms a human reference like `SRE-ADR-0007`. Folders that are not a known type hold ordinary pages, not records.

## How to use it

### Default types

```ts
docTypes: {
  adr: { label: 'ADR', plural: 'Decisions', description: 'Architecture Decision Record' },
  rfc: { label: 'RFC', plural: 'Proposals', description: 'Request for Comments' },
}
```

| Field | What it does |
| --- | --- |
| key (`adr`) | Folder name inside each project, and the `type` value in filters, `decisions.json` and `inkan new <type>`. |
| `label` | Short name: sidebar group heading, breadcrumbs, badges, the middle part of the ref (`SRE-ADR-0007`). |
| `plural` | Section heading on the team page and the counters there ("Decisions", "Proposals"). |
| `description` | Long name, used in generated text such as `llms.txt`. |

All three fields are required. The config loader rejects unknown fields inside a type.

### Adding a custom type

Give the full map. The defaults are replaced, not merged, so repeat `adr` and `rfc` if you still want them:

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';

export default defineConfig({
  docTypes: {
    adr: { label: 'ADR', plural: 'Decisions', description: 'Architecture Decision Record' },
    rfc: { label: 'RFC', plural: 'Proposals', description: 'Request for Comments' },
    postmortem: { label: 'PM', plural: 'Postmortems', description: 'Incident postmortem' },
  },
});
```

Then create the folder and the first file:

```bash
npx inkan new postmortem sre "Checkout outage on 2026-03-02"
# Created decisions/sre/postmortem/0001-checkout-outage-on-2026-03-02.md
```

The new type gets its own sidebar group, a counter and a "New PM" button on each team page, a type filter on `/decisions/`, and a template slot: put `templates/postmortem.md` in your repository and `inkan new` uses it. Without a template file the record starts with `title`, `date` and `authors` only. See [Number records with inkan new](../../cli/adr/0003-number-records-with-inkan-new.md).

> [!WARNING]
> Dropping a type from `docTypes` does not delete its files. They turn into plain pages: they lose their number, status sticker and metadata header and move from the record group to the page list in the sidebar.

### Numbering

The number is read from the file name with the pattern `^(\d+)`. Padding is cosmetic: `7-x.md`, `0007-x.md` and `00007-x.md` are all number 7, shown as `0007`. A file in a type folder without leading digits is still a record (type and status work) but has no number and no ref.

Numbers are per project and per type. `sre/adr/0001` and `payments/adr/0001` are different records; so are `sre/adr/0001` and `sre/rfc/0001`. Gaps are allowed, which is useful when a record is rejected before it is merged. The CLI picks `max + 1` in the target folder.

Within a type group the sidebar and the previous/next links at the bottom of a record are sorted by number. The record index on `/decisions/` is sorted by `date`, newest first.

### Human references

```text
<PROJECT ID upper-cased>-<type label>-<number padded to 4>
sre/adr/0007-x.md        -> SRE-ADR-0007
payments/rfc/0001-y.md   -> PAYMENTS-RFC-0001
sre/postmortem/0001-z.md -> SRE-PM-0001
```

The ref is indexed for search (typing `SRE-ADR-0007` in the search box finds the record), shown on list cards, used as the item prefix in the RSS feed and included in `llms.txt` and `decisions.json`. It is not used in URLs: links use the path, see [Link records by path](0006-link-records-by-path.md).

### Folders that are not types

Any other folder inside a project is a container for pages:

```text
decisions/
  sre/
    adr/0001-define-slos.md     record (type adr)
    rfc/0001-error-budget.md    record (type rfc)
    guides/on-call.md           page, listed under SRE in the sidebar
    guides/escalation.md        page
    notes.md                    page
```

Pages have `title`, optional `description`, `order` and `draft` in front matter. Other record fields are accepted but ignored. Pages can be nested as deep as you like. Records should sit directly in the type folder: the number is read from the third path segment, so a file in `sre/adr/2026/0001-x.md` would take its number from the folder name `2026`.

## Consequences

- No `type` field to maintain; a reader of the repository sees the type in the path.
- `docTypes` replaces the defaults, which makes removing RFCs possible but means a one-line addition must repeat the two built-ins.
- Moving a file between type folders changes its type, URL and ref. Add a `redirects` entry for the old URL.
- The type label is uppercase in refs only if you write it that way; `label: 'Pm'` gives `SRE-Pm-0001`.
