---
title: "Cloudflare Workers"
description: "How this documentation site is published to useinkan.dev: Workers static assets, a wrangler config next to the site and one GitHub Actions workflow."
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
configuration lives next to the site, and a GitHub Actions workflow builds and deploys every push to `main`.
Pull requests build the site and run `wrangler deploy --dry-run`, which needs no credentials and works for forks.

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
certificate.

```yaml title=".github/workflows/site.yml"
name: Site

on:
  push:
    branches: [main]
  pull_request:

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
      - run: npx inkan check
      - run: npm run build
      - run: npx wrangler deploy --dry-run
        if: github.event_name == 'pull_request'
      - run: npx wrangler deploy
        if: github.ref == 'refs/heads/main'
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

One-time setup:

1. In the Cloudflare dashboard, create an API token from the **Edit Cloudflare Workers** template, limited to
   your account and the zone of your domain.
2. Add it to the repository as the secret `CLOUDFLARE_API_TOKEN`, and your account ID as `CLOUDFLARE_ACCOUNT_ID`.
3. Set `url` in `inkan.config.ts` to the domain, so `llms.txt`, RSS, the sitemap and OpenGraph cards carry it.

Do not set `BASE_PATH`: the site is served from the root of its domain.

## Consequences

- Every merge to `main` is live within the length of one build; there is no server or container to maintain.
- Pull requests are checked against the same configuration but get no preview URL.
- Only `dist/` is uploaded. A site with protected projects keeps `dist-protected/` off Cloudflare and needs a
  host that can check sign-in, see [Sign-in and protected projects](0007-sign-in-and-protected-projects.md).
- Static assets on the free plan are limited to 20,000 files per version, far above what a decision archive builds.
