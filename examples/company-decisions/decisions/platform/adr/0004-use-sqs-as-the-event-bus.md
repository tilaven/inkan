---
title: "Use SQS as the event bus"
description: "Queues for service-to-service events."
status: superseded
date: 2024-09-03
authors: [sam]
deciders: [sam, ines]
tags: [events, aws]
risk: low
cost: 18
supersededBy: [platform/adr/0009-move-the-event-bus-to-kafka]
---
> [!IMPORTANT]
> Superseded by [Move the event bus to Kafka](./0009-move-the-event-bus-to-kafka.md).

## Context
Services need to tell each other about events without calling each other.

## Decision
Use SQS queues for service-to-service events.

## Consequences
- Easy to operate, no cluster to run
- No replay, no ordering across queues
