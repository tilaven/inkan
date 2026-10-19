---
title: "Change status and supersede from the CLI"
description: "How inkan status and inkan supersede edit front matter in place, which record references they accept, and what --dry-run shows."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [cli, content, lifecycle]
related: [authoring/adr/0004-configurable-status-lifecycle, authoring/adr/0006-link-records-by-path, cli/adr/0007-check-records-in-ci, deploy/adr/0005-records-from-other-repositories]
---

## Context

A record changes status a few times in its life: proposed, accepted, implemented, one day superseded. Each change is a small edit to front matter, and each one is easy to get wrong by hand: a misspelled status, a `supersededBy` on the old record without the matching `supersedes` on the new one, or a status left at `accepted` after the replacement landed. The build only catches the first of these. People also edit records from scripts and from pull request bots, where opening a file in an editor is not an option.

## Decision

Two commands edit front matter for you:

- `inkan status <record> <status>` sets `status` on one record.
- `inkan supersede <old> <new>` sets `status: superseded` and appends `<new>` to `supersededBy` on the old record, and appends `<old>` to `supersedes` on the new one.

Both validate the status against your configured `statuses`, resolve records by several spellings, rewrite only the keys they change and leave the rest of the file as written: comments, key order, quoting and line endings survive. `--dry-run` prints a diff instead of writing. Records fetched from a `repo` source are refused, because their clone is overwritten on the next sync.

## How to use it

### Change a status

```bash
npx inkan status sre/adr/0003 accepted
```

```text
sre/adr/0003-define-slos: proposed -> accepted
```

The status must be a key of `statuses` in your config (the nine defaults, or your own map). A wrong one exits with code 1 and a hint:

```text
Unknown status "acepted". Did you mean "accepted"? Known: draft, proposed, in-review, accepted, implemented, rejected, withdrawn, deprecated, superseded.
```

| Option | What it does |
| --- | --- |
| `--date [YYYY-MM-DD]` | Also sets `date` to today (the local calendar day) or, with a value, to that day. Useful when the date of a record is the date it was accepted, or when the change is recorded late. A value that is not a calendar day is refused. |
| `--dry-run` | Prints the diff and changes nothing. |
| `--root <dir>` | Folder with `inkan.config.*`, as for every command. |

Running the command again with the same status writes nothing and prints `sre/adr/0003-define-slos: already accepted`.

### Supersede a record

```bash
npx inkan supersede platform/adr/0004 platform/adr/0009
```

```text
platform/adr/0004-use-sqs-as-the-event-bus: accepted -> superseded, supersededBy += platform/adr/0009-move-the-event-bus-to-kafka
platform/adr/0009-move-the-event-bus-to-kafka: supersedes += platform/adr/0004-use-sqs-as-the-event-bus
```

What changes on each file:

| Record | Keys written |
| --- | --- |
| `<old>` | `status: superseded` (only when `superseded` is one of your statuses) and `supersededBy` gets the full id of `<new>` appended. |
| `<new>` | `supersedes` gets the full id of `<old>` appended. |

Ids are written in full (`platform/adr/0009-move-the-event-bus-to-kafka`), as a flow list (`supersedes: [platform/adr/0004-use-sqs-as-the-event-bus]`). Existing entries stay; if a list already names that record under any spelling, nothing is added, so the command is safe to run twice. The two records may live in different projects. A record cannot supersede itself. `--dry-run` works here too and shows the diff of both files. `--date [YYYY-MM-DD]` sets `date` on `<old>`, the record whose status changes, exactly as it does for `inkan status`.

### Which spellings of a record are accepted

`<record>`, `<old>` and `<new>` can be written as:

| Form | Example |
| --- | --- |
| Full id (path inside the content folder, without `.md`) | `sre/adr/0003-define-slos` |
| Short id with or without leading zeros | `sre/adr/0003`, `sre/adr/3` |
| Reference, in any case | `SRE-ADR-0003`, `sre-adr-0003` |
| File path, relative to the current folder or absolute | `decisions/sre/adr/0003-define-slos.md` |
| Trailing part of an id | `0003-define-slos` (only when exactly one record ends with it) |

A query that matches more than one record (duplicate numbers in one folder, or a trailing part shared by two projects) is refused with the list of candidates, and a query that matches nothing gets a "did you mean" hint built from ids and references.

### What --dry-run prints

A unified-style diff per file, changed lines only, followed by the summary line with `[dry run]`:

```text
--- decisions/platform/adr/0004-use-sqs-as-the-event-bus.md
- status: accepted
+ status: superseded
+ supersededBy: [platform/adr/0009-move-the-event-bus-to-kafka]
platform/adr/0004-use-sqs-as-the-event-bus: accepted -> superseded, supersededBy += platform/adr/0009-move-the-event-bus-to-kafka [dry run]
```

### How the file is edited

The front matter is parsed as a YAML document and the changed keys are set on that document; everything else is serialised back as it was. A `# comment` above `tags`, a quoted title, `"status"` written with quotes and CRLF line endings all survive. A file without front matter gets one. Front matter that does not parse stops the command with the file name and the first YAML error; run `inkan check` to find such files first.

### In scripts and npm

`init` adds `status` and `supersede` to the scripts of `package.json`, so these do the same thing:

```bash
npm run status -- sre/adr/0003 accepted
npm run supersede -- platform/adr/0004 platform/adr/0009
```

The exit code is 0 on success (including "already ..."), 1 on a usage error, an unknown status, an unresolved record or a read-only source record. Pair the commands with `inkan check` in CI to catch supersede links that were edited by hand on one side only; see [Check records in CI](0007-check-records-in-ci.md).

> [!NOTE]
> Records that come from a `repo` entry in `sources` live in a read-only clone under `node_modules/.inkan/sources/`. Both commands refuse them with the name of the source and its repository; change the file in that repository instead. See [Records from other repositories](../../deploy/adr/0005-records-from-other-repositories.md).

## Consequences

- Status changes are validated at the moment they are made, not at the next build, and the two sides of a supersede link are always written together.
- The commands only know front matter. The body of the old record is not touched, so add a sentence pointing at the replacement yourself when you want one.
- `supersede` sets `status: superseded` only if that status exists in your `statuses`. A lifecycle without it gets the links but no status change.
- Formatting is preserved key by key, not byte by byte: a list written one item per line is kept, but a key the command writes is always in flow style.
- The lookup by trailing id part is convenient and ambiguous by design; scripts should pass full ids or references.
