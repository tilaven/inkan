---
title: "Authors and tags pages"
description: "The /authors/ and /tags/ pages: who is listed, where names, teams and profile links come from, and how both pages feed the filterable index."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, navigation, content]
related: [authoring/adr/0005-optional-author-directory, authoring/adr/0003-metadata-in-front-matter, site/adr/0002-filterable-record-index]
---

## Context

People and topics are the two ways readers remember a decision when they do not remember its number: "the thing Marek wrote about Kafka". The archive has that data in every record's `authors`, `deciders` and `tags`. It should not require a second place to keep a list of people or an approved vocabulary of tags; such lists go stale the week after they are written.

## Decision

Inkan derives two directory pages from the front matter: `/authors/` lists everyone named as an author or decider, `/tags/` lists every tag in use. Both pages are indexes into the filterable record list: a name links to `/decisions/?author=<handle>`, a tag to `/decisions/?tag=<tag>`. An optional `_authors.yml` adds display names, teams, avatars and profile links, but is never required.

## How to use it

### Authors

Name people by handle in the front matter. The handle is the key used everywhere: filters, the authors page, avatars.

```yaml
---
title: Use Stripe as the primary payment provider
authors: [piotr.nowak]
deciders: [tomasz.wojcik, anna.kowalska]
---
```

`/authors/` then lists every handle that occurs in an `authors` or `deciders` list, plus everyone in `_authors.yml`, busiest first (by number of records, then by name). Each entry shows:

- the avatar: the `avatar` image from the directory, or initials built from the name;
- the name, linking to the pre-filtered index;
- the team, linking to the team page when it matches a project;
- `N authored · M decided`;
- a GitHub or GitLab profile link when the directory has one;
- the five newest records the person authored or signed off, with their status stickers;
- when there are more, a `See N more records` link to `/decisions/?author=<handle>`, which lists all of them.

To put names and teams behind the handles, add `_authors.yml` at the top of the content folder. See [Optional author directory](../../authoring/adr/0005-optional-author-directory.md) for the full format.

```yaml title="decisions/_authors.yml"
- id: anna.kowalska
  name: "Anna Kowalska"
  team: SRE
  github: akowalska
  avatar: https://example.com/avatars/anna.png
- id: marek
  name: "Marek Zieliński"
  team: Payments
  gitlab: mzielinski
```

| Field | Effect on the authors page |
| --- | --- |
| `name` | Display name; initials are derived from it. |
| `team` | Shown under the name. When it equals a project's id or name (case-insensitive), it links to that team page and the avatar takes the project's ink. |
| `github` / `gitlab` | Adds `GitHub @handle` or `GitLab @handle`. GitHub wins when both are set. |
| `avatar` | Image URL or path used instead of initials. |

A handle that is not in the directory still works everywhere: its name is the handle itself and its initials come from the handle (`anna.kowalska` becomes `AK`).

### Tags

Tags are free text in the front matter:

```yaml
tags: [payments, vendor, pci]
```

A single value is accepted too (`tags: payments`). `/tags/` shows every tag with its record count, most used first, as a tag cloud; each tag links to `/decisions/?tag=<tag>`. The same links appear on record headers, on the cards' tag line and in the table view of the index.

There is no allow-list. If two spellings exist (`postgres` and `postgresql`) both appear, which makes the page a cheap way to spot drift.

> [!TIP]
> Keep tags lowercase and singular. The filter compares the exact string, so `Kafka` and `kafka` are two tags.

### Counts in the sidebar

The sidebar hub shows "Authors" with the number of distinct handles across `authors` and `deciders`, and "Tags" with the number of distinct tags. Both numbers come from the records at build time.

## Consequences

- Nothing to maintain: a new author or tag appears on the next build, a removed one disappears.
- Without `_authors.yml` the pages show handles instead of names, which is fine for small teams and poor for a company-wide site.
- Tag spelling is not enforced. Reviewing `/tags/` from time to time is the intended control.
- The authors page lists everyone in the directory even with zero records, which is useful as a staff list and noisy if the directory is large.
- A busy author does not stretch the page: each entry stays at five records however many the person has.
- `?author=` matches deciders as well as authors, so the filtered index and the authors page agree on a person's records. There is no filter for authors only.
