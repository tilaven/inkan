---
title: "Idempotency keys on every write"
description: "Clients retry. Writes must be safe to repeat."
status: accepted
date: 2025-02-20
reviewed: 2025-10-20
authors: [noor]
deciders: [noor, jules]
tags: [api, ledger]
risk: low
pci: true
---
## Context
Clients retry. Networks drop responses. A retried payment must not move money twice.

## Decision
Every write endpoint requires an `Idempotency-Key` header. The ledger stores the key with the entry and rejects duplicates.

```http title="POST /v1/payments" {2}
POST /v1/payments
Idempotency-Key: 7c1d0a52-3a54-4e3c-9d0e-6a1d0e9f2b11
Content-Type: application/json
```

> [!WARNING]
> Keys expire after 24 hours. A client that retries later creates a new payment.

## Consequences
- [x] SDKs generate keys by default
- [ ] Add key-reuse metrics to the dashboard
