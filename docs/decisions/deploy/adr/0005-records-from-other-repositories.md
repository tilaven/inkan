---
title: "Records from other repositories"
description: "The sources option pulls records kept in other repositories or folders into the site as one project each; inkan sync keeps a shallow clone of every repo source."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, content, cli]
options: [sources]
related: [deploy/rfc/0001-aggregate-records-from-many-repositories, authoring/adr/0001-one-folder-per-project, deploy/adr/0002-github-and-gitlab-pages, ai/adr/0002-decisions-json, ai/adr/0005-mcp-server-for-agents]
---

## Context

One repository with one folder per project is the simplest layout and the default. Many teams keep their
decisions next to their code instead: `docs/decisions/` in the service repository, reviewed in the same pull
requests as the change. Without aggregation the organisation has one site per repository, or none, and agents
have several `llms.txt` files to find instead of one. The proposal in
[Aggregate records from many repositories](../rfc/0001-aggregate-records-from-many-repositories.md) asked for a
`sources` option that pulls those folders into one site at build time.

## Decision

`sources` in `inkan.config.ts` lists projects that live elsewhere. Each entry is either a git remote
(`repo`), which `inkan sync` clones shallowly into `node_modules/.inkan/sources/<project>`, or a
folder on disk (`dir`). A source appears as a project exactly like a folder under `contentDir`: same pages, same
`_project.yml`, same ids (`<project>/<type>/<slug>`), same `llms.txt` and `decisions.json`. Nothing is copied
into the content folder. "Edit" and "New ADR" links, and the `source` field of a record, point at the repository
the record came from, and records fetched from a `repo` are read-only for the CLI.

## How to use it

### Configure sources

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';

export default defineConfig({
  repo: { url: 'https://github.com/acme/decisions', branch: 'main' },
  sources: [
    // path defaults to docs/decisions; branch to the remote's default branch
    { project: 'checkout', repo: 'git@github.com:acme/checkout.git', branch: 'main' },
    // self-hosted GitLab: name the provider so edit links use GitLab's editor URLs
    { project: 'mobile', repo: 'https://git.acme.dev/apps/mobile.git', provider: 'gitlab', path: 'adr' },
    // a folder next to this repository, read in place, never fetched
    { project: 'search', dir: '../search-service', path: 'adrs' },
  ],
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `project` | required | Project id and URL segment, a folder-style name (letters, digits, `-`, `_`). Must not also exist under `contentDir`; the build fails with `project "x" also exists locally` |
| `repo` | none | What `git clone` takes: an `https://` or `ssh://` URL, `git@host:org/x.git`, or a local path relative to the config folder (turned into a `file://` URL). Exactly one of `repo` or `dir` |
| `dir` | none | Folder relative to the config folder, read as it is. Exactly one of `repo` or `dir` |
| `path` | `docs/decisions` | Records folder inside the repository or folder. Relative, no `..` segments |
| `branch` | remote default | Branch to follow. `repo` only |
| `provider` | guessed | `'github'` or `'gitlab'`, for edit links; guessed from `repo` (`gitlab` when the URL contains "gitlab"). `repo` only |

`repo`, `branch` and `path` must not start with `-`. Listing the same `project` twice is an error.

The folder at `path` holds `<type>/NNNN-title.md` files and an optional `_project.yml`, which gives the project
its name, description and owners. A repository laid out like the hub itself (`<path>/<project>/<type>/...`) works
too: when `<path>` has no records of its own, the folder named after the project inside it is used.

```text
checkout/                                 the source repository
  docs/decisions/
    _project.yml                          name: Checkout, owners, ...
    adr/0001-use-stripe.md                -> /checkout/adr/0001-use-stripe/
    rfc/0001-split-the-cart.md
```

### Fetch with inkan sync

```bash
npx inkan sync
# sync: checkout ← git@github.com:acme/checkout.git (main) docs/decisions @ 3f2a9c1: 12 records
# sync: search ← ../search-service/adrs (local): 4 records
```

`sync` makes a shallow (`--depth 1`), single-branch clone of every `repo` source with only `path` checked out
(sparse checkout), under `node_modules/.inkan/sources/<project>`. Later runs fetch the new tip and reset to
it, so the cache never grows history. `dir` sources need no fetching and are listed as `(local)`. If `path` is
not in the repository, `sync` fails with `folder "docs/decisions" not found in <repo>`.

You rarely run it yourself:

| Command | What it does with sources |
| --- | --- |
| `inkan build` | Refreshes every `repo` source, then builds. `--offline` builds from the cache and fails when a source was never fetched |
| `inkan dev` | Fetches only the sources that are not cached yet, then starts. Run `sync` to pull newer records |
| `inkan check`, `inkan mcp` | Fetch missing sources, then include sourced records |
| `inkan preview` | Nothing; it serves `dist/` |

The cache lives under `node_modules/`, which the `.gitignore` from `init` already excludes. Deleting it is safe.

### Authentication and private repositories

`sync` runs `git` with `GIT_TERMINAL_PROMPT=0`, so it never waits for a password; a repository git cannot read
fails the command with git's own message. Give git the credentials the way you already do:

- SSH remotes (`git@github.com:acme/checkout.git`) use the SSH agent or deploy key of the machine.
- HTTPS remotes use git's credential helper, or a token in the URL read from the environment:

```ts title="inkan.config.ts"
sources: [
  { project: 'checkout', repo: `https://x-access-token:${process.env.SOURCES_TOKEN}@github.com/acme/checkout.git` },
],
```

The web URL derived for edit links drops the user part of an HTTPS URL, so a token never ends up on a page.

### CI

The pipelines from `init` run `npx inkan check` and `npm run build`, and `build` syncs the sources first,
so a hub with sources needs two additions: credentials for the source repositories and a reason to rebuild when a
source changes. On GitHub Actions a `SOURCES_TOKEN` secret (a fine-grained token with read access to the source
repositories) and a `schedule:` trigger cover both:

```yaml title=".github/workflows/decisions.yml (additions)"
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * 1-5' # rebuild on weekday mornings to pick up source changes

jobs:
  build:
    steps:
      - run: npx inkan check
        env:
          SOURCES_TOKEN: ${{ secrets.SOURCES_TOKEN }}
      - run: npm run build
        env:
          SOURCES_TOKEN: ${{ secrets.SOURCES_TOKEN }}
          BASE_PATH: /${{ github.event.repository.name }}
```

A `repository_dispatch` event sent from the source repositories' pipelines rebuilds immediately instead of on a
schedule. See [GitHub and GitLab Pages](0002-github-and-gitlab-pages.md) for the full files.

### What the site does with sourced records

- Record ids are `<project>/<type>/<slug>`, so `supersedes`, `related` and cross-project links work across
  repositories. Relative `.md` links and images inside a source resolve to the project's pages.
- "Edit on GitHub/GitLab" opens the file in the source repository, on its `branch` (or the branch the clone is
  on). The project page's "New ADR" button opens the source repository's editor in `<path>/<type>/` with the
  next number and the hub's template. Both need a web URL that can be derived from `repo`; a `file://` or
  unrecognised remote gets no links.
- `source` in `decisions.json` and `llms-full.txt` is the file's web URL in the source repository
  (`https://github.com/acme/checkout/blob/main/docs/decisions/adr/0001-use-stripe.md`), or `<repo> <path>` when
  no web URL is known. Local records keep a path relative to the hub repository.
- Dates and authors are not filled from git for `repo` sources, because the clone is shallow. `dir` sources are
  read from their own repository's history.
- `check` reports broken references and duplicate numbers in sourced records too, but does not warn about
  authors missing from the hub's `_authors.yml` for `repo` sources.

### Read-only source records

The clone is a cache. `inkan status`, `inkan supersede`, `inkan new` and
`inkan import` refuse to touch a `repo` source and name the repository to change instead:

```text
checkout/adr/0001-use-stripe comes from the "checkout" source (git@github.com:acme/checkout.git) and cannot be edited here; change it in that repository.
```

The source repository can run Inkan itself, with the folder as its `contentDir`, or just edit the files
and let the hub's next build pick them up. `dir` sources are ordinary folders and are edited in place.

> [!NOTE]
> A source's `_project.yml` lives in the source. There is no local override, because a local
> `<contentDir>/<project>/` folder with the same name is an error.

## Consequences

- Teams keep records with their code and review them in the same pull requests; the organisation gets one site, one search, one `llms.txt` and one MCP server.
- The site is only as current as its last build. Without a schedule or a dispatch from the source repositories, a merged record appears when the hub next builds.
- Every build clones the sources. A source that is unreachable fails the build; `--offline` keeps a cached copy usable.
- No "Last updated" or inferred authors for `repo` sources, a consequence of shallow clones.
- Sourced records use the hub's `docTypes`, `statuses` and templates. A source repository with its own Inkan config must keep them compatible or the hub's build rejects its front matter.
