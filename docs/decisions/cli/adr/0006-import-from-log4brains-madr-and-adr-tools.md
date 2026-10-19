---
title: "Import from log4brains, MADR and adr-tools"
description: "How inkan import converts an existing ADR folder into numbered records with front matter, what it maps, what it skips and how to check the result."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [cli, content, migration]
related: [authoring/adr/0003-metadata-in-front-matter, authoring/adr/0004-configurable-status-lifecycle, cli/adr/0003-number-records-with-inkan-new, cli/adr/0007-check-records-in-ci]
---

## Context

Most teams that try Inkan already have decisions: a `docs/adr/` folder made with adr-tools, a log4brains site, or MADR files written by hand. Those formats keep metadata in the body, as a `## Status` section, a `Date:` line or a list of `* Status: accepted` items under the title. Inkan keeps metadata in front matter and takes the type and number from the path. Converting a few dozen files by hand is boring and error-prone, and it is the first thing a new user has to do.

## Decision

`inkan import <dir|file...> --project <name>` reads files in the three common dialects and writes them as `<contentDir>/<project>/<type>/NNNN-slug.md` with front matter:

- the first `# ` heading becomes `title`; a leading `1. ` becomes the record number,
- status, date, deciders and tags move into front matter, with status spellings mapped to your configured statuses,
- a `Superseded by [..](..)` status and adr-tools `Supersedes [..](..)` lines become `supersededBy` and `supersedes` when they point at files of the same import,
- links between imported files are rewritten to the new file names,
- original numbers are kept when they are free; existing files are never overwritten.

The command converts the metadata and leaves the body as it was, so the imported text reads exactly like the original.

## How to use it

### Run it

```bash
npx inkan import ../old-repo/docs/adr --project platform --dry-run
npx inkan import ../old-repo/docs/adr --project platform
```

```text
Wrote decisions/platform/adr/0001-record-architecture-decisions.md  <- ../old-repo/docs/adr/0001-record-architecture-decisions.md (adr-tools, accepted)
Wrote decisions/platform/adr/0002-use-postgres.md  <- ../old-repo/docs/adr/0002-use-postgres.md (adr-tools, superseded)
Wrote decisions/platform/adr/0003-use-cockroachdb.md  <- ../old-repo/docs/adr/20200927-use-cockroachdb.md (madr, accepted)
Imported 3 records into decisions/platform/adr.
```

Inputs are folders (walked recursively, `_`-prefixed files and folders skipped) or single `.md` and `.mdx` files, in any mix. Files named `README`, `index` or `template` (any case) are skipped. When the project folder has no `_project.yml`, one is created with `name: <project>` for you to fill in.

| Option | Default | What it does |
| --- | --- | --- |
| `--project <name>` | required | Project folder to write into: letters, digits, `-` and `_`. Must not be a project listed in `sources`. |
| `--type <type>` | `adr` | Type folder inside the project. Must be a key of `docTypes`. |
| `--format auto\|log4brains\|madr\|adr-tools` | `auto` | Dialect of every input file. `log4brains` and `madr` are the same parser; `auto` detects per file. |
| `--dry-run` | off | Prints what would be written and writes nothing, not even `_project.yml`. |
| `--root <dir>` | current folder | Folder with `inkan.config.*`. |

### Dialect detection

With `--format auto`, a file is adr-tools when its body has a `## Status` heading and a `Date: ...` line before the first `## ` heading. Everything else is parsed as MADR, which covers log4brains and MADR 2.x header lists as well as MADR 3 and 4 front matter.

| Source | Where the metadata is | What is read |
| --- | --- | --- |
| adr-tools | `Date:` line under the title; `## Status` section | `Date` becomes `date`. In `## Status`, the first plain line is the status, `Supersedes [..](..)` lines fill `supersedes`, lines starting with `Amended`, `Extended`, `Clarified` or `Related` fill `related`. The section is removed from the body. |
| log4brains, MADR 2.x | `* Status:`, `* Date:`, `* Deciders:` (or `Decision makers:`), `* Tags:`, `* Consulted:`, `* Informed:` list items under the title | Each becomes the front matter field of the same name; `deciders` and `tags` are split on commas, a leading `@` is dropped. Other list items stay in the body. |
| MADR 3 and 4 | YAML front matter | `title`, `status`, `date`, `deciders` / `decision-makers`, `tags`, `consulted`, `informed`. |

In every dialect the first `# ` heading is the title (falling back to a front matter `title`) and is removed from the body; a file with neither is skipped with `no heading`. A status that reads `Superseded by [title](file.md)` sets `supersededBy` from the link and the status `superseded`.

### Status mapping

The status is reduced to its first word, lowercased, and matched against your `statuses`:

1. an exact key (`accepted`),
2. a synonym, when the target is configured: `approved` to `accepted`, `pending` to `proposed`, `wip` to `draft`, `declined` to `rejected`, `obsolete` to `deprecated`, `done` to `implemented`,
3. the closest key by edit distance (`acepted` to `accepted`).

A status that maps to nothing is left out, and a warning names the file: `status "Parked" is not configured; left out`. Add the status to `statuses` first if you want to keep it; see [Configurable status lifecycle](../../authoring/adr/0004-configurable-status-lifecycle.md).

### Numbers, names and dates

| In the source | Result |
| --- | --- |
| `0007-use-kafka.md` | number 7, slug `use-kafka` |
| `# 7. Use Kafka` | number 7 (the heading wins over the file name), title `Use Kafka` |
| `20200927-use-kafka.md` (log4brains) | `date: 2020-09-27` unless the file states a date, slug `use-kafka` |
| `use-kafka.md`, no number anywhere | the next free number in the target folder |

Original numbers are kept when no record in the target folder uses them. Two sources claiming the same number, or a number already taken, fall back to the next free number in input order. The slug comes from the file name, or from the title when the name has none. A slug that already exists in the target folder means the file was imported before and is skipped with `already imported as <file>`; a target file that exists is never overwritten.

### Links

Relative Markdown links from one imported file to another are rewritten to the new name, keeping any `#anchor`: `[2. Use Postgres](0002-use-postgres.md)` becomes `[2. Use Postgres](./0002-use-postgres.md)` under its new number. `supersedes`, `supersededBy` and `related` get the full id of the target record (`platform/adr/0002-use-postgres`). A link whose target is not part of the same import is left as text and, for the three link fields, dropped with a warning: `supersedes link "0003-x.md" points outside this import; left out`. Import a whole folder at once so the links resolve.

### Check the result

```bash
npx inkan check
npx inkan dev
```

`check` reports one-sided supersede links, unknown authors and missing `owners` in the new `_project.yml`; see [Check records in CI](0007-check-records-in-ci.md). Deciders are imported as written (`Ann`, `Bob`), so either add them to `_authors.yml` under those handles or edit them to existing handles.

> [!TIP]
> Run the import with `--dry-run` first. It prints every target file, every warning and the skip reasons, and leaves the content folder untouched.

## Consequences

- A folder of adr-tools, log4brains or MADR files becomes a working Inkan project in one command, with the body text unchanged.
- Only metadata the three formats agree on is mapped. `consulted` and `informed` are written to front matter but the site does not display them; MADR "Decision Outcome" or "Considered Options" sections stay as ordinary body text.
- Numbers are preserved per type folder. Importing two sources into the same project renumbers the second one wherever numbers collide, and links are rewritten accordingly only within one run.
- Links to records outside the import are not resolved. Import related folders together, or fix the `supersedes` fields afterwards with `inkan supersede`.
- The command never overwrites or deletes, so re-running it is safe but does not update records that changed in the source.
