---
title: "Fill date and authors from git"
description: "A proposal to default a record's date and authors to the first commit that added the file when front matter leaves them out."
status: accepted
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, cli]
related: [authoring/adr/0009-fill-date-and-authors-from-git, authoring/adr/0003-metadata-in-front-matter, authoring/adr/0005-optional-author-directory]
---

Accepted and implemented: see [Fill date and authors from git](../adr/0009-fill-date-and-authors-from-git.md).

## Summary

When a record has no `date` or no `authors` in its front matter, take them from git: the date of the first commit that added the file, and the author of that commit mapped to a handle. The front matter stays the source of truth; git only fills gaps. The idea is borrowed from log4brains.

## Motivation

Today a record without `date` sorts last on the record index and the timeline, and a record without `authors` shows no author and is missing from the authors page. Both fields are easy to forget in a pull request, and both already exist in git history with better accuracy than a hand-typed value. Teams migrating from a tool that inferred them from git have hundreds of files without either field.

The site already runs git for related data: the "Last updated" footer of a page comes from `git log -1` on the file, and `inkan new` reads `git config user.name` to fill the template. Extending that to creation date and author is a small step.

## Proposal

### Behaviour

| Field | Front matter present | Front matter absent, inside git | Absent, outside git |
| --- | --- | --- | --- |
| `date` | Used as written. | Author date of the first commit that added the file. | Unset, as today. |
| `authors` | Used as written. | Handle of the first commit's author, see mapping below. | Empty, as today. |

Only the *first* commit counts. Later edits do not change the date and do not add authors; `deciders`, `tags` and the other fields are never inferred.

### Mapping a commit author to a handle

The commit carries a name and an email, while records use handles. The lookup order:

1. An `_authors.yml` entry whose new optional `email` field matches the commit email.
2. An entry whose `github` or `gitlab` field matches the local part of a `users.noreply.github.com` or `noreply.gitlab.com` address.
3. The commit's user name, as `inkan new` uses it today.

The third step produces values like "Ania Kowal" rather than `ania`. That is accepted as a fallback; the fix is to add the person to the directory.

### Where it runs

In the content loader, when the collection is built. A build inside a shallow clone (`fetch-depth: 1`, the default of `actions/checkout`) sees only one commit for every file, so the inferred date would be the date of the latest commit. The CI templates created by `inkan init` would set `fetch-depth: 0`, and the build would print one warning when the repository is shallow.

### Making it visible

Inferred values are shown like any other value, with a small "from git" marker in the record header, so a reader knows the date was not stated. The raw Markdown and `decisions.json` would carry the inferred values too, with a boolean `inferred` field in the JSON.

### Opting out

```ts title="inkan.config.ts"
git: { inferDate: false, inferAuthors: false },
```

Both default to `true` once the feature ships. A record can also opt out per field with an explicit empty value: `authors: []` means "no authors", not "ask git".

## Open questions

- [ ] Should a record that is moved with `git mv` keep its original date? `git log --follow` does this but is slow on large repositories; one call per file at build time may be acceptable, one per file on every dev reload may not.
- [ ] Is the author of the first commit the right person? A squash-merged pull request has the merger as committer and the author as author; using the author date and author name seems right, but a bot that opens migration PRs would become the author of hundreds of records.
- [ ] Should inferred values be written back into the file by a CLI command (`inkan metadata --write`), so the repository stays the single source and the build stays pure? This would make the build-time inference a transition tool rather than a permanent feature.
- [ ] Does the date of the first commit match what teams mean by `date`? For an ADR it is usually the day of the decision, which may be weeks before the file was committed.
