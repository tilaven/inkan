---
title: "Move the event bus to Kafka"
description: "Replay, ordering and fan-out are now requirements. Queues cannot give us those."
status: accepted
date: 2026-05-21
reviewBy: 2027-03-01
authors: [ines]
deciders: [sam, ines]
tags: [events, kafka]
risk: high
cost: 120
supersedes: [platform/adr/0004-use-sqs-as-the-event-bus]
---
## Context
Replay, ordering and fan-out are now requirements. Queues cannot give us those. The work in [Settle in async batches](../../payments/rfc/0001-settle-in-async-batches.md) needs all three.

```mermaid
flowchart LR
  Payments["Payments<br/>producer"] --> Kafka["Kafka<br/>event bus"]
  Mobile["Mobile<br/>producer"] --> Kafka
  Kafka --> Settlement["Settlement<br/>consumer"]
  Kafka --> Analytics["Analytics<br/>consumer"]
```

## Options
| Option | Replay | Ordering | Ops cost | Verdict |
|---|---|---|---|---|
| Keep SQS | No | Per queue | Low | Rejected |
| Kafka | Yes | Per partition | High | Chosen |
| Pulsar | Yes | Per partition | High | Rejected |

## Decision
Move the event bus to Kafka. Platform owns the clusters.

> [!WARNING]
> Operating Kafka is a platform commitment. Budget two engineers.

## Consequences
- [x] Topic naming convention: `<team>.<entity>.<event>`
- [ ] Migrate the last SQS consumers
