---
title: "Optional author directory"
description: "How _authors.yml turns handles into names, teams and profile links, and why records work without it."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, config, navigation]
related: [authoring/adr/0003-metadata-in-front-matter, authoring/adr/0009-fill-date-and-authors-from-git, site/adr/0004-authors-and-tags-pages]
---

## Context

Records name their authors, and the site builds an authors page and author filters from those names. Writing "Anna Lis" in one file and "anna.lis" in another splits one person in two. A central list fixes that, but demanding one before the first record can be written is a barrier, and it must not break when a new colleague commits a record before being added.

## Decision

`authors`, `deciders` and `owners` hold short handles. An optional `_authors.yml` at the root of the content folder maps a handle to a display name, a team and profile links. The site works without the file and with handles that are missing from it: an unknown handle is displayed as written and still gets its own filter and authors-page entry.

## How to use it

### The file

```yaml title="decisions/_authors.yml"
- id: ania
  name: "Ania Kowal"
  team: sre
  email: ania.kowal@acme.dev
  github: aniakowal
- id: jules
  name: "Jules Marchand"
  team: Payments
  gitlab: jmarchand
  avatar: https://avatars.example/jules.png
```

It is a YAML list; `id` is the handle used in front matter. Files whose name starts with `_` are never pages, so the directory does not show up in the sidebar.

| Field | Required | What it does |
| --- | --- | --- |
| `id` | yes | The handle. Must match `authors`, `deciders` and `owners` values exactly (case-sensitive). |
| `name` | yes | Display name in record headers, cards, the team page and the authors page. Initials for avatars are derived from it. |
| `email` | no | Git author e-mail. Commits with this e-mail map to the handle when `authors` is filled from git history. Not shown on the site. |
| `team` | no | Project id or project name, matched case-insensitively. Links the person to that team page and colours their avatar ring with the team's ink. |
| `github` | no | GitHub user name. Adds a "GitHub @name" link on the authors page. |
| `gitlab` | no | GitLab user name. Adds a "GitLab @name" link when `github` is absent. |
| `avatar` | no | Image URL shown on the authors page instead of initials. |

A missing `name` or a wrong type fails the build with the handle and the field. Fields outside this list are ignored.

### Using handles

```yaml
authors: [ania, jules]
deciders: [marek]
```

```yaml title="decisions/sre/_project.yml"
owners: [marek, ania]
```

Handles are matched by string. Pick one convention (first name, `first.last`, GitHub login) and stick to it; the directory does not merge aliases.

### Unknown handles

A handle that is not in the directory, or any handle when there is no `_authors.yml` at all, is shown as the raw string: `piotr.nowak` in the header, `PN` as initials. It appears in the author filter and on the authors page like everyone else. Nothing fails. Add the person to the directory later and every record updates on the next build.

### Where the directory is used

- Record header: author and decider names with initials, each linking to `/decisions/?author=<handle>`.
- Record cards and the backlog: stacked initials, ringed in the author's team ink.
- Team page: owners with avatars and names.
- `/authors/`: one card per person with name, team (linked to the team page when it matches a project), profile link, counts of authored and decided records, and the list of their records. People who are in the directory but have written nothing are listed too; the page is sorted by number of records, then name.
- `decisions.json` and `llms-full.txt` keep the raw handles, so agents can join them with your own HR data.

### Writing the author of a new record

`inkan new` fills `authors` with `--author <handle>` or, without the flag, with `git config user.name`. The git name is usually "First Last", not a handle, so pass `--author` or edit the file:

```bash
npx inkan new adr sre "Alert on burn rate" --author ania
```

### Records without authors

A record whose front matter has no `authors` gets the author of the commit that added the file. The commit's e-mail is compared with `email`, then its user name with the handle, `name`, `github` and `gitlab`, then a GitHub or GitLab no-reply address with the matching login. Without a match the git user name is used as the handle, which looks like `Ania Kowal` in the header and on the authors page. Adding `email` to the directory entry fixes this for every record on the next build. Details and the `git` option are in [Fill date and authors from git](0009-fill-date-and-authors-from-git.md).

## Consequences

- Zero setup: a repository with records and no directory is a valid site.
- Consistency depends on people typing the same handle. The build does not warn about a handle that is close to a known one.
- Only one profile link is shown per person; `github` wins over `gitlab`.
- Team matching reuses project ids and names, so a team that has no project folder gets a plain text label and no ink.
