-- Phase 09: Exact Quotations & Citation Tools
-- Creates research_quotations and research_quotation_alterations tables.

CREATE TABLE IF NOT EXISTS research_quotations (
  id                    serial          PRIMARY KEY,
  judgment_id           integer         NOT NULL REFERENCES research_verified_judgments(id),
  case_name             text,
  citation              text,
  court                 text,
  judge                 text,
  decision_date         text,
  paragraph_identifier  text,
  source_page_id        integer         REFERENCES research_source_pages(id),
  selected_text         text            NOT NULL,
  char_start            integer         NOT NULL,
  char_end              integer         NOT NULL,
  source_checksum       text            NOT NULL,
  creator_id            integer         NOT NULL REFERENCES research_users(id),
  created_at            timestamptz     NOT NULL DEFAULT now(),
  user_note             text,
  kind                  text            NOT NULL DEFAULT 'exact'
);

CREATE INDEX IF NOT EXISTS research_quotations_judgment_idx ON research_quotations(judgment_id);
CREATE INDEX IF NOT EXISTS research_quotations_creator_idx  ON research_quotations(creator_id);

CREATE TABLE IF NOT EXISTS research_quotation_alterations (
  id                serial      PRIMARY KEY,
  quotation_id      integer     NOT NULL REFERENCES research_quotations(id),
  kind              text        NOT NULL,
  position_start    integer     NOT NULL,
  position_end      integer     NOT NULL,
  original_text     text        NOT NULL,
  replacement_text  text        NOT NULL,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  recorded_by       integer     NOT NULL REFERENCES research_users(id)
);

CREATE INDEX IF NOT EXISTS research_quotation_alterations_quotation_idx ON research_quotation_alterations(quotation_id);
