---
title: "MCP server over decisions"
description: "Proposal: a small MCP server that lets agents query the archive through decisions.json with filters instead of reading llms-full.txt in full."
status: accepted
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [ai, data, roadmap]
related: [ai/adr/0005-mcp-server-for-agents, ai/adr/0002-decisions-json, ai/adr/0001-llms-txt-and-llms-full-txt, ai/adr/0003-markdown-copy-of-every-page]
---

Accepted and implemented: see [MCP server for agents](../adr/0005-mcp-server-for-agents.md).

## Summary

Ship an optional Model Context Protocol (MCP) server, `inkan mcp`, that reads `decisions.json` and the
Markdown copies of a published site (or a local `dist/`) and exposes them as tools: list records with filters,
read one record, follow its lineage, search by text. Agents connected to the server fetch exactly the records
they need instead of a growing `llms-full.txt`.

## Motivation

The current files work in two ways. `llms.txt` is an index an agent follows link by link; `llms-full.txt` is
everything at once. Both are fine for a few dozen records. With several hundred records the full file no longer
fits a context window, and following links one by one costs a round trip per record with no way to ask
"which accepted decisions mention Kafka and are tagged `messaging`".

`decisions.json` already holds the typed metadata and a `markdown` link per record. What is missing is a
protocol agents speak. MCP is the one coding assistants support today; a server over the existing JSON gives
agents filters and lineage without a new data format and without a database.

## Proposal

### Command

```bash
npx inkan mcp --site https://decisions.acme.dev
npx inkan mcp --dist ./dist
```

The server runs over stdio, the transport every MCP client supports for local servers. `--site` fetches
`decisions.json` and `.md` copies over HTTP; `--dist` reads them from a built folder, for use in CI or offline.
The index is loaded once at start and refreshed on demand with a `refresh` tool.

### Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `list_decisions` | `project?`, `type?`, `status?`, `tag?`, `author?`, `since?`, `limit?` | Matching entries of `decisions.json`, without bodies |
| `get_decision` | `id` | The entry plus the raw Markdown body of the record |
| `search_decisions` | `query`, same filters as `list_decisions` | Entries whose title, description or body contains the query |
| `lineage` | `id` | The chain of `supersedes` and `supersededBy` around a record, plus `related` |
| `list_projects` | none | Projects with name, description and record counts |
| `refresh` | none | Reloads the index from the site or folder |

Each tool returns the same objects as `decisions.json`, so a client that already understands the file
understands the tool output. `get_decision` fetches the `markdown` URL of the record, which is why the server
needs nothing beyond what the site already publishes.

### Resources

The server also exposes `llms.txt`, `AGENTS.md` and each record as MCP resources, so a client that prefers
resources to tools can attach a record to the conversation by URL.

### Client configuration

```json title=".mcp.json"
{
  "mcpServers": {
    "decisions": {
      "command": "npx",
      "args": ["inkan", "mcp", "--site", "https://decisions.acme.dev"]
    }
  }
}
```

### Scope

- Read-only. Writing a record stays with `inkan new` and a pull request; `AGENTS.md` explains that path.
- No full-text ranking beyond substring matching on the loaded bodies. The `search.json` the build writes for external search providers (plain-text `content` per record) could be reused later.
- Shipped inside the `inkan` package behind the `mcp` command so no second package is needed; the MCP SDK
  becomes a dependency only when the command runs, if that can be arranged with a lazy import.

## Open questions

- Should the server be a separate package (`@inkan/mcp`) to keep the SDK out of the main dependency tree, or a lazily imported command as proposed?
- `search_decisions` needs record bodies. Fetch all `.md` copies at start (simple, one request per record) or lazily per query (slower first search)?
- Private sites behind SSO: pass a bearer token or cookie through an option, or support only `--dist` for those?
- Does `decisions.json` need a `version` or `generatedAt` field so the server can tell a client how fresh the index is? That would be a small change to the JSON shape.
- Is `lineage` worth a tool, or is it enough that `get_decision` returns `supersedes` and `supersededBy` and the client follows them?
- Should validation of broken `supersedes`/`related` references land first, so `lineage` never returns dangling ids?
