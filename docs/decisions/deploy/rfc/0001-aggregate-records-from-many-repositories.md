---
title: "Aggregate records from many repositories"
description: "Proposal: let teams keep ADRs in their service repositories and have the build pull them into one site, one project folder per source."
status: accepted
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, content, roadmap]
related: [deploy/adr/0005-records-from-other-repositories, authoring/adr/0001-one-folder-per-project, deploy/adr/0002-github-and-gitlab-pages, ai/adr/0002-decisions-json]
---

Accepted and implemented: see [Records from other repositories](../adr/0005-records-from-other-repositories.md).

## Summary

Add a `sources` option that lists repositories and paths to pull records from. Before the build, Inkan
fetches each source into `<contentDir>/<project>/` and builds the site as if the files had always been there.
Teams keep their ADRs next to their code; the organisation gets one searchable archive and one `llms.txt`.
This is the main limitation log4brains users report.

## Motivation

Inkan assumes one repository with one folder per project. That is the simplest setup and the right
default. It does not match how many organisations work: a service team keeps `docs/decisions/` in the service
repository, reviews records in the same pull requests as the code, and does not want a second repository to
remember. Today those teams either copy files by hand, run their own site per repository, or give up on a
shared archive. Agents then have five `llms.txt` files to find instead of one.

The static build is a good fit for aggregation: fetching happens once, at build time, in CI, with the
credentials CI already has. Nothing changes at serve time.

## Proposal

### Configuration

```ts title="inkan.config.ts"
export default defineConfig({
  sources: [
    { project: 'payments', repo: 'https://github.com/acme/payments-service', path: 'docs/decisions', branch: 'main' },
    { project: 'mobile', repo: 'git@gitlab.acme.dev:apps/mobile.git', path: 'adr' },
  ],
});
```

| Field | Default | Meaning |
| --- | --- | --- |
| `project` | required | Folder name under `contentDir`; becomes the project id and URL segment |
| `repo` | required | Clone URL; HTTPS with a token from the environment or SSH |
| `path` | `'docs/decisions'` | Folder inside that repository to pull |
| `branch` | `'main'` | Branch or tag to read |

The local `decisions/` folder keeps working alongside sources. A `_project.yml` for a pulled project can live
either in the source folder (the team owns it) or locally in `decisions/<project>/_project.yml` (the archive
owns it); the local file wins.

### Build steps

1. `inkan build` and `dev` run a fetch step before Astro starts: a shallow clone of each source at
   `branch`, with the full history only when "Last updated" dates are wanted.
2. The `path` folder is copied to `<contentDir>/<project>/`. Files and folders starting with `_` are copied too, so a
   source can ship its own `_project.yml`.
3. A marker file, `<contentDir>/<project>/.inkan-source`, records the repository, commit and time, and
   tells `new` to refuse creating records there: records are written in the source repository.
4. The build continues as today. Pulled folders are added to `.gitignore` by `init` when `sources` is set.

`inkan fetch` runs step 1 and 2 alone, for scripts and for a look at the merged tree.

### Links back to the source

`repo` in the config is one repository today. Pulled records need "Edit on GitHub" and "New ADR" links that
point at their own repository and path. The source entry supplies them; the aggregated site's `repo` stays the
default for local projects. `decisions.json` gains a `repository` field per record so agents can tell where a
record is maintained.

### Cross-repository references

`supersedes`, `related` and relative `.md` links keep working inside one project because the folder layout is
preserved. References across repositories use the aggregated id, `<project>/<type>/<slug>`, which is what the
site already resolves. Validation of broken references matters more here: a renamed
file in one repository breaks a link in another.

### CI

The GitHub workflow needs a token that can read the source repositories (`GH_TOKEN` or a deploy key), and a
schedule or a repository-dispatch event so the archive rebuilds when a source changes. The starter workflow
would gain a commented `schedule:` trigger.

## Open questions

- Shallow clone by default, or full history so "Last updated" is correct? Full history of many large service repositories is slow; a `--filter=blob:none` partial clone may be the middle ground.
- Should a source be allowed to map several `path` folders to several projects from one clone, for monorepos that hold more than one team?
- How are conflicts handled when a local `decisions/<project>/` and a source use the same project name: fail, or merge with local files winning?
- Should `dev` fetch on every start, or only with `--fetch`, so local work stays fast and offline?
- Does the "New ADR" button on a pulled project open the source repository's editor, or hide itself because the template may differ there?
- Is `.inkan-source` the right marker, or should the resolved config carry a `sources` map that pages read, with nothing written into the content folder?
