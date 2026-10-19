---
title: "llms.txt and llms-full.txt"
description: "Every build writes an index of all records for language models at /llms.txt and the full text of every record at /llms-full.txt."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [ai, content, build]
related: [ai/adr/0002-decisions-json, ai/adr/0003-markdown-copy-of-every-page, ai/adr/0004-agents-md-for-coding-agents, authoring/adr/0012-custom-metadata-fields]
---

## Context

A decision archive is the best context a coding assistant can have about a codebase: it says what was chosen
and why. HTML pages are a poor way to feed it. An agent has to crawl, strip navigation and guess which page is
a record. The `llms.txt` convention gives a site one plain-text entry point that lists its content with short
descriptions, and a companion file with the full text.

## Decision

Two text endpoints are part of every build:

- `/llms.txt`: the site title and description, the record types and statuses, and one line per record grouped
  by project, each linking to the raw Markdown of the record.
- `/llms-full.txt`: the full body of every record, newest first, each preceded by a YAML block of metadata.

Both are built from the same collection as the HTML pages, so they can never list a record the site does not have.

## How to use it

Nothing to configure. After `inkan build` the files are in `dist/llms.txt` and `dist/llms-full.txt`;
in `dev` they are served at the same paths. The landing page lists them in its "For agents" section, and the
right rail of every record links to `llms.txt`.

Set `url` in the config: every link inside the files is absolute and built from it.

```ts title="inkan.config.ts"
export default defineConfig({
  title: 'Acme Decisions',
  description: 'Central, searchable record of architecture decisions (ADR) and proposals (RFC).',
  url: 'https://decisions.acme.dev',
});
```

### What llms.txt contains

```text
# Acme Decisions

> Central, searchable record of architecture decisions (ADR) and proposals (RFC).

Types: adr (Architecture Decision Record), rfc (Request for Comments).
Statuses: draft, proposed, in-review, accepted, implemented, rejected, withdrawn, deprecated, superseded. Only "accepted"/"implemented" records describe the current state; "superseded" ones point to their replacement.
Full text of every record: https://decisions.acme.dev/llms-full.txt. Machine-readable index: https://decisions.acme.dev/decisions.json.
Every link below points to the raw Markdown of the record; drop the ".md" suffix and add "/" for the HTML page.

## Payments (payments)

Checkout, billing and payment providers.

- [PAYMENTS-ADR-0001: Use Stripe as the primary payment provider](https://decisions.acme.dev/payments/adr/0001-use-stripe.md) [accepted]: One provider for cards and wallets.

## Pages

- [Decision handbook](https://decisions.acme.dev/handbook.md): How Acme writes, reviews and retires architecture decisions.
```

Line by line:

| Part | Source |
| --- | --- |
| `# title` and `> description` | `title` and `description` from the config |
| `Types:` | `docTypes`, key and `description` |
| `Statuses:` | the keys of `statuses` |
| One `##` per project | `_project.yml` name and id, in `order`; the description when there is one |
| One `-` per record | `ref` (or title) and title, link to the `.md` copy, `[status]`, then the front-matter `description` |
| `## Pages` | Markdown pages from `pagesDir`, only when there are any |

Records inside a project are in the same order as `getDecisions()`: newest `date` first, then by path.
Records without a status show `[n/a]`.

### What llms-full.txt contains

One block per record, separated by `---` lines:

````text
# Use Stripe as the primary payment provider

```yaml
ref: PAYMENTS-ADR-0001
type: adr
project: payments
status: accepted
date: 2026-01-18
authors: piotr.nowak
deciders: tomasz.wojcik
tags: payments, vendor
url: https://decisions.acme.dev/payments/adr/0001-use-stripe/
markdown: https://decisions.acme.dev/payments/adr/0001-use-stripe.md
source: decisions/payments/adr/0001-use-stripe.md
```

## Context
...
````

The YAML block holds `ref`, `type`, `project`, `status`, `date`, `authors`, `deciders`, `reviewers`, `rfc_review` (RFC review status), `tags`, `supersedes`,
`superseded_by`, `url`, `markdown` and `source`; empty fields are left out. The body is the record's Markdown
as written, without its front matter. Only records are included, not pages or project intros. For a record pulled
from another repository with `sources`, `source` is the file's web URL in that repository instead of a local path
(see [Records from other repositories](../../deploy/adr/0005-records-from-other-repositories.md)).

### Pointing an assistant at it

Give the assistant the `llms.txt` URL and let it follow links, or paste `llms-full.txt` into a context window
for a question about the whole archive. The starter `AGENTS.md` already tells agents where these files are.
An agent with tool support does better with the [MCP server](0005-mcp-server-for-agents.md), which filters
and returns single records over the same published files.

> [!NOTE]
> Drafts (`draft: true`) are excluded from production builds and therefore from both files. Records with
> `status: superseded` are included; the `superseded_by` line tells the reader where to look instead.

`llms-full.txt` adds a `name: value` line for each custom field a record has. See [Custom metadata fields](../../authoring/adr/0012-custom-metadata-fields.md).

## Consequences

- An assistant gets the whole archive in one or two requests, with the same freshness as the site.
- `llms-full.txt` grows with the archive. Thousands of records make a file too large for one context window; `decisions.json`, the per-record `.md` copies and `inkan mcp` are the way to fetch less.
- Absolute links depend on `url` being correct. The default `http://localhost:4321` is fine for `dev` and wrong for production.
- The format is plain Markdown by convention, not a schema. Tools that need types read `decisions.json`.
