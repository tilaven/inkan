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

### New repository

```bash
npm create inkan@latest my-decisions
cd my-decisions
npm install
```

`npm create inkan` runs `inkan init` in the folder you name (`decisions-site` when you give none). The result is a small repository that already builds:

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

### Existing repository

```bash
npm install -D inkan
npx inkan init
```

`init` only adds files that do not exist yet. It adds the `dev`, `build`, `preview`, `new`, `status`, `supersede` and `check` scripts to your `package.json` and keeps the scripts you already have. Details: [Scaffold with init and npm create](cli/adr/0002-scaffold-with-init-and-npm-create.md).

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
import { defineConfig } from 'inkan';

export default defineConfig({
  title: 'Acme Decisions',
  tagline: 'Architecture decisions and RFCs for every team, in one place.',
  url: 'https://decisions.acme.dev',
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
});
```

`url` is used for `llms.txt`, RSS and the sitemap. `repo` turns on the "Edit this page" and "New ADR" buttons. The full list of options is in the [configuration reference](configuration.md).

## Next steps

- [Repository layout](project-structure.md): where every file goes and which URL it gets.
- [Front matter reference](front-matter.md): every field a record, project or author can have.
- [Configurable status lifecycle](authoring/adr/0004-configurable-status-lifecycle.md): rename statuses or add your own.
- [Change status and supersede from the CLI](cli/adr/0005-change-status-and-supersede-from-the-cli.md): `npm run status -- platform/adr/2 accepted` when the decision is made.
- [Import from log4brains, MADR and adr-tools](cli/adr/0006-import-from-log4brains-madr-and-adr-tools.md): bring your existing ADR folder in.
- [GitHub and GitLab Pages](deploy/adr/0002-github-and-gitlab-pages.md): publish the site with the workflow `init` created.
- [Theme with --inkan-* CSS tokens](theming/adr/0003-theme-with-inkan-css-tokens.md): give the site your colours.
