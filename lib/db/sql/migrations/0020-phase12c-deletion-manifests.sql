-- Phase 12c: Per-layer granular deletion with manifest tracking.
-- Manifests are stored in object storage; this table records the key
-- so the manifest can be retrieved by container.

CREATE TABLE IF NOT EXISTS research_deletion_manifests (
  id           serial PRIMARY KEY,
  container_id int  NOT NULL REFERENCES research_source_containers(id),
  requested_at timestamptz NOT NULL,
  actor        text NOT NULL,
  layers_requested jsonb NOT NULL,
  manifest_key text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_deletion_manifests_container_idx
  ON research_deletion_manifests (container_id);
