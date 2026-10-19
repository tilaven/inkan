---
title: Record architecture decisions
description: We keep ADRs and RFCs as Markdown next to each other, one folder per team.
status: accepted
date: 2026-01-01
authors: [jane.doe]
tags: [process]
---

## Context

Decisions get lost in chats and meetings. New people cannot find out why things are the way they are.

## Decision

We write an **ADR** for every decision that is hard to reverse, and an **RFC** when we want feedback first.
Records live in `decisions/<team>/adr|rfc/` and are published with inkan.

```mermaid
flowchart LR
  idea[Idea] --> rfc[RFC: in review] --> adr[ADR: accepted]
  adr -.-> new[New ADR supersedes it]
```

## Consequences

- Run `npx inkan new adr <team> "Title"` to start a record.
- Only `accepted` and `implemented` records describe how we work today.
