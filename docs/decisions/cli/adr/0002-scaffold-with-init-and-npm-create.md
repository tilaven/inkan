---
title: "Scaffold with init and npm create"
description: "What inkan init and npm create inkan put into a repository, and how they behave in a folder that already has files."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [cli, deploy]
related: [cli/adr/0001-ship-as-an-npm-package-with-a-cli, deploy/adr/0002-github-and-gitlab-pages, deploy/adr/0003-docker-and-nginx, ai/adr/0004-agents-md-for-coding-agents]
---

## Context

A tool that needs "only Markdown and one config file" still has a first five minutes: a config with the right import, a project folder with a `_project.yml`, one record that shows the format, npm scripts, a `.gitignore`, and a CI workflow so the site is published from day one. Writing these by hand from the README is slow and error-prone, and a decision log often starts inside an existing repository that already has a `package.json`.

## Decision

`inkan init [dir]` copies a starter repository from the package and wires up `package.json`. It never overwrites a file that already exists, so it is safe to run inside an existing repository. `npm create inkan` is a thin wrapper, published as `create-inkan`, that runs the same `init` in a new folder.

The starter is complete: it builds and deploys without edits. Everything in it is a plain file you can change or delete afterwards.

## How to use it

### A new repository

```bash
npm create inkan@latest my-decisions
cd my-decisions
npm install
npm run dev
```

`npm create inkan [dir]` resolves the `inkan` package it depends on and runs `inkan init <dir>`. When you give no folder name it uses `decisions-site`. After `init` you still run `npm install` yourself; the output ends with the exact next commands.

### An existing repository

```bash
npm install -D inkan
npx inkan init
```

Without an argument `init` targets the current folder (or `--root`). With `npx inkan init docs` the files land in `docs/`, which is how this site is laid out. Run the CLI from that folder afterwards, or pass `--root docs`.

### What `init` creates

| File | Purpose |
| --- | --- |
| `inkan.config.ts` | `defineConfig` with `title`, `tagline`, `url` and `repo` to fill in. |
| `decisions/_authors.yml` | One example author (`jane.doe`), to show the format. |
| `decisions/platform/_project.yml` | A first project named Platform with icon, description and owner. |
| `decisions/platform/adr/0001-record-architecture-decisions.md` | A first ADR with a Mermaid diagram, so the site is not empty. |
| `AGENTS.md` | Instructions for coding agents: where records live, how to create one, what statuses mean. |
| `.github/workflows/decisions.yml` | Builds every pull request and publishes `main` to GitHub Pages. |
| `.gitlab-ci.yml` | Builds merge requests and publishes the default branch to GitLab Pages. |
| `Dockerfile`, `nginx.conf`, `.dockerignore` | Two-stage image: build with Node, serve `dist/` with nginx. |
| `.gitignore` | `node_modules/` and `dist/`. |
| `package.json` | Created, or updated in place (see below). |

The dotfiles are stored in the package as `_gitignore` and `_dockerignore` and renamed on copy, because npm drops `.gitignore` from published packages. `init` prints every file it added with a `+` and marks `package.json` with `~`.

### How `package.json` is handled

If there is no `package.json`, `init` creates one:

```json title="package.json"
{
  "name": "my-decisions",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "inkan dev",
    "build": "inkan build",
    "preview": "inkan preview",
    "new": "inkan new"
  },
  "devDependencies": {
    "inkan": "^0.1.0"
  }
}
```

If one exists, `init` only adds to it:

- The four scripts are added. Scripts you already have, including ones with the same names, are kept as they are.
- `"type": "module"` is set only when `type` is missing. The config file is an ES module, so a repository that uses CommonJS keeps `.ts` for the config and is otherwise unaffected.
- `inkan` is added to `devDependencies` at the installed version, unless it is already in `dependencies`.

Nothing else in the file is touched, and key order of your existing fields is preserved.

### Existing files are never replaced

`init` skips any file that already exists at the destination and keeps going. Running it twice is harmless. This also means a second `init` does not refresh an old workflow file: delete it first if you want the current one.

### After init

1. Set `title`, `url` and `repo` in `inkan.config.ts`. `repo` enables the edit and "New ADR" buttons; `url` is used in feeds and `llms.txt`.
2. Rename the `platform` folder or add your own projects. A folder with records is enough; `_project.yml` adds the display name.
3. Push. The GitHub workflow needs Pages set to "GitHub Actions" as the source; the GitLab pipeline publishes to Pages on the default branch. Both set `BASE_PATH=/<repository name>` for project pages; remove that line for a custom domain. See [GitHub and GitLab Pages](../../deploy/adr/0002-github-and-gitlab-pages.md).
4. Optional: `docker build -t decisions .` for a self-hosted image. See [Docker and nginx](../../deploy/adr/0003-docker-and-nginx.md).

> [!NOTE]
> The CI files and the Dockerfile use Node 22 and run `npm install` or `npm ci`. The Dockerfile expects a `package-lock.json`, so commit the lockfile that `npm install` created.

## Consequences

- One command gives a repository that builds and deploys. New users see a working site before reading any documentation.
- Safe in existing repositories: nothing is overwritten and `package.json` is extended, not replaced.
- The starter is a snapshot. Files it created are yours from then on; updates to the package's starter do not propagate to them, which is intended for CI files you will edit anyway.
- `npm create inkan` pins the `inkan` version it was published with. Use `@latest` to get the current one.
- The starter ships files for every target (GitHub, GitLab, Docker). Delete the ones you do not use.
