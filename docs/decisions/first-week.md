---
title: "Your first week"
description: "From a working local site to a published one: connect GitHub, GitLab, self-hosted GitLab or Gitea, rebuild on events and tell your team about new decisions."
order: 3
---

The [quick start](quick-start.md) ends with a site on your machine. This guide covers what comes next: put it on the web, point it at your Git host, keep it current and bring your team in. Every step links to the page that describes it in full.

## Before you start

You have a repository with `inkan.config.ts` and a `decisions/` folder, and `npm run build` works. If not, finish the [quick start](quick-start.md) first.

Two settings matter on every host. Set both in `inkan.config.ts`:

```ts title="inkan.config.ts"
import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  title: 'Acme Decisions',
  // Where the site will live. Used for llms.txt, RSS, the sitemap and links in notifications.
  url: 'https://acme.github.io/decisions',
  // Where the records live. Turns on "Edit this page" and "New ADR".
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
});
```

`repo.provider` decides how edit links are built. Use the value for your host:

| Host | `repo.provider` |
| --- | --- |
| GitHub, GitHub Enterprise | `'github'` (the default) |
| GitLab.com, self-hosted GitLab | `'gitlab'` |
| Gitea, Forgejo | `'gitea'` |

> [!NOTE]
> `provider: 'gitea'` applies to `repo.provider` and to `provider` inside `sources`. It ships together with this guide. On a release that does not have it yet, `inkan build` rejects the value, so update `@tilaven/inkan` first.

## Publish on GitHub Pages

`inkan init` already wrote `.github/workflows/decisions.yml`.

1. Commit and push to GitHub:

   ```bash
   git add .
   git commit -m "Add decision site"
   git push
   ```

2. In the repository, open Settings, then Pages, and set Source to "GitHub Actions".
3. Open the Actions tab. When the run is green, the site is at `https://<owner>.github.io/<repo>/`.

The workflow checks and builds every pull request, and publishes only from `main`. It sets `BASE_PATH` to the repository name, which is right for that address. For a custom domain remove the `BASE_PATH` line. Full file and a table of changes: [GitHub and GitLab Pages](deploy/adr/0002-github-and-gitlab-pages.md).

## Publish on GitLab Pages

`init` also wrote `.gitlab-ci.yml`. Push it to a GitLab project. The `pages` job builds the default branch and publishes `public/`. The site appears at `https://<group>.gitlab.io/<project>/`. Set `repo.provider: 'gitlab'` so edit links open GitLab's editor.

Keep only the file for the host you use. Delete the other one.

## Self-hosted GitLab

The `.gitlab-ci.yml` from `init` works on a self-hosted instance that has Pages enabled. Name the provider, because Inkan cannot tell from a custom host name that it is GitLab:

```ts title="inkan.config.ts"
repo: { url: 'https://git.acme.dev/platform/decisions', branch: 'main', provider: 'gitlab' },
url: 'https://platform.pages.acme.dev/decisions',
```

The same goes for records you pull from other repositories. Inkan guesses `gitlab` only when the repository host contains "gitlab". Otherwise set `provider: 'gitlab'` on the source (see [Records in other repositories](#records-in-other-repositories)).

If your instance has no Pages, build in CI and serve `dist/` from any web server, or use the [Docker image](deploy/adr/0003-docker-and-nginx.md).

## Gitea and Forgejo

Gitea and Forgejo have no Pages job like GitHub's, but they run GitHub-style workflows with Gitea Actions and Forgejo Actions. You need a runner registered for the repository.

1. Set `repo.provider: 'gitea'` in `inkan.config.ts`.
2. Move the workflow into `.gitea/workflows/` (Gitea) or `.forgejo/workflows/` (Forgejo). Keep the `check` and `build` steps from `.github/workflows/decisions.yml`. Remove the `upload-pages-artifact` step and the whole `deploy` job, which use GitHub Pages. Then remove `needs: deploy` from the `notify` job (or delete `notify` if you do not want messages), or the workflow is invalid.
3. Publish `dist/` the way you publish other static sites. The easiest route is the Docker image that `init` already created:

   ```bash
   docker build -t decisions .
   docker run --rm -p 8080:80 decisions
   ```

   A workflow can run the same build and push the image to your registry. Details of the image and its `nginx.conf`: [Docker and nginx](deploy/adr/0003-docker-and-nginx.md).

Set `BASE_PATH` only when the site is served under a sub-path. See [Serve from a sub-path](deploy/adr/0004-serve-from-a-sub-path.md).

## Rebuild on events

A static site is only as current as its last build. Decide what triggers one.

| Event | How |
| --- | --- |
| A record changes in this repository | Push to the default branch. The workflow from `init` builds on every push to it. |
| A pull request | The same workflow runs `inkan check` and a build, without publishing. A bad reference or front matter fails the check. |
| A record changes in another repository | List that repository in `sources`, then rebuild on a schedule or on an event from the other repository. |
| A fixed time | Add a `schedule:` trigger, for example weekday mornings. |

### Records in other repositories

Teams often keep decisions next to their code. Pull them into one site with `sources`:

```ts title="inkan.config.ts"
export default defineConfig({
  sources: [
    { project: 'checkout', repo: 'git@github.com:acme/checkout.git' },
    { project: 'mobile', repo: 'https://git.acme.dev/apps/mobile.git', provider: 'gitlab', path: 'adr' },
    { project: 'tools', repo: 'https://code.acme.dev/infra/tools.git', provider: 'gitea' },
  ],
});
```

`inkan sync` fetches them, and `inkan build` does it for you. In CI the job needs a token that can read those repositories. Add it as a secret and read it from `process.env` in the URL. See [Records from other repositories](deploy/adr/0005-records-from-other-repositories.md) for the options, private repositories and the CI additions.

### Schedule and triggers

Replace the `on:` block of the workflow with this one, or merge the new triggers into the one you have. Keep a single `on:` per file:

```yaml title=".github/workflows/decisions.yml (on: block)"
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * 1-5' # weekday mornings
  repository_dispatch: # rebuild at once when a source repository sends an event
```

On GitLab create a schedule under Build, Pipeline schedules, and call the pipeline trigger API from the source repository to rebuild at once. Gitea and Forgejo workflows accept the same `schedule:` block. `repository_dispatch` is a GitHub Actions event: send it from the source repository's pipeline.

## Notify the team about accepted decisions

`inkan notify` posts a message to Slack, Microsoft Teams or a webhook when a record moves into `accepted`. The workflow from `init` already has a `notify` job that runs on the default branch. Without a webhook URL it only lists the changes in the job log. Add one to get messages:

- GitHub: Settings, Secrets and variables, Actions, then a secret named `INKAN_SLACK_WEBHOOK` or `INKAN_TEAMS_WEBHOOK`.
- GitLab: Settings, CI/CD, Variables, with the same names, masked.
- Gitea and Forgejo: add the same names as repository secrets, and give the job `fetch-depth: 0` so it can compare with the previous commit.

Try it locally first: `npx inkan notify --since main --dry-run` lists the records that moved to `accepted` since `main`. Without a webhook it then says "No notification channels"; once a webhook is set, `--dry-run` prints the messages it would send. The CI job runs only on pushes to the default branch, not on pull requests. For several channels, filters by project or type, and other chat tools, see [Notify chat when a decision is accepted](cli/adr/0008-notify-chat-when-a-decision-is-accepted.md).

## The week, day by day

| Day | Do this | Read |
| --- | --- | --- |
| 1 | Create the site, run `npm run dev`, write one record with `npx inkan new`. | [Quick start](quick-start.md) |
| 2 | Set `title`, `url` and `repo` in `inkan.config.ts`. Add your teams as folders and your people to `_authors.yml`. | [Configuration reference](configuration.md), [Repository layout](project-structure.md) |
| 3 | Push to your host and publish with the workflow from `init`. Share the link. | This page, [GitHub and GitLab Pages](deploy/adr/0002-github-and-gitlab-pages.md) |
| 4 | Bring in your existing ADRs with `inkan import`, or pull other repositories in with `sources`. | [Import from log4brains, MADR and adr-tools](cli/adr/0006-import-from-log4brains-madr-and-adr-tools.md), [Records from other repositories](deploy/adr/0005-records-from-other-repositories.md) |
| 5 | Add the webhook for notifications. Make the check a required check on pull requests; add `--strict` to its step if warnings should fail it too. | [Notify chat](cli/adr/0008-notify-chat-when-a-decision-is-accepted.md), [Check records in CI](cli/adr/0007-check-records-in-ci.md) |

After the first week, tune the [status lifecycle](authoring/adr/0004-configurable-status-lifecycle.md), add [custom fields](authoring/adr/0012-custom-metadata-fields.md) and set up [periodic reviews](authoring/adr/0011-review-decisions-on-a-schedule.md).
