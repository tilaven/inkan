---
title: "Quick start"
description: "Create a decision site, write the first record and build it, in about five minutes."
order: 2
---

## Requirements

- Node.js 22.22 or newer (the package declares `"engines": { "node": ">=22.22" }`).
- npm, or any package manager that can run `npm create` and `npx`.
- Git. Not required to build, but "Last updated" dates, edit links, the default author of `inkan new` and the `date` and `authors` of records that omit them come from it.

## 1. Create a site

Pick **one** of the two paths. They do the same thing, `inkan init`, in different places. Running both is never needed.

| | Path A: new repository | Path B: existing repository |
| --- | --- | --- |
| Use it when | You start from nothing, or the decisions get their own repository. | You already have a Git repository (a service, a monorepo, a docs repo) and want the site in it. |
| Where you run it | In the **parent** folder, for example `~/projects`. The command creates the new folder. | In the **root** of the repository, next to `.git`. A `package.json` is optional. |
| Command | `npm create @tilaven/inkan@latest my-decisions` | `npm install -D @tilaven/inkan`, then `npx inkan init` |

### Path A: new repository

Run this from the folder that should contain the new project, not from inside a project:

```bash
npm create @tilaven/inkan@latest my-decisions
cd my-decisions
npm install
```

`npm create @tilaven/inkan` downloads the scaffolder and runs `inkan init` for the folder you name. It creates that folder (`decisions-site` when you give no name) and fills it. Then you `cd` into it and install the dependencies. The result is a small repository that already builds:

```text
my-decisions/
  inkan.config.ts
  decisions/
    _authors.yml
    platform/
      _project.yml
      adr/0001-record-architecture-decisions.md
  package.json
  AGENTS.md
  Dockerfile  nginx.conf
  .github/workflows/decisions.yml  .gitlab-ci.yml
  .gitignore  .dockerignore
```

The folder is not a Git repository yet. Run `git init` in it (or push it to an empty repository on your host) when you are ready.

### Path B: existing repository

Run both commands in the root of the repository, the folder that holds `.git`:

```bash
cd path/to/your-repo
npm install -D @tilaven/inkan
npx inkan init
```

- `npm install -D @tilaven/inkan` adds Inkan to `devDependencies`. If the folder has no `package.json`, npm creates one first.
- `npx inkan init` writes the same files as path A into the current folder. It only adds files that do not exist yet, so nothing of yours is overwritten. It adds the `dev`, `build`, `preview`, `new`, `status`, `supersede` and `check` scripts to your `package.json` and keeps the scripts you already have.

Your repository may already use a `decisions` folder, or you may want the records elsewhere, for example `docs/decisions`. Set `contentDir` in `inkan.config.ts` (see [Configure](#5-configure)) and move the sample project there.

Details of both paths: [Scaffold with init and npm create](cli/adr/0002-scaffold-with-init-and-npm-create.md).

> [!NOTE]
> From here on, run every command in the folder that contains `inkan.config.ts` and `package.json`. That is `my-decisions/` for path A and the repository root for path B. To run from somewhere else, pass `--root <folder>`.

## 2. Write a record

```bash
npx inkan new adr platform "Use PostgreSQL for the ledger"
```

This creates `decisions/platform/adr/0002-use-postgresql-for-the-ledger.md` from the built-in ADR template, with today's date and your Git user name as the author. Open it and fill in the sections:

```md title="decisions/platform/adr/0002-use-postgresql-for-the-ledger.md"
---
title: Use PostgreSQL for the ledger
description: One sentence that says what was decided.
status: proposed
date: 2026-10-16
authors: [jane.doe]
deciders: []
tags: []
---

## Context
...
```

The type (`adr`) is the folder name. The project (`platform`) is the folder above it. A new project is a new folder: `inkan new rfc payments "Settle in async batches"` creates `decisions/payments/` with a `_project.yml` for you to fill in. See [Number records with inkan new](cli/adr/0003-number-records-with-inkan-new.md).

> [!TIP]
> Handles in `authors`, `deciders` and `owners` are free text. List them in `decisions/_authors.yml` when you want full names and avatars on the site.

## 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:4321>. Records, projects and the config file are watched; the site reloads when you save. Use `--port` and `--host` to change where it listens:

```bash
npx inkan dev --port 3000 --host
```

## 4. Build

```bash
npm run build
npm run preview
```

`build` writes the whole site to `dist/`: HTML, CSS, the search index, `rss.xml`, `sitemap-index.xml`, `llms.txt`, `decisions.json`, the `/export/` document, the `/badges/` images and a `.md` copy of every page. It fails when a record has invalid front matter, for example a `status` that is not in your list, so run it in CI on every pull request. `preview` serves `dist/` locally, search included.

```bash
npm run check
```

`check` takes seconds and finds what the build does not: a `supersedes` entry that points nowhere, two records with the same number, a supersede link set on one side only, a project without owners. The CI files from `init` run `check` and then `build` on every pull request. See [Check records in CI](cli/adr/0007-check-records-in-ci.md).

## 5. Configure

Everything about the site lives in `inkan.config.ts`:

```ts title="inkan.config.ts"
import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  title: 'Acme Decisions',
  tagline: 'Architecture decisions and RFCs for every team, in one place.',
  url: 'https://decisions.acme.dev',
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
});
```

`url` is used for `llms.txt`, RSS and the sitemap. `repo` turns on the "Edit this page" and "New ADR" buttons. The full list of options is in the [configuration reference](configuration.md).

## Windows

Inkan runs on Windows with PowerShell or Command Prompt, as long as Node.js is 22.22 or newer. The commands in these docs are the same. A few things differ from macOS and Linux:

- **Chaining commands.** Windows PowerShell 5.1 does not understand `&&`. Run the commands one per line, as this guide does, or use PowerShell 7.
- **Environment variables.** `BASE_PATH=/docs npm run build` is shell syntax for macOS and Linux. In PowerShell write `$env:BASE_PATH = '/docs'` on one line, then `npm run build`. In Command Prompt write `set BASE_PATH=/docs`, then `npm run build`.
- **Config file.** Inkan's config is `inkan.config.ts`, written in TypeScript. `inkan.config.mjs`, `inkan.config.js` and `inkan.config.json` work too. There is no TOML or YAML config.
- **Paths in the config.** Use forward slashes, or paths relative to the config file. A backslash starts an escape sequence in a JavaScript string, so `'C:\work\x'` does not mean what it looks like.

```ts title="inkan.config.ts"
export default defineConfig({
  contentDir: './decisions',      // relative to this file: the usual choice
  sources: [
    { project: 'search', dir: 'C:/work/search-service', path: 'adrs' }, // absolute path, forward slashes
  ],
});
```

- **Git.** Install [Git for Windows](https://git-scm.com/download/win) and make sure `git` works in the same terminal. Without it, dates, authors and "Last updated" are missing (see below).

## Common pitfalls

| Symptom | Cause and fix |
| --- | --- |
| `npm warn EBADENGINE` or errors from Node itself | Node.js is older than 22.22. Check with `node -v` and upgrade. |
| A project folder ends up inside another project | You ran `npm create` from inside a project. For a new repository, run it from the parent folder. For an existing repository, use path B instead. |
| `inkan: command not found`, or `npx inkan` offers to install a package | `@tilaven/inkan` is not installed in this folder. Answer no, go to the folder with `package.json` and run `npm install`. |
| The site is empty or shows the wrong title | You ran a command outside the site folder, so Inkan found no `inkan.config.ts`. `cd` into the folder, or pass `--root <folder>`. |
| You ran `npm create` and then `init` as well | Harmless. `init` skips files that already exist. Pick one path next time, and keep the folder you have. |
| Port 4321 is already in use | Another dev server is running. Stop it, or pick a port: `npx inkan dev --port 3000`. The terminal prints the address it really listens on. |
| `inkan build` fails with `unknown status` or another front matter error | The message names the file and the field. A `status` must be one of the keys in your [status list](authoring/adr/0004-configurable-status-lifecycle.md), in lower case: `accepted`, not `Accepted`. Run `npm run check` for the full list of problems. |
| `Invalid inkan config: ... unknown option, did you mean ...` | A key in `inkan.config.ts` is misspelled or does not exist. Unknown keys are an error on purpose. |
| No "Last updated", authors or dates | The folder is not a Git repository, or the clone is shallow. Run `git init` and commit. In CI use `fetch-depth: 0` (GitHub) or `GIT_DEPTH: 0` (GitLab); the `init` workflows already do. |
| Links on the deployed site start with the repository name, or 404 | A project site lives under `/<repo>/`, a custom domain at `/`. The workflows set `BASE_PATH` for the first case. Remove it for a custom domain. See [Serve from a sub-path](deploy/adr/0004-serve-from-a-sub-path.md). |
| "Edit this page" buttons are missing | `repo.url` is not set in `inkan.config.ts`. |
| `npm ci` fails in the Docker build or in CI | There is no `package-lock.json`. Run `npm install` once and commit the lock file. |

## Next steps

- [Your first week](first-week.md): publish the site, connect your Git host, rebuild on events and notify your team.
- [Repository layout](project-structure.md): where every file goes and which URL it gets.
- [Front matter reference](front-matter.md): every field a record, project or author can have.
- [Configurable status lifecycle](authoring/adr/0004-configurable-status-lifecycle.md): rename statuses or add your own.
- [Change status and supersede from the CLI](cli/adr/0005-change-status-and-supersede-from-the-cli.md): `npm run status -- platform/adr/2 accepted` when the decision is made.
- [Import from log4brains, MADR and adr-tools](cli/adr/0006-import-from-log4brains-madr-and-adr-tools.md): bring your existing ADR folder in.
- [GitHub and GitLab Pages](deploy/adr/0002-github-and-gitlab-pages.md): publish the site with the workflow `init` created.
- [Theme with --inkan-* CSS tokens](theming/adr/0003-theme-with-inkan-css-tokens.md): give the site your colours.
