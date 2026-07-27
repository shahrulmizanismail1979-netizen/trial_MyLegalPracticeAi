/**
 * Phase 12b — Permission-controlled export service.
 *
 * buildExport() assembles content from the DB and dispatches to a format-specific
 * renderer. Provenance is labelled on every section. Rights-restricted containers
 * have all text replaced with the stub even after the export gate has passed.
 */

import PDFDocument from "pdfkit";
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import {
  db,
  researchVerifiedJudgments,
  researchRightsRecords,
  researchSearchIndex,
  researchCaseMetadata,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchAnnotations,
  researchAuthorities,
  researchLegislationRefs,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../domain/types";
import { reconstructJudicialText } from "../quotations/integrity";

// ── Constants ──────────────────────────────────────────────────────────────

export const PROVENANCE_TAGS = {
  VERIFIED_JUDICIAL_TEXT: "[VERIFIED JUDICIAL TEXT]",
  AI_GENERATED: "[AI-GENERATED]",
  USER_AUTHORED: "[USER-AUTHORED]",
  UNVERIFIED: "[UNVERIFIED]",
  RIGHTS_RESTRICTED: "[RIGHTS-RESTRICTED — content omitted]",
} as const;

export type ProvenanceLabel = (typeof PROVENANCE_TAGS)[keyof typeof PROVENANCE_TAGS];

/**
 * Rights statuses that permit full-text export.
 * Any container NOT in this set gets text replaced with the rights-restricted stub,
 * even if the export gate (exportPermitted) was satisfied.
 */
const EXPORT_TEXT_APPROVED_STATUSES = new Set([
  "OFFICIAL_COURT_SOURCE",
  "PUBLIC_OR_OPEN_LICENCE_SOURCE",
  "USER_OWNED_OR_AUTHORISED",
]);

export const EXPORT_FORMATS = ["json", "markdown", "csv", "docx", "pdf", "bibliography"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_SCOPES = [
  "full",
  "judgment_only",
  "analysis_only",
  "annotations",
  "authorities",
] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export interface ExportResult {
  contentType: string;
  filename: string;
  buffer: Buffer;
}

// ── Internal data model ───────────────────────────────────────────────────

interface ExportData {
  judgment: {
    id: number;
    containerId: number;
    citation: string | null;
    court: string | null;
    decisionDate: string | null;
    verifiedBy: string;
    rightsStatus: string;
  };
  rightsRestricted: boolean;
  judicialText: string | null;
  aiPropositions: Array<{
    id: number;
    fieldName: string;
    content: string;
    confidenceCategory: string;
    reviewStatus: string;
    supportingParagraphIds: string[];
  }>;
  annotations: Array<{
    id: number;
    paragraphRef: string | null;
    kind: string;
    body: string;
    createdAt: Date;
  }>;
  authorities: Array<{
    id: number;
    caseName: string;
    citation: string | null;
    treatment: string;
    treatmentEvidence: string | null;
    reviewStatus: string;
  }>;
  legislationRefs: Array<{
    id: number;
    statute: string;
    provision: string | null;
    jurisdiction: string | null;
    mode: string;
  }>;
  scope: ExportScope;
  format: ExportFormat;
  exportedAt: string;
}

// ── Assembly ───────────────────────────────────────────────────────────────

async function assembleExportData(
  containerId: number,
  format: ExportFormat,
  scope: ExportScope,
  dbc: DbClient,
): Promise<ExportData | null> {
  // 1. Find the verified judgment for this container.
  const [judgment] = await dbc
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.containerId, containerId))
    .orderBy(desc(researchVerifiedJudgments.id))
    .limit(1);

  if (!judgment) return null;

  // 2. Get the container rights status.
  const [container] = await dbc
    .select({ rightsStatus: researchVerifiedJudgments.containerId })
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgment.id));

  const [latestRights] = await dbc
    .select()
    .from(researchRightsRecords)
    .where(eq(researchRightsRecords.containerId, containerId))
    .orderBy(desc(researchRightsRecords.id))
    .limit(1);

  const rightsStatus = latestRights?.status ?? "UNREVIEWED";
  const rightsRestricted = !EXPORT_TEXT_APPROVED_STATUSES.has(rightsStatus);

  // 3. Metadata — use search index for court/date, case_metadata for citation.
  const [searchRow] = await dbc
    .select({ court: researchSearchIndex.court, decisionDate: researchSearchIndex.decisionDate })
    .from(researchSearchIndex)
    .where(eq(researchSearchIndex.judgmentId, judgment.id))
    .limit(1);

  const citationRows = await dbc
    .select({ value: researchCaseMetadata.value })
    .from(researchCaseMetadata)
    .where(eq(researchCaseMetadata.judgmentId, judgment.id))
    .orderBy(desc(researchCaseMetadata.id))
    .limit(20);

  // Take the first non-null citation field value.
  const citationRow = citationRows.find(
    (r) => typeof r.value === "string" && r.value.length > 0,
  );
  const citation = citationRow ? String(citationRow.value) : null;

  // 4. Judicial text (only if scope includes judgment).
  let judicialText: string | null = null;
  if (scope === "full" || scope === "judgment_only") {
    const reconstruction = await reconstructJudicialText(judgment.id, dbc);
    judicialText = reconstruction?.text ?? null;
  }

  // 5. AI propositions.
  const aiPropositions: ExportData["aiPropositions"] = [];
  if (scope === "full" || scope === "analysis_only") {
    const runs = await dbc
      .select({ id: researchAiAnalysisRuns.id })
      .from(researchAiAnalysisRuns)
      .where(eq(researchAiAnalysisRuns.judgmentId, judgment.id));

    if (runs.length > 0) {
      const runIds = runs.map((r) => r.id);
      const props = await dbc
        .select()
        .from(researchAiPropositions)
        .where(inArray(researchAiPropositions.runId, runIds));
      for (const p of props) {
        aiPropositions.push({
          id: p.id,
          fieldName: p.fieldName,
          content: p.content,
          confidenceCategory: p.confidenceCategory,
          reviewStatus: p.reviewStatus,
          supportingParagraphIds: p.supportingParagraphIds ?? [],
        });
      }
    }
  }

  // 6. Annotations.
  const annotations: ExportData["annotations"] = [];
  if (scope === "full" || scope === "annotations") {
    const rows = await dbc
      .select()
      .from(researchAnnotations)
      .where(eq(researchAnnotations.judgmentId, judgment.id))
      .orderBy(researchAnnotations.createdAt);
    for (const a of rows) {
      annotations.push({
        id: a.id,
        paragraphRef: a.paragraphRef ?? null,
        kind: a.kind,
        body: a.body,
        createdAt: a.createdAt,
      });
    }
  }

  // 7. Authorities + legislation.
  const authorities: ExportData["authorities"] = [];
  const legislationRefs: ExportData["legislationRefs"] = [];
  if (scope === "full" || scope === "authorities") {
    const authRows = await dbc
      .select()
      .from(researchAuthorities)
      .where(eq(researchAuthorities.judgmentId, judgment.id));
    for (const a of authRows) {
      authorities.push({
        id: a.id,
        caseName: a.caseName,
        citation: a.citation ?? null,
        treatment: a.treatment,
        treatmentEvidence: a.treatmentEvidence ?? null,
        reviewStatus: a.reviewStatus,
      });
    }

    const legRows = await dbc
      .select()
      .from(researchLegislationRefs)
      .where(eq(researchLegislationRefs.judgmentId, judgment.id));
    for (const l of legRows) {
      legislationRefs.push({
        id: l.id,
        statute: l.statute,
        provision: l.provision ?? null,
        jurisdiction: l.jurisdiction ?? null,
        mode: l.mode,
      });
    }
  }

  const STUB = PROVENANCE_TAGS.RIGHTS_RESTRICTED;

  return {
    judgment: {
      id: judgment.id,
      containerId,
      citation,
      court: searchRow?.court ?? null,
      decisionDate: searchRow?.decisionDate?.toISOString().slice(0, 10) ?? null,
      verifiedBy: judgment.verifiedBy,
      rightsStatus,
    },
    rightsRestricted,
    // ── Text redaction at the data layer ───────────────────────────────────
    // When rightsRestricted=true, ALL user-visible textual content is replaced
    // with the rights-restricted stub before any renderer sees it.
    // Metadata (case names, citations, statute names, confidence levels,
    // treatment labels) is preserved because it is non-sensitive bibliographic
    // information that rights restrictions do not prohibit disclosing.
    judicialText: rightsRestricted ? STUB : judicialText,
    aiPropositions: aiPropositions.map((p) =>
      rightsRestricted
        ? { ...p, content: STUB }
        : p,
    ),
    annotations: annotations.map((a) =>
      rightsRestricted
        ? { ...a, body: STUB }
        : a,
    ),
    authorities: authorities.map((a) =>
      rightsRestricted
        ? { ...a, treatmentEvidence: STUB }
        : a,
    ),
    // Legislation: statute/provision names are bibliographic metadata (kept);
    // no free-text content field to redact.
    legislationRefs,
    scope,
    format,
    exportedAt: new Date().toISOString(),
  };
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Build an export for a verified judgment inside a container.
 * MUST be called after `assertExportAllowed` has passed.
 *
 * @returns ExportResult — contentType + filename + buffer ready for streaming.
 * @throws Error with code "JUDGMENT_NOT_FOUND" if the container has no verified judgment.
 */
export async function buildExport(
  containerId: number,
  format: ExportFormat,
  scope: ExportScope,
  _actor: string,
  dbc: DbClient = db,
): Promise<ExportResult> {
  const data = await assembleExportData(containerId, format, scope, dbc);
  if (!data) {
    const err = new Error(`No verified judgment found for container ${containerId}`);
    (err as NodeJS.ErrnoException).code = "JUDGMENT_NOT_FOUND";
    throw err;
  }

  switch (format) {
    case "json":
      return renderJson(data);
    case "markdown":
      return renderMarkdown(data);
    case "csv":
      return renderCsv(data);
    case "bibliography":
      return renderBibliography(data);
    case "docx":
      return renderDocx(data);
    case "pdf":
      return renderPdf(data);
  }
}

// ── Provenance helper ─────────────────────────────────────────────────────

function tag(text: string, provenance: ProvenanceLabel, restricted: boolean): string {
  if (restricted) return PROVENANCE_TAGS.RIGHTS_RESTRICTED;
  return `${provenance}\n${text}`;
}

// ── JSON renderer ─────────────────────────────────────────────────────────

function renderJson(data: ExportData): ExportResult {
  // All text fields are already pre-redacted at the data layer when
  // data.rightsRestricted === true. Renderers simply use data as-is.
  const output = {
    judgment: {
      id: data.judgment.id,
      citation: data.judgment.citation,
      court: data.judgment.court,
      decisionDate: data.judgment.decisionDate,
      verifiedBy: data.judgment.verifiedBy,
      rightsStatus: data.judgment.rightsStatus,
    },
    exportedAt: data.exportedAt,
    scope: data.scope,
    rightsRestricted: data.rightsRestricted,
    sections: [
      ...(data.judicialText !== null
        ? [
            {
              kind: "judgment_text",
              provenance: PROVENANCE_TAGS.VERIFIED_JUDICIAL_TEXT,
              content: data.judicialText,
            },
          ]
        : []),
      ...data.aiPropositions.map((p) => ({
        kind: "ai_analysis",
        provenance: PROVENANCE_TAGS.AI_GENERATED,
        field: p.fieldName,
        content: p.content,
        confidence: p.confidenceCategory,
        reviewStatus: p.reviewStatus,
        paragraphIds: p.supportingParagraphIds,
      })),
      ...data.annotations.map((a) => ({
        kind: "annotation",
        provenance: PROVENANCE_TAGS.USER_AUTHORED,
        annotationKind: a.kind,
        paragraphRef: a.paragraphRef,
        content: a.body,
        createdAt: a.createdAt,
      })),
      ...data.authorities.map((a) => ({
        kind: "authority",
        provenance: PROVENANCE_TAGS.AI_GENERATED,
        caseName: a.caseName,
        citation: a.citation,
        treatment: a.treatment,
        treatmentEvidence: a.treatmentEvidence,
      })),
      ...data.legislationRefs.map((l) => ({
        kind: "legislation",
        provenance: PROVENANCE_TAGS.AI_GENERATED,
        statute: l.statute,
        provision: l.provision,
        jurisdiction: l.jurisdiction,
        mode: l.mode,
      })),
    ],
  };

  const json = JSON.stringify(output, null, 2);
  const safeFilename = (data.judgment.citation ?? `judgment-${data.judgment.id}`)
    .replace(/[^a-zA-Z0-9-_ ]/g, "_")
    .slice(0, 60);

  return {
    contentType: "application/json; charset=utf-8",
    filename: `${safeFilename}.json`,
    buffer: Buffer.from(json, "utf-8"),
  };
}

// ── Markdown renderer ─────────────────────────────────────────────────────

function renderMarkdown(data: ExportData): ExportResult {
  const lines: string[] = [];
  const { judgment, rightsRestricted } = data;

  // Title block
  lines.push(`# ${judgment.citation ?? `Judgment ${judgment.id}`}`);
  if (judgment.court) lines.push(`**Court:** ${judgment.court}`);
  if (judgment.decisionDate) lines.push(`**Date:** ${judgment.decisionDate}`);
  lines.push(`**Rights status:** ${judgment.rightsStatus}`);
  lines.push(`**Exported:** ${data.exportedAt}`);
  lines.push("");

  // Judicial text (already pre-redacted at data layer if rightsRestricted)
  if (data.judicialText !== null) {
    lines.push("## Judgment Text");
    lines.push(`*${PROVENANCE_TAGS.VERIFIED_JUDICIAL_TEXT}*`);
    lines.push("");
    lines.push(data.judicialText);
    lines.push("");
  }

  // AI analysis
  if (data.aiPropositions.length > 0) {
    lines.push("## AI Analysis");
    lines.push(`*${PROVENANCE_TAGS.AI_GENERATED}*`);
    lines.push("");
    const byField = new Map<string, typeof data.aiPropositions>();
    for (const p of data.aiPropositions) {
      const arr = byField.get(p.fieldName) ?? [];
      arr.push(p);
      byField.set(p.fieldName, arr);
    }
    for (const [field, props] of byField) {
      lines.push(`### ${field}`);
      for (const p of props) {
        lines.push(`- **[${p.confidenceCategory}]** ${p.content}`);
      }
      lines.push("");
    }
  }

  // Annotations
  if (data.annotations.length > 0) {
    lines.push("## Annotations");
    lines.push(`*${PROVENANCE_TAGS.USER_AUTHORED}*`);
    lines.push("");
    for (const a of data.annotations) {
      const para = a.paragraphRef ? ` (${a.paragraphRef})` : "";
      lines.push(`- **${a.kind}${para}:** ${a.body}`);
    }
    lines.push("");
  }

  // Authorities
  if (data.authorities.length > 0) {
    lines.push("## Cases Cited");
    lines.push(`*${PROVENANCE_TAGS.AI_GENERATED}*`);
    lines.push("");
    for (const a of data.authorities) {
      const cit = a.citation ? ` ${a.citation}` : "";
      lines.push(`- *${a.caseName}*${cit} — ${a.treatment}`);
    }
    lines.push("");
  }

  // Legislation
  if (data.legislationRefs.length > 0) {
    lines.push("## Legislation Considered");
    lines.push(`*${PROVENANCE_TAGS.AI_GENERATED}*`);
    lines.push("");
    for (const l of data.legislationRefs) {
      const prov = l.provision ? ` s ${l.provision}` : "";
      lines.push(`- ${l.statute}${prov} (${l.mode})`);
    }
    lines.push("");
  }

  const markdown = lines.join("\n");
  const safeFilename = (judgment.citation ?? `judgment-${judgment.id}`)
    .replace(/[^a-zA-Z0-9-_ ]/g, "_")
    .slice(0, 60);

  return {
    contentType: "text/markdown; charset=utf-8",
    filename: `${safeFilename}.md`,
    buffer: Buffer.from(markdown, "utf-8"),
  };
}

// ── CSV renderer (one row per AI proposition) ────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function renderCsv(data: ExportData): ExportResult {
  const { judgment } = data;
  const citationCol = judgment.citation ?? `judgment-${judgment.id}`;

  const rows: string[] = [
    ["field", "content", "confidence", "review_status", "provenance", "judgment_citation"].join(","),
  ];

  for (const p of data.aiPropositions) {
    rows.push(
      [
        csvEscape(p.fieldName),
        csvEscape(p.content),
        csvEscape(p.confidenceCategory),
        csvEscape(p.reviewStatus),
        csvEscape(PROVENANCE_TAGS.AI_GENERATED),
        csvEscape(citationCol),
      ].join(","),
    );
  }

  // Append authorities as additional rows with a distinct field type.
  for (const a of data.authorities) {
    rows.push(
      [
        csvEscape("casesConsidered"),
        csvEscape(`${a.caseName}${a.citation ? ` [${a.citation}]` : ""} — ${a.treatment}`),
        csvEscape("N/A"),
        csvEscape(a.reviewStatus),
        csvEscape(PROVENANCE_TAGS.AI_GENERATED),
        csvEscape(citationCol),
      ].join(","),
    );
  }

  const csv = rows.join("\r\n") + "\r\n";
  const safeFilename = citationCol.replace(/[^a-zA-Z0-9-_ ]/g, "_").slice(0, 60);

  return {
    contentType: "text/csv; charset=utf-8",
    filename: `${safeFilename}.csv`,
    buffer: Buffer.from(csv, "utf-8"),
  };
}

// ── Bibliography renderer (OSCOLA-style) ──────────────────────────────────

function renderBibliography(data: ExportData): ExportResult {
  const { judgment } = data;
  const lines: string[] = [];

  lines.push(`Bibliography — ${judgment.citation ?? `Judgment ${judgment.id}`}`);
  lines.push(`${PROVENANCE_TAGS.AI_GENERATED}`);
  lines.push(`Generated: ${data.exportedAt}`);
  lines.push("");

  if (data.authorities.length > 0) {
    lines.push("Cases:");
    lines.push("──────");
    for (const a of data.authorities) {
      const cit = a.citation ? ` [${a.citation}]` : "";
      const evidence = a.treatmentEvidence ? ` — "${a.treatmentEvidence}"` : "";
      lines.push(`${a.caseName}${cit} (treatment: ${a.treatment})${evidence}`);
    }
    lines.push("");
  }

  if (data.legislationRefs.length > 0) {
    lines.push("Legislation:");
    lines.push("────────────");
    for (const l of data.legislationRefs) {
      const prov = l.provision ? ` s ${l.provision}` : "";
      const juris = l.jurisdiction ? ` (${l.jurisdiction})` : "";
      lines.push(`${l.statute}${prov}${juris} [${l.mode}]`);
    }
    lines.push("");
  }

  if (data.authorities.length === 0 && data.legislationRefs.length === 0) {
    lines.push("(No authorities or legislation recorded for this judgment.)");
  }

  const text = lines.join("\n");
  const safeFilename = (judgment.citation ?? `judgment-${judgment.id}`)
    .replace(/[^a-zA-Z0-9-_ ]/g, "_")
    .slice(0, 60);

  return {
    contentType: "text/plain; charset=utf-8",
    filename: `${safeFilename}.bib.txt`,
    buffer: Buffer.from(text, "utf-8"),
  };
}

// ── DOCX renderer ──────────────────────────────────────────────────────────

async function renderDocx(data: ExportData): Promise<ExportResult> {
  const { judgment, rightsRestricted } = data;
  const title = judgment.citation ?? `Judgment ${judgment.id}`;

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true })],
    }),
  ];

  // Metadata block
  const metaLines: string[] = [];
  if (judgment.court) metaLines.push(`Court: ${judgment.court}`);
  if (judgment.decisionDate) metaLines.push(`Date: ${judgment.decisionDate}`);
  metaLines.push(`Rights status: ${judgment.rightsStatus}`);
  metaLines.push(`Exported: ${data.exportedAt}`);
  for (const line of metaLines) {
    children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }));
  }

  // Judicial text (already pre-redacted at data layer if rightsRestricted)
  if (data.judicialText !== null) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Judgment Text")] }),
      new Paragraph({
        children: [
          new TextRun({
            text: PROVENANCE_TAGS.VERIFIED_JUDICIAL_TEXT,
            italics: true,
            color: "808080",
          }),
        ],
      }),
    );
    // Split long text into paragraphs at newlines
    for (const para of data.judicialText.split(/\n{2,}/)) {
      if (para.trim()) {
        children.push(new Paragraph({ children: [new TextRun(para.trim())] }));
      }
    }
  }

  // AI propositions
  if (data.aiPropositions.length > 0) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("AI Analysis")] }),
      new Paragraph({
        children: [
          new TextRun({ text: PROVENANCE_TAGS.AI_GENERATED, italics: true, color: "808080" }),
        ],
      }),
    );
    for (const p of data.aiPropositions) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${p.fieldName}] `, bold: true }),
            new TextRun({ text: `[${p.confidenceCategory}] `, italics: true }),
            new TextRun(p.content),
          ],
        }),
      );
    }
  }

  // Annotations
  if (data.annotations.length > 0) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Annotations")] }),
      new Paragraph({
        children: [
          new TextRun({ text: PROVENANCE_TAGS.USER_AUTHORED, italics: true, color: "808080" }),
        ],
      }),
    );
    for (const a of data.annotations) {
      const label = a.paragraphRef ? `${a.kind} (${a.paragraphRef})` : a.kind;
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true }),
            new TextRun(a.body),
          ],
        }),
      );
    }
  }

  // Authorities
  if (data.authorities.length > 0) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Cases Cited")] }),
      new Paragraph({
        children: [
          new TextRun({ text: PROVENANCE_TAGS.AI_GENERATED, italics: true, color: "808080" }),
        ],
      }),
    );
    for (const a of data.authorities) {
      const cit = a.citation ? ` ${a.citation}` : "";
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${a.caseName}${cit}`, italics: true }),
            new TextRun(` — ${a.treatment}`),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    title,
    description: `Verified judgment export — ${data.exportedAt}`,
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeFilename = title.replace(/[^a-zA-Z0-9-_ ]/g, "_").slice(0, 60);

  return {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: `${safeFilename}.docx`,
    buffer: Buffer.from(buffer),
  };
}

// ── PDF renderer ───────────────────────────────────────────────────────────

function renderPdf(data: ExportData): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const { judgment, rightsRestricted } = data;
    const title = judgment.citation ?? `Judgment ${judgment.id}`;

    const doc = new PDFDocument({ autoFirstPage: true, size: "A4", margin: 72 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const safeFilename = title.replace(/[^a-zA-Z0-9-_ ]/g, "_").slice(0, 60);
      resolve({
        contentType: "application/pdf",
        filename: `${safeFilename}.pdf`,
        buffer,
      });
    });

    // Title page
    doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown();

    if (judgment.court) {
      doc.fontSize(12).font("Helvetica").text(`Court: ${judgment.court}`);
    }
    if (judgment.decisionDate) {
      doc.text(`Date: ${judgment.decisionDate}`);
    }
    doc.text(`Rights status: ${judgment.rightsStatus}`);
    doc.text(`Exported: ${data.exportedAt}`);
    doc.moveDown(2);

    // Helper to write a section heading + provenance
    const writeSection = (heading: string, provenance: ProvenanceLabel) => {
      doc.fontSize(14).font("Helvetica-Bold").text(heading);
      doc.fontSize(9).font("Helvetica-Oblique").fillColor("gray").text(provenance);
      doc.fillColor("black").fontSize(10).font("Helvetica").moveDown(0.5);
    };

    // Judicial text (already pre-redacted at data layer if rightsRestricted)
    if (data.judicialText !== null) {
      writeSection("Judgment Text", PROVENANCE_TAGS.VERIFIED_JUDICIAL_TEXT);
      doc.text(data.judicialText, { lineGap: 4 });
      doc.moveDown();
    }

    // AI analysis
    if (data.aiPropositions.length > 0) {
      writeSection("AI Analysis", PROVENANCE_TAGS.AI_GENERATED);
      for (const p of data.aiPropositions) {
        doc.font("Helvetica-Bold").text(`[${p.fieldName}]`, { continued: true });
        doc.font("Helvetica-Oblique").text(` [${p.confidenceCategory}] `, { continued: true });
        doc.font("Helvetica").text(p.content);
        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    // Annotations
    if (data.annotations.length > 0) {
      writeSection("Annotations", PROVENANCE_TAGS.USER_AUTHORED);
      for (const a of data.annotations) {
        const label = a.paragraphRef ? `${a.kind} (${a.paragraphRef})` : a.kind;
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(a.body);
        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    // Authorities
    if (data.authorities.length > 0) {
      writeSection("Cases Cited", PROVENANCE_TAGS.AI_GENERATED);
      for (const a of data.authorities) {
        const cit = a.citation ? ` ${a.citation}` : "";
        doc.font("Helvetica-Oblique").text(`${a.caseName}${cit}`, { continued: true });
        doc.font("Helvetica").text(` — ${a.treatment}`);
        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    // Legislation
    if (data.legislationRefs.length > 0) {
      writeSection("Legislation Considered", PROVENANCE_TAGS.AI_GENERATED);
      for (const l of data.legislationRefs) {
        const prov = l.provision ? ` s ${l.provision}` : "";
        doc.text(`${l.statute}${prov} [${l.mode}]`);
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}
