---
title: "Use PostgreSQL for the ledger"
description: "The ledger lives in PostgreSQL, not a document store."
status: implemented
date: 2024-11-04
authors: [jules]
deciders: [noor]
tags: [postgres, ledger]
risk: medium
cost: 25
pci: true
related: [dbre/adr/0001-standardize-on-postgresql-16]
---
## Context
The ledger records every movement of money. It needs transactions, strict constraints and a query language our auditors already know. The first prototype used a document store.

> [!NOTE]
> Ledger entries are append-only. Corrections are new entries.

## Options
| Option | Transactions | Ops cost | Verdict |
|---|---|---|---|
| PostgreSQL | Yes | Low | Chosen |
| DynamoDB | Limited | Medium | Rejected |
| MongoDB | Yes | Medium | Rejected |

## Decision
We store the ledger in PostgreSQL. Amounts are integer minor units.

```sql title="ledger_entries.sql" {2} del={3} ins={4}
CREATE TABLE ledger_entries (
  id            uuid PRIMARY KEY,
  amount        numeric(12,2) NOT NULL,
  amount_minor  bigint NOT NULL,
  currency      char(3) NOT NULL
);
```

## Consequences
- [x] Money is stored as integer minor units
- [x] Retries are safe, see PAY-123
- [ ] Backfill the old numeric column

See also [Standardize on PostgreSQL 16](../../dbre/adr/0001-standardize-on-postgresql-16.md).
