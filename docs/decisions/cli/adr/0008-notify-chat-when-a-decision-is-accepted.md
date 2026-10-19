---
title: "Notify chat when a decision is accepted"
description: "How inkan notify posts to Slack, Teams or a webhook when records move into a notified status, which commit it compares with, how channels are filtered, and how the starter CI files run it."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [cli, deploy, lifecycle]
related: [cli/adr/0005-change-status-and-supersede-from-the-cli, cli/adr/0007-check-records-in-ci, authoring/adr/0004-configurable-status-lifecycle, deploy/adr/0002-github-and-gitlab-pages, deploy/adr/0005-records-from-other-repositories, deploy/adr/0007-sign-in-and-protected-projects]
---

## Context

A decision matters when the people it affects know about it. A pull request that sets a record to `accepted` is reviewed by a few people, and everyone else finds out when they open the site, if they do. The site is passive: it is always up to date and nobody is told that something changed. Teams already work in a chat tool, and a short message with the title and a link there is what gets a decision read.

## Decision

`inkan notify` compares the records with an earlier commit and posts a message for every record whose status changed into a notified status. The default is `accepted`; `notify.statuses` changes it. It runs in CI after the site is deployed, so the link in the message already works. Slack, Microsoft Teams and any generic webhook are supported. Webhook URLs come from environment variables or from the config through `process.env`, never from literals, and they are not part of the built site.

## How to use it

### What counts as a change

A record is reported when all of these hold:

- its file changed between the compared commit and the working tree;
- its `status` is in the notified list;
- its `status` at the compared commit was different, or the record did not exist there. A record added in the range counts as changed from no status.

Renames are followed: a record that moved to another folder and went from `proposed` to `accepted` is reported once, with `proposed` as its previous status. A record that is edited but keeps its status is not reported, and neither is a record that left the notified status. Records from `repo` sources are skipped, because their history lives in their own repository.

Protected records are never posted: a record of a project with `protected: true` or on a path in `protectedRoutes` (see [Sign-in and protected projects](../../deploy/adr/0007-sign-in-and-protected-projects.md)) is left out of every channel, whatever its filters, because a chat room is not a place only members can see. The message would carry the title, description and link of something the public site hides.

### Which commit it compares with

| Source | Compared commit |
| --- | --- |
| `--since <ref>` | The ref you pass. |
| GitHub Actions, push | `before` from the event file (`GITHUB_EVENT_PATH`). |
| GitHub Actions, pull request | The base sha of the pull request. |
| GitLab CI, merge request pipeline | `CI_MERGE_REQUEST_DIFF_BASE_SHA`. |
| GitLab CI, other pipelines | `CI_COMMIT_BEFORE_SHA`. |
| Anywhere else | `HEAD~1`. |

The first push of a new branch has no previous commit (the sha is all zeros). The command then prints `No previous commit to compare with (first push of a branch); nothing to notify.` and exits with 0. A compared commit that is not in the clone is an error that names the cause. The job needs the full history: `fetch-depth: 0` on GitHub, `GIT_DEPTH: 0` on GitLab.

Locally the working tree is included in the comparison (tracked files only: `git add` a new record first), so `npx inkan notify --since main --dry-run` shows what a pull request would send.

### Channels

A channel is a webhook that receives messages. The simplest setup is an environment variable, usually a CI secret:

| Variable | Channel |
| --- | --- |
| `INKAN_SLACK_WEBHOOK` | Slack |
| `INKAN_TEAMS_WEBHOOK` | Microsoft Teams |
| `INKAN_WEBHOOK` | Generic webhook |

For more than one channel of a type, or for filters, list them in `notify.channels`:

```ts title="inkan.config.ts"
export default defineConfig({
  url: 'https://decisions.acme.dev',
  notify: {
    statuses: ['accepted'],
    channels: [
      { type: 'slack', name: 'platform-slack', url: process.env.SLACK_PLATFORM },
    ],
  },
});
```

| Key | What it does |
| --- | --- |
| `type` | `slack`, `teams` or `webhook`. |
| `url` | The webhook URL. Always read it from `process.env`; the config file is committed. A channel whose URL is empty is skipped. |
| `name` | Label in the command output. Without it the label is the type, numbered when there are several of one type. URLs are never printed. |
| `projects` | Only records of these projects. |
| `types` | Only these record types, for example `['adr']`. |
| `statuses` | Replaces `notify.statuses` for this channel. |
| `headers` | `webhook` only: extra request headers, for example an authorization token. Read secret values from `process.env` too. |
| `body` | `webhook` only: a function that returns the JSON body instead of `{ site, events }`. |

Channels from the environment and from the config add up. A status that is not in `statuses` of the config is an error (`notify: unknown status "acepted". Did you mean "accepted"? Known: ...`), checked before anything is sent, so a typo fails the job instead of silencing it.

### Route decisions to the team that cares

Each channel has its own filters, so one pipeline can serve several rooms:

```ts title="inkan.config.ts"
export default defineConfig({
  notify: {
    channels: [
      { type: 'slack', name: 'platform', url: process.env.SLACK_PLATFORM, projects: ['platform', 'sre'] },
      { type: 'slack', name: 'payments', url: process.env.SLACK_PAYMENTS, projects: ['payments'] },
      { type: 'teams', name: 'architects', url: process.env.TEAMS_ARCHITECTS, types: ['adr', 'rfc'], statuses: ['accepted', 'rejected'] },
    ],
  },
});
```

A record reaches a channel when its project and type match (an empty or missing list matches everything) and its status is in the channel's `statuses`, or in `notify.statuses` when the channel has none. The command works out the union of all these statuses first, so a channel that wants `rejected` sees `rejected` records even though the global list says `accepted`.

### Slack

Create an incoming webhook for a channel (Slack app, Incoming Webhooks) and store the URL as `INKAN_SLACK_WEBHOOK`. Each record becomes a Block Kit message: the heading as a link, the description, and a line with the project, type, status change and authors. Link unfurling is off. Mattermost and Rocket.Chat accept the same payload on their incoming webhooks, so use `type: 'slack'` for them.

### Microsoft Teams

In a Teams channel add a workflow from the template "Post to a channel when a webhook request is received" and store its URL as `INKAN_TEAMS_WEBHOOK`. The message is an Adaptive Card with the project and type, the heading, the description, a fact set (status change, authors) and an "Open record" button. Classic incoming webhooks accept the same card.

### Any other webhook

`type: 'webhook'` posts one JSON document per run with all events that match the channel:

```json
{
  "site": { "title": "Acme decisions", "url": "https://decisions.acme.dev" },
  "events": [
    {
      "id": "sre/adr/0003-define-slos",
      "ref": "SRE-ADR-0003",
      "title": "Define SLOs",
      "description": "Availability and latency targets per service.",
      "project": "sre",
      "projectName": "Site reliability",
      "type": "adr",
      "typeLabel": "ADR",
      "status": "accepted",
      "statusLabel": "Accepted",
      "previousStatus": "proposed",
      "previousStatusLabel": "Proposed",
      "authors": ["Alex Chen"],
      "tags": ["slo"],
      "url": "https://decisions.acme.dev/sre/adr/0003-define-slos/",
      "file": "docs/decisions/sre/adr/0003-define-slos.md"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id`, `ref` | Full id and reference (`SRE-ADR-0003`, or `null`). |
| `title`, `description` | From the front matter; the title falls back to the id, the description may be `null`. |
| `project`, `projectName` | Project folder and its name from `_project.yml`. |
| `type`, `typeLabel` | Record type and its label. |
| `status`, `statusLabel` | The new status and its label. |
| `previousStatus`, `previousStatusLabel` | The status at the compared commit, `null` for a new record. |
| `authors` | Names from `_authors.yml`, else the handles. |
| `tags` | The record's tags. |
| `url` | The record on the site, else the file in the repository, else `null`. |
| `file` | Path relative to the repository root. |

`headers` are added to the request. For services that expect their own format, `body` receives `{ site, events }` and returns what to send:

```ts title="inkan.config.ts"
channels: [
  {
    type: 'webhook',
    name: 'discord',
    url: process.env.DISCORD_WEBHOOK,
    body: ({ events }) => ({ content: events.map((e) => `**${e.title}** is now ${e.statusLabel}: ${e.url ?? e.file}`).join('\n') }),
  },
  {
    type: 'webhook',
    name: 'google-chat',
    url: process.env.GOOGLE_CHAT_WEBHOOK,
    body: ({ events }) => ({ text: events.map((e) => `${e.title} is now ${e.statusLabel}`).join('\n') }),
  },
],
```

### Digest and links

Slack and Teams get one message per record. Above 5 records in one run they get a single digest that lists up to 20 of them, with a "...and N more" line after that. The generic webhook always gets one request.

A record links to the site (`<url>/<base>/<id>/`) when `url` is set in the config (set the same `BASE_PATH` as for the build), and to the file in the repository (from `repo`) otherwise. Without either there is no link, and the message still names the record.

### Dry run and exit codes

```bash
npx inkan notify --dry-run
```

`--dry-run` resolves everything and prints the JSON bodies instead of sending them. Output of a real run:

```text
sre/adr/0003-define-slos: proposed -> accepted
platform/adr/0009-move-the-event-bus-to-kafka: (new) -> accepted
slack: sent 2 messages (2 records)
architects: skipped, no URL (is its secret set in this pipeline?)
discord: failed, 404 Not Found: Unknown Webhook
```

| Output | When |
| --- | --- |
| `No records moved into accepted since abc1234.` | Nothing changed. Exit 0. |
| `No notification channels: set notify.channels ...` | Records changed but no channel is configured. Exit 0. |
| `<name>: sent N messages (M records)` | Delivered. |
| `<name>: skipped, no URL ...` | The channel has no URL, typically an unset secret. A note, exit code unchanged. |
| `<name>: failed, <reason>` | A delivery failed (non-2xx answer, no answer within 10 seconds). Other channels are still tried. Exit 1. |
| `notify: unknown status ...` | A status in the config is not in `statuses`. Exit 1. |

### In the starter CI files

`inkan init` writes a `notify` job that runs after the site is deployed, on the default branch only. A channel whose secret is not set is skipped, so the job does nothing until you add a webhook.

```yaml title=".github/workflows/decisions.yml"
notify:
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  needs: deploy
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0 # compares with the commit before the push
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: npm install
    - run: npx inkan notify
      env:
        BASE_PATH: /${{ github.event.repository.name }} # same as the build, so links point at the right pages
        INKAN_SLACK_WEBHOOK: ${{ secrets.INKAN_SLACK_WEBHOOK }}
        INKAN_TEAMS_WEBHOOK: ${{ secrets.INKAN_TEAMS_WEBHOOK }}
```

```yaml title=".gitlab-ci.yml"
notify:
  needs: [pages]
  script:
    - npm install
    - BASE_PATH="/$CI_PROJECT_NAME" npx inkan notify
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $CI_PIPELINE_SOURCE == "push"
```

On GitLab add `INKAN_SLACK_WEBHOOK` and `INKAN_TEAMS_WEBHOOK` as masked variables in Settings, CI/CD, Variables. On GitHub add them as repository secrets. See [GitHub and GitLab Pages](../../deploy/adr/0002-github-and-gitlab-pages.md).

## Consequences

- People hear about accepted decisions on the day they land, with a link, without anyone writing the announcement.
- The comparison is by status in git history, so the command is stateless: nothing is stored between runs. A run that is repeated on the same push sends the same messages again.
- Squash merges and pushes of many commits work, because only the first and the last state are compared. A record that went `proposed` to `accepted` to `proposed` inside one push is not reported.
- A failed delivery fails the job but not the deploy, because `notify` runs after it. Re-run the job to retry.
- Secrets live in the CI system. A webhook URL that someone hard-codes in the config ends up in the repository, which is why the docs and the examples always use `process.env`.
- Records from `repo` sources are not announced here; run `notify` in their own repository. See [Records from other repositories](../../deploy/adr/0005-records-from-other-repositories.md).
- Pairs with [Change status and supersede from the CLI](0005-change-status-and-supersede-from-the-cli.md) and [Check records in CI](0007-check-records-in-ci.md): `check` guards the merge, `notify` announces the result.
