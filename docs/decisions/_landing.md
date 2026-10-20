---
title: Try it, right now
description: two commands, one minute
---

```bash
npm create @tilaven/inkan@latest my-decisions
cd my-decisions && npm install && npm run dev
```

Open http://localhost:4321 and you are looking at your own decision archive, with a sample project to edit. Already have a repository with ADRs? Run `npm install -D @tilaven/inkan` and `npx inkan init` there, or bring them over with `inkan import` from log4brains, MADR or adr-tools.

## How to read these docs

Every feature of Inkan is described by an **ADR** in one of the projects below: why it exists, what was decided and how to use it. Ideas that are not built yet are **RFCs** and wait on the backlog. This site is built with Inkan from the `docs/` folder of the repository, so what you are reading is also what your own records will look like.
