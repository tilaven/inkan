---
title: "Settle in async batches"
description: "Move settlement off the request path and into hourly batches."
status: proposed
date: 2026-09-12
reviewBy: 2026-11-12
authors: [jules]
deciders: [noor]
reviewers:
  sam: { state: changes-requested, date: 2026-10-12, note: Needs a rollback plan for a stuck batch }
  ines: { state: approved, date: 2026-10-09 }
  ania: pending
tags: [settlement, queue]
risk: medium
cost: 8
pci: false
related: [platform/adr/0009-move-the-event-bus-to-kafka]
---
## Summary
Move settlement off the request path and into hourly batches.

## Motivation
Settlement adds 300 ms to p99 checkout latency and fails the whole request when the bank is slow.

## Proposal
```mermaid
flowchart LR
  Client --> API
  API -- writes --> Ledger["Ledger<br/>PostgreSQL · payments"]
  API -- publishes --> Topic["payment.accepted<br/>Kafka · platform"]
  Topic -- "hourly settlement" --> Batch["Batch"]
```

The API writes the ledger entry and publishes `payment.accepted`. A batch job reads the topic once an hour and settles in groups.

This relies on the event bus described in [Move the event bus to Kafka](../../platform/adr/0009-move-the-event-bus-to-kafka.md).

> [!CAUTION]
> Customers see "pending" for up to an hour. Support needs a runbook before this ships.

## Open questions
- [ ] Batch size and cut-off time per currency
- [ ] Failure handling for partially settled batches
