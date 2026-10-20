---
title: "AGENTS.md for coding agents"
description: "A starter AGENTS.md tells coding agents how to read and write records, and the site serves it at /AGENTS.md next to llms.txt."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [ai, cli, content]
related: [ai/adr/0001-llms-txt-and-llms-full-txt, ai/adr/0005-mcp-server-for-agents, cli/adr/0002-scaffold-with-init-and-npm-create, cli/adr/0003-number-records-with-inkan-new]
---

## Context

Coding agents work in the repository, not on the site. They need to know where records live, which statuses
mean "this is how we do it", how to create a record and what not to do (mark it accepted). `AGENTS.md` is the
file convention agents read at the root of a repository. The same instructions are useful to an agent that only
sees the published site.

## Decision

`inkan init` copies a starter `AGENTS.md` into the repository. The site serves that file at
`/AGENTS.md` when it exists, either in the content folder or next to the config file, and lists it in the
"For agents" section of the landing page. Inkan does not generate or rewrite the file in the repository;
it is yours. The served copy only gets a short `## MCP` section appended that names the server for this site.

## How to use it

### The starter file

`init` (and `npm create @tilaven/inkan`) writes this file unless one already exists:

```md title="AGENTS.md"
# Instructions for AI agents

This repository is the source of truth for architecture decisions (ADR) and proposals (RFC).

## Reading
- Records live in `decisions/<project>/<adr|rfc>/NNNN-slug.md`. Project metadata is in `decisions/<project>/_project.yml`.
- Front matter `status` tells you whether a record is current: only `accepted` and `implemented` describe how
  things are done today. `superseded` records name their replacement in `supersededBy`.
- `decisions.json` / `llms-full.txt` on the published site contain the same data in one file.
- Prefer the MCP server when you can run it: `npx inkan mcp --root .` (or `--url <published site>`) offers
  `search_records`, `get_record`, `list_projects`, `list_tags`, `list_fields` and `list_authors` with filters, so you need not read every file.

## Writing
- Create records with `npx inkan new <adr|rfc> <project> "<title>"`, then fill in the template.
- Use `status: proposed` (ADR) or `draft` (RFC). Never mark a record `accepted` yourself.
- When a record replaces another, set `supersedes` on the new one and `supersededBy` + `status: superseded` on the old one.
- Link other records with relative Markdown links to the `.md` file.
- Run `npm run build` to validate front matter before committing.
```

Edit it to match your process: the status an agent may set, who reviews, which projects exist, whether a
pull request is required. If your `contentDir` is not `decisions`, change the paths. The MCP line points
agents at [inkan mcp](0005-mcp-server-for-agents.md); drop it if you do not want agents to run `npx`.

### Where the file may live

| Location | Example |
| --- | --- |
| Content folder | `decisions/AGENTS.md` |
| Site root (the folder with `inkan.config.ts`) | `AGENTS.md` |

The content folder is checked first. In a monorepo where the decision site lives in a sub-folder, the file
next to the config is the one that is served; the repository's own root `AGENTS.md` is not.

### What the site does with it

- `/AGENTS.md` returns the file as `text/markdown`, with one section appended:

  ```md
  ## MCP
  Query these records with filters through the MCP server: `npx @tilaven/inkan mcp --url https://decisions.acme.dev` (tools: search_records, get_record, list_projects, list_tags, list_fields, list_authors; resources: decision://<id>).
  ```

  The address is `url` from the config, so set it or the line names `http://localhost:4321`.
- The landing page section `agents` (part of the default `landing.sections`) lists `/llms.txt`,
  `/llms-full.txt`, `/decisions.json`, then `/AGENTS.md` when the file exists, then `/rss.xml`.
  The links between records are at `/graph.json`, see [Decision graph](../../site/adr/0012-decision-graph.md).
- Nothing else reads it. It is not indexed by search and not a page in the sidebar.

Without the file the endpoint is absent and the landing list skips it.

### Writing good instructions

The starter is short on purpose. Things worth adding for your repository:

- The exact command to create a record for each type you configured in `docTypes`.
- The statuses from your `statuses` list and which of them an agent may set.
- Where to look before writing: "search `decisions.json` for the same tag before proposing a new record".
- The review path: who to add as `deciders`, whether `reviewBy` is required for RFCs.

> [!TIP]
> Keep `AGENTS.md` and your record templates in `templates/` consistent. The template decides what an agent
> fills in; `AGENTS.md` decides how.

## Consequences

- Agents working in the repository and agents reading the site get the same instructions, from one file you control.
- Inkan does not validate or template the file. Outdated instructions are your responsibility, like any other documentation.
- The appended MCP section cannot be turned off; it is the only text on the served page you did not write.
- Serving it publicly means the instructions are public. Keep internal links and names you would not publish out of it.
- Only one location is served; a second `AGENTS.md` deeper in the repository is ignored by the site.
