---
title: "Check records in CI"
description: "What inkan check validates without building the site, how its output and exit codes work, and how the starter CI files run it."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [cli, content, deploy]
related: [authoring/adr/0013-review-rfcs-with-reviewers, cli/adr/0004-validate-config-and-content-at-build-time, authoring/adr/0006-link-records-by-path, authoring/adr/0005-optional-author-directory, cli/adr/0005-change-status-and-supersede-from-the-cli, authoring/adr/0011-review-decisions-on-a-schedule, deploy/adr/0002-github-and-gitlab-pages, authoring/adr/0012-custom-metadata-fields]
---

## Context

The build validates the shape of every record: a `status` outside the configured list or a `date` that is not a date fails it. It does not validate meaning. A `supersedes` entry can point at a record that does not exist, two files in one folder can share a number, a record can carry `supersededBy` while its status still says `accepted`, and an RFC can sit past its `reviewBy` date for months. None of this breaks the HTML, so none of it failed a pull request, and the build itself takes long enough that nobody runs it just to check a link.

## Decision

`inkan check` reads every record directly, without Astro, and runs a fixed set of rules over them. Problems that make the site wrong are errors and set the exit code to 1; problems that make it worse are warnings and only fail with `--strict`. The output names the file and the front matter line, so it reads like a linter. On GitHub Actions each problem is also emitted as an annotation, so it appears inline in the pull request. The CI files that `inkan init` creates run `check` before the build.

## How to use it

### Run it

```bash
npx inkan check
```

```text
decisions/payments/adr/0003-use-stripe.md:9 error supersedes points to "payments/adr/0001-build-our-own-gateway", which does not exist, did you mean "payments/adr/0001-build-our-own-card-gateway"?
decisions/payments/adr/0003-use-stripe.md:6 warning author "jule" is not in _authors.yml, did you mean "jules"?

decisions/sre/_project.yml warning project "sre" has no owners

1 error, 2 warnings (41 records in 7 projects).
```

Each line is `path:line level message`. The path is relative to the folder you run in (or to the site root when the file is outside it), and the line points at the offending front matter key when there is one. Problems are grouped by file. With nothing to report the output is one line: `No problems found (40 records in 7 projects).`

`init` adds `check` to `package.json`, so `npm run check` does the same.

| Option | What it does |
| --- | --- |
| `--strict` | Warnings fail the command too (exit code 1). |
| `--format json` | Prints a JSON report instead of text (see below). |
| `--root <dir>` | Folder with `inkan.config.*`. |

### The rules

Errors (the site would be wrong):

| Rule | What it reports |
| --- | --- |
| `front-matter` | The file has no `---` block, or the block does not parse as YAML. The line of the YAML error is given when known. |
| `title` | The front matter has no `title`. |
| `duplicate-number` | Two files in the same `<project>/<type>/` folder start with the same number. Both files are reported. |
| `status` | `status` is not a key of `statuses`, with a "did you mean" hint or the list of known keys. |
| `date` | `date`, `reviewBy` or `reviewed` is not a date in `YYYY-MM-DD` form. |
| `review-interval` | `reviewEvery`, on a record or in `_project.yml`, is not an interval such as `1 year`, `6 months`, `90 days` or `never`. |
| `reviewers` | An entry of `reviewers` cannot be read, or its state is not `pending`, `approved` or `changes-requested`. |
| `field` | A custom field has an invalid value, or a `required` field has none. See [Custom metadata fields](../../authoring/adr/0012-custom-metadata-fields.md). |
| `project-fields` | `fields` in a `_project.yml` is not a valid set of field definitions, or a field name has two types or units across projects. |
| `missing-record` | An entry of `supersedes`, `supersededBy` or `related` names a record that does not exist, with the closest id of the same project and type as a hint. |

Warnings (the site is incomplete or misleading):

| Rule | What it reports |
| --- | --- |
| `one-sided-supersede` | A `supersedes` entry whose target does not list this record in `supersededBy`, or the other way round. `inkan supersede` writes both sides. |
| `superseded-status` | The record has `supersededBy` but its status is not `superseded` (only when `superseded` is one of your statuses). |
| `unknown-author` | A handle in `authors`, `deciders` or `reviewers` is not an `id` in `_authors.yml`. Only when that file exists; records from a `repo` source are skipped, since their handles belong to another repository. |
| `review-blocked` | The status is a current one (`accepted`, `implemented`, …) while a reviewer still has `changes-requested`. |
| `review-overdue` | `reviewBy` is in the past and the status is still one marked `open`. |
| `review-due` | A decided record's periodic review is past due: its `reviewBy`, or `reviewEvery` after `reviewed` (or `date`), is before today. The message names the command that closes it, `inkan reviewed <record>`. See [Review decisions on a schedule](../../authoring/adr/0011-review-decisions-on-a-schedule.md). |
| `project-file` | A project folder with records has no `_project.yml`. |
| `project-owners` | `_project.yml` has an empty `owners` list. |

Both project rules skip projects that come from `sources`. Reference values are matched the way the site matches them: full id, short id (`sre/adr/3`), reference (`SRE-ADR-0003`) or file path; see [Link records by path](../../authoring/adr/0006-link-records-by-path.md).

### Exit codes

| Situation | Exit code |
| --- | --- |
| No problems, or warnings only | 0 |
| Warnings only, with `--strict` | 1 |
| At least one error | 1 |
| Config does not load, or a `repo` source cannot be fetched | 1, with the message on stderr |

### JSON output

```bash
npx inkan check --format json
```

```json
{
  "ok": false,
  "errors": 1,
  "warnings": 1,
  "records": 41,
  "projects": 7,
  "problems": [
    {
      "level": "error",
      "rule": "missing-record",
      "message": "supersedes points to \"payments/adr/0001-build-our-own-gateway\", which does not exist, did you mean \"payments/adr/0001-build-our-own-card-gateway\"?",
      "file": "decisions/payments/adr/0003-use-stripe.md",
      "line": 9,
      "record": "payments/adr/0003-use-stripe"
    }
  ]
}
```

`ok` is `true` when there are no errors, regardless of warnings. `line` and `record` are absent when they do not apply (a `project-owners` problem has no record). The exit code follows the same rules as the text output, so a script can read the JSON and still rely on the status.

### GitHub Actions annotations

When `GITHUB_ACTIONS=true`, `check` prints one workflow command per problem after the report:

```text
::error file=decisions/payments/adr/0003-use-stripe.md,line=9,title=inkan check (missing-record)::supersedes points to ...
```

GitHub turns these into annotations on the changed files in the pull request. Paths are relative to `GITHUB_WORKSPACE` (or the repository root); files outside the workspace and under `node_modules`, such as fetched sources, get no annotation. GitLab has no equivalent; the job log and the exit code carry the result there.

### In the starter CI files

`inkan init` writes a GitHub workflow and a GitLab pipeline that run `check` before the build on every pull or merge request and on the default branch:

```yaml title=".github/workflows/decisions.yml"
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # full history for "Last updated"
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm install
- run: npx inkan check # broken links, duplicate numbers, unknown statuses … as PR annotations
- run: npm run build
```

```yaml title=".gitlab-ci.yml"
variables:
  GIT_DEPTH: 0 # full history for "Last updated"

build:
  script:
    - npm install
    - npx inkan check
    - npm run build
```

A failing check stops the job before the build runs. Add `--strict` to the step when you want warnings to block merges too. The full history (`fetch-depth: 0`, `GIT_DEPTH: 0`) is for the dates and authors inferred from git, not for `check`. See [GitHub and GitLab Pages](../../deploy/adr/0002-github-and-gitlab-pages.md).

### What it does not check

`check` reads the front matter and the folder layout. It does not render Markdown, so broken relative links in the body, missing images and Mermaid syntax errors are left to the build, and it does not validate `inkan.config.*` beyond loading it (the schema runs on load, so a bad config still fails). Content from `repo` sources is included: missing clones are fetched first, with progress on stderr. See [Validate config and content at build time](0004-validate-config-and-content-at-build-time.md) for what the build covers.

## Consequences

- Reference and numbering mistakes fail a pull request within seconds, with the file and line, and show up inline on GitHub.
- Errors and warnings are separate by design: a project without `owners` should not block a hotfix to a record, but `--strict` is there for repositories that want a clean log.
- The rule set is fixed. There is no configuration to disable one rule; keep the warning level in mind when a rule does not fit your process.
- `check` is a second validator next to the build, with its own messages. The two agree on what a valid status and date are, because both read the same config, but `check` is stricter about dates (the build accepts anything `Date` can parse).
- Records in `repo` sources are checked but cannot be fixed here; the fix goes to the source repository.
