---
title: "Error budget policy"
description: "What happens to feature work when a service burns through its error budget."
status: in-review
date: 2026-09-30
reviewBy: 2026-11-06
authors: [ania]
deciders: [marek]
reviewers:
  ines: { state: approved, date: 2026-10-08, note: Budgets match our SLO tiers }
  sam: { state: approved, date: 2026-10-10 }
  kenji: pending
tags: [slo, process]
---
## Summary
Define what happens to feature work when a service burns through its error budget.

## Motivation
SLOs exist (see [Define SLOs before dashboards](../adr/0001-define-slos-before-dashboards.md)), but nothing changes when a service misses one.

## Proposal
The error budget for a window is the share of events that may fail:

$$
\begin{aligned}
\text{error budget} &= (1 - \mathit{SLO}) \times \text{window} \\
(1 - 0.999) \times 30\,\text{d} &= 43.2\,\text{min}
\end{aligned}
$$

When more than **100 %** of the budget is spent in a 30-day window, the team freezes feature releases for that service until the budget recovers.

> [!IMPORTANT]
> Reliability work is exempt from the freeze.

## Alternatives
| Option | Effect | Verdict |
|---|---|---|
| Freeze on exhaustion | Clear trigger | Proposed |
| Advisory only | No friction | Rejected |

## Open questions
- [ ] Who can grant an exception?
- [ ] Do batch jobs share the same policy?
