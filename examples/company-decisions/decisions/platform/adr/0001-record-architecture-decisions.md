---
title: "Record architecture decisions"
description: "We keep a short record of every significant decision, in the repo."
status: implemented
date: 2024-01-15
reviewed: 2026-04-01
reviewEvery: 2 years
authors: [sam]
deciders: [sam, ines]
tags: [process, adr]
---
## Context
Decisions live in chat threads and in the memory of whoever was in the room.

## Decision
We keep a short record of every significant decision, in the repository, as Markdown. One file per decision, numbered, with a status.

## Consequences
- [x] Template in `templates/adr.md`
- [x] CI builds the archive on every pull request
