---
title: "Cloudflare Workers"
description: "How this documentation site is published to useinkan.dev: Workers static assets, docs/wrangler.jsonc and Cloudflare building from the repository."
status: implemented
date: 2026-10-20
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, ci]
related: [deploy/adr/0001-static-html-output, deploy/adr/0002-github-and-gitlab-pages, deploy/adr/0004-serve-from-a-sub-path]
options: [url]
---

## Context

The site you are reading is built from `docs/` with Inkan itself and should be online, so it doubles as a
live example. Cloudflare serves static files from its edge for free, handles a custom domain and its
certificate, and recommends Workers static assets over Pages for new projects.

## Decision

The site is deployed as a Worker with only static assets: no script, `docs/dist/` uploaded as is. The wrangler
configuration lives next to the site in `docs/wrangler.jsonc`. Cloudflare's Git integration (Workers Builds) is
connected to this repository and builds and deploys every push to `main`, so no Cloudflare credentials are
stored in GitHub. Pull requests are checked by the repository's own CI, which builds and crawls the docs.

## How to use it

```jsonc title="docs/wrangler.jsonc"
{
  "name": "inkan-docs",
  "compatibility_date": "2026-10-20",
  "assets": {
    "directory": "./dist",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  },
  "routes": [{ "pattern": "useinkan.dev", "custom_domain": true }],
  "workers_dev": false,
  "preview_urls": false
}
```

`auto-trailing-slash` serves `<folder>/index.html` for `<folder>/`, and `404-page` serves the `404.html` that
every build writes, the two things [Static HTML output](0001-static-html-output.md) asks of a host.
`useinkan.dev` is a zone in the same Cloudflare account, so the first deploy created its DNS record and
certificate. The site sits at the root of the domain, so there is no `BASE_PATH`, and `docs/inkan.config.ts`
sets `url: 'https://useinkan.dev'` so `llms.txt`, RSS, the sitemap and OpenGraph cards carry it.

The Worker `inkan-docs` is connected under **Workers & Pages**, **Settings**, **Builds**:

| Setting | Value |
| --- | --- |
| Git repository | `tilaven/inkan`, production branch `main` |
| Root directory | empty, the repository root |
| Build command | `(git fetch --unshallow \|\| true) && npm run docs:build` |
| Deploy command | `npx wrangler deploy --config docs/wrangler.jsonc` |
| Non-production branch builds | off |

Cloudflare runs `npm ci` in the root directory before the build command. That has to be the repository root,
because `docs/` is an npm workspace and the lockfile lives at the top. The `git fetch` keeps the "Last updated"
dates right: they come from `git log`, and a shallow clone would date every page to the day of the build.
`--config` points wrangler at `docs/wrangler.jsonc`, and `assets.directory` resolves relative to that file.

The same setup works for any decision repository: put a `wrangler.jsonc` with your own `name` and domain next
to `inkan.config.ts`, import the repository in **Workers & Pages**, and use `npm run build` and
`npx wrangler deploy` as the commands.

## Consequences

- Every merge to `main` is live within the length of one build; there is no server or container to maintain.
- The build runs on Cloudflare and reports a check on each commit; GitHub holds no Cloudflare secret.
- The build settings live in the Cloudflare dashboard, not in the repository; this record is their reference.
- Pull requests get no preview URL.
- Only `dist/` is uploaded. A site with protected projects keeps `dist-protected/` off Cloudflare and needs a
  host that can check sign-in, see [Sign-in and protected projects](0007-sign-in-and-protected-projects.md).
- Static assets on the free plan are limited to 20,000 files per version; this site builds under 700.
