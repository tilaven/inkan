---
title: "Link records by path"
description: "How supersedes, supersededBy and related reference other records, and how ordinary relative Markdown links work both on GitHub and on the site."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [content, markdown, navigation]
related: [authoring/adr/0003-metadata-in-front-matter, authoring/adr/0004-configurable-status-lifecycle, site/adr/0012-decision-graph]
---

## Context

Decisions refer to each other: a new ADR supersedes an old one, an RFC relates to the ADR it came from. Readers meet these records in two places, the rendered site and the repository on GitHub or GitLab, and a link must work in both. Numbers alone (`ADR-0004`) are ambiguous across projects, and absolute site URLs break when the site moves to a sub-path.

## Decision

Lineage fields in front matter (`supersedes`, `supersededBy`, `related`) hold the path of the target record inside the content folder, without extension: `platform/adr/0004-use-sqs-as-the-event-bus`. The path is unique across projects and stable as long as the file does not move.

In the body, authors write plain relative Markdown links to the `.md` file, exactly as they would for GitHub. At build time a remark plugin (`remark-md-links`) rewrites those links to the page URL, including the base path, so the same text works in both places.

## How to use it

### Lineage in front matter

```yaml title="decisions/platform/adr/0009-move-the-event-bus-to-kafka.md"
supersedes: [platform/adr/0004-use-sqs-as-the-event-bus]
related: [payments/rfc/0001-settle-in-async-batches]
```

```yaml title="decisions/platform/adr/0004-use-sqs-as-the-event-bus.md"
status: superseded
supersededBy: [platform/adr/0009-move-the-event-bus-to-kafka]
```

The record header shows a lineage block with the lines "Supersedes", "Superseded by" and "Related". Each entry links to the target and shows its number, title and status sticker.

| Field | Shown as | Direction |
| --- | --- | --- |
| `supersedes` | Supersedes | Written on the new record. Not mirrored: fill `supersededBy` on the old one yourself. |
| `supersededBy` | Superseded by | Written on the old record. Pair it with `status: superseded`. |
| `related` | Related | Mirrored: if A lists B, B also shows A under Related without listing it. |

Path rules:

- Path inside the content folder, with the project and type folders: `sre/adr/0001-define-slos`. Cross-project references work the same way.
- No extension. A trailing `.md` or `.mdx`, a leading `/` and upper-case letters are tolerated and normalised.
- Several targets: `supersedes: [a/adr/0001-x, a/adr/0002-y]`. A single string works too.

A path that matches no record is still rendered as a link to `/<path>/` with the path as its text and no sticker. The build does not fail on it, so check the lineage block after renaming files.

### Relative links in the body

Write the link to the file, relative to the file you are editing:

```md
See [Error budget policy](../rfc/0001-error-budget-policy.md#proposal) and the
[Payments ledger decision](../../payments/adr/0001-use-postgresql-for-the-ledger.md).
```

On GitHub and GitLab these open the source files. On the site they become `/sre/rfc/0001-error-budget-policy/#proposal` and `/payments/adr/0001-use-postgresql-for-the-ledger/`. The rules, from `app/src/lib/remark-md-links.mjs`:

| Link | Result |
| --- | --- |
| `./0003-x.md`, `../rfc/0001-y.mdx` | Rewritten to the page URL, base path prepended, trailing slash added. |
| `../rfc/0001-y.md#proposal` | Fragment kept. |
| `../index.md` | An `index.md` maps to its folder (`/sre/`). A `README.md` is rewritten to `/sre/readme/`, which does not exist when the file is the project intro, so link `../index.md` or the folder instead. |
| `[x][ref]` with `[ref]: ./0003-x.md` | Reference-style definitions are rewritten too. |
| `/abs/x.md`, `https://host/x.md` | Left alone. |
| `#top`, `./diagram.png` | Left alone: only `.md` and `.mdx` targets are touched. |
| `../../../README.md` | Left alone when it points outside the content folder. |

The rewrite applies to files inside the content folder only. Pages in `pagesDir` keep their links as written.

> [!TIP]
> Mixed-case file names are lower-cased in URLs, so `0002-Second.md` is served at `/payments/rfc/0002-second/`. Keep file names lower-case to avoid surprises when linking from other tools.

### Links to pages and other targets

- Another page in the same project: `[On-call guide](../guides/on-call.md)`.
- A root page: from `sre/adr/0001-x.md`, `[Quick start](../../quick-start.md)`.
- A heading in the same record: `[see below](#consequences)`. Headings get ids from their text and an anchor link on hover.
- Issue keys like `PAY-123` can become links without Markdown syntax, see [Turn issue keys into links](0008-turn-issue-keys-into-links.md).

### When files move

Renaming `0004-use-sqs.md` to `0004-use-sqs-as-the-event-bus.md` changes its path. Update the lineage fields in other records and the relative links that point at it, then add a redirect for the old URL in `inkan.config.ts`:

```ts title="inkan.config.ts"
redirects: { '/platform/adr/0004-use-sqs': '/platform/adr/0004-use-sqs-as-the-event-bus/' },
```

## Consequences

- One spelling for a target everywhere: the file path. It survives a change of domain or base path.
- Lineage references are not validated at build time; a stale path becomes a dead link in the header.
- `supersedes` and `supersededBy` are two edits in two files. `related` needs only one.
- Links in the body are rewritten, not checked. A typo in a relative link is a 404 on the site and a 404 on GitHub, which at least fails in the same way in both places.
