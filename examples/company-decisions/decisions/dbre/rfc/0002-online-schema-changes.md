---
title: "Online schema changes"
description: "Ship schema changes without locking tables or scheduling downtime."
status: draft
date: 2026-10-02
reviewBy: 2026-11-05
authors: [kenji]
deciders: [kenji]
reviewers: [ania, sam]
tags: [migrations, postgres]
risk: high
---
## Summary
Ship schema changes without locking tables or scheduling downtime.

## Proposal
Copy into a shadow table with a trigger-based sync, then swap names inside one short lock.

```sql title="swap.sql" {2}
BEGIN;
LOCK TABLE ledger_entries IN ACCESS EXCLUSIVE MODE;
ALTER TABLE ledger_entries RENAME TO ledger_entries_old;
ALTER TABLE ledger_entries_new RENAME TO ledger_entries;
COMMIT;
```

## Open questions
- [ ] Build the tooling or adopt it?
- [ ] How do we test the swap under load?
