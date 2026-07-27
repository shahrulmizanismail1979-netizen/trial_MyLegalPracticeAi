-- Phase 12a: Add indexes on research_audit_events for the admin query route.
-- The existing index covers (entity_type, entity_id); we add actor, event,
-- and created_at to support filtered paginated queries efficiently.

CREATE INDEX IF NOT EXISTS research_audit_events_actor_idx
  ON research_audit_events (actor);

CREATE INDEX IF NOT EXISTS research_audit_events_event_idx
  ON research_audit_events (event);

CREATE INDEX IF NOT EXISTS research_audit_events_created_at_idx
  ON research_audit_events (created_at DESC);
