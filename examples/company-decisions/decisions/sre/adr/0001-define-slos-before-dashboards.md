---
title: "Define SLOs before dashboards"
description: "Every service gets a written SLO before anyone builds a dashboard for it."
status: implemented
date: 2025-03-12
reviewBy: 2026-10-09
authors: [ania]
deciders: [marek]
tags: [slo, observability]
risk: low
---
## Context
We run forty dashboards and nobody can say what "healthy" means for any of the services behind them. On-call decisions are made by feel.

## Decision
Every service gets a written SLO before anyone builds a dashboard for it. The SLO names the user-visible behaviour, the target and the window.

> [!TIP]
> Start with one availability SLO and one latency SLO per service tier.

## Consequences
- [x] New services ship with `slo.yml`
- [x] Dashboards link to their SLO
- [ ] Retire dashboards that have no SLO behind them
