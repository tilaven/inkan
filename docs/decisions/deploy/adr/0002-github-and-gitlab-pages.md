---
title: "GitHub and GitLab Pages"
description: "The workflow files that inkan init writes: build every pull request, publish the default branch to GitHub Pages or GitLab Pages."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, ci, cli]
related: [deploy/adr/0001-static-html-output, deploy/adr/0004-serve-from-a-sub-path, deploy/adr/0005-records-from-other-repositories, cli/adr/0002-scaffold-with-init-and-npm-create]
---

## Context

Most decision repositories already live on GitHub or GitLab, and both offer free static hosting from a CI job.
Writing the pipeline is the same twenty lines every time, and getting the sub-path right (`/<repo>/` for a
project site) is where people lose an afternoon.

## Decision

`inkan init` copies two ready pipelines into the repository: `.github/workflows/decisions.yml` for
GitHub Actions and `.gitlab-ci.yml` for GitLab CI. Both run `inkan check` and build every pull or merge
request, so broken references and invalid front matter fail the check, and publish the default branch to Pages.
Both set `BASE_PATH` to the repository name,
which is right for a project site and is one line to remove for a custom domain. Existing files are never
overwritten.

## How to use it

```bash
npx inkan init
git add . && git commit -m "Add decision site" && git push
```

Delete the file for the platform you do not use.

### GitHub Pages

```yaml title=".github/workflows/decisions.yml"
# Checks and builds every pull request (broken references or invalid front matter fail the job)
# and publishes main to GitHub Pages (Settings → Pages → Source: GitHub Actions).
name: Decisions site

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history for "Last updated"
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npx inkan check # broken links, duplicate numbers, unknown statuses … as PR annotations
      - run: npm run build
        env:
          # Project sites live under /<repo>/. Remove for a custom domain.
          BASE_PATH: /${{ github.event.repository.name }}
      - uses: actions/upload-pages-artifact@v3
        if: github.ref == 'refs/heads/main'
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

One-time setup in the repository: Settings, Pages, Source: "GitHub Actions". The site appears at
`https://<owner>.github.io/<repo>/`.

| Change | When |
| --- | --- |
| Remove the `BASE_PATH` line | Custom domain, or a `<owner>.github.io` user site served at `/` |
| Replace `main` in both `branches` and `if` | Your default branch has another name |
| `npm ci` instead of `npm install` | You commit `package-lock.json` and want exact versions |
| Add `url: 'https://<owner>.github.io/<repo>'` to the config | So `llms.txt`, RSS and the sitemap carry the real address |
| Add `--strict` to the `check` step | Warnings (one-sided supersede links, unknown authors, overdue `reviewBy` and due reviews) fail the job too |
| Add a `schedule:` trigger and a token for `sources` | The hub pulls records from other repositories; see [Records from other repositories](0005-records-from-other-repositories.md) |

`fetch-depth: 0` is not cosmetic: the "Last updated" dates on pages come from `git log`, and a shallow clone
would date every page to the day of the build.

On GitHub Actions `inkan check` prints every problem as a workflow annotation on the file and line, so a
broken `supersedes` reference shows up in the pull request's "Files changed" view. The step exits 1 on errors and
stops the job before the build; the build itself still validates front matter. If the hub lists `sources`, the
check and the build fetch them, so the job needs credentials that can read those repositories. Every rule the
command applies is listed in [Check records in CI](../../cli/adr/0007-check-records-in-ci.md).

### GitLab Pages

```yaml title=".gitlab-ci.yml"
# Checks and builds merge requests and publishes the default branch to GitLab Pages.
image: node:22

variables:
  GIT_DEPTH: 0 # full history for "Last updated"

build:
  script:
    - npm install
    - npx inkan check # broken links, duplicate numbers, unknown statuses …
    - npm run build
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

pages:
  script:
    - npm install
    - npx inkan check
    # Project pages live under /<project>/. Remove BASE_PATH for a custom domain.
    - BASE_PATH="/$CI_PROJECT_NAME" npm run build
    - mv dist public
  artifacts:
    paths: [public]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

GitLab publishes the `public` folder of a job named `pages`, hence the `mv`. The site appears at
`https://<group>.gitlab.io/<project>/`. For a group site or a custom domain, remove `BASE_PATH=...` from the
build line. With `repo.provider: 'gitlab'` in the config, the edit and "New ADR" links point at GitLab's
web editor.

GitLab has no annotation format, so `check` prints its report to the job log; `--format json` gives a
machine-readable report if you want to post it elsewhere.

> [!NOTE]
> Both pipelines check and build on every pull or merge request but publish only from the default branch. A
> failing check on a pull request is the point: fix the reference or the front matter, push again.

### What the pipelines do not do

- No preview deployment per pull request. Download the `dist` artifact or run `npm run preview` locally.
- No caching of `node_modules`. Add `cache: npm` to `setup-node`, or a GitLab `cache:` block, if install time matters.
- No `url` for you. Set it in `inkan.config.ts`; the pipelines cannot know your final domain.
- No credentials or schedule for `sources`. A hub that pulls records from other repositories adds both by hand.

## Consequences

- A new repository is published with `init`, one commit and one click in the Pages settings.
- The default assumes a project site under `/<repo>/`. Custom domains need one line removed, and forgetting it produces a site whose links all start with the repository name.
- `init` never overwrites files, so an existing `.gitlab-ci.yml` or workflow keeps its content; copy the relevant jobs by hand.
- The two files encode today's recommended actions (`upload-pages-artifact@v3`, `deploy-pages@v4`). They are yours after `init` and do not update with the package.
