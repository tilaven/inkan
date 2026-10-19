---
title: "Idempotent order submission"
description: "Every submit carries a client-generated key; retries never create a second order."
status: accepted
date: 2026-04-17
authors: [jules]
deciders: [jules]
tags: [reliability, api]
related: [payments/adr/0002-idempotency-keys-on-every-write]
---
## Context
Mobile clients retry on flaky networks and a few customers ended up with two orders.

## Decision
`POST /orders` requires an `Idempotency-Key` header. The key is stored with the order for 24 hours; a repeated key returns the original response.

## Consequences
- [x] Key column and unique index on `orders`
- [ ] Clients send the header (mobile first)
