---
title: "MCP server for agents"
description: "inkan mcp serves records over the Model Context Protocol, from the content folder or a published site, so agents query with filters instead of reading llms-full.txt."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [ai, cli, data]
related: [ai/rfc/0001-mcp-server-over-decisions, ai/adr/0002-decisions-json, ai/adr/0003-markdown-copy-of-every-page, ai/adr/0004-agents-md-for-coding-agents, authoring/adr/0011-review-decisions-on-a-schedule, deploy/adr/0005-records-from-other-repositories, authoring/adr/0012-custom-metadata-fields]
---

## Context

`llms.txt` and `llms-full.txt` give an agent the whole archive in one or two requests. That stops working when
the archive outgrows a context window, and neither file answers "which accepted decisions mention Kafka" without
the agent reading everything. `decisions.json` has the typed metadata but no protocol. The Model Context Protocol
(MCP) is what coding assistants speak today; the proposal in
[MCP server over decisions](../rfc/0001-mcp-server-over-decisions.md) asked for a server over the data the site
already publishes.

## Decision

`inkan mcp` is an MCP server over stdio, shipped inside the `@tilaven/inkan` package with no extra
dependency. It has two sources: the content folder of a repository (the default, read live on every call) or a
published site (`--url`, read through `decisions.json`, the `.md` copies and `llms.txt`). It offers eight
read-only tools (`list_projects`, `search_records`, `get_record`, `list_tags`, `list_fields`, `list_authors`, `due_reviews`, `rfc_reviews`) and one resource
per record (`decision://<id>`). Writing records stays with `inkan new` and a pull request.

## How to use it

### Start the server

```bash
npx inkan mcp                              # records of the config in the current folder
npx inkan mcp --root ../decisions   # another folder holding inkan.config.*
npx @tilaven/inkan mcp --url https://decisions.acme.dev
```

| Flag | Default | What it does |
| --- | --- | --- |
| `--root <dir>` | current folder | Folder with `inkan.config.*`; the server reads `contentDir` and every `sources` entry from it |
| `--url <site>` | none | Read a published site instead of local files. Must start with `http://` or `https://`, otherwise the command exits with `--url must be the address of a published site` |

Local mode re-reads the content folder on every tool call, so an edit is visible without a restart. Drafts
(`draft: true`) are skipped. On start-up the server fetches `repo` sources that are not cached yet (the same as
`inkan dev`) and loads the config once to fail early when it is broken. Records from
[other repositories](../../deploy/adr/0005-records-from-other-repositories.md) are served like local ones.

Remote mode fetches `<url>/decisions.json` for the index, `<url>/<id>.md` for a body and `<url>/llms.txt` for
project names and descriptions. Pass the site including its `base` path when it is served from a sub-path. Each
response is cached for 30 seconds; each request times out after 10 seconds with
`<url>/decisions.json did not answer within 10s`. Without `llms.txt` the project list still works, with the folder
name as the project name. Remote mode decides "current" with the default statuses (`accepted`, `implemented`),
because the site's `statuses` config is not published.

Only protocol messages go to stdout. Logs, warnings from the config and anything a plugin prints go to stderr,
prefixed `inkan mcp:`.

### Tools

Every tool returns JSON as text content and, for clients on protocol `2025-06-18`, the same object as
`structuredContent`. Filters compare case-insensitively.

| Tool | Input | Output |
| --- | --- | --- |
| `list_projects` | none | `projects[]`: `id`, `name`, `description`, `owners`, `records` (count), in `_project.yml` `order` |
| `search_records` | `project`, `type`, `status`, `tag`, `author`, `field` (`name=value`), `query`, `current_only`, `limit` (default 20, max 200), `offset` (default 0); all optional | `total`, `offset`, `limit`, `records[]` of summaries: `id`, `ref`, `title`, `status`, `date`, `project`, `type`, `tags`, `description`, `fields`; newest first |
| `get_record` | `id` (required) | Every metadata field including custom `fields`, `current` (boolean), `review` (`{ due, reviewed, every }` or `null`, as in `decisions.json`), `reviewers` and `rfcReview` (`{ status, approved, required, waitingOn }`), `supersedes` and `supersededBy` resolved to `{ id, ref, title, status }` (or `{ id, missing: true }`), `currentRecord` (the end of the `supersededBy` chain, `null` when the record is current itself), `body` (Markdown without front matter). Text content is a YAML block followed by the body |
| `list_tags` | `project` (optional) | `tags[]` of `{ name, count }`, most used first |
| `list_fields` | none | `fields[]` of `{ name, label, type, values, unit, description }` and `projects` with each project's own fields (local sites only) |
| `list_authors` | `project` (optional) | `authors[]` of `{ name, count }`, from `authors` only |
| `due_reviews` | `project`, `within` (days, default 30), `all` (every scheduled record, not only the due ones); all optional | Decided records whose periodic review is overdue or due within the window, soonest first, each with its summary and `review`. See [Review decisions on a schedule](../../authoring/adr/0011-review-decisions-on-a-schedule.md) |
| `rfc_reviews` | `reviewer` (optional) | Open records with reviewers: `id`, `title`, each reviewer's state, the review status and who it waits on. With `reviewer`, only records waiting on that handle. See [Review RFCs with reviewers](../../authoring/adr/0013-review-rfcs-with-reviewers.md) |

`query` looks in title, description and tags first and reads bodies only for records that did not match there,
eight at a time. `current_only` keeps records whose status has `current: true` in your `statuses`.

`get_record` accepts what the CLI accepts: a full id (`sre/adr/0001-define-slos`), a short id (`sre/adr/0001`
or `sre/adr/1`), a reference (`SRE-ADR-0001`, case-insensitive) or a bare slug that ends an id
(`0001-define-slos`). A bare number such as `0001` does not match. Two possible answers (duplicate numbers in one
folder, the same slug in two projects) produce a tool error
`"sre/adr/1" is ambiguous: sre/adr/0001-a, sre/adr/0001-b.`; no match produces
`No record matches "...". Use search_records to find ids.` Input problems (wrong type, `limit` below 1, a missing
`id`) are tool errors too, with `isError: true`, so the agent can correct itself. An unknown tool name is a
protocol error (`-32602`).

### Resources

`resources/list` returns one entry per record: URI `decision://<id>`, name `ref` (or id), the title, and
`<status>: <description>` as the description, `text/markdown`. `resources/read` on such a URI returns the same
YAML block and body as `get_record`. `resources/templates/list` advertises `decision://{id}`. An unknown URI
is error `-32002`, `Resource not found`.

### Connect a client

Claude Code:

```bash
claude mcp add inkan -- npx inkan mcp --root .
```

Claude Desktop, Cursor and other clients that read an `mcpServers` map (for Claude Code also a `.mcp.json` in
the repository):

```json title=".mcp.json"
{
  "mcpServers": {
    "inkan": {
      "command": "npx",
      "args": ["-y", "@tilaven/inkan", "mcp", "--url", "https://decisions.acme.dev"]
    }
  }
}
```

Use `--root` for an agent that works in the repository (it then sees uncommitted records) and `--url` for one
that only knows the site. The served `/AGENTS.md` ends with an `## MCP` section that names the `--url` command
for the site, and the starter `AGENTS.md` tells agents to prefer the server over reading every file; see
[AGENTS.md for coding agents](0004-agents-md-for-coding-agents.md).

### Protocol details

- JSON-RPC 2.0, one message per line on stdin and stdout; batches (arrays) are accepted and answered as one array.
- Protocol versions `2025-06-18` and `2025-03-26`; an unknown version is answered with `2025-06-18`.
- `initialize` returns `capabilities: { tools: {}, resources: {} }` and an `instructions` text that tells the
  agent to start with `list_projects` or `search_records` and to trust only current records.
- Notifications (`notifications/initialized`, `notifications/cancelled`) are accepted and not answered; `ping`
  returns `{}`; unknown methods return `-32601`.
- The server exits when stdin closes.

Records include their custom `fields`. `search_records` takes `field: "risk=high"` and the `list_fields` tool returns the declared fields with their types and allowed values. See [Custom metadata fields](../../authoring/adr/0012-custom-metadata-fields.md).

## Consequences

- An agent fetches the records a question needs, with filters and lineage, instead of the whole archive. Large archives stay usable.
- Read-only by design. The write path is unchanged: `inkan new`, a commit, a review.
- Remote mode depends on what the site publishes: without `url` in the config the `.md` links in `decisions.json` point at `localhost`, and `current_only` ignores custom `statuses`.
- Text search is substring matching over bodies read on demand. It is fine for hundreds of records; it is not ranked search.
- The transport is stdio only. A shared, always-on HTTP server would need a process manager and authentication that this command does not provide.
