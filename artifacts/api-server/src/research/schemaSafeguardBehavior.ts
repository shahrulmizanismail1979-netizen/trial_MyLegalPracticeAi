import { expect } from "vitest";
import type { IsolatedTestDb } from "./testing/testDb";
export async function assertResearchSafeguards(isolated: IsolatedTestDb): Promise<void> {
  const { pool } = isolated;
  expect((await pool.query("SHOW search_path")).rows[0].search_path).toBe(isolated.schemaName);
  const { rows: [container] } = await pool.query(`
    INSERT INTO research_source_containers
      (original_name, source_batch, content_sha256, size_bytes, provenance)
    VALUES ('safeguard.pdf', 'schema-safeguard', repeat('7', 64), 1, '{}')
    RETURNING id
  `);
  const { rows: [run] } = await pool.query(`
    INSERT INTO research_segmentation_runs
      (container_id, run_key, processor_version, source_checksum)
    VALUES ($1, 'schema-safeguard', 'schema-safeguard@1', repeat('8', 64))
    RETURNING id
  `, [container.id]);
  const candidateRetry = (detail: string) => pool.query(`
    INSERT INTO research_case_candidates
      (container_id, run_id, start_page_id, detail)
    VALUES ($1, $2, 41, jsonb_build_object('attempt', $3::text))
    ON CONFLICT (run_id, container_id, start_page_id)
      WHERE start_page_id IS NOT NULL
    DO UPDATE SET detail = EXCLUDED.detail
    RETURNING id, detail
  `, [container.id, run.id, detail]);
  const firstCandidate = await candidateRetry("first");
  const retriedCandidate = await candidateRetry("retry");
  expect(retriedCandidate.rows[0]).toMatchObject({
    id: firstCandidate.rows[0].id,
    detail: { attempt: "retry" },
  });

  const legacyCandidates = await pool.query(`
    INSERT INTO research_case_candidates (container_id, run_id, start_page_id)
    VALUES ($1, $2, NULL), ($1, $2, NULL)
    RETURNING id
  `, [container.id, run.id]);
  expect(legacyCandidates.rowCount).toBe(2);
  expect((await pool.query(`
    SELECT count(*)::int AS count FROM research_case_candidates
    WHERE run_id = $1 AND container_id = $2
  `, [run.id, container.id])).rows[0].count).toBe(3);
  const { rows: judgments } = await pool.query(`
    INSERT INTO research_verified_judgments
      (candidate_id, container_id, text_checksum, verified_by)
    VALUES
      ($1, $3, repeat('9', 64), 'schema-safeguard'),
      ($2, $3, repeat('a', 64), 'schema-safeguard')
    RETURNING id
  `, [firstCandidate.rows[0].id, legacyCandidates.rows[0].id, container.id]);
  const [judgment, otherJudgment] = judgments;
  const insertedSearch = await pool.query(`
    INSERT INTO research_search_index
      (judgment_id, container_id, document_text, processor_version)
    VALUES ($1, $2, 'running constitutional', 'schema-safeguard@1')
    RETURNING
      document = to_tsvector('english', document_text) AS english_generated,
      document_ms = to_tsvector('simple', document_text) AS simple_generated,
      document @@ plainto_tsquery('english', 'runs') AS english_match,
      document_ms @@ plainto_tsquery('simple', 'running') AS simple_match
  `, [judgment.id, container.id]);
  expect(insertedSearch.rows[0]).toEqual({
    english_generated: true,
    simple_generated: true,
    english_match: true,
    simple_match: true,
  });
  const updatedSearch = await pool.query(`
    UPDATE research_search_index SET document_text = 'courts keadilan'
    WHERE judgment_id = $1
    RETURNING
      document = to_tsvector('english', document_text) AS english_generated,
      document_ms = to_tsvector('simple', document_text) AS simple_generated,
      document @@ plainto_tsquery('english', 'running') AS stale_english,
      document_ms @@ plainto_tsquery('simple', 'keadilan') AS simple_match
  `, [judgment.id]);
  expect(updatedSearch.rows[0]).toEqual({
    english_generated: true,
    simple_generated: true,
    stale_english: false,
    simple_match: true,
  });
  const ginIndexes = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'research_search_index_document_gin',
        'research_search_index_document_ms_gin'
      )
      AND indexdef LIKE '%USING gin%'
    ORDER BY indexname
  `);
  expect(ginIndexes.rows.map(({ indexname }) => indexname)).toEqual([
    "research_search_index_document_gin", "research_search_index_document_ms_gin",
  ]);
  const { rows: [user] } = await pool.query(`
    INSERT INTO research_users (email, display_name)
    VALUES ('schema-safeguard@example.test', 'Schema Safeguard')
    RETURNING id
  `);
  const checkViolation = async (sql: string, values: unknown[]) => {
    await expect(pool.query(sql, values)).rejects.toMatchObject({ code: "23514" });
  };
  await checkViolation(`
    INSERT INTO research_case_metadata
      (judgment_id, container_id, field_name, value, confidence, method, processor_version)
    VALUES ($1, $2, 'invalidField', '{}', 0.5, 'regex', 'schema-safeguard@1')
  `, [judgment.id, container.id]);
  await checkViolation(`
    INSERT INTO research_duplicate_links
      (source_judgment_id, target_judgment_id, link_type, similarity_score, detected_by)
    VALUES ($1, $2, 'NOT_A_LINK', 0.5, 'schema-safeguard')
  `, [judgment.id, otherJudgment.id]);
  await checkViolation(`
    INSERT INTO research_annotations (user_id, judgment_id, kind, body)
    VALUES ($1, $2, 'scribble', 'invalid annotation')
  `, [user.id, judgment.id]);
  const uniqueKeys = await pool.query(`
    SELECT table_name, count(*)::int AS count
    FROM (
      SELECT t.relname AS table_name,
        ARRAY(SELECT a.attname::text
          FROM unnest(i.indkey) WITH ORDINALITY key(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = key.attnum
          ORDER BY key.ord) AS columns
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema() AND i.indisunique AND i.indisvalid
    ) keys
    WHERE (table_name = 'research_bookmarks'
        AND columns = ARRAY['user_id', 'judgment_id'])
       OR (table_name = 'research_duplicate_links'
        AND columns = ARRAY['source_judgment_id', 'target_judgment_id'])
    GROUP BY table_name ORDER BY table_name
  `);
  expect(uniqueKeys.rows).toEqual([
    { table_name: "research_bookmarks", count: 1 }, { table_name: "research_duplicate_links", count: 1 },
  ]);
  await pool.query(`
    INSERT INTO research_bookmarks (user_id, judgment_id)
    VALUES ($1, $2)
  `, [user.id, judgment.id]);
  await expect(pool.query(`
    INSERT INTO research_bookmarks (user_id, judgment_id) VALUES ($1, $2)
  `, [user.id, judgment.id])).rejects.toMatchObject({ code: "23505" });
  await pool.query(`
    INSERT INTO research_duplicate_links
      (source_judgment_id, target_judgment_id, link_type, similarity_score, detected_by)
    VALUES ($1, $2, 'EXACT_DUPLICATE', 1, 'schema-safeguard')
  `, [judgment.id, otherJudgment.id]);
  await expect(pool.query(`
    INSERT INTO research_duplicate_links
      (source_judgment_id, target_judgment_id, link_type, similarity_score, detected_by)
    VALUES ($1, $2, 'POSSIBLE_DUPLICATE', 0.5, 'schema-safeguard')
  `, [judgment.id, otherJudgment.id])).rejects.toMatchObject({ code: "23505" });
  const workspaceParents = await pool.query(`
    WITH folder AS (
      INSERT INTO research_folders (owner_id, name)
      VALUES ($1, 'Safeguard folder') RETURNING id
    ), folder_item AS (
      INSERT INTO research_folder_items (folder_id, judgment_id)
      SELECT id, $2 FROM folder
    ), reading_list AS (
      INSERT INTO research_reading_lists (owner_id, name)
      VALUES ($1, 'Safeguard reading list') RETURNING id
    ), reading_item AS (
      INSERT INTO research_reading_list_items (list_id, judgment_id)
      SELECT id, $2 FROM reading_list
    ), collection AS (
      INSERT INTO research_quotation_collections (owner_id, name)
      VALUES ($1, 'Safeguard quotations') RETURNING id
    )
    SELECT folder.id AS folder_id, reading_list.id AS list_id,
      collection.id AS collection_id
    FROM folder, reading_list, collection
  `, [user.id, judgment.id]);
  const { rows: [provider] } = await pool.query(`
    INSERT INTO research_ai_providers (name, model_name)
    VALUES ('schema-safeguard', 'schema-safeguard') RETURNING id
  `);
  const { rows: [analysis] } = await pool.query(`
    INSERT INTO research_ai_analysis_runs
      (judgment_id, provider_id, prompt_version, model_version)
    VALUES ($1, $2, 'schema-safeguard@1', 'schema-safeguard') RETURNING id
  `, [judgment.id, provider.id]);
  const { rows: [proposition] } = await pool.query(`
    INSERT INTO research_ai_propositions
      (run_id, proposition_id, field_name, content, confidence_category)
    VALUES ($1, 'schema-safeguard-proposition', 'holding', 'Passage', 'high')
    RETURNING id
  `, [analysis.id]);
  await pool.query(`
    INSERT INTO research_workspace_quotations
      (collection_id, proposition_id, passage_text)
    VALUES ($1, $2, 'Protected passage')
  `, [workspaceParents.rows[0].collection_id, proposition.id]);
  await pool.query(`
    WITH deleted_folder AS (
      DELETE FROM research_folders WHERE id = $1 RETURNING id
    ), deleted_list AS (
      DELETE FROM research_reading_lists WHERE id = $2 RETURNING id
    )
    DELETE FROM research_quotation_collections WHERE id = $3
  `, [
    workspaceParents.rows[0].folder_id,
    workspaceParents.rows[0].list_id,
    workspaceParents.rows[0].collection_id,
  ]);
  const cascaded = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM research_folder_items) AS folder_items,
      (SELECT count(*)::int FROM research_reading_list_items) AS reading_list_items,
      (SELECT count(*)::int FROM research_workspace_quotations) AS workspace_quotations
  `);
  expect(cascaded.rows[0]).toEqual({
    folder_items: 0, reading_list_items: 0, workspace_quotations: 0,
  });
}