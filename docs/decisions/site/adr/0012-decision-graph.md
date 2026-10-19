---
title: "Decision graph"
description: "What the /graph/ page draws, how supersedes and related links become arrows between project lanes, and the /graph.json export behind it."
status: implemented
date: 2026-10-17
tags: [site, navigation, lineage]
related: [authoring/adr/0006-link-records-by-path, site/adr/0003-timeline-and-backlog, authoring/adr/0004-configurable-status-lifecycle]
---

## Context

Lineage fields answer a local question: from one record, which records does it supersede or relate to. The lineage block in the header shows that one hop. Nobody can see the chain behind it: an SQS decision replaced by Kafka, which a payments RFC leans on, which later becomes an ADR of its own. The timeline orders records but does not connect them; the index filters but does not follow links. The picture of how decisions grew out of each other, across teams and over time, had to be reconstructed by clicking.

## Decision

Inkan builds `/graph/`: one page that draws every linked record as a node and every resolved `supersedes` and `related` link as an edge, laid out as a project-by-time grid. The same data is written to `/graph.json` for tools and agents.

The layout is a grid:

- One horizontal lane per project, in the projects' display order, in the project's ink.
- One column per calendar month that contains at least one linked record, oldest on the left. Months without linked records are skipped, so a quiet year costs no space. A last column, `undated`, holds the linked records without a `date`.
- Inside a lane and month, records stack vertically.

Edges come in two kinds:

| Front matter | Drawn as | Direction |
| --- | --- | --- |
| `supersedes`, `supersededBy` | solid arrow | points at the newer record, the one doing the superseding |
| `related` | dashed line | none |

## How to use it

### Reading the page

Nothing to configure. The page is linked from the header and the sidebar hub next to Timeline and Open decisions (the sidebar link carries the number of linked records), and every record header whose lineage resolves to another record has a "See on the graph" link that opens the page with that record highlighted.

Only records with at least one resolved link are drawn. The lede says how many records are not on the figure for lack of links, so a sparse graph is not mistaken for a sparse archive. Each node shows the record's reference and title next to a strip of the project's ink, and links to the record. Records whose status is superseded, deprecated, rejected or withdrawn have a dashed, faded outline. The title of each node, shown on hover, carries the full title and the status.

Hovering or focusing a node highlights it together with its neighbours and the edges between them, and fades the rest. The URL `?focus=<record id>` opens the page with that node highlighted, for example `/graph/?focus=platform/adr/0009-move-the-event-bus-to-kafka`; that is what "See on the graph" links to. When the record is not on the figure, the page says so under it. Two checkboxes above the figure hide one kind of edge, to see only the chain of replacements or only the loose connections.

The figure is a static SVG rendered at build time. Highlighting and the checkboxes are a small inline script; without JavaScript the full graph is still there to read, and a list under the figure repeats every edge as text ("0009 Move the event bus to Kafka supersedes 0004 Use SQS as the event bus"), which also serves screen readers and search.

### How links are resolved

References are resolved the same way as the lineage block, see [Link records by path](../../authoring/adr/0006-link-records-by-path.md): the target is a path inside the content folder without extension, a leading `/` and a trailing `.md` or `.mdx` are tolerated, and the comparison ignores case. Then:

- A link written on both sides (`supersedes` on the new record and `supersededBy` on the old, or `related` on both) is one edge, not two.
- When a pair of records both supersedes and relates, only the supersedes arrow is drawn.
- A reference that matches no record is ignored on the figure. `inkan check` reports it, so a renamed file does not silently remove an edge.

### `/graph.json`

Every build also writes `/graph.json` next to `decisions.json`:

```json title="graph.json"
{
  "nodes": [
    { "id": "platform/adr/0009-move-the-event-bus-to-kafka", "href": "/platform/adr/0009-move-the-event-bus-to-kafka/", "title": "Move the event bus to Kafka", "project": "platform", "ref": "ADR-0009", "number": 9, "status": "accepted", "date": "2026-03-14", "degree": 2 }
  ],
  "edges": [
    { "from": "platform/adr/0009-move-the-event-bus-to-kafka", "to": "platform/adr/0004-use-sqs-as-the-event-bus", "kind": "supersedes" },
    { "from": "payments/rfc/0001-settle-in-async-batches", "to": "platform/adr/0009-move-the-event-bus-to-kafka", "kind": "related" }
  ],
  "dangling": [
    { "from": "sre/adr/0002-error-budget", "to": "sre/adr/0001-define-slo", "kind": "related" }
  ]
}
```

`nodes` holds the drawn records with their edge count (`degree`). In `edges`, a `supersedes` edge goes from the newer record to the one it replaces; a `related` edge is undirected and its ends are sorted. `dangling` lists the links with an end that resolved to nothing, in the same directions; the missing end is the normalised path as written. These are the references `inkan check` reports. An agent that wants the chain behind a record reads this file instead of walking `supersededBy` through `decisions.json` one record at a time.

## Consequences

- Nothing to configure and nothing new to write: the graph is built from the lineage fields that records already carry.
- Records without links are not on the figure. A record only appears once another record points at it, or it points at one.
- Columns are months, so two decisions a day apart share a cell and are only ordered vertically. The timeline keeps the exact order.
- An archive with links spread over many years and projects makes a wide figure. The page scrolls it horizontally rather than shrinking it to the viewport, so the labels stay readable.
- Unresolved references no longer pass unnoticed: they are missing from the figure and listed by `inkan check`.
- `graph.json` is one more file to keep stable. New fields may be added; existing ones keep their meaning.
