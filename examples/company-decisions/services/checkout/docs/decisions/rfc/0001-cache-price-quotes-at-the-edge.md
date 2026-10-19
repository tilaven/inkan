---
title: "Cache price quotes at the edge"
description: "Serve price quotes from the CDN for 60 seconds to take pricing off the checkout path."
status: proposed
date: 2026-09-20
reviewBy: 2026-10-30
authors: [jules]
deciders: [noor]
tags: [performance, pricing]
---
## Summary
Serve price quotes from the CDN for 60 seconds.

## Motivation
Since [the split](../adr/0001-split-checkout-out-of-the-monolith.md), each cart view makes a pricing call that adds 120 ms at p95.

## Proposal
Quotes are keyed by SKU and currency and cached at the edge for 60 seconds. Promotions purge the key.

## Open questions
- Per-customer prices cannot be cached; how many carts does that affect?
