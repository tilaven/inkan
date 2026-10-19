---
title: "Comments under RFCs"
description: "A discussion section below a record, off by default: giscus (GitHub Discussions), a GitLab issue read through the public API, or your own Astro component, switched per record type, status and record."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [site, comments, rfc, plugins]
related: [site/adr/0005-full-text-search-with-pagefind, authoring/adr/0003-metadata-in-front-matter, theming/adr/0002-day-and-stage-themes, extending/adr/0002-override-components-and-fill-slots]
---

## Context

An RFC is a question put to other people. The text on the page is the proposal; the answers are the useful part, and they usually end up in a chat thread or a pull request that the record never links to. Months later the record says "accepted" and nobody can find who objected to what. For an ADR this matters less, because it records a decision that is already made. For an RFC, the conversation is part of the evidence.

The site is static. It has no database, no login and no server that could store a comment. Whatever holds the discussion has to be a service the team already uses, and the page can only show it or link to it. Teams differ in which service that is: GitHub Discussions on one side, GitLab issues on the other, an internal forum on a third.

## Decision

A record page can show a "Discussion" section below the record footer. It is off by default. The `comments` option turns it on and names a provider that renders the conversation:

- `giscus` embeds GitHub Discussions with the giscus widget.
- `gitlab` shows the notes of a GitLab issue or merge request, read from the public GitLab API in the browser, and always keeps a link to the issue.
- `custom` renders an `.astro` component you write.

By default only records of type `rfc` get the section. The options `types` and `statuses` change that, and two front matter fields, `comments` and `discussion`, override it for a single record. The static site stores nothing itself: the comments live in the provider, and the page is only a window onto them.

Independent of the provider, an RFC that is proposed in a pull request or merge request also shows the review comments left on its file, pinned next to the paragraph they refer to. The only setting is the record's `discussion` field.

## How to use it

### Turning it on

```ts title="inkan.config.ts"
export default defineConfig({
  repo: { url: 'https://github.com/acme/decisions', provider: 'github' },
  comments: {
    provider: 'giscus',
    repoId: 'R_kgDOAbCdEf',
    category: 'RFC discussions',
    categoryId: 'DIC_kwDOAbCdEf4Cx1Yz',
  },
});
```

Every provider accepts these options:

| Option | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | `false` removes the section everywhere. `comments: false` is the short form, and so is leaving `comments` out. |
| `types` | `['rfc']` | Record types (keys of `docTypes`) that get the section. |
| `statuses` | every status | Only records with one of these statuses get the section, e.g. `['proposed', 'in-review']` to close the thread once an RFC is decided. |
| `provider` | required | `'giscus'`, `'gitlab'` or `'custom'`. The other keys depend on it, and keys that do not belong to the chosen provider fail the build. |

The section is a "Discussion" heading and the provider's output, placed after the record footer. Plain pages and index pages never get it.

### giscus

[giscus](https://giscus.app) stores a comment thread as a GitHub Discussion in your repository. Readers sign in with GitHub in the widget; the site itself needs no token.

Setup, once per repository:

1. Make the repository public and turn on Discussions (Settings, General, Features).
2. Create a Discussions category for the threads. An "Announcements" type category is the safest choice, since only maintainers and giscus can start threads in it.
3. Install the [giscus app](https://github.com/apps/giscus) on the repository.
4. Open [giscus.app](https://giscus.app), enter `owner/name`, choose the category, and copy `data-repo-id` and `data-category-id` from the generated snippet. They are `repoId` and `categoryId` in the config.

| Option | Default | What it does |
| --- | --- | --- |
| `repoId` | required | The repository id from giscus.app. |
| `category` | required | Name of the Discussions category. |
| `categoryId` | required | The category id from giscus.app. |
| `repo` | from `repo.url` | `owner/name`. Required when `repo.provider` is not `'github'` or `repo.url` is empty. |
| `mapping` | `'specific'` | How a page finds its discussion: `'specific'` uses the record id as the search term, so a page keeps its thread when the site moves to another domain. Also `'pathname'`, `'url'`, `'title'` and `'og:title'`. |
| `strict` | `true` | Find the discussion by an exact hash of the term instead of GitHub's fuzzy search, so a record never picks up a similar record's thread. |
| `reactions` | `true` | Show the reaction buttons on the discussion. |
| `inputPosition` | `'top'` | Put the comment box above (`'top'`) or below (`'bottom'`) the comments. |
| `lang` | The site's `locale` | Language of the widget, e.g. `'pl'` or `'zh-CN'`. |
| `theme` | `{ light: 'light', dark: 'dark' }` | giscus theme names, or URLs of a CSS file, for Day and Stage. |

The page loads `https://giscus.app/client.js`, and the comments iframe loads lazily, when the section comes near the viewport. The first comment on a record creates the discussion; giscus does it, not the site.

The theme follows the reader's choice in the header. When the Day/Stage toggle changes, the site tells the giscus iframe to switch between `theme.light` and `theme.dark`, without reloading it. See [Day and Stage themes](../../theming/adr/0002-day-and-stage-themes.md).

If the discussion already exists, for example one started by hand, put its URL in the record:

```yaml
discussion: https://github.com/acme/decisions/discussions/42
```

When that is a discussion of the configured repository, giscus uses its number instead of searching by `mapping`.

### GitLab

GitLab offers no widget to embed. The `gitlab` provider therefore works in two steps. The server renders a plain link. In the browser, a small script then asks the GitLab API for the comments of the issue and lists them under the page. Comments come from the GraphQL API (`/api/graphql`), which answers anonymous reads of public projects; the REST notes endpoint needs a token on gitlab.com. The issue search uses the REST API (`/api/v4`). Nothing needs a token, and nothing is stored by the site.

```ts title="inkan.config.ts"
export default defineConfig({
  repo: { url: 'https://gitlab.acme.dev/platform/decisions', provider: 'gitlab' },
  comments: { provider: 'gitlab', labels: ['rfc'] },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `project` | from `repo.url` | Project path, e.g. `group/sub/repo`. Required when `repo.provider` is not `'gitlab'`. |
| `host` | origin of `repo.url` when `repo.provider` is `'gitlab'`, else `'https://gitlab.com'` | GitLab instance, for self-hosted installs. |
| `labels` | `[]` | Labels added to the issue when a reader starts the discussion. |

Which issue belongs to a record is decided in this order:

1. The record's `discussion` field, when it is a link to an issue or merge request on the same host (`https://gitlab.acme.dev/platform/decisions/-/issues/7`, `.../-/work_items/7` or `.../-/merge_requests/12`).
2. Otherwise a search of the project's issues, open and closed, by the record reference. The first issue whose title starts with the reference (`SRE-RFC-0001: Define SLOs`) wins, case does not matter, and `SRE-RFC-0001` does not match `SRE-RFC-00012`. A record without a reference is matched by its exact title.

When an issue is found, the page shows "N comments on GitLab" (or "No comments yet") with a link to the issue, then each note with the author's avatar and name, the date and the text, oldest first, and a "Reply on GitLab" button. The page fetches the newest 100 notes; on a longer thread the heading says "Latest N comments on GitLab". System notes such as label changes are left out. Note text is shown as plain text with its line breaks, not rendered Markdown.

When no issue is found, or the API cannot be reached, the link stays:

| Situation | Link |
| --- | --- |
| `discussion` is an issue or merge request on `host` | "Open the discussion on GitLab", to that URL. |
| `discussion` points elsewhere (another host, a GitHub discussion) | "Open the discussion", to that URL. The issue search still runs. |
| No `discussion` | "Start the discussion on GitLab", to the project's new-issue form with the title (`SRE-RFC-0001 Define SLOs`) and a description holding the record's URL already filled in, plus a `/label ~"x"` line for each entry of `labels`. |

Title the issue with the reference at the start and the next visit finds it. Private projects get the link only: the API answers anonymous requests with an error, and the page does not ask for credentials. The same happens when the instance does not allow cross-origin requests from your site.

> [!NOTE]
> The API is called by the reader's browser, so a self-hosted GitLab behind a VPN shows the notes only to readers on that VPN. Everyone else sees the link.

### A custom provider

```ts title="inkan.config.ts"
export default defineConfig({
  comments: {
    provider: 'custom',
    component: './src/Comments.astro',
    options: { forum: 'https://forum.acme.example' },
  },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `component` | required | An `.astro` file, relative to the config file. |
| `options` | `{}` | Passed to the component as is. |

The component is rendered inside the "Discussion" section, on the server. It receives `CommentsProps`:

| Prop | Value |
| --- | --- |
| `d` | The record, as in the data API: `d.ref` (e.g. `'SRE-RFC-0001'`, or `null`), `d.title`, `d.id`, `d.href`. |
| `options` | The `options` from the config. |
| `discussion` | The record's `discussion` front matter, or `undefined`. |
| `title` | The reference and the title (`SRE-RFC-0001 Define SLOs`), or only the title when the record has no reference. |
| `pageUrl` | Absolute URL of the record page, built from `url` and `base`. |

```astro title="src/Comments.astro"
---
import type { CommentsProps } from "inkan";

const { discussion, title, pageUrl, options } = Astro.props as CommentsProps;
const href = discussion ?? `${options.forum}/new?title=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`;
---
<a class="pill" href={href}>{discussion ? 'Open the discussion' : 'Start the discussion'}</a>
```

A plugin can set `comments` in its `config` hook; use an absolute path or a `file:` URL for `component`, because a relative path is resolved against the site's config file.

### Per record

Two front matter fields override the config for one record:

| Field | What it does |
| --- | --- |
| `comments` | `false` hides the section on this record. `true` shows it although its type or status is not in `types` or `statuses`. |
| `discussion` | The URL of the conversation: a GitHub discussion, a GitLab issue or a GitLab merge request. |

```yaml
---
title: "Define SLOs for the checkout API"
status: in-review
comments: true
discussion: https://github.com/acme/decisions/discussions/42
---
```

`comments` has no effect when comments are off in the config. See [Front matter reference](../../front-matter.md).

### Review comments on lines

An RFC is usually proposed in a pull request (GitHub) or merge request (GitLab), and reviewers comment on specific lines of the RFC file in the diff. Set `discussion` to that pull or merge request and the record page shows those comments where they belong:

```yaml
discussion: https://github.com/acme/decisions/pull/12
```

```yaml
discussion: https://gitlab.acme.dev/platform/decisions/-/merge_requests/7
```

No config is needed. The reader's browser fetches the review comments on the record's own file and pins each one next to the paragraph (top-level block) of the record text it refers to. A paragraph with comments gets a marker with their count; it opens the list under the paragraph. Comments on other files of the same pull request are ignored. The record's path is its path in its repository (for `sources`, in the source repository), so the pull request must be in that repository; a record from a `dir` source outside any repository gets nothing.

| Part | Behavior |
| --- | --- |
| Placement | A comment goes to the block that contains its line. A line between blocks goes to the block above; a line before the first or after the last block goes to the first or last. |
| Outdated | GitHub keeps comments whose line has since changed. They are placed by their original line and marked "outdated". |
| Removed lines | Only comments on lines of the new version of the file are shown; comments on removed lines are left out. |
| "Comment" link | Paragraphs, headings, quotes and code blocks get a small "+" link in the right margin, visible on hover and keyboard focus on screens wider than 1100px. Lists and tables get none. It opens the pull or merge request diff: on GitHub at that line, on GitLab at the file. On a plain `http://` site (no Web Crypto) it opens the diff at the top. |
| Failure | When the request fails, nothing is pinned. The "Comment" links stay. |

Limits:

- Public repositories only. The page calls the GitHub or GitLab API anonymously, and a private repository answers with an error.
- GitHub allows 60 anonymous API requests per hour for each reader's IP address. Past that, the comments are not shown until the limit resets.
- Up to 500 review comments are fetched on GitHub (one request per 100) and the newest 100 on GitLab. Comment text is shown as plain text, not rendered Markdown.
- The comments are read-only; a reader replies on GitHub or GitLab.

This is independent of the `comments` option. It works with giscus, `gitlab`, a `custom` component or with comments off, and it does not depend on the record type or status. It does not use `repo` or the provider settings either: the pull or merge request is found from the `discussion` URL alone. A `discussion` that is neither a pull request nor a merge request, such as a GitHub discussion or a GitLab issue, pins nothing.

### Search

The section is excluded from the search index, so a comment is never a search hit and the record's excerpt does not change when people reply. The index covers the record text; the conversation stays in its provider.

## Consequences

- The default is no comments, no extra request and no third-party script. A site that never sets `comments` is unchanged.
- giscus loads a script and an iframe from `giscus.app`, so giscus and GitHub see the reader's requests. Readers who comment need a GitHub account. If that is a privacy problem, the `gitlab` provider loads no script or iframe: the reader's browser only calls the API of the configured `host` (gitlab.com unless you set your own) when the page opens, and a `custom` provider loads whatever you put in it.
- The static site keeps no comments. They survive in GitHub Discussions or GitLab, not in `dist/`, and a rebuild neither adds nor loses any. The page shows what the provider has at the moment the reader opens it.
- GitLab comments are read-only on the page. To reply, a reader goes to GitLab. That is a deliberate limit of having no embeddable widget and no tokens in the site.
- A record is matched to its thread by its id (giscus) or its reference (GitLab). Renaming a record file changes the id, so give the record a `discussion` link before moving it.
- Review comments on lines add one anonymous API request per page view, to GitHub or GitLab, only on records whose `discussion` is a pull or merge request. GitHub's limit of 60 requests per hour per reader IP applies, and a private repository shows only the "Comment" links.
- Comments are not searchable from the palette. Teams that want to find a past objection search in GitHub or GitLab.
