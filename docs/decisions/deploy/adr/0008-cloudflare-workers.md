---
title: "Cloudflare Workers"
description: "How this documentation site is published to useinkan.dev: Workers static assets, a wrangler config next to the site, built by Cloudflare from the repository."
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

The site is deployed as a Worker with only static assets: no script, `dist/` uploaded as is. The wrangler
configuration lives next to the site. Cloudflare's Git integration (Workers Builds) clones the repository and
builds and deploys every push to `main`, so no Cloudflare credentials are stored in GitHub. A GitHub Actions
workflow with an API token remains the alternative for hosts that build elsewhere.

## How to use it

```jsonc title="wrangler.jsonc"
{
  "name": "my-decisions",
  "compatibility_date": "2026-10-20",
  "assets": {
    "directory": "./dist",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  },
  "routes": [{ "pattern": "decisions.example.com", "custom_domain": true }],
  "workers_dev": false
}
```

`auto-trailing-slash` serves `<folder>/index.html` for `<folder>/`, and `404-page` serves the `404.html` that
every build writes, the two things [Static HTML output](0001-static-html-output.md) asks of a host.
The custom domain must be a zone in the same Cloudflare account; the first deploy creates its DNS record and
certificate. Do not set `BASE_PATH`, and set `url` in `inkan.config.ts` to the domain, so `llms.txt`, RSS, the
sitemap and OpenGraph cards carry it.

### Workers Builds

In the Cloudflare dashboard: **Workers & Pages**, **Create**, **Import a repository**, then pick the repository.
The Worker name must equal `name` in `wrangler.jsonc`.

| Setting | Value |
| --- | --- |
| Root directory | The folder that holds `wrangler.jsonc` and `inkan.config.ts` |
| Build command | `git fetch --unshallow \|\| true; npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Production branch | `main` |

The `git fetch` keeps the "Last updated" dates right, which come from `git log` and would all show the build
day in a shallow clone. In a monorepo where the site is a workspace, run the install and build from the
repository root, as this site does with `cd .. && npm ci && npm run docs:build`.

### GitHub Actions

```yaml title=".github/workflows/site.yml"
name: Site

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history for "Last updated"
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

The token comes from the **Edit Cloudflare Workers** template, limited to your account and the zone of your
domain.

## Consequences

- Every merge to `main` is live within the length of one build; there is no server or container to maintain.
- With Workers Builds the build runs on Cloudflare and reports a check on each commit; GitHub holds no secret.
- Pull requests are checked by the repository's own CI but get no preview URL.
- Only `dist/` is uploaded. A site with protected projects keeps `dist-protected/` off Cloudflare and needs a
  host that can check sign-in, see [Sign-in and protected projects](0007-sign-in-and-protected-projects.md).
- Static assets on the free plan are limited to 20,000 files per version, far above what a decision archive builds.
