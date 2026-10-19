---
title: "Number records with inkan new"
description: "How inkan new picks the next number, builds the file name, fills a template and creates a project folder when needed."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [cli, content, markdown]
options: [templatesDir]
related: [authoring/adr/0002-record-type-comes-from-the-folder, authoring/adr/0003-metadata-in-front-matter, authoring/adr/0001-one-folder-per-project, authoring/rfc/0001-fill-date-and-authors-from-git, authoring/adr/0012-custom-metadata-fields]
---

## Context

Records are numbered files, `0007-use-kafka.md`, and the number is part of how people refer to them (`PLATFORM-ADR-0007`). Finding the next free number by hand means listing a folder and counting; two people doing that on the same day get a conflict. Each record also starts from the same skeleton, with today's date and the author's handle, which nobody wants to type again. log4brains and adr-tools both solved this with a `new` command, and users expect one.

## Decision

`inkan new <type> <project> "<title>"` creates the next numbered record of a type inside a project from a template. The number is one more than the highest number already in that folder. The file name is the number padded to four digits plus a slug of the title. The template comes from your `templatesDir` when it has a file for that type, otherwise from the package. If the project folder has no `_project.yml` yet, the command creates a minimal one so the project appears on the site with a name. An existing folder can be named by its slug: `inkan new adr ops-plans "…"` writes into `Ops Plans/`.

## How to use it

### The command

```bash
npx inkan new adr platform "Move the event bus to Kafka"
# Created decisions/platform/adr/0010-move-the-event-bus-to-kafka.md

npx inkan new rfc payments "Settle in async batches" --author jules
```

With the npm script that `init` adds: `npm run new -- adr platform "Move the event bus to Kafka"`.

| Argument | Meaning |
| --- | --- |
| `<type>` | A key of `docTypes`: `adr` or `rfc` by default, or a type you added in the config. Any other value lists the known types and exits with code 1. |
| `<project>` | The project folder inside `contentDir`. It does not have to exist yet. |
| `"<title>"` | The title. Everything after the project is joined with spaces, so quotes are optional unless the title contains shell characters. |
| `--author <handle>` | Handle written into the `{{author}}` placeholder. Default: the `_authors.yml` handle that matches the repository's Git user (by e-mail, then name), else `git config user.name`, or empty outside Git. |
| `--root <dir>` | Folder with the config, as for every command. |

### Numbering

The command reads the folder `<contentDir>/<project>/<type>/`, takes the leading digits of every file name and adds one to the largest. An empty or new folder starts at `0001`. Numbers are per project and per type, so `sre/adr/0003` and `sre/rfc/0003` are different records, and gaps are allowed: deleting `0005` does not renumber anything, and the next record after `0004` and `0009` is `0010`. Numbers are padded to four digits.

The site derives the number from the file name the same way, so a record you create by hand with a correct name is indistinguishable from one created by the command. See [Record type comes from the folder](../../authoring/adr/0002-record-type-comes-from-the-folder.md).

### The slug

The title is lowercased, accents are stripped (`é` to `e`, `ł` to `l`), every run of characters that is not `a-z` or `0-9` becomes one `-`, and leading or trailing hyphens are removed:

| Title | File |
| --- | --- |
| `Use PostgreSQL for the ledger` | `0001-use-postgresql-for-the-ledger.md` |
| `Zażółć gęślą jaźń: v2` | `0002-zazolc-gesla-jazn-v2.md` |
| `  Error budget (draft)  ` | `0003-error-budget-draft.md` |

### Templates and placeholders

Templates are Markdown files named after the type: `adr.md`, `rfc.md`, `postmortem.md`. The package ships `adr.md` and `rfc.md`. Your own templates live in `templatesDir` (default `templates/`, relative to the config file); a file there with the same name replaces the built-in one, and types without a file fall back to the package's. A type with no template at all gets a three-line front matter with `title`, `date` and `authors`.

Three placeholders are replaced everywhere in the template:

| Placeholder | Value |
| --- | --- |
| `{{title}}` | The title. When it contains `:` or `#` it is written as a quoted JSON string, so the YAML stays valid. |
| `{{date}}` | Today's date as `YYYY-MM-DD` (the local calendar day). |
| `{{author}}` | `--author`, or the handle matched from the Git user, or the Git user name, or empty. Quoted when it would not survive inside `[...]`, e.g. `"Doe, John"`. |

The built-in ADR template:

```md title="templates/adr.md"
---
title: {{title}}
description: One sentence that says what was decided.
status: proposed
date: {{date}}
authors: [{{author}}]
deciders: []
tags: []
---

## Context

What is the problem and why does it need a decision now?

## Options considered

1. **Option A**: …
2. **Option B**: …

## Decision

What we will do.

## Consequences

What becomes easier or harder because of this decision.
```

The built-in RFC template starts with `status: draft` and has the sections Summary, Motivation, Proposal, Alternatives and Open questions. To use your own, copy a built-in file into `templates/` and edit it:

```text
templates/
  adr.md          replaces the built-in ADR template
  postmortem.md   template for a custom type from docTypes
```

> [!TIP]
> The same templates feed the "New ADR" and "New RFC" buttons on every team page when `repo` is configured. The button opens your repository's web editor with the next number in the file name and the template as content, so people without a checkout can start a record too.

### Automatic `_project.yml`

When `<contentDir>/<project>/_project.yml` does not exist, the command writes one before creating the record:

```yaml title="decisions/payments/_project.yml"
name: payments
description:
owners: []
```

It prints a reminder to fill in the details. The folder name is the id used in URLs; `name` is only the display name, so set it to `Payments`. See [One folder per project](../../authoring/adr/0001-one-folder-per-project.md) and the fields in the [front matter reference](../../front-matter.md).

### Author handles

Without `--author`, the command looks the Git user up in `_authors.yml`: an entry whose `email` matches `git config user.email`, or whose handle, `name`, `github` or `gitlab` matches `git config user.name`, gives its handle, so `Jane Doe <jane@example.com>` becomes `authors: [jane.doe]`. Without a match the Git user name is written as it is, for example `Jane Doe`, and `inkan check` reports it as an unknown author; pass `--author jane.doe` or edit the line after creation. The [RFC on filling date and authors from git](../../authoring/rfc/0001-fill-date-and-authors-from-git.md) discusses the same matching for `date` and `authors` at build time.

Custom fields that have a `default` are written into the new record's front matter. See [Custom metadata fields](../../authoring/adr/0012-custom-metadata-fields.md).

## Consequences

- The next number is always right for the folder you have checked out. Two branches that both add `0010` still conflict at merge time; the build does not notice, but `inkan check` reports the clash as a `duplicate-number` error, so the CI check from `init` catches it on the merged branch. See [Check records in CI](0007-check-records-in-ci.md).
- Templates are plain Markdown with three placeholders. There is no templating language, no conditionals and no per-project template.
- The command needs the config to know `contentDir`, `templatesDir` and `docTypes`, so it must run in the folder with `inkan.config.*` or with `--root`.
- The slug only keeps ASCII letters and digits. Titles in scripts without a Latin transliteration produce very short slugs; rename the file if you need to, the number is what matters.
- Nothing is renumbered or renamed afterwards. Changing a title later leaves the file name as it was, which keeps links stable.
