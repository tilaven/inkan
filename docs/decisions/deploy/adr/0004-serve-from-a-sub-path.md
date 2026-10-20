---
title: "Serve from a sub-path"
description: "The base option and the BASE_PATH variable: how to publish the site under /decisions/ or /<repo>/ with every link, redirect and search request pointing at the right place."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, config, navigation]
options: [base]
related: [deploy/adr/0002-github-and-gitlab-pages, deploy/adr/0003-docker-and-nginx, site/adr/0006-header-banner-footer-and-redirects]
---

## Context

GitHub and GitLab project sites live under `/<repo>/`. Company portals mount tools under paths such as
`/docs/decisions/`. A static site with absolute links (`/decisions/`, `/_astro/x.css`) breaks there, and
relative links break the moment a page sits one folder deeper. The prefix has to be known at build time and
applied everywhere: HTML links, rewritten Markdown links, redirects, the search index and the asset URLs.

## Decision

The `base` option sets the path prefix. The `BASE_PATH` environment variable overrides it, so one config file
serves local development at `/` and CI builds at `/<repo>/`. Every URL the app produces goes through one
helper that prefixes `base`; links in Markdown and in the config are site-relative and get the prefix at
build time.

## How to use it

| Option | Default | What it does |
| --- | --- | --- |
| `base` | `'/'` | Path the site is served from, for example `'/decisions'`. |
| `BASE_PATH` (env) | unset | Replaces `base` for one build or dev run. The CI files from `init` set it to the repository name. |

```ts title="inkan.config.ts"
export default defineConfig({
  url: 'https://intranet.acme.dev',
  base: '/decisions',
});
```

```bash
BASE_PATH=/my-repo npx inkan build
BASE_PATH=/my-repo npx inkan dev             # http://localhost:4321/my-repo/
```

### What gets the prefix

| Where | How |
| --- | --- |
| Links the app renders (sidebar, header, cards, breadcrumbs, pager) | Built with the `url()` helper, which prefixes `base` |
| `navigation`, `footer.links`, `landing.actions` in the config | Site-relative hrefs (`/handbook/`) get the prefix; `https://`, `//` and `#` hrefs pass through |
| Relative Markdown links to `.md` files inside the content folder | Rewritten to `<base>/<project>/<type>/<slug>/` |
| `redirects` | Sources are matched under `base` by Astro; site-relative targets get the prefix |
| Search | Pagefind's script and index are loaded from `<base>/pagefind/`; the `url` of every record in `search.json` carries the prefix, and a custom provider gets it as `base` |
| Hashed assets | Astro writes them under `<base>/_astro/` |
| Absolute URLs in `llms.txt`, `decisions.json`, RSS, sitemap, canonical tags | `new URL(href, url)`, where `href` already carries the prefix |

The one thing that does not change is the output folder: `dist/` stays flat. `dist/index.html` is the page
served at `/<base>/`; the host decides where the folder is mounted.

### Writing links that survive a sub-path

In Markdown, link records by relative path to the `.md` file, as on GitHub:

```md
See [SLOs](../adr/0001-define-slos.md) and the [handbook](/handbook/).
```

The first link is rewritten with the prefix. The second is not, because it does not end in `.md` and starts
with `/`; use the `navigation` option or a relative link for pages instead, or accept that absolute links in
prose are tied to one deployment.

In your own components and pages, never write `/decisions/` by hand:

```astro
---
import { url } from '@tilaven/inkan/data';
---
<a href={url('decisions/')}>All records</a>
```

or read `import.meta.env.BASE_URL`, which Astro sets to `base`.

### Hosting the folder

- GitHub Pages and GitLab Pages: nothing to do, the generated pipelines set `BASE_PATH` and the platforms mount the artifact at `/<repo>/`.
- nginx, S3, a CDN: upload or copy `dist/` to a folder named after the base (`html/decisions/`), or configure the
  server to map `/decisions/` to the folder. The asset cache rules in the starter `nginx.conf` need the same prefix.
- Custom domain at the root: remove `BASE_PATH` from the pipeline and leave `base` at its default.

> [!WARNING]
> Build and host must agree. A site built with `base: '/decisions'` and served at `/` shows unstyled pages,
> because every stylesheet and script URL starts with `/decisions/`. The reverse, built for `/` and served
> under a prefix, breaks the same way. If the page renders without styles, this is the first thing to check.

### Checking a build

```bash
BASE_PATH=/decisions npx inkan build
npx inkan preview              # serves at http://localhost:4321/decisions/
grep -o 'href="/decisions/[^"]*"' dist/index.html | head
```

`preview` reads the same `BASE_PATH`-free config, so set the variable for it too if you did not put `base` in
the file.

## Consequences

- One config and one environment variable cover root, project-site and portal deployments; CI needs no second config file.
- Absolute paths in Markdown prose are not rewritten. Authors who hard-code `/decisions/` tie the archive to one deployment.
- The prefix is baked in at build time. Moving the site to another path means another build, not a server rewrite.
- The dev server honours `base` too, so local URLs carry the prefix when it is set in the config. Keep `base` out of the file and use `BASE_PATH` in CI if you prefer `http://localhost:4321/` locally.
