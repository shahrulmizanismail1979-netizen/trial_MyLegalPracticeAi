-- Project Sarawak 20: durable, idempotent checkout reservations and paid places.
-- Additive only; safe to apply more than once.

CREATE TABLE IF NOT EXISTS sarawak20_reservations (
  id text PRIMARY KEY,
  cohort text NOT NULL CHECK (cohort IN ('firm', 'chambering')),
  request_id text NOT NULL UNIQUE,
  checkout_session_id text UNIQUE,
  checkout_url text,
  subscription_id text UNIQUE,
  subscriber_id integer,
  status text NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'reserved', 'consumed', 'released', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sarawak20_reservations_capacity_idx
  ON sarawak20_reservations (cohort, status, expires_at);