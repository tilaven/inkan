---
title: "Show status history from git"
description: "Every record page lists its status changes from git history: the new status, date, author and a link to the commit, read with one git log per repository, with git.history to turn it off."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [site, content, config]
options: [git.history]
related: [authoring/adr/0009-fill-date-and-authors-from-git, authoring/adr/0004-configurable-status-lifecycle, cli/adr/0005-change-status-and-supersede-from-the-cli]
---

## Context

A record shows its current `status` and nothing else about how it got there. When a proposal became accepted, who marked it implemented and when it was deprecated are questions the page cannot answer, although every one of those changes is a commit that edited the `status:` line. Readers open the repository's history view and look for the right diff by hand.

The site already reads git for the "Last updated" date of every page and for inferred dates and authors, see [Fill date and authors from git](../../authoring/adr/0009-fill-date-and-authors-from-git.md). The status history is one more query against the same repositories, with the same rules for authors and shallow clones.

## Decision

Every record page gets a "History" section under the body, above the footer actions. It lists each change of the front-matter `status`, newest first, with the new status, the author date of the commit, the author mapped to a handle through `_authors.yml`, and the short commit SHA linking to the commit on GitHub or GitLab. The first entry is the first commit in which the file has a `status`, usually the one that added it. Entries are ordered by author date, and commits on both sides of a merge count. The section is on by default and `git: { history: false }` turns it off.

The data comes from one `git log -G'^status:'` and one `git cat-file --batch` per repository and build, not from one call per file. Shallow clones are skipped with the same warning as date and author inference.

## How to use it

### Nothing to configure

Build inside the repository. A record whose file was added as `proposed`, later accepted and then implemented shows:

| Status | Date | By | Commit |
| --- | --- | --- | --- |
| implemented | 2026-03-02 | ania | `9f3c1e2` |
| accepted | 2026-02-11 | ania | `4b7d0a8` |
| proposed | 2026-01-28 | ania | `c21e9d4` |

The status is rendered with its sticker and label from the lifecycle, see [Configurable status lifecycle](../../authoring/adr/0004-configurable-status-lifecycle.md). An unknown status value in an old commit is shown as written; a commit that removed the line shows "No status". An author found in `_authors.yml` is shown by name and links to the index filtered by that author.

### What counts as a change

| Commit | Listed |
| --- | --- |
| Adds the file with a `status` | Yes, as the first entry. A file added without one starts at the commit that sets it. |
| Changes the value of `status:` | Yes. |
| Touches the `status:` line without changing the value (reformatting, moving the line) | No. |
| Leaves front matter that does not parse | No; the next valid commit is compared with the last listed status. |
| Edits the file without touching `status:` | No. |
| Renames or moves the file | History restarts: the move is the first entry of the new path. |

The log runs without `--follow`, as the one in 0009 does, so a renamed record loses the entries from before the move. Dates and statuses from before a move stay in git; the page shows the part under the current path.

### Commit links

When `repo.url` is set (see [Header, banner, footer and redirects](0006-header-banner-footer-and-redirects.md)) and the file is in the hub's own repository, the short SHA links to the commit on GitHub or GitLab, anchored to the diff of that file. Without `repo.url`, or for a file in another repository (a `dir` source outside the hub's repository), the SHA is plain text.

### Who made the change

The commit author becomes a handle with the lookup from [Fill date and authors from git](../../authoring/adr/0009-fill-date-and-authors-from-git.md#mapping-a-commit-author-to-a-handle): `email` in `_authors.yml` first, then handle, name or `github` / `gitlab` login, then the noreply address forms. A commit that matches nothing shows the git user name. Add the person to `_authors.yml` with their `email` to fix it for every entry at once.

### Options

```ts title="inkan.config.ts"
export default defineConfig({
  git: { history: false },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `git.history` | `true` | Read status changes from git and render the "History" section. `false` removes the section and leaves `history` empty in `decisions.json`. |

`git.history` sits next to `git.dates` and `git.authors`. Unknown keys under `git` still fail the config validation.

### Shallow clones, CI and other repositories

The same shallow-clone rule applies: in a shallow clone no history is read, the section is left out and the build prints the one-time warning from 0009 for that repository (it names dates, authors and status history together). The CI files that `inkan init` creates fetch the full history (`fetch-depth: 0`, `GIT_DEPTH: 0`), so a pipeline made from them shows the history.

Records from `sources` behave as for inference. A `dir` source is read from the repository it lives in and gets a history; it gets commit links only when that is the hub's repository, because `repo.url` names the hub's repository. A `repo` source is a shallow clone made by `inkan sync` and has no history, see [Records from other repositories](../../deploy/adr/0005-records-from-other-repositories.md).

### decisions.json

Each record in `decisions.json` carries a `history` array, oldest first, so a script can read the lifecycle without the HTML:

```json title="decisions.json (one record, excerpt)"
"history": [
  { "status": "proposed", "date": "2026-01-28T09:12:40.000Z", "author": "ania", "commit": "c21e9d4f6a0b3e5d8c7a1b2f4e6d8c0a9b7e5d3c", "url": "https://github.com/acme/decisions/commit/c21e9d4f6a0b3e5d8c7a1b2f4e6d8c0a9b7e5d3c#diff-..." },
  { "status": "accepted", "date": "2026-02-11T15:03:11.000Z", "author": "ania", "commit": "4b7d0a8...", "url": "https://github.com/acme/decisions/commit/4b7d0a8...#diff-..." },
  { "status": "implemented", "date": "2026-03-02T08:45:02.000Z", "author": "ania", "commit": "9f3c1e2...", "url": "https://github.com/acme/decisions/commit/9f3c1e2...#diff-..." }
]
```

`date` is the full author timestamp, `commit` the full hash (the page shows the first seven characters), `url` is `null` when there is no link and `status` is `null` for a commit that removed the `status:` line. A record without history (shallow clone, outside git, `repo` source) has an empty array. The rest of the file is described in [decisions.json](../../ai/adr/0002-decisions-json.md).

### Changing the status

`inkan status <record> <status>` edits the front matter in place, see [Change status and supersede from the CLI](../../cli/adr/0005-change-status-and-supersede-from-the-cli.md). The edit shows up in the history once it is committed; an uncommitted change has no entry, and `dev` keeps showing the committed history until then.

### Replacing the section

The section is the component `RecordHistory`, with the record as `d: Decision`, and can be replaced through `components`, see [Override components and fill slots](../../extending/adr/0002-override-components-and-fill-slots.md). Its content is excluded from the Pagefind index, so author names and commit SHAs do not turn up as search hits.

> [!NOTE]
> The section is rendered only when a record has at least one entry. Turning `git.history` off, a shallow clone and a build outside git all leave the page without a "History" heading rather than with an empty one.

## Consequences

- The lifecycle of a record is visible on its page and in `decisions.json` without editing the record or keeping a changelog in the body.
- The build depends on history, as inference does. A `--depth 1` clone builds the same site without the section.
- Two git processes per repository and build, regardless of the number of records. The cost grows with the size of the history, not with the number of files.
- A squash-merged pull request attributes the change to the pull request author, not to the person who approved or merged it.
- A rename restarts the history. Move records rarely, or accept that the entries before the move are reachable only through git.
- A commit that changes the status of many records at once, such as a migration, appears in every one of them with the same author and date.
- Reformatting the `status:` line is invisible; changing its value is not. There is no way to change a status "quietly" short of rewriting history.
