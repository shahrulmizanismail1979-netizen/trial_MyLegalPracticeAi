-- Migration 0030: Persist Stripe alert delivery attempts so ops can audit
-- past failures across server restarts.

CREATE TABLE IF NOT EXISTS alert_delivery_attempts (
  id          SERIAL PRIMARY KEY,
  channel     TEXT        NOT NULL,
  outcome     TEXT        NOT NULL,
  detail      TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index that backs the audit-history query (newest-first ORDER BY attempted_at DESC).
CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_time
  ON alert_delivery_attempts (attempted_at DESC);
