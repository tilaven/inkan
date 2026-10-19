---
title: "Standardize on PostgreSQL 16"
description: "One major version everywhere, upgraded on a fixed yearly cadence."
status: accepted
date: 2025-10-06
reviewBy: 2026-11-09
authors: [kenji]
deciders: [kenji]
tags: [postgres, upgrades]
risk: medium
cost: 40
related: [payments/adr/0001-use-postgresql-for-the-ledger]
---
## Decision
One major version everywhere, upgraded on a fixed yearly cadence. The ledger ([Use PostgreSQL for the ledger](../../payments/adr/0001-use-postgresql-for-the-ledger.md)) moves first.

| Version | Status |
|---|---|
| 14 | Upgrade now |
| 15 | Upgrade by Q2 |
| 16 | Standard |
