---
title: "Validate config and content at build time"
description: "What Inkan checks in inkan.config and in front matter, how the errors read, and why a bad record fails the build."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [cli, config, content]
related: [cli/adr/0001-ship-as-an-npm-package-with-a-cli, authoring/adr/0003-metadata-in-front-matter, authoring/adr/0004-configurable-status-lifecycle, extending/adr/0001-plugins-with-defineplugin]
---

## Context

A decision log is edited by many people in pull requests, often without running the site locally. Metadata mistakes are quiet: `status: acepted` renders fine but the record never shows up as current, a misspelled config key is ignored and the feature "does not work". With a static site there is exactly one moment where every file is read, the build, so that is where mistakes must be caught, with messages that name the file and the field.

## Decision

Inkan validates two things and stops on the first problem:

- **The config file**, with a zod schema in which every key is optional and unknown keys are rejected. Each unknown key gets a "did you mean" hint. Plugins are the exception: unknown keys on a plugin are kept, because a newer plugin may carry more, but each one is reported as a warning.
- **Content metadata**: the front matter of every record and page, every `_project.yml` and `_authors.yml`, through Astro content collections with zod schemas. `status` is an enum built from the keys of `statuses` in your config, so the allowed values are exactly the ones you defined. A failure stops `inkan build` with a non-zero exit code, which fails the pull request check.

## How to use it

### Config errors

Run `inkan dev` or `inkan build`. The config is validated before anything else. A broken config looks like this:

```text
Invalid inkan config:
  inkan.config.ts: titel: unknown option, did you mean "title"?
  inkan.config.ts: repo.provder: unknown option, did you mean "provider"?
  inkan.config.ts: theme.default: expected one of "system"|"light"|"dark"
  inkan.config.ts: contentDir: must not be empty
```

What is checked:

| Check | Example message |
| --- | --- |
| The default export is an object | `inkan.config.ts: the default export must be an object (use defineConfig({ ... }))` |
| No unknown keys, at any depth (`repo`, `theme`, `footer`, `landing`, `search`, `statuses.*`, `docTypes.*`, `navigation[]`, `head[]`) | `landing.action: unknown option, did you mean "actions"?` |
| Types of every value, enums for `repo.provider`, `theme.default` and `landing.actions[].variant` | `repo.provider: expected one of "github"\|"gitlab"` |
| `contentDir`, `templatesDir` and `pagesDir` are not empty strings | `pagesDir: must not be empty` |
| `plugins[].config` is a function | `plugins.0.config: expected a function` |
| `plugins[].motifs` maps names matching `/^[a-z][a-z0-9-]*$/` to a non-empty path or `URL` | `plugins.0.motifs.Stamp: motif names use lowercase letters, digits and dashes and start with a letter` |
| `search` matches the chosen provider: `type` is one of five values, that provider's keys are present and no others | `search.type: type must be one of pagefind, algolia, meilisearch, typesense, custom`, `search.apiKey: unknown option`, `search.host: expected string, received undefined` |
| `sources[]`: `project` is a folder name (letters, digits, `-`, `_`), exactly one of `repo` or `dir` is set, `branch` and `provider` only with `repo`, and `repo`, `branch` and `path` do not start with `-` (`path` is relative and inside the source) | `sources.0: set exactly one of repo or dir`, `sources.0.branch: only applies to repo sources`, `sources.0.path: must be a relative path inside the source` |
| `git` has only `dates` and `authors`, both booleans | `git.date: unknown option, did you mean "dates"?` |
| `codeRefs` is `false` or an object with `include` and `exclude` (string arrays) and `marker` (string) | `codeRefs.includes: unknown option, did you mean "include"?` |
| `export` has only `statuses` (string array) and `title` | `export.status: unknown option, did you mean "statuses"?` |
| After plugin `config` hooks ran: `head` and `navigation` still have the right shape, and `search` is still a valid provider | `Invalid inkan config after plugin hooks: ...` |

The hint is the closest known key at that position, measured by edit distance; a key that is nowhere near anything known gets no hint. `$schema` is accepted at the top level of any config and dropped, so a JSON config can point an editor at a schema.

Unknown keys on a plugin do not fail the build. They are printed once at load time:

```text
inkan: plugin "acme": unknown key "remarkPlugin"
```

The known plugin keys are `name`, `config`, `remarkPlugins`, `rehypePlugins`, `vitePlugins`, `integrations`, `pages`, `motifs`, `head` and `navigation`. See [Plugins with definePlugin](../../extending/adr/0001-plugins-with-defineplugin.md).

### Front matter errors

Every `.md` and `.mdx` file in `contentDir` is parsed against the record schema. The schema is in `app/src/content.config.ts` and documented field by field in the [front matter reference](../../front-matter.md). The rules in short:

- `title` is required and a string.
- `status`, when present, must be one of your configured statuses. With the defaults: `draft`, `proposed`, `in-review`, `accepted`, `implemented`, `rejected`, `withdrawn`, `deprecated`, `superseded`.
- `date`, `reviewBy` and `reviewed` must be dates; `reviewEvery` must be an interval (`1 year`, `6 months`, `90 days`) or `never`, on records and in `_project.yml` alike.
- `authors`, `deciders`, `tags`, `supersedes`, `supersededBy` and `related` are lists of strings; a single string is accepted and wrapped.
- `order` is a number, `draft` a boolean.

A bad record stops the build. Astro prints the collection, the file and the field, for example a `status: acepted` is reported as an invalid enum value for `status` in `decisions/sre/adr/0002-error-budget.md`, together with the allowed values. Fields that the schema does not know are dropped silently, so a `Status:` with a capital letter is not an error; it is simply not a status. Watch the sticker on the record to confirm.

`_project.yml` and `_authors.yml` are validated the same way: `name` is required in both, `ink` must be one of the six ink letters, and a `links[].url` must start with `http://`, `https://` or `/`. `motif` is checked once all projects are read: a name that is neither built in nor registered by a plugin fails the build with `project "sre": unknown motif "ring", did you mean "rings"? (available: ...)`. A plugin motif whose module does not exist fails at config load with `plugin "acme" motif "stamp": module not found: ...`.

> [!WARNING]
> Changing `statuses` or `docTypes` in the config changes what is valid. When you remove `in-review` from `statuses`, every record that still uses it fails the next build. That is deliberate: a status that is not in the lifecycle must not sit on a record unnoticed.

### Page and route conflicts

The build also fails when two things would be served at the same URL: a project folder named like a built-in page (`decisions`, `tags`), two project folders with the same slug (`Ops Plans/` and `ops-plans/`), a root-level `about.md` next to a project folder `about/`, or a page in `pagesDir` or from a plugin that shadows a record, a redirect or a built-in page. Dynamic pages such as `guides/[slug].astro` only warn. A plugin page whose `entrypoint` file does not exist fails as well.

### Running it in CI

The workflow and pipeline that `inkan init` creates run `npm run build` on every pull or merge request, so a bad record cannot be merged. Without them, a minimal check is:

```yaml title=".github/workflows/decisions.yml"
- run: npm install
- run: npm run build
```

The build exits with code 1 on the first error. Fix it and run again; errors are reported one file at a time.

### Checking without building the site

`inkan check` validates what the build cannot see: references in `supersedes`, `supersededBy` and `related` that point nowhere, duplicate numbers, one-sided supersede links, unknown authors, overdue reviews and projects without `_project.yml` or `owners`. It reads the files directly, takes seconds and reports `path:line level message`. It also catches front matter that does not parse, a missing `title`, an unknown status and a malformed date, with the same config the build uses. The CI files from `init` run it before the build. See [Check records in CI](0007-check-records-in-ci.md).

The config alone can be checked programmatically with `validateConfig` from `inkan/lib/config.mjs`, which throws an error with one line per problem; this is what the test suite of the package uses.

## Consequences

- Typos in the config and in `status` are found at build time, with the file and the key named. Nothing silently does nothing, except unknown front matter fields.
- The status list is a closed enum per site. That is what makes the backlog, the "current" flag and the stickers reliable, at the cost of a build failure when the list changes.
- Plugins can carry keys the core does not know, so a plugin written for a newer version loads on an older one with a warning instead of an error.
- Build-time validation covers shape, not meaning. A `supersedes` path that points at a record that does not exist, a duplicate number or a missing `owners` entry passes the build; `inkan check` is the second step that catches them.
- Front matter fields outside the schema are dropped without a warning. A misspelled field name such as `author:` instead of `authors:` is the one class of typo the build does not catch.
