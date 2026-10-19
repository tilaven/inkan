-- Ledger schema (sample code that references decision records).
-- @adr payments/adr/0001

CREATE TABLE ledger_entries (
  id              bigserial PRIMARY KEY,
  account_id      bigint      NOT NULL,
  amount_cents    bigint      NOT NULL,
  -- Writes carry the caller's idempotency key, so a retried request never books twice. @adr payments/adr/0002
  idempotency_key text        NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
