---
title: "decisions.json"
description: "A typed JSON index of every record at /decisions.json, with status, dates, people, tags, lineage and links, for scripts, dashboards and agents."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [ai, data, build]
related: [ai/adr/0001-llms-txt-and-llms-full-txt, ai/adr/0005-mcp-server-for-agents, authoring/adr/0003-metadata-in-front-matter, extending/adr/0005-data-api-and-layouts, authoring/adr/0012-custom-metadata-fields]
---

## Context

`llms.txt` is for reading. Scripts, dashboards, badges and agents with tools want to filter: all open RFCs of
one team, every record tagged `database`, the chain of records that superseded each other. Parsing front
matter out of a Git checkout works but ties every consumer to the folder layout and to a YAML parser.

## Decision

Every build writes `/decisions.json`: an array with one object per record, holding the normalised front matter
plus the computed fields the site itself uses (`id`, `ref`, `type`, `project`), the code references found for
the record (`codeRefs`) and three links (`url`, `markdown`, `source`). Dates are `YYYY-MM-DD` strings, missing
values are `null`, lists are always arrays.

## How to use it

Nothing to configure. After `inkan build` the file is at `dist/decisions.json`; in `dev` it is served
at `/decisions.json`. The landing page lists it under "For agents" and every record links to it from its rail.

### Shape

```json title="decisions.json"
[
  {
    "id": "payments/adr/0001-use-stripe",
    "ref": "PAYMENTS-ADR-0001",
    "title": "Use Stripe as the primary payment provider",
    "description": "One provider for cards and wallets.",
    "type": "adr",
    "project": "payments",
    "status": "accepted",
    "date": "2026-01-18",
    "authors": ["piotr.nowak"],
    "deciders": ["tomasz.wojcik"],
    "tags": ["payments", "vendor"],
    "supersedes": ["payments/adr/0000-old-choice"],
    "supersededBy": [],
    "related": ["dbre/adr/0001-postgresql-as-default-database"],
    "codeRefs": [{ "file": "services/billing/src/provider.ts", "line": 12 }],
    "review": { "due": "2027-01-18", "reviewed": null, "every": "1 year" },
    "url": "https://decisions.acme.dev/payments/adr/0001-use-stripe/",
    "markdown": "https://decisions.acme.dev/payments/adr/0001-use-stripe.md",
    "source": "decisions/payments/adr/0001-use-stripe.md"
  }
]
```

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Path inside the content folder without extension: `<project>/<type>/<file>` |
| `ref` | `string \| null` | Human reference `<PROJECT>-<TYPE LABEL>-<NNNN>`, from the folder names and the file number |
| `title` | `string` | Front matter `title` |
| `description` | `string \| null` | Front matter `description` |
| `type` | `string` | Folder name inside the project, one of the keys of `docTypes` |
| `project` | `string` | Top-level folder name |
| `status` | `string \| null` | Front matter `status`, one of the keys of `statuses` |
| `date` | `string \| null` | Front matter `date` as `YYYY-MM-DD` |
| `authors`, `deciders`, `tags` | `string[]` | Front matter lists; a single value is wrapped in an array |
| `reviewers` | `{ handle, state, date?, note? }[]` | Front matter `reviewers`, normalised; empty when there are none. See [Review RFCs with reviewers](../../authoring/adr/0013-review-rfcs-with-reviewers.md) |
| `rfcReview` | `object \| null` | RFC review status (`in-review`, `changes-requested`, `approved`, `closed`), approval counts and `waitingOn` handles; `null` without reviewers |
| `supersedes`, `supersededBy`, `related` | `string[]` | Record ids as written in front matter |
| `codeRefs` | `{ file, line }[]` | Places in the repository that mention the record in an `@adr <record>` comment; `file` is relative to the repository root. Empty when `codeRefs: false`. See [Reference records from code](../../authoring/adr/0010-reference-records-from-code.md) |
| `review` | `{ due, reviewed, every } \| null` | The record's periodic review: `due` is the next review date, `reviewed` the last one (or `null`), `every` the interval that applies (`"1 year"`, or `null` when only `reviewBy` schedules it). `null` for records without a schedule. See [Review decisions on a schedule](../../authoring/adr/0011-review-decisions-on-a-schedule.md) |
| `url` | `string` | Absolute URL of the HTML page, built from `url` and `base` in the config |
| `markdown` | `string` | Absolute URL of the raw Markdown copy |
| `source` | `string` | Path of the file relative to the repository root. For a record pulled with `sources` from another repository, its web URL there (`https://github.com/acme/checkout/blob/main/docs/decisions/adr/0001-x.md`), or `<repo> <path>` when no web URL can be derived |

Records are sorted newest first by `date`, then by `id`. Only records are listed: Markdown pages, project
intros and `_landing.md` are not in the file. Drafts are excluded from production builds.

### Examples

Open RFCs per project, with `jq`:

```bash
curl -s https://decisions.acme.dev/decisions.json \
  | jq -r '[.[] | select(.type == "rfc" and (.status | IN("draft", "proposed", "in-review")))] | group_by(.project)[] | "\(.[0].project): \(length)"'
```

A README badge from the count of accepted decisions:

```bash
curl -s https://decisions.acme.dev/decisions.json | jq '[.[] | select(.status == "accepted")] | length'
```

The site already serves ready badges for the common counts at `/badges/records.svg`, `/badges/accepted.svg`
and `/badges/<project>.svg` (and `.json` for shields.io); see
[Static HTML output](../../deploy/adr/0001-static-html-output.md).

Follow a lineage: start from a record, read `supersededBy`, look up that `id` in the same array. For the whole chain at once, `/graph.json` holds every resolved `supersedes` and `related` link as `{nodes, edges, dangling}`, see [Decision graph](../../site/adr/0012-decision-graph.md).

> [!TIP]
> The same data is available at build time from `@tilaven/inkan/data` (`getDecisions()`), which is the better
> choice for a custom page inside the site. `decisions.json` is for everything outside the build. An agent
> with tools gets the same index with filters from the [MCP server](0005-mcp-server-for-agents.md), which reads
> this file when started with `--url`.

### Stability

The field list above is the contract. New fields may be added in later releases; existing fields keep their
name and type. Consumers should ignore fields they do not know.

Custom fields declared with `fields` are in each record's `fields` object, with normalised values (numbers as numbers, booleans as booleans, lists as arrays). See [Custom metadata fields](../../authoring/adr/0012-custom-metadata-fields.md).

## Consequences

- Any language with a JSON parser can query the archive without cloning the repository or parsing YAML.
- The file is regenerated on every build and is only as current as the last deployment.
- Record bodies are not included, to keep the file small. Fetch `markdown` for the text of one record, or `llms-full.txt` for all of them.
- `supersedes`, `supersededBy` and `related` are copied as written. A typo in front matter is a dangling id here too; run `inkan check` in CI to catch it before the build.
