---
title: "Split checkout out of the monolith"
description: "Checkout becomes its own service with its own release cadence and its own decision log."
status: accepted
date: 2026-02-03
authors: [jules]
deciders: [jules, noor]
tags: [architecture, service]
---
## Context
Checkout ships twice a week while the rest of the monolith ships monthly. Every checkout change waits for the monolith's release train, and the funnel is where lost minutes cost the most.

## Decision
Checkout becomes a service of its own. Its records stay next to its code in `docs/decisions/` and are pulled into the hub as the "checkout" project.

![Where checkout sits in the request flow](./images/flow.svg)

## Consequences
- Pricing calls become network calls; see [Cache price quotes at the edge](../rfc/0001-cache-price-quotes-at-the-edge.md).
- Settlement stays with Payments (`PAY-410`).
