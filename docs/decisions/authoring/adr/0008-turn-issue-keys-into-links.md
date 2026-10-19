---
title: "Turn issue keys into links"
description: "How the issueLinks option turns tracker keys such as PAY-123 or #42 in record text into links, with pattern, url and $1."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [markdown, config, content]
options: [issueLinks]
related: [authoring/adr/0007-github-flavoured-markdown-with-diagrams-and-math, authoring/adr/0006-link-records-by-path]
---

## Context

Decisions cite tickets: the incident that triggered them, the epic that implements them. Authors write the key (`PAY-123`) and move on; nobody pastes the full Jira URL every time. On the site the key should be a link, and the tracker URL should live in one place so a tracker migration is a one-line change.

## Decision

`issueLinks` in `inkan.config.ts` is a list of rules. Each rule has a regular expression `pattern` and a `url` template. A remark plugin (`remark-issue-links`) scans the text of every Markdown file the site renders and wraps each match in a link, replacing `$1` in the template with the first capture group. Text that is already a link or inside code is left alone.

## How to use it

### Configuration

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';

export default defineConfig({
  issueLinks: [
    { pattern: '\\b((?:PAY|OPS)-\\d+)\\b', url: 'https://acme.atlassian.net/browse/$1' },
    { pattern: '(?<![\\w/])#(\\d+)\\b', url: 'https://github.com/acme/decisions/issues/$1' },
  ],
});
```

| Field | What it does |
| --- | --- |
| `pattern` | A JavaScript regular expression as a string. Backslashes are doubled because it is a string literal. The plugin adds the `g` flag; do not include flags. |
| `url` | Link target. `$1` to `$9` are replaced by the matching capture group. A group that did not participate becomes an empty string. |

The default is an empty list, which disables the plugin. Rules are validated at build time: a missing `pattern` or `url`, or an extra field, fails the build.

### What gets linked

Given the first rule above, this source:

```md
Triggered by PAY-123 and OPS-7. See `PAY-999` in the code and [PAY-1](https://old.tracker/1).
```

renders as "Triggered by [PAY-123](https://acme.atlassian.net/browse/PAY-123) and [OPS-7](https://acme.atlassian.net/browse/OPS-7). See `PAY-999` in the code and [PAY-1](https://old.tracker/1)."

- Matches in plain text, including inside headings, list items, tables and alerts, become links with the CSS class `issue`.
- Text inside inline code and code blocks is never touched.
- Text that is already inside a link (`[PAY-1](...)` or a reference link) is never touched.
- Several rules are applied in document order. When two rules match overlapping text, the earlier match wins and the overlap is skipped.
- Front matter is not scanned. `description: Fixes PAY-5` stays plain text in lists and feeds.

### Writing patterns

- Anchor the key with `\b` so `REPAY-123` does not link as `PAY-123`.
- Use a non-capturing group `(?:...)` for alternatives and one capturing group for the part that goes into the URL.
- For GitHub-style `#42`, exclude characters that commonly precede a `#` in prose, as in the example above, or the pattern also matches in words like `C#5`. Headings are not affected because the `#` of a heading is not text.
- Pass the whole key when the tracker URL needs it (`browse/$1` with `(PAY-\d+)`), or only the number (`issues/$1` with `#(\d+)`).

> [!WARNING]
> A pattern that matches very broadly (`\d+`) links every number on the site. Test a new rule with `inkan dev` on a record that uses the key before merging the config.

### Limits

- Every Markdown and MDX file the site renders is processed: records, project pages, root pages and pages in `pagesDir`.
- Only text nodes are scanned; a key inside raw HTML in the Markdown is not linked.
- The plugin has no knowledge of the tracker. It does not check that the issue exists, fetch its title or mark it closed.

## Consequences

- Authors keep writing keys the way they do in commit messages; the site does the linking.
- Moving trackers means changing one `url`. Old records update on the next build.
- A regular expression in config is powerful and easy to get wrong. A bad pattern fails loudly (`Invalid regular expression`) at build time; an over-broad one fails quietly by linking too much.
- The links are site-only. On GitHub the keys stay plain text, unless GitHub's own autolink references are configured for the repository.
