---
title: "Fill date and authors from git"
description: "When a record omits date or authors, the site takes them from the commit that added the file: what is inferred, how git authors become handles, and why shallow clones are skipped."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [content, config, cli]
options: [git.dates, git.authors]
related: [authoring/rfc/0001-fill-date-and-authors-from-git, authoring/adr/0003-metadata-in-front-matter, authoring/adr/0005-optional-author-directory, site/adr/0013-status-history-from-git]
---

## Context

A record without `date` sorts last on the record index and the timeline, and a record without `authors` has no author on its page and is missing from the authors page. Both fields are easy to forget in a pull request, and both are already in git history. Teams that import hundreds of records from another tool have neither field in most files. The site already runs git for the "Last updated" date of every page, so the creation date and the first author are one more field of the same `git log`.

This ADR implements the proposal in [Fill date and authors from git](../rfc/0001-fill-date-and-authors-from-git.md). The option names differ from the RFC: the config key is `git`, not `inferDate` / `inferAuthors`.

## Decision

Front matter stays the source of truth. When a record has no `date`, the site uses the author date of the commit that added the file. When a record has no `authors`, the site uses the author of that commit, mapped to a handle through `_authors.yml`. Both are on by default and can be switched off separately with `git: { dates: false, authors: false }`.

The history comes from one `git log` per repository and build, not from one call per file. Shallow clones are skipped with a warning, because their oldest visible commit is not the commit that added the file.

## How to use it

### Nothing to configure

Commit a record without `date` or `authors`:

```yaml title="decisions/sre/adr/0004-alert-on-burn-rate.md"
---
title: Alert on burn rate
status: accepted
tags: [alerting]
---
```

On a build inside the repository, the page shows the date and author of the first commit that added the file. The inferred values are used everywhere the site reads them: the record header, the index and its filters, the timeline, the authors page, the RSS feed, `decisions.json`, `llms.txt` and the export document.

### What is inferred

| Field | Front matter present | Absent, file in git | Absent, outside git or shallow clone |
| --- | --- | --- | --- |
| `date` | Used as written. | Author date (`%at`) of the commit that added the file. | Unset: sorts last, no date shown. |
| `authors` | Used as written. | The handle matched to that commit's author, see below. | Empty. |

Only the commit that added the file counts; later edits never change the date or add authors. `deciders`, `tags` and every other field are never inferred. A file that is renamed or moved counts as a new file (the log runs with `--no-renames`), so its date becomes the date of the move. Keep an explicit `date` in records you plan to move.

An empty list is the same as a missing field: `authors: []` is inferred too. To state "no authors" for one record, turn inference off for the site.

### Options

```ts title="inkan.config.ts"
export default defineConfig({
  git: { dates: true, authors: false },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `git.dates` | `true` | Fill a missing `date` from the first commit. |
| `git.authors` | `true` | Fill missing `authors` from the first commit's author. |

Unknown keys under `git` fail the config validation.

### Mapping a commit author to a handle

A commit carries a name and an e-mail; records use handles. The lookup walks the entries of `_authors.yml` in this order and stops at the first match. Comparisons ignore case and surrounding spaces.

1. An entry whose `email` equals the commit e-mail. `email` is a new optional field of the directory, see [Optional author directory](0005-optional-author-directory.md).
2. An entry whose handle, `name`, `github` or `gitlab` equals the commit's user name.
3. For a `users.noreply.github.com` address, an entry whose handle or `github` equals the login part (`12345+login@` loses the number).
4. For a `noreply.gitlab.com` address, the same with `gitlab`.
5. No match: the commit's user name is used as the handle, or the e-mail when the name is empty.

Step 5 produces a value like `Ania Kowal` instead of `ania`. The site shows it as any unknown handle, with its own filter and authors-page entry. The fix is to add the person to the directory with their `email`:

```yaml title="decisions/_authors.yml"
- id: ania
  name: "Ania Kowal"
  email: ania.kowal@acme.dev
  github: aniakowal
```

> [!TIP]
> Commits made through the GitHub web editor use a `users.noreply.github.com` address, so a `github` login in the directory is enough to match them.

### How it looks

An inferred value is rendered like a stated one. The `<dd>` element in the record header carries `data-inferred="date"` or `data-inferred="authors"` and the tooltip "From git history", which a custom stylesheet can use to mark it. `decisions.json` and `llms-full.txt` carry the inferred values without a flag.

### Shallow clones and CI

The history is read with `git rev-parse --is-shallow-repository` first. In a shallow clone nothing is inferred and the build prints once per repository:

```text
inkan: /path/to/repo is a shallow clone, so dates, authors and status history are not inferred from git (fetch the full history, e.g. fetch-depth: 0 or GIT_DEPTH: 0)
```

The CI files that `inkan init` creates already fetch the full history: `fetch-depth: 0` on `actions/checkout` and `GIT_DEPTH: 0` in `.gitlab-ci.yml`. Add the same to a pipeline you wrote yourself.

### Records from other repositories

Records pulled in through `sources` behave in two ways. A `dir` source is read from its own repository, with the same rules. A `repo` source is a shallow clone made by `inkan sync`, so its records are never inferred; write `date` and `authors` in those files. The warning above is not printed for them.

### Which folders are read

One `git log` runs per repository over the content folder, the pages folder and every `dir` source. Repositories are found with `git rev-parse --show-toplevel` for each folder, so the content folder may live in a different repository than the config file. The same log feeds the "Last updated" date of every page, which comes from the committer date of the last commit touching the file. A second log over the same repositories feeds the "History" section of every record, see [Show status history from git](../../site/adr/0013-status-history-from-git.md).

## Consequences

- Imported and hand-written records get a date and an author without editing hundreds of files.
- The build depends on history. A fresh clone with `--depth 1` builds the same site minus inferred values, and a build outside git shows none of them.
- The date of the first commit is not always the date of the decision. Write `date` when the two differ.
- A squash-merged pull request has the pull request author as the commit author, so that is who is inferred. Migration commits by a bot make the bot the author of every record they add; map its e-mail to a handle or write `authors` in the imported files.
- Renames reset the date. There is no `--follow`, because it would cost one git call per file.
- Inference is per site, not per record: there is no front matter value that means "no authors, do not ask git".
