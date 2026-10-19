---
title: "Header, banner, footer and redirects"
description: "The site chrome you can configure: navigation links, the announcement banner, the footer, redirects for moved pages, repository-based Edit and New ADR links, and the previous/next pager."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [site, navigation, config]
options: [banner, footer, navigation, redirects]
related: [site/adr/0002-filterable-record-index, extending/adr/0002-override-components-and-fill-slots, deploy/adr/0004-serve-from-a-sub-path, cli/adr/0003-number-records-with-inkan-new]
---

## Context

The pages around the content are the same on every site, but every team needs small adjustments: a link to the handbook, a notice during a migration, a copyright line, a redirect after a record was renamed, and a way to get from a page to the file behind it. These must be reachable from the one config file so nobody has to touch the site code for them.

## Decision

Inkan keeps a fixed chrome (sidebar, header, footer) and exposes the parts teams change through `navigation`, `banner`, `footer`, `redirects` and `repo`. The repository option turns on links to edit a page and to start a new record in the web editor of GitHub or GitLab. Records of the same project and type get a previous/next pager. The chrome components themselves can be replaced through `components`, which is described in [Override components and fill slots](../../extending/adr/0002-override-components-and-fill-slots.md).

## How to use it

### Navigation

The header always has Records, Timeline and Open decisions. `navigation` appends links after them; plugins can append more. The same links are repeated in the sidebar under the hub links.

```ts title="inkan.config.ts"
export default defineConfig({
  navigation: [
    { label: 'Handbook', href: '/handbook/' },
    { label: 'Status page', href: 'https://status.acme.dev' },
  ],
});
```

A `href` starting with `/` gets the base path prefixed; URLs with a scheme, `//host` links and `#fragments` pass through untouched. The current page is marked with `aria-current="page"`.

The sidebar is built from the content: Home, All decisions, Timeline, Open decisions, Authors and Tags with their counts, then any Markdown page at the root of the content folder (ordered by `order`, then title), then one collapsible section per project (a heading with the project's name, then lists of its pages and of its records grouped by type) inside a "Teams and their records" navigation landmark. Collapsed sections are remembered in the browser (`localStorage` key `inkan-side-closed`); the section holding the current page always opens. On phones the sidebar is a drawer with its own close button, and a second skip link at the top of the page jumps to the search button.

### Banner

```ts title="inkan.config.ts"
export default defineConfig({
  banner: {
    message: 'Records are frozen until <a href="/platform/rfc/0004-new-numbering/">RFC 0004</a> is decided.',
    dismissible: true,
  },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `banner` | `null` | No banner. |
| `banner.message` | required | Text of the strip above the header. Inline HTML is allowed and not escaped. |
| `banner.dismissible` | `false` | Adds a close button. The dismissal is stored per message (`localStorage` key `inkan-banner`), so changing the text shows the banner again. |

### Footer

```ts title="inkan.config.ts"
export default defineConfig({
  footer: {
    copyright: '© 2026 Acme · <a href="/legal/">Legal</a>',
    links: [{ label: 'Handbook', href: '/handbook/' }, { label: 'GitHub', href: 'https://github.com/acme/decisions' }],
  },
});
```

`copyright` may contain inline HTML. `links` follow the same `href` rules as `navigation`. After your links the footer always shows a "Print / export" link to the `/export/` document (see [Print and export](0008-print-and-export.md)) and ends with "Built with Inkan".

### Redirects

```ts title="inkan.config.ts"
export default defineConfig({
  redirects: {
    '/adr': '/decisions/',
    '/sre/adr/0001': '/sre/adr/0001-define-slos-per-user-journey/',
    '/old-handbook': 'https://handbook.acme.dev',
  },
});
```

Keys are old paths, values are new paths or absolute URLs. Site-relative targets get the base path prefixed. Redirects are emitted by the static build as redirect pages, so they work on any host. A redirect source may not collide with a real page; the build fails with a message if it does. The old team page address `/projects/<project>/` redirects to `/<project>/` on its own.

### Repository links

```ts title="inkan.config.ts"
export default defineConfig({
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `repo.url` | `''` | Repository URL. Empty disables every link below. |
| `repo.branch` | `'main'` | Branch used in edit and new-file links. |
| `repo.provider` | `'github'` | `github` or `gitlab`; decides the URL shapes. |

With a repository configured you get:

- **Edit on github / gitlab** under every record and page. The path is the file's location relative to the repository root, detected with `git rev-parse --show-toplevel`, so a config in a sub-folder of a monorepo still produces correct links.
- **+ New ADR · 0008** buttons on each team page, one per record type. GitHub opens the new-file editor with the file name (`0008-new-adr.md`) and the record template pre-filled; GitLab opens it with the file name only. The number is one above the highest existing number for that type in that project.
- A pill with the provider name in the header that links to the repository.

Pages and records also show a "Last updated" date taken from the last commit touching the file; records have "Copy link" and "Raw Markdown" buttons next to the edit link, and a "Copy page" menu in the header (see [Markdown copy of every page](../../ai/adr/0003-markdown-copy-of-every-page.md)).

### Previous and next

A record ends with a pager to the previous and next record of the same project and type, in number order. Pages that are not records (guides, team intros) have no pager. The breadcrumb in the header shows site, team, type and number.

### Not found

Unknown paths render the built-in 404 page with a link to `/decisions/`. Static hosts need to be told to serve `404.html`; GitHub Pages and the nginx config from `init` already do.

## Consequences

- Everything above lives in `inkan.config.ts`; changing it restarts the dev server automatically.
- `banner.message` and `footer.copyright` are inserted as HTML. Only put trusted markup there.
- Dismissal and collapsed sidebar sections are per browser; there is no server to remember them.
- The "New ADR" link fills the template in GitHub only, because GitLab's new-file URL takes a file name but no content.
- Redirects are static redirect pages, so they work on every host but add one round trip; the build does not write host-specific redirect rules.
