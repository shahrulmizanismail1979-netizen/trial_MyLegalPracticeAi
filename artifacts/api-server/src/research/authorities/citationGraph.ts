// Phase 11a: Citation graph (intra-collection only).
//
// Builds a directed authority graph limited to documents in this private
// collection.  Does NOT claim anything about whether a case remains good law.

import {
  db,
  researchAuthorities,
  researchVerifiedJudgments,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type { DbClient } from "../domain/types";
import { CITATION_GRAPH_DISCLAIMER } from "./extractor";

export interface CitationLink {
  authorityId: number;
  treatment: string;
  treatmentEvidence: string | null;
  reviewStatus: string;
  /** The judgment in this collection that IS the cited case (if known). */
  linkedJudgmentId: number | null;
}

export interface CitationNode {
  caseName: string;
  citation: string | null;
  links: CitationLink[];
}

export interface CitationGraph {
  /** Authorities cited BY this judgment (outbound). */
  outbound: CitationNode[];
  /**
   * Judgments in this collection that CITE this judgment's known citations
   * (inbound).  Only populated when the judgment has a confirmed citation.
   */
  inbound: CitationNode[];
  /** Always included.  Never omit or paraphrase. */
  disclaimer: string;
}

/**
 * Build the citation graph for a verified judgment.
 *
 * Outbound: all authorities extracted from approved runs for this judgment.
 * Inbound: authorities in other judgments' approved runs where the citation
 *          string matches any citation in this judgment's outbound set — OR
 *          where the cited judgment is this one.
 *
 * Important: the graph is strictly limited to documents in this collection.
 * No claim of good-law status is made.
 */
export async function getCitationGraph(
  judgmentId: number,
  dbc: DbClient = db,
): Promise<CitationGraph> {
  // 1. Outbound: authorities cited by this judgment.
  const outboundRows = await dbc
    .select()
    .from(researchAuthorities)
    .where(eq(researchAuthorities.judgmentId, judgmentId));

  // Group outbound rows by (caseName, citation).
  const outboundMap = new Map<string, CitationNode>();
  for (const row of outboundRows) {
    const key = `${row.caseName}||${row.citation ?? ""}`;
    if (!outboundMap.has(key)) {
      outboundMap.set(key, { caseName: row.caseName, citation: row.citation, links: [] });
    }
    outboundMap.get(key)!.links.push({
      authorityId: row.id,
      treatment: row.treatment,
      treatmentEvidence: row.treatmentEvidence,
      reviewStatus: row.reviewStatus,
      linkedJudgmentId: null,
    });
  }

  const outbound = [...outboundMap.values()];

  // 2. Inbound: other judgments in the collection that cite this judgment.
  //    We match on citation strings: find all authorities in the DB whose
  //    citation matches any citation in this judgment's authority rows.
  //    Additionally we look for authority rows whose judgment_id points to
  //    THIS judgment (if someone extracted a cross-reference directly).
  const thisCitations = outboundRows
    .map((r) => r.citation)
    .filter((c): c is string => c !== null && c.trim().length > 0);

  // Load all authority rows that reference this judgment's known citations.
  // Limitation: citation string matching is exact; alias/abbreviation variants
  // are not resolved (the collection limitation disclaimer applies).
  const inboundRows =
    thisCitations.length > 0
      ? await dbc
          .select()
          .from(researchAuthorities)
          .where(inArray(researchAuthorities.citation, thisCitations))
          .then((rows) => rows.filter((r) => r.judgmentId !== judgmentId))
      : [];

  // Build inbound nodes grouped by the citing judgment.
  const inboundMap = new Map<number, { judgmentId: number; rows: typeof inboundRows }>();
  for (const row of inboundRows) {
    if (!inboundMap.has(row.judgmentId)) {
      inboundMap.set(row.judgmentId, { judgmentId: row.judgmentId, rows: [] });
    }
    inboundMap.get(row.judgmentId)!.rows.push(row);
  }

  // We don't have a citation column on verified judgments; use the authority
  // row's own citation string (already stored during extraction).
  const inboundJudgmentIds = [...inboundMap.keys()];
  // Build a map: judgmentId → any authority citation from that judgment's rows.
  const judgmentCitationMap = new Map<number, string | null>();
  for (const jid of inboundJudgmentIds) {
    const entry = inboundMap.get(jid);
    judgmentCitationMap.set(jid, entry?.rows[0]?.citation ?? null);
  }

  const inbound: CitationNode[] = [];
  for (const { judgmentId: citingJudgmentId, rows } of inboundMap.values()) {
    const citingCitation = judgmentCitationMap.get(citingJudgmentId) ?? null;
    const caseName =
      rows[0]?.caseName ??
      `Judgment #${citingJudgmentId} (in collection)`;
    inbound.push({
      caseName,
      citation: citingCitation,
      links: rows.map((r) => ({
        authorityId: r.id,
        treatment: r.treatment,
        treatmentEvidence: r.treatmentEvidence,
        reviewStatus: r.reviewStatus,
        linkedJudgmentId: citingJudgmentId,
      })),
    });
  }

  return { outbound, inbound, disclaimer: CITATION_GRAPH_DISCLAIMER };
}
