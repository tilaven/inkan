---
title: Decision handbook
description: How Acme writes, reviews and retires architecture decisions.
---

## When to write a record

Write an **ADR** when a choice is hard to reverse: a database, a vendor, a protocol, a boundary between teams.
Write an **RFC** when you want feedback before deciding.

## Lifecycle

1. `inkan new adr <team> "Title"` creates the next numbered file.
2. Open a pull request; reviewers comment on the Markdown.
3. Merge with `status: accepted` (or `rejected`). Never edit an accepted record: supersede it.

:::tip{title="Draft in the open"}
Open the pull request as soon as the context section is written. Early readers catch missing options.
:::

:::danger
Never rewrite the decision of an accepted record. Write a new one with `supersedes:` instead.
:::

## Where a decision belongs

Pick the team that will live with the consequences. Cross-team decisions go to the team that operates the result.

> [!NOTE]
> Not sure? Ask in #architecture before opening the pull request.
