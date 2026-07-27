-- Phase 11b: Research Workspace
-- Adds workspace tables (folders, saved searches, reading lists, quotation
-- collections, comparison tables, authorities tables) and extends existing
-- bookmarks and annotations tables.

-- Extend research_annotations with highlight coordinates, tags, and visibility.
ALTER TABLE research_annotations
  ADD COLUMN IF NOT EXISTS char_start  integer,
  ADD COLUMN IF NOT EXISTS char_end    integer,
  ADD COLUMN IF NOT EXISTS tags        jsonb,
  ADD COLUMN IF NOT EXISTS is_public   boolean NOT NULL DEFAULT false;

-- Extend research_bookmarks with folder association.
-- (label column already exists from Phase 09.)
-- We add folder_id after research_folders is created below.

-- Folders
CREATE TABLE IF NOT EXISTS research_folders (
  id                  serial      PRIMARY KEY,
  owner_id            integer     NOT NULL REFERENCES research_users(id),
  kind                text        NOT NULL DEFAULT 'research',  -- research|course|matter
  name                text        NOT NULL,
  description         text,
  shared_with_students boolean    NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_folders_owner_idx ON research_folders(owner_id);

-- Folder items (unique membership)
CREATE TABLE IF NOT EXISTS research_folder_items (
  id            serial      PRIMARY KEY,
  folder_id     integer     NOT NULL REFERENCES research_folders(id) ON DELETE CASCADE,
  judgment_id   integer     NOT NULL REFERENCES research_verified_judgments(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_folder_items_folder_judgment_uq
  ON research_folder_items(folder_id, judgment_id);
CREATE INDEX IF NOT EXISTS research_folder_items_folder_idx ON research_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS research_folder_items_judgment_idx ON research_folder_items(judgment_id);

-- Now add folder_id FK to bookmarks
ALTER TABLE research_bookmarks
  ADD COLUMN IF NOT EXISTS folder_id integer REFERENCES research_folders(id);

-- Saved searches
CREATE TABLE IF NOT EXISTS research_saved_searches (
  id          serial      PRIMARY KEY,
  owner_id    integer     NOT NULL REFERENCES research_users(id),
  name        text        NOT NULL,
  query       jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_saved_searches_owner_idx ON research_saved_searches(owner_id);

-- Reading lists
CREATE TABLE IF NOT EXISTS research_reading_lists (
  id                   serial      PRIMARY KEY,
  owner_id             integer     NOT NULL REFERENCES research_users(id),
  name                 text        NOT NULL,
  shared_with_students boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_reading_lists_owner_idx ON research_reading_lists(owner_id);

-- Reading list items
CREATE TABLE IF NOT EXISTS research_reading_list_items (
  id            serial      PRIMARY KEY,
  list_id       integer     NOT NULL REFERENCES research_reading_lists(id) ON DELETE CASCADE,
  judgment_id   integer     NOT NULL REFERENCES research_verified_judgments(id),
  position      integer     NOT NULL DEFAULT 0,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_reading_list_items_list_judgment_uq
  ON research_reading_list_items(list_id, judgment_id);
CREATE INDEX IF NOT EXISTS research_reading_list_items_list_idx ON research_reading_list_items(list_id);

-- Quotation collections
CREATE TABLE IF NOT EXISTS research_quotation_collections (
  id          serial      PRIMARY KEY,
  owner_id    integer     NOT NULL REFERENCES research_users(id),
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_quotation_collections_owner_idx
  ON research_quotation_collections(owner_id);

-- Saved quotation passages (linked to AI propositions)
CREATE TABLE IF NOT EXISTS research_workspace_quotations (
  id              serial      PRIMARY KEY,
  collection_id   integer     NOT NULL REFERENCES research_quotation_collections(id) ON DELETE CASCADE,
  proposition_id  integer     NOT NULL REFERENCES research_ai_propositions(id),
  passage_text    text        NOT NULL,
  label           text,
  char_start      integer,
  char_end        integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_workspace_quotations_collection_idx
  ON research_workspace_quotations(collection_id);

-- Case-comparison tables (config stored; grid assembled on read)
CREATE TABLE IF NOT EXISTS research_comparison_tables (
  id            serial      PRIMARY KEY,
  owner_id      integer     NOT NULL REFERENCES research_users(id),
  name          text        NOT NULL,
  judgment_ids  jsonb       NOT NULL DEFAULT '[]',
  field_names   jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_comparison_tables_owner_idx ON research_comparison_tables(owner_id);

-- Authorities tables (scoped to judgment IDs; populated from Phase 11a)
CREATE TABLE IF NOT EXISTS research_authorities_tables (
  id            serial      PRIMARY KEY,
  owner_id      integer     NOT NULL REFERENCES research_users(id),
  name          text        NOT NULL,
  judgment_ids  jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_authorities_tables_owner_idx ON research_authorities_tables(owner_id);
