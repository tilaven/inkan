---
title: "Reference records from code"
description: "Point at a record from a code comment with @adr, and get the list of referencing files and lines on the record page, linked to GitHub or GitLab."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [content, config, navigation]
options: [codeRefs]
related: [authoring/adr/0006-link-records-by-path, authoring/adr/0003-metadata-in-front-matter, ai/adr/0002-decisions-json]
---

## Context

A decision is only useful while the code still follows it. Records link to each other, but nothing links a record to the module that implements it, so a reader of the ADR does not know where to look, and a reader of the code does not know why it is written that way. Comments like `// see ADR 12` exist in most repositories already; they are just not machine-readable.

## Decision

A comment that contains the marker `@adr` followed by a record reference is a code reference. Once per build, Inkan lists the files of the repository with `git ls-files`, scans the text files for the marker and groups the hits by record. Each record page ends with a "Referenced in code" section listing file and line, linked to the file on GitHub or GitLab when `repo` is configured. `decisions.json` carries the same list. A reference that matches no record is a build warning.

The scan is on by default, excludes Markdown and the content folder, and can be narrowed with globs or turned off.

## How to use it

### Write a marker

Any comment syntax works; the scanner reads plain text and does not know the language.

```python title="services/events/publish.py"
class Producer:
    # @adr platform/adr/0009-move-the-event-bus-to-kafka
    def publish(self, topic, event): ...

    # Consumers replay from the last committed offset, see @adr PAYMENTS-RFC-0001.
    def replay(self, topic, from_offset): ...
```

```sql title="services/ledger/schema.sql"
-- @adr payments/adr/0001
CREATE TABLE ledger_entries (
  -- Retried requests never book twice. @adr payments/adr/0002
  idempotency_key text NOT NULL UNIQUE
);
```

The syntax is `<marker>` + spaces or a colon + the reference. `@adr: sre/adr/1` and `@adr	sre/adr/1` are valid. The marker must start a word: `me@adr sre/adr/1` (an e-mail) and `@adrx sre/adr/1` are ignored, and so is a bare `` `@adr` `` with nothing after it. A trailing `.`, `,` or `/` after the reference is dropped, so a reference can end a sentence.

### Reference forms

The reference is resolved like the `<record>` argument of `inkan status`:

| Form | Example | Notes |
| --- | --- | --- |
| Record id | `sre/adr/0001-define-slos` | The path inside the content folder without `.md`. |
| Short id | `sre/adr/0001`, `sre/adr/1` | Project, type and number; leading zeros optional. |
| Ref | `SRE-ADR-0001` | Case-insensitive. |
| File name | `0001-define-slos` | Matches a record whose id ends with `/0001-define-slos`. |

A reference that matches no record, or more than one (duplicate numbers in a project), is reported during the build:

```text
inkan: services/api/handler.ts:4: "@adr sre/adr/9999" matches no record
```

The build does not fail on it. Records fetched through `sources` can be referenced like local ones.

### What is scanned

- Inside a git repository: the output of `git ls-files --cached --others --exclude-standard`, so tracked and untracked files, minus ignored ones (`node_modules/`, `dist/` when they are in `.gitignore`). Outside git: a walk of the repository root that skips `node_modules`, `dist` and `.git`.
- The content folder (`contentDir`) is never scanned, so a record can mention `@adr` in prose without referencing itself.
- Files above 1 MB and files with a NUL byte in their first 8000 bytes (binaries) are skipped. Files that do not contain the marker at all are not parsed.
- The repository root is the top level of the git repository that holds the config file, or the config folder outside git.

### Options

```ts title="inkan.config.ts"
export default defineConfig({
  codeRefs: {
    include: ['services/**', 'apps/**'],
    exclude: ['**/*.{md,mdx}', '**/*.test.*'],
    marker: '@decision',
  },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `codeRefs` | scan on | `false` turns the scan off; no section, no warnings, empty `codeRefs` in `decisions.json`. |
| `codeRefs.include` | `['**/*']` | Files to scan. A file must match one of the globs. |
| `codeRefs.exclude` | `['**/*.{md,mdx}']` | Files to skip even when included. |
| `codeRefs.marker` | `'@adr'` | The word that starts a reference. |

Globs are matched against the path relative to the repository root with `/` separators. `**` crosses folders, `*` and `?` stay inside one segment, `{a,b}` picks one alternative. A pattern without a `/` matches a file name anywhere in the tree, like `.gitignore`: `*.test.py` skips every test file. Options you leave out keep their defaults, so setting `include` alone still excludes Markdown.

> [!NOTE]
> The sample site in `examples/company-decisions` sets `codeRefs: { include: ['examples/company-decisions/**'] }` so only its own services are scanned. Decide what to include in every repository that keeps code next to its records; scanning a monorepo with the default `**/*` is correct but reads every text file, and markers in test fixtures or vendored code show up as warnings.

### What the record page shows

Below the body and above the "Edit" and "Raw Markdown" buttons, a record with references gets:

```text
Referenced in code  3
  services/api/handler.ts     L1 ↗
  services/jobs/run.py        L1 ↗
  services/jobs/run.test.py   L1 ↗
```

Entries are sorted by file, then line. With `repo.url` set, each entry links to the file and line in the web UI: `<url>/blob/<branch>/<file>#L<line>` for GitHub, `<url>/-/blob/<branch>/<file>#L<line>` for GitLab, with `repo.branch` defaulting to `main`. Without `repo.url` the entries are plain text. The section is excluded from search indexing. Records without references show nothing.

The same list is in `decisions.json` as `codeRefs: [{ "file": "services/api/handler.ts", "line": 1 }]`, with paths relative to the repository root. `llms.txt` and the MCP server do not include it.

## Consequences

- Code and decisions reference each other with one comment and no tooling in the code repository.
- The scan reads the hub's repository only. Code that lives in another repository cannot be listed, even when its records are pulled in through `sources`.
- Line numbers are those at build time. The link points at the current branch, so a file that moved since the last deploy may open at the wrong line until the site is rebuilt.
- A reference to a record that is later renumbered or renamed becomes a warning, not an error. Run the build in CI and read the warnings, or reference records by `ref` (`SRE-ADR-0001`), which survives a rename of the file.
- `git ls-files` includes untracked files, so a scratch file with a marker shows up in a local build but not in CI.
