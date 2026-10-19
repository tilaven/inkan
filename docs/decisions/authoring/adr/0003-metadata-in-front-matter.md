---
title: "Metadata in front matter"
description: "Every field a record or page can carry in its YAML front matter, what each one drives on the site and how it is validated."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, markdown]
related: [authoring/adr/0004-configurable-status-lifecycle, authoring/adr/0006-link-records-by-path, authoring/adr/0009-fill-date-and-authors-from-git, cli/adr/0004-validate-config-and-content-at-build-time, authoring/adr/0012-custom-metadata-fields]
---

## Context

Older ADR tools read status, date and authors from a Markdown table or a bullet list at the top of the body (`* Status: accepted`). That format is fragile: an HTML comment or a reworded label breaks the parser, and the metadata cannot be validated. GitHub and GitLab already understand YAML front matter and hide it when rendering a file.

## Decision

All metadata lives in YAML front matter between `---` lines. The body is plain Markdown and is never parsed for metadata. The schema is validated at build time: a missing `title`, an unknown `status` or a malformed date fails `inkan build` with the file name and the field. Fields that take several values also accept a single value, so `tags: db` and `tags: [db]` mean the same.

## How to use it

### A complete example

```yaml title="decisions/payments/adr/0003-use-stripe.md"
---
title: Use Stripe as the primary payment provider
description: One-line summary for lists, search, RSS and llms.txt.
status: accepted
date: 2026-01-18
authors: [piotr.nowak, anna.lis]
deciders: [tomasz.wojcik]
tags: [payments, vendor]
supersedes: [payments/adr/0001-build-our-own-gateway]
supersededBy: []
related: [dbre/adr/0001-postgresql-as-default-database]
reviewBy: 2026-11-15
draft: false
---
```

### Fields

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `title` | string | required | Heading of the page, sidebar entry, search title. The build fails without it. |
| `description` | string | none | Lede on cards and in lists, `<meta name="description">`, RSS summary, `llms.txt` line. Keep it to one sentence. |
| `status` | one of the configured statuses | none | Sticker, status filter, backlog membership, foil. Any value outside the list fails the build. See [Configurable status lifecycle](0004-configurable-status-lifecycle.md). |
| `date` | date | first commit of the file | When the decision was made or the RFC opened. Sorts the record index and the timeline, newest first. When absent, the date of the commit that added the file is used; outside git the record sorts last. See [Fill date and authors from git](0009-fill-date-and-authors-from-git.md). |
| `authors` | list of handles | author of the first commit | Shown in the header with initials, counted on the authors page, filterable (`?author=`). When absent, the author of the commit that added the file is mapped to a handle; outside git the list is empty. |
| `deciders` | list of handles | `[]` | People who signed off. Shown in the header, counted on the authors page as "decided". |
| `tags` | list of strings | `[]` | Shown as `#tag` chips, filterable (`?tag=`), listed on `/tags/`. |
| `supersedes` | list of record paths | `[]` | Lineage line "Supersedes" linking to the older records. |
| `supersededBy` | list of record paths | `[]` | Lineage line "Superseded by". |
| `related` | list of record paths | `[]` | Lineage line "Related". Shown on both records even when only one of them lists the other. |
| `reviewBy` | date | none | On open records: the decision deadline, shown as a `D-n` chip in the header and sorting the backlog. On decided records: the date of the next review. |
| `reviewed` | date | none | When a decided record was last reviewed. `inkan reviewed` writes it. |
| `reviewEvery` | interval or `never` | project's, then `reviews.every` | How often a decided record comes up for review (`1 year`, `6 months`, `90 days`). `never` opts out. See [Review decisions on a schedule](0011-review-decisions-on-a-schedule.md). |
| `order` | number | `0` | Sidebar position for pages that are not records. Lower first. Ignored on records, which sort by number. |
| `draft` | boolean | `false` | Hides the file from production builds. |
| `slug` | string | none | Replaces the URL path derived from the file name. Use sparingly. |

Handles are free text. They match entries in `_authors.yml` when that file exists, otherwise they are shown as written. Record paths are the path inside the content folder without extension, such as `sre/adr/0001-define-slos`; a `.md` suffix or a leading slash is tolerated.

Unknown fields are kept out of the way: the build neither fails nor uses them. To add keys of your own that the site validates, shows and filters, declare them as [custom metadata fields](0012-custom-metadata-fields.md).

### Single value or list

The list fields (`authors`, `deciders`, `tags`, `supersedes`, `supersededBy`, `related`) accept any of these spellings:

```yaml
tags: payments
tags: [payments, vendor]
tags:
  - payments
  - vendor
```

A missing field is an empty list. `null` is also an empty list. For `authors`, an empty list is then filled from git unless `git.authors` is `false`.

### Dates

Write dates as `YYYY-MM-DD`. Unquoted YAML dates and quoted strings are both accepted and coerced to a date; the site prints them back as `YYYY-MM-DD` in UTC. A value that does not parse (`date: next week`) fails the build. A missing `date` is not an error: inside a git repository it comes from the first commit, and `git: { dates: false }` turns that off.

`reviewBy` is compared with the reader's current date in the browser, so an "overdue" badge never goes stale on a static page. On a record in an open status it is the decision deadline, tracked on the backlog. On a decided record it is the date of the next periodic review, shown as "Next review" in the header and listed on `/reviews/` together with records scheduled by `reviewEvery`; `reviewed` records when the last review happened. See [Review decisions on a schedule](0011-review-decisions-on-a-schedule.md).

### Drafts

```yaml
draft: true
```

A draft is rendered by `inkan dev` so you can preview it, and skipped by `inkan build`: no page, no sidebar entry, no search hit, no line in `llms.txt` or `decisions.json`. Use it for work in progress that is already merged. For a record that is being discussed and should be visible, use an open status such as `proposed` instead.

### Pages

Pages (Markdown files outside a type folder) use the same front matter but only `title`, `description`, `order` and `draft` have an effect. The project intro (`<project>/index.md`) needs `title` only.

### Templates

`inkan new` fills `title`, `date` and `authors` from `templates/<type>.md`. Keep the template's front matter in sync with the fields your team wants every record to carry. See [Number records with inkan new](../../cli/adr/0003-number-records-with-inkan-new.md).

## Consequences

- Metadata is machine-checked. A typo in a status is caught before deploy, not discovered on the backlog page months later.
- The body is free: HTML comments, tables and headings never interfere with metadata.
- Front matter is hidden when the file is viewed on GitHub or GitLab, so the status is not visible there. Teams that read records in the repository often add a one-line alert at the top of the body.
- The built-in schema is fixed by the package. Extra keys are not an error and are ignored, unless you declare them as custom fields.
