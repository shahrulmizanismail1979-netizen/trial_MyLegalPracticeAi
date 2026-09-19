-- Global control-plane row per subscriber workspace. No legacy data is moved.
CREATE TABLE IF NOT EXISTS firm_workspace_credentials (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL DEFAULT 0,
  password_hash text,
  credential_version integer NOT NULL DEFAULT 0,
  challenge_hash text,
  challenge_nonce text,
  challenge_expires_at timestamptz,
  challenge_attempts integer NOT NULL DEFAULT 0,
  challenge_consumed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_workspace_credentials_workspace_id_unique UNIQUE (workspace_id)
);