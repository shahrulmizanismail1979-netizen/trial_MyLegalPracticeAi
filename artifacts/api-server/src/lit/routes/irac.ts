import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import mammoth from "mammoth";
import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as safeFetch } from "undici";
import { ai } from "@workspace/integrations-gemini-ai";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "../../lib/logger";
import {
  streamChat,
  normalizeProvider,
  type AIProvider,
  type ChatMessage,
} from "../lib/aiProvider";
import { requireSubscription } from "./billing";

const router: IRouter = Router();
const connectors = new ReplitConnectors();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const MODEL = "gemini-2.5-flash";
// Largest slice of a user-supplied template/precedent we feed into a draft prompt.
const TEMPLATE_CHAR_CAP = 40000;
// Caps for the per-pathway expert paralegal chat.
const CHAT_MAX_TURNS = 24;
const CHAT_MSG_CHAR_CAP = 16000;
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500MB per file (very large bundles, recordings)
const MAX_FILES = 100;
const MAX_ZIP_ENTRIES = 500;
// Cumulative uncompressed bytes we will inflate from a single archive — guards
// against ZIP/decompression bombs that are tiny on disk but huge expanded.
const MAX_ZIP_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1GB
// Per-entry caps. adm-zip allocates output based on the entry header's declared
// size, so refusing oversized entries (and absurd compression ratios) before
// getData() bounds the memory a single crafted entry can force us to inflate.
const MAX_ZIP_ENTRY_BYTES = 200 * 1024 * 1024; // 200MB per entry
const MAX_ZIP_RATIO = 200; // declared / compressed; classic bombs are far higher
const MAX_CHARS_PER_FILE = 1_500_000;
const MAX_TOTAL_CHARS = 5_000_000; // cap raw text stored per case
// Largest media buffer we will send to ElevenLabs speech-to-text.
const STT_MAX_BYTES = 200 * 1024 * 1024;
// Grounded calls collapse (no groundingChunks returned) when the prompt is
// flooded with a huge raw document dump. The Issues stage digests the FULL
// text ungrounded; every grounded stage then runs on the compact stage
// summaries plus only a small raw excerpt, which keeps grounding reliable.
const GROUNDED_RAW_CAP = 28_000;
const CASE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// ─────────────────────────────────────────────────────────────────────────────
// In-memory case store (compressed, session-scoped — no persistence by design)
// ─────────────────────────────────────────────────────────────────────────────
interface CaseFileMeta {
  name: string;
  chars: number;
  truncated: boolean;
  source: string; // original upload name (zip name if extracted from archive)
}

interface CaseRecord {
  id: string;
  createdAt: number;
  pathway: string;
  files: CaseFileMeta[];
  combinedText: string;
  totalChars: number;
  issues?: string;
  rules?: string;
  application?: string;
  opinion?: string;
}

const cases = new Map<string, CaseRecord>();

function pruneCases() {
  const now = Date.now();
  for (const [id, rec] of cases) {
    if (now - rec.createdAt > CASE_TTL_MS) cases.delete(id);
  }
}
setInterval(pruneCases, 30 * 60 * 1000).unref?.();

function getCase(id: string): CaseRecord | undefined {
  const rec = cases.get(id);
  if (!rec) return undefined;
  if (Date.now() - rec.createdAt > CASE_TTL_MS) {
    cases.delete(id);
    return undefined;
  }
  return rec;
}

// ─────────────────────────────────────────────────────────────────────────────
// Litigation pathways & document catalogue
// ─────────────────────────────────────────────────────────────────────────────
interface PathwayInfo {
  id: string;
  label: string;
  blurb: string;
  court: string;
  keyLegislation: string[];
}

export const PATHWAYS: Record<string, PathwayInfo> = {
  "general-civil": {
    id: "general-civil",
    label: "General Civil Litigation",
    blurb: "Contract, tort, debt recovery and general disputes in the civil courts.",
    court: "High Court in Malaya / Sessions Court",
    keyLegislation: [
      "Rules of Court 2012 (as amended by P.U.(A) 229/2023)",
      "Contracts Act 1950 (Act 136)",
      "Specific Relief Act 1950 (Act 137)",
      "Civil Law Act 1956 (Act 67)",
      "Evidence Act 1950 (Act 56)",
      "Limitation Act 1953 (Act 254) — s.6(1), 6 years",
      "Courts of Judicature Act 1964 (Act 91)",
      "Subordinate Courts Act 1948 (Act 92)",
    ],
  },
  "banking-commercial": {
    id: "banking-commercial",
    label: "Banking & Commercial Litigation",
    blurb: "Loan recovery, guarantees, foreclosure, facilities and commercial disputes.",
    court: "High Court (Commercial Division)",
    keyLegislation: [
      "Financial Services Act 2013 (Act 758)",
      "Islamic Financial Services Act 2013 (Act 759)",
      "National Land Code (Act 828, Revised 2020)",
      "Hire-Purchase Act 1967 (Act 212)",
      "Contracts Act 1950 (Act 136)",
      "Insolvency Act 1967 (Act 360)",
      "Rules of Court 2012 (esp. O.14, O.81, O.83)",
    ],
  },
  "accident-rdc": {
    id: "accident-rdc",
    label: "Accident & Running Down Litigation",
    blurb: "Personal injury and motor-vehicle (running down) claims.",
    court: "Sessions Court / Magistrates' Court",
    keyLegislation: [
      "Civil Law Act 1956 (Act 67) — s.7 (dependency), s.8 (estate), s.28A (PI damages)",
      "Road Transport Act 1987 (Act 333)",
      "Evidence Act 1950 (Act 56)",
      "Rules of Court 2012",
      "Limitation Act 1953 (Act 254) — s.6(1), 6 years (no separate PI period)",
      "Public Authorities Protection Act 1948 (Act 198) — 36 months vs public authorities",
    ],
  },
  corporate: {
    id: "corporate",
    label: "Corporate Litigation",
    blurb: "Oppression, derivative actions, directors' duties, winding up and schemes.",
    court: "High Court (Companies / Commercial Division)",
    keyLegislation: [
      "Companies Act 2016 (Act 777) — esp. ss.346, 347, 465–466",
      "Insolvency Act 1967 (Act 360)",
      "Capital Markets and Services Act 2007 (Act 671)",
      "Rules of Court 2012",
      "Companies (Winding-Up) Rules 1972",
    ],
  },
  probate: {
    id: "probate",
    label: "Probate (Contentious & Non-Contentious)",
    blurb: "Grants of probate, letters of administration and contentious probate.",
    court: "High Court (Probate)",
    keyLegislation: [
      "Probate and Administration Act 1959 (Act 97)",
      "Wills Act 1959 (Act 346)",
      "Distribution Act 1958 (Act 300)",
      "Public Trust Corporation Act 1995 (Act 532) — Amanah Raya",
      "Rules of Court 2012 (O.71, O.72)",
    ],
  },
  "small-estate": {
    id: "small-estate",
    label: "Small Estate Distribution",
    blurb: "Estates within the Small Estates (Distribution) Act limits via the Land Office.",
    court: "Estate Distribution Unit / Land Administrator",
    keyLegislation: [
      "Small Estates (Distribution) Act 1955 (Act 98)",
      "Distribution Act 1958 (Act 300)",
      "National Land Code (Act 828, Revised 2020)",
      "Small Estates (Distribution) Regulations 1955",
    ],
  },
  family: {
    id: "family",
    label: "Family Law (Non-Muslim)",
    blurb: "Divorce, custody, maintenance and division of matrimonial assets.",
    court: "High Court (Family Division)",
    keyLegislation: [
      "Law Reform (Marriage and Divorce) Act 1976 (Act 164) — ss.76, 77, 88, 93",
      "Guardianship of Infants Act 1961 (Act 351)",
      "Married Women and Children (Maintenance) Act 1950 (Act 263)",
      "Child Act 2001 (Act 611)",
      "Divorce and Matrimonial Proceedings Rules 1980",
    ],
  },
  "construction-cipaa": {
    id: "construction-cipaa",
    label: "Construction & Adjudication (CIPAA)",
    blurb:
      "Construction payment disputes, CIPAA statutory adjudication, and enforcement or setting aside of adjudication decisions.",
    court: "High Court (Construction Court) / AIAC Adjudication",
    keyLegislation: [
      "Construction Industry Payment and Adjudication Act 2012 (Act 746)",
      "AIAC Adjudication Rules & Procedure",
      "Arbitration Act 2005 (Act 646)",
      "Contracts Act 1950 (Act 136)",
      "Rules of Court 2012",
      "Limitation Act 1953 (Act 254) — s.6(1), 6 years",
    ],
  },
  defamation: {
    id: "defamation",
    label: "Defamation (incl. Online / Social Media)",
    blurb:
      "Libel and slander claims, including social-media and online defamation, with related injunctions and pre-action discovery.",
    court: "High Court / Sessions Court",
    keyLegislation: [
      "Defamation Act 1957 (Act 286)",
      "Communications and Multimedia Act 1998 (Act 588)",
      "Civil Law Act 1956 (Act 67)",
      "Evidence Act 1950 (Act 56)",
      "Rules of Court 2012",
      "Limitation Act 1953 (Act 254) — s.6(1), 6 years",
    ],
  },
};

interface DocItem {
  id: string;
  label: string;
}
interface DocCategory {
  id: string;
  label: string;
  description: string;
  items: DocItem[];
}

// A shared spine of categories; items are tuned per pathway below.
function baseCategories(items: {
  cause: DocItem[];
  interlocutory: DocItem[];
  witness: DocItem[];
  trial: DocItem[];
  submissions: DocItem[];
}): DocCategory[] {
  return [
    {
      id: "cause-papers",
      label: "Cause Papers & Pleadings",
      description: "Originating process and pleadings that commence and frame the action.",
      items: items.cause,
    },
    {
      id: "interlocutory",
      label: "Interlocutory Applications",
      description: "Applications made before trial to manage or dispose of the matter.",
      items: items.interlocutory,
    },
    {
      id: "witness",
      label: "Witness Statements & Examination",
      description: "Witness statements and examination-in-chief / cross-examination questions.",
      items: items.witness,
    },
    {
      id: "trial",
      label: "Trial Documents & Bundles",
      description: "Documents and bundles the court requires for a civil trial.",
      items: items.trial,
    },
    {
      id: "submissions",
      label: "Written Submissions",
      description: "Written submissions for trial and for interlocutory hearings.",
      items: items.submissions,
    },
  ];
}

const COMMON_INTERLOCUTORY: DocItem[] = [
  { id: "summary-judgment", label: "Summary Judgment (O.14) — Notice of Application + Affidavit in Support" },
  { id: "striking-out", label: "Striking Out of Pleadings (O.18 r.19) — Application + Affidavit" },
  { id: "injunction", label: "Interlocutory Injunction (O.29) — Application + Affidavit + Undertaking as to Damages" },
  { id: "amendment", label: "Amendment of Pleadings (O.20) — Application + Affidavit" },
  { id: "further-particulars", label: "Further & Better Particulars (O.18 r.12) — Request + Application to Compel" },
  { id: "discovery", label: "Discovery / Production of Documents (O.24) — Application + Affidavit" },
  { id: "interrogatories", label: "Interrogatories (O.26) — Application + Affidavit" },
  { id: "set-aside-default", label: "Setting Aside Judgment in Default (O.13 / O.19 / O.42 r.13) — Application + Affidavit" },
  { id: "security-costs", label: "Security for Costs (O.23) — Application + Affidavit" },
  { id: "substituted-service", label: "Substituted Service (O.62 r.5) — Application + Affidavit" },
  { id: "third-party", label: "Third Party Notice & Directions (O.16)" },
  { id: "consolidation", label: "Consolidation of Actions (O.4 r.1) — Application + Affidavit" },
  { id: "stay", label: "Stay of Proceedings / Execution — Application + Affidavit" },
  { id: "extension-time", label: "Extension of Time (O.3 r.5) — Application + Affidavit" },
];

const COMMON_TRIAL: DocItem[] = [
  { id: "case-management-checklist", label: "Pre-Trial Case Management Bundle & Checklist (O.34)" },
  { id: "bundle-pleadings", label: "Bundle of Pleadings" },
  { id: "bundle-documents", label: "Common / Agreed Bundle of Documents (Parts A / B / C)" },
  { id: "statement-agreed-facts", label: "Statement of Agreed Facts & Issues to be Tried" },
  { id: "chronology", label: "Chronology of Events" },
  { id: "list-witnesses", label: "List of Witnesses & Availability Dates" },
  { id: "witness-summons", label: "Witness Summons / Subpoena (O.38 rr.14–19)" },
  { id: "notice-admit", label: "Notice to Admit Facts / Documents (O.27)" },
  { id: "bundle-authorities", label: "Bundle of Authorities" },
  { id: "summary-trial", label: "Skeleton / Opening Statement for Trial" },
  { id: "draft-order", label: "Draft Order / Judgment for Extraction (O.42)" },
];

const COMMON_WITNESS: DocItem[] = [
  { id: "witness-statement", label: "Witness Statement (O.38) — Examination-in-Chief" },
  { id: "exam-in-chief", label: "Supplementary Examination-in-Chief Questions" },
  { id: "cross-examination", label: "Cross-Examination Questions & Bundle Cross-References" },
  { id: "re-examination", label: "Re-Examination Questions" },
  { id: "hostile-witness", label: "Application to Treat Witness as Hostile (O.38)" },
  { id: "expert-report", label: "Expert Witness Report & Statement (independent duty to court)" },
];

const COMMON_SUBMISSIONS: DocItem[] = [
  { id: "submission-trial", label: "Written Submission for Trial (full)" },
  { id: "submission-interlocutory", label: "Written Submission for Interlocutory Hearing" },
  { id: "submission-reply", label: "Submission in Reply" },
  { id: "skeleton-argument", label: "Skeleton Argument / Summary of Submission" },
  { id: "submission-prelim", label: "Submission on Preliminary Objection" },
  { id: "submission-costs", label: "Submission on Costs (O.59)" },
];

export const CATALOG: Record<string, DocCategory[]> = {
  "general-civil": baseCategories({
    cause: [
      { id: "writ", label: "Writ of Summons (Form 2) + Statement of Claim (O.18)" },
      { id: "statement-claim", label: "Statement of Claim" },
      { id: "defence", label: "Defence (and Counterclaim)" },
      { id: "reply", label: "Reply (and Defence to Counterclaim)" },
      { id: "originating-summons", label: "Originating Summons (Form 5) + Affidavit in Support" },
    ],
    interlocutory: COMMON_INTERLOCUTORY,
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  "banking-commercial": baseCategories({
    cause: [
      { id: "writ-loan", label: "Writ + Statement of Claim (Loan / Facility Recovery)" },
      { id: "writ-guarantee", label: "Writ + Statement of Claim (Guarantee)" },
      { id: "os-foreclosure", label: "Originating Summons for Order for Sale (O.83, charged land)" },
      { id: "statement-claim", label: "Statement of Claim" },
      { id: "defence", label: "Defence (and Counterclaim)" },
    ],
    interlocutory: [
      { id: "summary-judgment", label: "Summary Judgment (O.14) — Application + Affidavit" },
      { id: "mareva", label: "Mareva / Freezing Injunction (O.29) — Application + Affidavit" },
      ...COMMON_INTERLOCUTORY.filter((i) => i.id !== "summary-judgment"),
    ],
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  "accident-rdc": baseCategories({
    cause: [
      { id: "writ-rdc", label: "Writ + Statement of Claim (Running Down)" },
      { id: "statement-claim", label: "Statement of Claim (Personal Injury / RDC)" },
      { id: "fatal-dependency", label: "Writ + SOC (Fatal Accident — Dependency s.7 & Estate s.8 CLA 1956)" },
      { id: "defence", label: "Defence (incl. contributory negligence)" },
      { id: "third-party", label: "Third Party Notice (insurer / joint tortfeasor)" },
      { id: "particulars-injury", label: "Particulars of Injuries & Schedule of Special Damages" },
    ],
    interlocutory: COMMON_INTERLOCUTORY,
    witness: [
      { id: "witness-statement", label: "Witness Statement — Plaintiff / Eyewitness" },
      { id: "expert-report", label: "Medical Expert Report & Statement" },
      ...COMMON_WITNESS.filter((i) => !["witness-statement", "expert-report"].includes(i.id)),
    ],
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  corporate: baseCategories({
    cause: [
      { id: "os-oppression", label: "Originating Summons — Oppression (s.346 CA 2016) + Affidavit" },
      { id: "leave-derivative", label: "Leave for Statutory Derivative Action (s.347 CA 2016)" },
      { id: "winding-up", label: "Winding-Up Petition (s.465 CA 2016)" },
      { id: "statement-claim", label: "Statement of Claim (Breach of Directors' Duties)" },
      { id: "defence", label: "Defence" },
    ],
    interlocutory: COMMON_INTERLOCUTORY,
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  probate: baseCategories({
    cause: [
      { id: "petition-probate", label: "Petition for Grant of Probate (O.71) + Affidavit" },
      { id: "petition-loa", label: "Petition for Letters of Administration (O.72) + Affidavit" },
      { id: "caveat", label: "Caveat against Grant" },
      { id: "citation", label: "Citation to Accept or Refuse Probate" },
      { id: "statement-claim", label: "Statement of Claim (Contentious Probate / Will Challenge)" },
    ],
    interlocutory: COMMON_INTERLOCUTORY,
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  "small-estate": baseCategories({
    cause: [
      { id: "form-a", label: "Form A — Petition for Distribution of Small Estate" },
      { id: "supporting-docs", label: "Supporting Documents Checklist (death cert, title, heirs)" },
      { id: "heir-consent", label: "Consent / Renunciation of Heirs" },
      { id: "asset-schedule", label: "Schedule of Estate Assets & Liabilities" },
    ],
    interlocutory: [
      { id: "amend-petition", label: "Application to Amend Petition" },
      { id: "review", label: "Application for Review of Distribution Order" },
    ],
    witness: [
      { id: "heir-statement", label: "Statement of Heir / Beneficiary" },
    ],
    trial: [
      { id: "hearing-bundle", label: "Distribution Hearing Bundle (Land Office)" },
      { id: "asset-schedule", label: "Estate Asset Schedule" },
    ],
    submissions: [
      { id: "submission-distribution", label: "Written Submission on Distribution / Faraid where applicable" },
    ],
  }),
  family: baseCategories({
    cause: [
      { id: "petition-divorce", label: "Petition for Divorce (single / joint)" },
      { id: "os-custody", label: "Originating Summons — Custody (GIA 1961) + Affidavit" },
      { id: "maintenance", label: "Application for Maintenance (ss.77, 93 LRA 1976)" },
      { id: "matrimonial-assets", label: "Claim for Division of Matrimonial Assets (s.76 LRA 1976)" },
      { id: "answer", label: "Answer (and Cross-Petition)" },
    ],
    interlocutory: [
      { id: "interim-custody", label: "Interim Custody / Access — Application + Affidavit" },
      { id: "interim-maintenance", label: "Interim Maintenance — Application + Affidavit" },
      ...COMMON_INTERLOCUTORY.filter((i) => i.id !== "summary-judgment"),
    ],
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  "construction-cipaa": baseCategories({
    cause: [
      { id: "payment-claim", label: "Payment Claim (s.5 CIPAA 2012)" },
      { id: "payment-response", label: "Payment Response (s.6 CIPAA 2012)" },
      { id: "adjudication-notice", label: "Notice of Adjudication & Adjudication Claim (s.9)" },
      { id: "adjudication-response", label: "Adjudication Response (s.10) / Reply (s.11)" },
      { id: "writ-construction", label: "Writ + Statement of Claim (Construction Contract)" },
      { id: "defence", label: "Defence (and Counterclaim)" },
    ],
    interlocutory: [
      { id: "enforce-decision", label: "Enforcement of Adjudication Decision (s.28) — OS + Affidavit" },
      { id: "set-aside-decision", label: "Setting Aside Adjudication Decision (s.15) — OS + Affidavit" },
      { id: "stay-decision", label: "Stay of Adjudication Decision (s.16) — Application + Affidavit" },
      ...COMMON_INTERLOCUTORY,
    ],
    witness: [
      { id: "expert-qs", label: "Expert Report — Quantity Surveyor / Quantum" },
      { id: "expert-delay", label: "Expert Report — Delay / Programming Analysis" },
      ...COMMON_WITNESS.filter((i) => i.id !== "expert-report"),
    ],
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
  defamation: baseCategories({
    cause: [
      { id: "concerns-notice", label: "Letter of Demand / Concerns Notice" },
      { id: "writ-defamation", label: "Writ + Statement of Claim (Libel / Slander)" },
      { id: "particulars-words", label: "Particulars of Words Complained Of & Innuendo" },
      { id: "defence", label: "Defence (Justification, Fair Comment, Qualified Privilege)" },
      { id: "reply", label: "Reply (and Defence to Counterclaim)" },
    ],
    interlocutory: [
      { id: "norwich-pharmacal", label: "Pre-Action / Norwich Pharmacal Discovery — Identify Anonymous Poster" },
      { id: "interlocutory-injunction", label: "Injunction to Restrain Publication (Bonnard v Perryman caution)" },
      { id: "takedown", label: "Application for Takedown / Removal of Online Content" },
      ...COMMON_INTERLOCUTORY.filter((i) => i.id !== "injunction"),
    ],
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt scaffolding — grounding + strict accuracy
// ─────────────────────────────────────────────────────────────────────────────
const BASE_PERSONA = `You are MyLitAi IRAC — Senior Counsel specialising in Malaysian civil litigation. Write for a busy practising Malaysian advocate & solicitor on a live file: lead with the answer, be court-ready and tactical, use tight headings and numbered lists, Malaysian legal English, **bold** for Acts, sections and case names. Never fabricate a citation, section, form, fee or threshold — where something must be confirmed, say so plainly.`;

const GROUNDING_DIRECTIVE = `You are MyLitAi IRAC — Senior Counsel specialising in Malaysian civil litigation. You have LIVE Google Search grounding enabled.

MANDATORY SEARCH PROTOCOL (do this FIRST, every time):
- You MUST run Google searches BEFORE stating any law. Do NOT answer from memory — your parametric knowledge of Malaysian citations is unreliable and may be out of date.
- Run at least one search for EACH legal issue/point you address (statute + section, and the leading Malaysian case). Search again to confirm the citation and that it is still in force.
- Do NOT write your own "Sources"/"References"/"Bibliography" list. The verified source list is attached AUTOMATICALLY from your grounded searches, so any list you type yourself is redundant and risks presenting unverified citations as verified. Cite authorities inline in the prose instead.

NON-NEGOTIABLE ACCURACY RULES:
1. Base every statement of law on CURRENT, VERIFIED Malaysian sources retrieved via your search tool — statutes (e.g. lom.agc.gov.my / AGC), the Rules of Court 2012, and reported judgments. Prefer the most recent amendments and confirm they are still in force.
2. NEVER invent a case citation, section number, form number, fee or threshold. If a point is not confirmed by a search you actually ran, say so explicitly and tell the practitioner exactly what to check (e.g. "verify current filing fee at the registry").
3. For every case or statute you rely on, name it precisely and ensure it is reflected by your grounded searches. If a point rests only on general principle, say "general principle — verify".
4. Distinguish binding Malaysian authority from merely persuasive (English / Commonwealth) authority.
5. Note any recent (last 24 months) amendments or practice directions that bite on the point.

STYLE: Write for a busy practising Malaysian advocate & solicitor on a live file. Lead with the answer, be court-ready and tactical, use tight headings and numbered lists. Use Malaysian legal English. Use **bold** for Acts, sections and case names.`;

function pathwayContext(pathwayId: string): string {
  const p = PATHWAYS[pathwayId];
  if (!p) return "";
  return `\nSELECTED PATHWAY: ${p.label} — ${p.blurb}\nUsual forum: ${p.court}\nKey legislation to consider (verify currency): ${p.keyLegislation.join("; ")}.`;
}

function caseContext(rec: CaseRecord): string {
  const parts: string[] = [];
  const excerpt = rec.combinedText.slice(0, GROUNDED_RAW_CAP);
  parts.push(
    `\n=== CASE FILE EXCERPT (first ${excerpt.length} chars of uploaded documents${
      rec.combinedText.length > excerpt.length ? "; full text already digested in the stage summaries below" : ""
    }) ===\n${excerpt}`,
  );
  if (rec.issues) parts.push(`\n=== ISSUES IDENTIFIED (I) ===\n${rec.issues}`);
  if (rec.rules) parts.push(`\n=== APPLICABLE LAW / RULES (R) ===\n${rec.rules}`);
  if (rec.application) parts.push(`\n=== ANALYSIS / APPLICATION (A) ===\n${rec.application}`);
  if (rec.opinion) parts.push(`\n=== LEGAL OPINION (C) ===\n${rec.opinion}`);
  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE streaming helper with grounding citations
// ─────────────────────────────────────────────────────────────────────────────
interface Citation {
  title: string;
  uri: string;
}

async function streamGenerate(
  res: Response,
  prompt: string,
  opts: { grounded?: boolean; disclaimer?: string; provider?: AIProvider } = {},
): Promise<{ text: string; citations: Citation[] } | null> {
  const { grounded = true, disclaimer } = opts;
  const provider = normalizeProvider(opts.provider);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders?.();

  const citations = new Map<string, Citation>();
  let full = "";

  try {
    for await (const piece of streamChat([{ role: "user", text: prompt }], {
      provider,
      grounded,
      maxOutputTokens: 8192,
    })) {
      if (piece.text) {
        full += piece.text;
        res.write(`data: ${JSON.stringify({ content: piece.text })}\n\n`);
      }
      if (piece.citations) {
        for (const c of piece.citations) {
          if (!citations.has(c.uri)) citations.set(c.uri, c);
        }
      }
    }

    const citationList = [...citations.values()];
    if (citationList.length > 0) {
      res.write(`data: ${JSON.stringify({ citations: citationList })}\n\n`);
    }
    // Safety net: a Gemini grounded stage that returns ZERO verified sources
    // means the model answered from memory rather than from live search — any
    // authorities it named are UNVERIFIED. OpenAI has no live Google Search
    // grounding at all, so a grounded request on OpenAI is expected to return
    // no citations: surface a clear provider note rather than the severe
    // grounding-failure warning.
    const openaiUngrounded = provider === "openai" && grounded;
    const groundingWarning =
      provider === "gemini" && grounded && citationList.length === 0;
    let doneDisclaimer: string;
    if (groundingWarning) {
      doneDisclaimer =
        "⚠️ No live sources could be verified for this output — the model did not return grounded citations. Treat every case, statute and section named here as UNVERIFIED and confirm against primary sources before any use.";
    } else if (openaiUngrounded) {
      doneDisclaimer =
        "ℹ️ Generated with OpenAI, which has no live Google Search grounding — citations are drawn from the model's training data and may be outdated or inaccurate. A qualified Malaysian Advocate & Solicitor MUST verify every case, statute, section and form against primary sources before any use.";
    } else {
      doneDisclaimer =
        disclaimer ||
        "AI-generated and grounded in live sources, but it may contain errors. A qualified Malaysian Advocate & Solicitor MUST verify every citation, section and form against primary sources before any professional use or filing.";
    }
    res.write(
      `data: ${JSON.stringify({
        done: true,
        groundingWarning,
        provider,
        disclaimer: doneDisclaimer,
      })}\n\n`,
    );
    res.end();
    return { text: full, citations: citationList };
  } catch (error) {
    logger.error({ err: error }, "IRAC stream failed");
    res.write(
      `data: ${JSON.stringify({ error: "Generation failed. Please try again.", done: true })}\n\n`,
    );
    res.end();
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File extraction
// ─────────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

// Largest buffer we will hand to Gemini for OCR (base64 inflates ~33%; the
// inline request ceiling is ~20MB, so keep the raw bytes well under that).
const OCR_MAX_BYTES = 14 * 1024 * 1024;

function imageMimeFor(lower: string): string | null {
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".tiff") || lower.endsWith(".tif")) return "image/tiff";
  return null;
}

/**
 * OCR / vision text extraction via Gemini. Used for scanned (image-only) PDFs
 * that carry no text layer, and for image uploads. Returns "" on any failure
 * so the caller can fall back gracefully.
 */
async function ocrWithGemini(buffer: Buffer, mimeType: string): Promise<string> {
  if (buffer.length > OCR_MAX_BYTES) return "";
  try {
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: buffer.toString("base64") } },
            {
              text:
                "Transcribe ALL readable text from this document VERBATIM, " +
                "preserving the original order, line breaks, tables and numbers. " +
                "Do not summarise, interpret, translate or add commentary. " +
                "If the document is a scan or photo, read it carefully. " +
                "Output only the transcribed text. If there is genuinely no " +
                "text, output nothing.",
            },
          ],
        },
      ],
    });
    return resp.text ?? "";
  } catch (e) {
    logger.warn({ err: e }, "Gemini OCR extraction failed");
    return "";
  }
}

// ─── Audio / video transcription (voice notes, meetings, screen recordings) ──
const MEDIA_EXTS = [
  ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".flac", ".weba",
  ".webm", ".mp4", ".mov", ".m4v", ".mkv", ".avi", ".3gp", ".amr",
];

function isMediaFile(name: string): boolean {
  const l = name.toLowerCase();
  return MEDIA_EXTS.some((e) => l.endsWith(e));
}

function mediaMimeFor(lower: string): string {
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a") || lower.endsWith(".m4v") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".opus")) return "audio/opus";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".weba")) return "audio/webm";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  if (lower.endsWith(".avi")) return "video/x-msvideo";
  if (lower.endsWith(".3gp")) return "video/3gpp";
  if (lower.endsWith(".amr")) return "audio/amr";
  return "application/octet-stream";
}

/**
 * Transcribe an audio/video recording to text via ElevenLabs Scribe (speech-to-text).
 * Returns "" on any failure so the caller can carry on without the recording.
 */
async function transcribeWithElevenLabs(buffer: Buffer, filename: string): Promise<string> {
  if (buffer.length > STT_MAX_BYTES) return "";
  try {
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    const blob = new Blob([new Uint8Array(buffer)], { type: mediaMimeFor(filename.toLowerCase()) });
    form.append("file", blob, filename);
    const resp = await connectors.proxy("elevenlabs", "/v1/speech-to-text", {
      method: "POST",
      body: form,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, detail: detail.slice(0, 300), file: filename }, "ElevenLabs STT failed");
      return "";
    }
    const data = (await resp.json().catch(() => ({}))) as { text?: string };
    return (data.text ?? "").trim();
  } catch (e) {
    logger.warn({ err: e, file: filename }, "ElevenLabs STT exception");
    return "";
  }
}

// ─── Diarized transcription (speaker-labelled, timestamped) ──────────────────
interface ScribeWord {
  text?: string;
  start?: number;
  end?: number;
  type?: string; // "word" | "spacing" | "audio_event"
  speaker_id?: string;
}
interface ScribeResponse {
  language_code?: string;
  text?: string;
  words?: ScribeWord[];
}

export interface TranscriptSegment {
  speaker: string; // raw id, e.g. "speaker_0"
  speakerLabel: string; // friendly default, e.g. "Speaker 1"
  startSec: number;
  start: string; // hh:mm:ss
  text: string;
}

/**
 * Transcribe a recording with speaker diarization + word timestamps via
 * ElevenLabs Scribe. Returns null on failure so the caller can report cleanly.
 */
async function transcribeDiarized(buffer: Buffer, filename: string): Promise<ScribeResponse | null> {
  if (buffer.length > STT_MAX_BYTES) return null;
  try {
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("diarize", "true");
    form.append("tag_audio_events", "true");
    form.append("timestamps_granularity", "word");
    const blob = new Blob([new Uint8Array(buffer)], { type: mediaMimeFor(filename.toLowerCase()) });
    form.append("file", blob, filename);
    const resp = await connectors.proxy("elevenlabs", "/v1/speech-to-text", {
      method: "POST",
      body: form,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, detail: detail.slice(0, 300), file: filename }, "ElevenLabs diarized STT failed");
      return null;
    }
    return (await resp.json().catch(() => null)) as ScribeResponse | null;
  } catch (e) {
    logger.warn({ err: e, file: filename }, "ElevenLabs diarized STT exception");
    return null;
  }
}

function fmtClock(sec: number): string {
  let s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  s = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Group consecutive words by speaker into readable, timestamped segments. */
function buildSegments(words: ScribeWord[]): {
  segments: TranscriptSegment[];
  speakerCount: number;
  durationSec: number;
} {
  const speakerOrder: string[] = [];
  const labelFor = (sid: string) => {
    let idx = speakerOrder.indexOf(sid);
    if (idx === -1) {
      speakerOrder.push(sid);
      idx = speakerOrder.length - 1;
    }
    return `Speaker ${idx + 1}`;
  };

  const segments: TranscriptSegment[] = [];
  let cur: TranscriptSegment | null = null;
  let lastEnd = 0;

  for (const w of words) {
    if (typeof w.end === "number") lastEnd = Math.max(lastEnd, w.end);
    // Carry forward the current speaker for tokens that lack a speaker_id
    // (e.g. "spacing" and "audio_event" tokens) so they don't force a spurious
    // switch to "speaker_0" and fragment the diarized segments.
    const sid: string = w.speaker_id || cur?.speaker || "speaker_0";
    if (!cur || cur.speaker !== sid) {
      if (cur) segments.push(cur);
      const startSec = typeof w.start === "number" ? w.start : lastEnd;
      cur = {
        speaker: sid,
        speakerLabel: labelFor(sid),
        startSec,
        start: fmtClock(startSec),
        text: "",
      };
    }
    cur.text += w.text ?? "";
  }
  if (cur) segments.push(cur);

  for (const s of segments) s.text = s.text.replace(/\s+/g, " ").trim();
  return {
    segments: segments.filter((s) => s.text.length > 0),
    speakerCount: speakerOrder.length,
    durationSec: lastEnd,
  };
}

// ─── Web link extraction (paste a URL → pull the readable text) ───────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Largest remote response we will buffer when fetching a URL.
const URL_FETCH_MAX_BYTES = 25 * 1024 * 1024;
const URL_FETCH_MAX_REDIRECTS = 5;

// Returns true if an IP literal points at a private / loopback / link-local /
// reserved / cloud-metadata range that must never be reachable via SSRF.
function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
    if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 (test)
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (v === 6) {
    let h = ip.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
    const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (h === "::1" || h === "::") return true; // loopback / unspecified
    if (h.startsWith("fe80") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb"))
      return true; // link-local
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
    if (h.startsWith("ff")) return true; // multicast
    return false;
  }
  // Not a recognisable IP literal — treat as unsafe.
  return true;
}

// Resolve a hostname and confirm every resolved address is publicly routable.
async function assertPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isIP(host)) return !isBlockedIp(host);
  let records: { address: string }[];
  try {
    records = await dnsLookup(host, { all: true });
  } catch {
    return false;
  }
  if (records.length === 0) return false;
  return records.every((r) => !isBlockedIp(r.address));
}

// Dispatcher that re-validates the IP at *socket connect time* on every
// connection (incl. each redirect hop). This closes the DNS-rebinding TOCTOU
// window: even if the pre-flight DNS lookup resolved to a public IP, the
// address actually connected to is checked here and refused if it is private.
const safeFetchAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dnsLookup(hostname, { all: true })
        .then((records) => {
          const list = Array.isArray(records) ? records : [records];
          const safe = list.filter((r) => r.address && !isBlockedIp(r.address));
          if (safe.length === 0) {
            callback(new Error(`Blocked non-public address for ${hostname}`), null as never);
            return;
          }
          // undici passes `all: true` and then expects an array of records;
          // otherwise it expects (address, family).
          if (options && (options as { all?: boolean }).all) {
            callback(
              null,
              safe.map((r) => ({ address: r.address, family: r.family })) as never,
            );
          } else {
            callback(null, safe[0].address, safe[0].family);
          }
        })
        .catch((err) => callback(err as NodeJS.ErrnoException, null as never));
    },
  },
});

async function readCapped(
  resp: Awaited<ReturnType<typeof safeFetch>>,
  max: number,
): Promise<Buffer | null> {
  const lenHeader = resp.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > max) return null;
  const body = resp.body;
  if (!body) {
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf.length > max ? null : buf;
  }
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

async function fetchUrlText(rawUrl: string): Promise<string> {
  let current = rawUrl.trim();
  if (!/^https?:\/\//i.test(current)) current = `https://${current}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    let parsed: URL | null = null;
    let resp: Awaited<ReturnType<typeof safeFetch>> | null = null;
    // Manual redirect loop — re-validate the host (DNS → IP range) on every hop
    // so a public host cannot redirect us to an internal target.
    for (let hop = 0; hop <= URL_FETCH_MAX_REDIRECTS; hop++) {
      try {
        parsed = new URL(current);
      } catch {
        return "";
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      if (!(await assertPublicHost(parsed.hostname))) return "";
      resp = await safeFetch(current, {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: safeFetchAgent,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MyLitAi/1.0; +https://mylitai.life) legal-research-fetch",
          Accept: "text/html,application/pdf,text/plain,*/*",
        },
      });
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location");
        if (!loc) return "";
        current = new URL(loc, current).toString();
        continue;
      }
      break;
    }
    if (!resp || !parsed) return "";
    if (!resp.ok) return "";
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const buf = await readCapped(resp, URL_FETCH_MAX_BYTES);
    if (!buf) return "";
    if (ct.includes("application/pdf") || parsed.pathname.toLowerCase().endsWith(".pdf")) {
      return await extractText(buf, "page.pdf");
    }
    if (ct.includes("text/html") || ct.includes("application/xhtml")) {
      return htmlToText(buf.toString("utf-8"));
    }
    if (ct.includes("text/") || ct.includes("json")) {
      return buf.toString("utf-8");
    }
    // Unknown type but small enough — try as UTF-8 text.
    if (buf.length < 5 * 1024 * 1024) return htmlToText(buf.toString("utf-8"));
    return "";
  } catch (e) {
    logger.warn({ err: e, url: rawUrl }, "URL fetch failed");
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    let text = "";
    let parser: { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> } | null = null;
    try {
      // pdf-parse v2 exposes a `PDFParse` class (not a callable default export).
      const { PDFParse } = (await import("pdf-parse")) as unknown as {
        PDFParse: new (opts: { data: Uint8Array }) => {
          getText: () => Promise<{ text?: string }>;
          destroy?: () => Promise<void>;
        };
      };
      parser = new PDFParse({ data: new Uint8Array(buffer) });
      const r = await parser.getText();
      text = r.text || "";
    } catch (e) {
      logger.warn({ err: e, file: filename }, "pdf-parse failed; trying OCR");
    } finally {
      try {
        await parser?.destroy?.();
      } catch {
        /* ignore cleanup errors */
      }
    }
    // A scanned/image-only PDF (e.g. a receipt) yields little-to-no text layer.
    // Fall back to Gemini vision OCR so the upload still works.
    if (text.trim().length < 20) {
      const ocr = await ocrWithGemini(buffer, "application/pdf");
      if (ocr.trim().length > text.trim().length) return ocr;
    }
    return text;
  }
  if (lower.endsWith(".docx")) {
    const r = await mammoth.extractRawText({ buffer });
    return r.value || "";
  }
  const imageMime = imageMimeFor(lower);
  if (imageMime) {
    return await ocrWithGemini(buffer, imageMime);
  }
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".rtf") ||
    lower.endsWith(".csv")
  ) {
    return buffer.toString("utf-8");
  }
  return "";
}

function isSupportedDoc(name: string): boolean {
  const l = name.toLowerCase();
  return (
    l.endsWith(".pdf") ||
    l.endsWith(".docx") ||
    l.endsWith(".txt") ||
    l.endsWith(".md") ||
    l.endsWith(".rtf") ||
    l.endsWith(".csv") ||
    imageMimeFor(l) !== null
  );
}

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array("files", MAX_FILES)(req, res, (err: unknown): void => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return void res
          .status(413)
          .json({ error: `File too large. Maximum ${MAX_FILE_BYTES / (1024 * 1024)}MB per file.` });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return void res.status(400).json({ error: `Too many files. Maximum ${MAX_FILES} per upload.` });
      }
      return void res.status(400).json({ error: (err as Error).message });
    }
    if (err) {
      logger.error({ err }, "IRAC upload failure");
      return void res.status(500).json({ error: "Upload failed" });
    }
    next();
  });
}

interface PasteTextItem {
  label?: string;
  content?: string;
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

router.post("/extract", uploadMiddleware, async (req, res): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const pathway = String(req.body?.pathway || "general-civil");
    const pasteTexts = parseJsonArray<PasteTextItem>(req.body?.pasteTexts);
    const urls = parseJsonArray<string>(req.body?.urls)
      .map((u) => String(u || "").trim())
      .filter(Boolean);

    // Optional: append to an existing matter rather than starting a new one.
    const appendCaseId = String(req.body?.caseId || "").trim();
    const existing = appendCaseId ? getCase(appendCaseId) : undefined;
    if (appendCaseId && !existing) {
      return void res.status(404).json({ error: "Case not found or expired" });
    }

    if (files.length === 0 && pasteTexts.length === 0 && urls.length === 0) {
      return void res.status(400).json({ error: "No materials provided" });
    }

    const fileMetas: CaseFileMeta[] = [];
    const segments: string[] = [];
    // Budget the running total so we stop ingesting once the case is full,
    // rather than buffering everything and truncating at the very end. Account
    // for any text already stored when appending to an existing case.
    let charsUsed = existing ? existing.combinedText.length : 0;
    const pushDoc = (name: string, source: string, rawText: string) => {
      if (!rawText.trim()) return;
      const remaining = MAX_TOTAL_CHARS - charsUsed;
      if (remaining <= 0) return;
      let text = rawText;
      let truncated = false;
      const cap = Math.min(MAX_CHARS_PER_FILE, remaining);
      if (text.length > cap) {
        text = text.slice(0, cap);
        truncated = true;
      }
      charsUsed += text.length;
      fileMetas.push({ name, source, chars: text.length, truncated });
      segments.push(`\n----- DOCUMENT: ${name} -----\n${text}`);
    };

    // 1) Pasted text notes
    pasteTexts.forEach((item, i) => {
      const content = String(item?.content || "");
      if (!content.trim()) return;
      const label = String(item?.label || "").trim() || `Pasted note ${i + 1}`;
      pushDoc(label, "pasted text", content);
    });

    // 2) Web links — fetch & extract readable text
    for (const url of urls) {
      try {
        const text = await fetchUrlText(url);
        if (text.trim()) {
          let host = url;
          try {
            host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
          } catch {
            /* keep raw */
          }
          pushDoc(`Web page — ${host}`, url, text);
        }
      } catch (e) {
        logger.warn({ err: e, url }, "url extract failed");
      }
    }

    // 3) Uploaded files (documents, archives, audio/video recordings)
    for (const f of files) {
      const lower = f.originalname.toLowerCase();
      if (lower.endsWith(".zip")) {
        let zip: AdmZip;
        try {
          zip = new AdmZip(f.buffer);
        } catch {
          continue;
        }
        const entries = zip.getEntries().slice(0, MAX_ZIP_ENTRIES);
        let unzippedBytes = 0;
        for (const entry of entries) {
          if (entry.isDirectory) continue;
          const entryName = entry.entryName;
          if (entryName.startsWith("__MACOSX")) continue;
          const base = entryName.split("/").pop() || entryName;
          // ZIP-bomb guard: reject entries whose declared size, compression
          // ratio, or the running extracted total exceeds our ceilings BEFORE
          // inflating (adm-zip allocates based on the declared header size).
          const declared = entry.header?.size ?? 0;
          const compressed = entry.header?.compressedSize ?? 0;
          if (declared > MAX_ZIP_ENTRY_BYTES) continue;
          if (compressed > 0 && declared / compressed > MAX_ZIP_RATIO) continue;
          if (unzippedBytes + declared > MAX_ZIP_UNCOMPRESSED_BYTES) break;
          try {
            const data = entry.getData();
            unzippedBytes += data.length;
            if (unzippedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) break;
            if (isMediaFile(entryName)) {
              const transcript = await transcribeWithElevenLabs(data, base);
              if (transcript) pushDoc(`Transcript — ${base}`, f.originalname, transcript);
            } else if (isSupportedDoc(entryName)) {
              const text = await extractText(data, entryName);
              pushDoc(base, f.originalname, text);
            }
          } catch (e) {
            logger.warn({ err: e, entry: entryName }, "zip entry extract failed");
          }
        }
      } else if (isMediaFile(lower)) {
        try {
          const transcript = await transcribeWithElevenLabs(f.buffer, f.originalname);
          if (transcript) pushDoc(`Transcript — ${f.originalname}`, f.originalname, transcript);
        } catch (e) {
          logger.warn({ err: e, file: f.originalname }, "transcription failed");
        }
      } else if (isSupportedDoc(lower)) {
        try {
          const text = await extractText(f.buffer, f.originalname);
          pushDoc(f.originalname, f.originalname, text);
        } catch (e) {
          logger.warn({ err: e, file: f.originalname }, "file extract failed");
        }
      }
    }

    if (fileMetas.length === 0) {
      return void res.status(400).json({
        error:
          "No readable content could be extracted. Supported: PDF (incl. scanned), " +
          "DOCX, images (PNG/JPG), TXT/MD/RTF/CSV, audio & video recordings, web links " +
          "and pasted text — also inside ZIP archives.",
      });
    }

    if (existing) {
      // Append to the existing matter.
      existing.files = [...existing.files, ...fileMetas];
      existing.combinedText = (existing.combinedText + "\n" + segments.join("\n")).slice(
        0,
        MAX_TOTAL_CHARS,
      );
      existing.totalChars = existing.combinedText.length;
      return void res.json({
        caseId: existing.id,
        pathway: existing.pathway,
        files: existing.files,
        totalChars: existing.totalChars,
        documentCount: fileMetas.length,
      });
    }

    const id = randomUUID();
    const combinedText = segments.join("\n").slice(0, MAX_TOTAL_CHARS);
    const rec: CaseRecord = {
      id,
      createdAt: Date.now(),
      pathway,
      files: fileMetas,
      combinedText,
      totalChars: combinedText.length,
    };
    cases.set(id, rec);

    res.json({
      caseId: id,
      pathway,
      files: fileMetas,
      totalChars: combinedText.length,
      documentCount: fileMetas.length,
    });
  } catch (error) {
    logger.error({ err: error }, "IRAC extract failed");
    res.status(500).json({ error: "Extraction failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue + pathways (static reference)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pathways", (_req, res) => {
  res.json(Object.values(PATHWAYS));
});

router.get("/catalog", (req, res): void => {
  const pathway = String(req.query.pathway || "general-civil");
  const cat = CATALOG[pathway] || CATALOG["general-civil"];
  res.json({ pathway, categories: cat });
});

router.get("/case/:id", (req, res): void => {
  const rec = getCase((req.params.id as string));
  if (!rec) return void res.status(404).json({ error: "Case not found or expired" });
  res.json({
    caseId: rec.id,
    pathway: rec.pathway,
    files: rec.files,
    totalChars: rec.totalChars,
    stages: {
      issues: Boolean(rec.issues),
      rules: Boolean(rec.rules),
      application: Boolean(rec.application),
      opinion: Boolean(rec.opinion),
    },
    issues: rec.issues,
    rules: rec.rules,
    application: rec.application,
    opinion: rec.opinion,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IRAC pipeline (SSE)
// ─────────────────────────────────────────────────────────────────────────────

// I — Issues
router.post("/issues", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found or expired" });
  if (req.body?.pathway) rec.pathway = String(req.body.pathway);

  const prompt = `${BASE_PERSONA}${pathwayContext(rec.pathway)}

TASK — ISSUE IDENTIFICATION (the "I" of IRAC):
Read the uploaded case file below (the COMPLETE set of documents for this matter) and extract the legal issues with forensic precision. This digest is the foundation for the later research, analysis and drafting stages, so capture every material fact, party, date and figure faithfully.

Produce:
## 1. Case Snapshot
A 4–6 line factual matrix: parties & roles, the transaction/event, the dispute, amounts/dates, and current posture.

## 2. Legal Issues
A numbered list of the discrete legal issues raised by these facts. For EACH issue:
- State the issue as a precise legal question.
- Note the cause(s) of action or defence engaged.
- Flag any threshold/procedural issues (limitation, locus standi, jurisdiction, condition precedent).

## 3. Preliminary & Procedural Flags
Limitation exposure, pre-action requirements, urgency (injunction?), and missing information to obtain from the client.

Be specific to the facts — do not give generic checklists.
=== UPLOADED CASE FILE ===
${rec.combinedText.slice(0, MAX_TOTAL_CHARS)}`;

  // Ungrounded: this stage digests the full (possibly very large) document set.
  // Grounding is reserved for the law-stating stages below, where a smaller
  // prompt keeps Google Search grounding reliable.
  const result = await streamGenerate(res, prompt, {
    grounded: false,
    provider: normalizeProvider(req.body?.provider),
    disclaimer:
      "AI-generated issue digest. Verify the facts against the source documents; the legal research stage will ground the applicable law.",
  });
  if (result) rec.issues = result.text;
});

// R — Rules / Research
router.post("/research", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found or expired" });

  const prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(rec.pathway)}

TASK — LEGAL RESEARCH / RULES (the "R" of IRAC):
Using LIVE grounded search of current Malaysian sources, research the law that governs the issues identified. Cover ALL relevant Malaysian sources: statutes, subsidiary legislation, the Rules of Court 2012, and binding case authority. Confirm currency (latest in-force amendments).

For EACH issue (mirror the issue numbering):
### Issue [n]: [short label]
- **Statute / Rules**: exact Act name (Act No.) and section(s); current version.
- **Leading authority**: precise Malaysian case name and citation that you have verified via search; one line on what it holds. Mark persuasive (foreign) authority as such.
- **Standard / test**: the legal test or elements the court applies.
- **Currency note**: any recent amendment / practice direction; or "verify" if uncertain.

Cite each authority inline. Do NOT append your own "Sources" list — the verified source list is attached automatically from your grounded searches. Never fabricate a citation; if a point is unverified, say so.
=== ISSUES (digest of the full case file) ===
${rec.issues || "(Issues not yet generated — work from the case excerpt below.)"}
=== CASE FILE EXCERPT ===
${rec.combinedText.slice(0, GROUNDED_RAW_CAP)}`;

  const result = await streamGenerate(res, prompt, { grounded: true, provider: normalizeProvider(req.body?.provider) });
  if (result) rec.rules = result.text;
});

// A — Application / Analysis
router.post("/application", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found or expired" });

  const prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(rec.pathway)}

TASK — APPLICATION / ANALYSIS (the "A" of IRAC):
Apply the researched law to the specific facts of this case. This is the reasoning, not a restatement of the law.

For EACH issue (mirror the numbering):
### Issue [n]
- **Application**: apply each element/test to the actual facts; cite the fact that satisfies (or defeats) each element.
- **Strength**: how strong is the position (Strong / Arguable / Weak) and why.
- **Opponent's best counter** and your reply.
- **Evidential gaps**: what must be proved and what evidence is missing.

Be candid about weaknesses — a practitioner needs the real picture.
=== ISSUES ===
${rec.issues || "(none)"}
=== APPLICABLE LAW ===
${rec.rules || "(research not yet generated — reason from first principles of Malaysian law and flag for verification)"}
=== CASE FILE EXCERPT ===
${rec.combinedText.slice(0, GROUNDED_RAW_CAP)}`;

  const result = await streamGenerate(res, prompt, { grounded: true, provider: normalizeProvider(req.body?.provider) });
  if (result) rec.application = result.text;
});

// C — Conclusion / Legal Opinion
router.post("/opinion", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found or expired" });

  const prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(rec.pathway)}

TASK — LEGAL OPINION (the "C" of IRAC):
Draft a formal written legal opinion for the client file, in proper Malaysian counsel's opinion style.

Structure:
## LEGAL OPINION
**Re:** [matter] — **Prepared for:** [instructing solicitor/client] — **Date:** [date]
1. **Instructions & Scope**
2. **Summary of Advice** (the bottom line, up front — prospects expressed as a candid assessment)
3. **Material Facts** (numbered)
4. **Issues** (numbered)
5. **The Law & Analysis** (issue by issue — rule then application, citing verified Malaysian authority)
6. **Quantum / Relief** where relevant
7. **Risks, Costs & Limitation**
8. **Recommendation & Next Steps** (numbered, with deadlines)

Keep every citation verified via grounding; flag anything to confirm. End with a professional reservation clause.
=== FULL IRAC CONTEXT ===
${caseContext(rec)}`;

  const result = await streamGenerate(res, prompt, { grounded: true, provider: normalizeProvider(req.body?.provider) });
  if (result) rec.opinion = result.text;
});

// ─────────────────────────────────────────────────────────────────────────────
// Document Analyzer (SSE) — single-pass analysis of an uploaded document
// ─────────────────────────────────────────────────────────────────────────────
router.post("/analyze", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Document not found or expired — please upload again." });
  if (req.body?.pathway) rec.pathway = String(req.body.pathway);

  const prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(rec.pathway)}

TASK — DOCUMENT ANALYSIS:
A Malaysian advocate & solicitor has uploaded the document(s) below for analysis. Read them carefully and produce a clear, practitioner-ready analysis. Use LIVE grounded search to confirm any law you state.

## 1. Document Identification
For each document: its nature/type (e.g. Statement of Claim, agreement, letter of demand, affidavit, notice), who issued it, the date, and any court / suit / reference number.

## 2. Key Contents & Terms
The material facts, parties and their roles, obligations, amounts, dates, and any critical clauses or allegations — quoting the key wording where it matters.

## 3. Legal Issues & Implications
The causes of action, defences, rights and liabilities engaged. Cite the relevant Malaysian statute and section, and the leading authority (verified via grounding). Distinguish binding from persuasive authority.

## 4. Risks, Red Flags & Deadlines
Limitation exposure, time-sensitive steps, onerous or unusual terms, and anything that must be actioned urgently.

## 5. Strengths & Weaknesses
A candid assessment from the practitioner's perspective.

## 6. Recommended Next Steps
Numbered, practical actions — including any responsive document that should be drafted.
=== UPLOADED DOCUMENT(S) ===
${rec.combinedText.slice(0, GROUNDED_RAW_CAP)}`;

  await streamGenerate(res, prompt, {
    grounded: true,
    provider: normalizeProvider(req.body?.provider),
    disclaimer:
      "AI-generated analysis grounded in live sources. It may contain errors — a qualified Malaysian Advocate & Solicitor MUST verify every citation, section and deadline against primary sources before relying on it.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drafting studio (SSE) — samples, tailored drafts & replies to the opponent
// ─────────────────────────────────────────────────────────────────────────────
function docLabel(pathway: string, category: string, docType: string): string {
  const cats = CATALOG[pathway] || CATALOG["general-civil"];
  const cat = cats.find((c) => c.id === category);
  const item = cat?.items.find((i) => i.id === docType);
  return item?.label || docType;
}

router.post("/draft", async (req, res): Promise<void> => {
  const { caseId, opponentCaseId, category, docType, pathway: bodyPathway, mode, instructions } = req.body || {};
  const rec = caseId ? getCase(String(caseId)) : undefined;
  const opponent = opponentCaseId ? getCase(String(opponentCaseId)) : undefined;
  const pathway = String(bodyPathway || rec?.pathway || opponent?.pathway || "general-civil");
  const label = docType ? docLabel(pathway, String(category), String(docType)) : "";
  const isSample = String(mode) === "sample";
  const isReply = String(mode) === "reply";

  const FORMAT_RULES = `MANDATORY DRAFTING RULES (Malaysian practice):
- Follow the Rules of Court 2012 format for the relevant document; use the correct current Form number (verify via grounding).
- Full court title (e.g. "IN THE HIGH COURT IN MALAYA AT [PLACE]"), correct suit/OS/petition numbering format, and correct party designations.
- Numbered paragraphs for pleadings, affidavits and submissions; one material fact per paragraph in pleadings.
- Include the prayer/relief, signature/attestation blocks, and exhibit markings where required.
- Amounts in RM to two decimals; land described in proper NLC format where relevant.
- Cite only verified statutes/rules/cases; never fabricate. Where a detail must be confirmed, mark it.`;

  let prompt: string;
  if (isSample) {
    prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(pathway)}

${FORMAT_RULES}

TASK — ANNOTATED SAMPLE / PRECEDENT:
Produce a clean, professional SAMPLE of: **${label}**.
This is a teaching precedent (not tied to a real client). Use realistic but clearly generic placeholders in [SQUARE BRACKETS] for all case-specific details.
After the specimen, add:
## DRAFTING NOTES
- The required elements and the rule/Form that mandates them (verify currency).
- Common mistakes that get these struck out or rejected in Malaysian courts.
- Filing notes: where filed, approximate fee, and any time limit (mark "verify").`;
  } else if (isReply) {
    if (!opponent) {
      return void res
        .status(404)
        .json({ error: "Opposing party's document not found — upload it first." });
    }
    const target = label
      ? `the responsive document: **${label}**`
      : "the MOST APPROPRIATE responsive court document";
    prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(pathway)}

${FORMAT_RULES}

TASK — DRAFT A REPLY TO THE OPPOSING PARTY'S DOCUMENT:
The opposing party has served the document(s) reproduced below.
1. First, under a heading "## Opponent's Document", briefly identify what their document is and the key points/allegations it raises (2–4 lines).
2. Then draft ${target} that responds to it — a complete, court-ready Malaysian court document that answers each material allegation, raises the appropriate defences/objections, and protects our client's position.
${label ? "" : "Choose the correct responsive document under the Rules of Court 2012 (e.g. a Defence to a Statement of Claim, a Reply, an Affidavit in Reply, or a submission in response) and state clearly which you have chosen and why.\n"}Address each allegation point by point — admit, deny, or put to proof as appropriate; plead positive averments; and raise any counterclaim, set-off or preliminary objection that arises.
${instructions ? `Special instructions: ${instructions}\n` : ""}${rec ? "Where relevant, use our client's own facts, issues and analysis from the active matter (set out below) to strengthen the response.\n" : ""}After the document, add:
## FILING NOTES
1. Court & registry, approximate fee (mark "verify").
2. The statutory time limit to respond (e.g. time to enter appearance / file a defence) — mark "verify".
3. Documents to attach/exhibit and the next procedural step.
=== OPPOSING PARTY'S DOCUMENT(S) ===
${opponent.combinedText.slice(0, GROUNDED_RAW_CAP)}${
      rec ? `\n=== OUR CLIENT'S MATTER CONTEXT ===\n${caseContext(rec)}` : ""
    }`;
  } else {
    if (!rec) {
      return void res
        .status(404)
        .json({ error: "Case not found — upload documents first, or use Sample mode." });
    }
    prompt = `${GROUNDING_DIRECTIVE}${pathwayContext(pathway)}

${FORMAT_RULES}

TASK — TAILORED DRAFT FROM THE CASE FILE:
Draft a complete, court-ready **${label}** using the facts, issues and analysis from this matter.
Pull real names, dates, amounts and particulars from the case file where available; use [PLACEHOLDER] only where the information is genuinely absent.
${instructions ? `Special instructions: ${instructions}\n` : ""}
After the document, add:
## FILING NOTES
1. Court & registry, approximate fee (mark "verify").
2. Documents to attach/exhibit.
3. Statutory time limits / deadlines.
4. Next procedural step.
=== MATTER CONTEXT ===
${caseContext(rec)}`;
  }

  const templateRaw =
    typeof req.body?.templateText === "string" ? req.body.templateText : "";
  const templateText = templateRaw.trim().slice(0, TEMPLATE_CHAR_CAP);
  if (templateText) {
    prompt += `

=== TEMPLATE / PRECEDENT TO FOLLOW (supplied by the user) ===
The user has supplied the document below as the precedent they want THIS draft modelled on. Treat it as the controlling template for form and style:
- Mirror its structure, section order, headings, paragraph numbering, clause wording style, layout and tone as closely as you can.
- Substitute the correct parties, facts, figures, dates and law for THE CURRENT MATTER — do NOT carry over the template's own party names, facts or figures.
- Treat any blanks or placeholders in the template as markers for where matter-specific content belongs.
- Where the template omits something required by the Rules of Court 2012 or the mandatory drafting rules above, add it. Where the template conflicts with current law, the correct court format or the correct Form, the LAW AND THE RULES PREVAIL — do not reproduce the template's mistakes.

TEMPLATE CONTENT:
${templateText}`;
  }

  await streamGenerate(res, prompt, {
    grounded: true,
    provider: normalizeProvider(req.body?.provider),
    disclaimer: isSample
      ? "Sample precedent for guidance only — adapt to your facts and verify the current Form, rule and fee before use."
      : "AI-generated draft grounded in live sources. It MUST be reviewed, verified and settled by a qualified Malaysian Advocate & Solicitor before filing. Verify every citation, Form number and fee against primary sources.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Template / precedent upload for drafting — extract the text of a single sample
// document so the client can pass it to /draft as `templateText` (the AI then
// mirrors its structure and style). The file is the user's OWN precedent, so
// returning its extracted text to them carries no confidentiality concern.
// ─────────────────────────────────────────────────────────────────────────────
function templateUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown): void => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return void res
          .status(413)
          .json({ error: `File too large. Maximum ${MAX_FILE_BYTES / (1024 * 1024)}MB.` });
      }
      return void res.status(400).json({ error: (err as Error).message });
    }
    if (err) {
      logger.error({ err }, "IRAC template upload failure");
      return void res.status(500).json({ error: "Upload failed" });
    }
    next();
  });
}

router.post("/extract-template", templateUploadMiddleware, async (req, res): Promise<void> => {
  const file = (req as Request & { file?: { buffer: Buffer; originalname: string } }).file;
  if (!file) {
    return void res.status(400).json({ error: "No file uploaded." });
  }
  if (!isSupportedDoc(file.originalname)) {
    return void res.status(400).json({
      error: "Unsupported file type. Upload a PDF, Word (.docx), text, RTF, CSV or image file.",
    });
  }
  try {
    const raw = (await extractText(file.buffer, file.originalname)).trim();
    if (!raw) {
      return void res.status(422).json({
        error: "Could not read any text from that file. Try a clearer copy or a different format.",
      });
    }
    const text = raw.slice(0, TEMPLATE_CHAR_CAP);
    res.json({
      name: file.originalname,
      text,
      chars: text.length,
      truncated: raw.length > text.length,
    });
  } catch (err) {
    logger.error({ err }, "IRAC template extraction failed");
    res.status(500).json({ error: "Could not process that file. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Expert paralegal chat — a conversational assistant scoped to a single pathway.
// Stateless: the client holds the conversation and re-sends it each turn (keeps
// matter discussion off the server, consistent with the app's privacy model).
// Gated like the other AI tools.
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_DIRECTIVE = `You are the user's dedicated EXPERT PARALEGAL for the practice area set out below — a calm, knowledgeable Malaysian litigation paralegal working under a practising advocate & solicitor. You are in a live chat: the user will ask questions, seek your view, or give you instructions on a matter.
- Be conversational but precise and practical; lead with the answer, then the reasoning.
- Stay within this pathway's Malaysian law and procedure; if a question falls outside it, say so briefly and still help.
- When the user gives an instruction (e.g. "draft me…", "what do I file…", "what's the deadline…"), respond with concrete, court-ready guidance and clear next steps.
- Use Malaysian legal English, **bold** for Acts, sections and case names, and tight numbered lists where they help.
- Never fabricate a citation, section, Form, fee or threshold — where something must be confirmed, say so plainly.
- Keep replies focused; do not pad with academic background unless asked.`;

router.post("/chat", requireSubscription, async (req, res): Promise<void> => {
  const { pathway: bodyPathway, litMessages } = req.body || {};
  const pathway = String(bodyPathway || "general-civil");
  const provider = normalizeProvider(req.body?.provider);

  const rawMsgs: Array<{ role?: unknown; text?: unknown }> = Array.isArray(litMessages)
    ? litMessages
    : [];
  const history: ChatMessage[] = [];
  for (const m of rawMsgs.slice(-CHAT_MAX_TURNS)) {
    const role: ChatMessage["role"] = m?.role === "assistant" ? "assistant" : "user";
    const text = typeof m?.text === "string" ? m.text.slice(0, CHAT_MSG_CHAR_CAP) : "";
    if (text.trim()) history.push({ role, text });
  }
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return void res.status(400).json({ error: "Send a message to your paralegal." });
  }

  const systemInstruction = `${CHAT_DIRECTIVE}\n${pathwayContext(pathway)}`;

  // Authenticated/premium SSE route: same-origin only. We deliberately do NOT
  // set Access-Control-Allow-Origin (a credentialed cross-origin read is blocked
  // by the browser with "*" anyway, and the app enforces same-origin CSRF).
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const citations = new Map<string, Citation>();
  try {
    for await (const piece of streamChat(history, {
      provider,
      grounded: true,
      systemInstruction,
      maxOutputTokens: 4096,
    })) {
      if (piece.text) res.write(`data: ${JSON.stringify({ content: piece.text })}\n\n`);
      if (piece.citations) {
        for (const c of piece.citations) {
          if (!citations.has(c.uri)) citations.set(c.uri, c);
        }
      }
    }
    const citationList = [...citations.values()];
    if (citationList.length > 0) {
      res.write(`data: ${JSON.stringify({ citations: citationList })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    logger.error({ err }, "IRAC chat failed");
    res.write(
      `data: ${JSON.stringify({ error: "The paralegal could not respond. Please try again.", done: true })}\n\n`,
    );
    res.end();
  }
});

// ─── Transcription: recording → full diarized, timestamped transcript ─────────
// Dedicated uploader so the 200MB cap is enforced at parse time (rejecting
// oversized recordings before they are buffered into memory) — important
// because this endpoint is ungated.
const transcribeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STT_MAX_BYTES, files: 1 },
});

function transcribeUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  transcribeUpload.single("file")(req, res, (err: unknown): void => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return void res
          .status(413)
          .json({ error: `Recording too large. Maximum ${Math.floor(STT_MAX_BYTES / (1024 * 1024))}MB.` });
      }
      return void res.status(400).json({ error: (err as Error).message });
    }
    if (err) {
      logger.error({ err }, "IRAC transcribe upload failure");
      return void res.status(500).json({ error: "Upload failed" });
    }
    next();
  });
}

router.post("/transcribe", transcribeUploadMiddleware, async (req, res): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return void res.status(400).json({ error: "No recording uploaded." });
    }
    if (!isMediaFile(file.originalname)) {
      return void res.status(400).json({
        error: "Please upload an audio or video recording (e.g. MP3, WAV, M4A, MP4, MOV).",
      });
    }
    if (file.size > STT_MAX_BYTES) {
      return void res
        .status(413)
        .json({ error: `Recording too large. Maximum ${Math.floor(STT_MAX_BYTES / (1024 * 1024))}MB.` });
    }

    const result = await transcribeDiarized(file.buffer, file.originalname);
    if (!result || !result.text || !result.text.trim()) {
      return void res.status(502).json({
        error: "Could not transcribe this recording. Please check it has audible speech and try again.",
      });
    }

    const words = Array.isArray(result.words) ? result.words : [];
    const { segments, speakerCount, durationSec } = buildSegments(words);
    const finalSegments: TranscriptSegment[] =
      segments.length > 0
        ? segments
        : [
            {
              speaker: "speaker_0",
              speakerLabel: "Speaker 1",
              startSec: 0,
              start: "00:00:00",
              text: result.text.trim(),
            },
          ];

    res.json({
      filename: file.originalname,
      language: result.language_code || "unknown",
      durationSec,
      speakerCount: Math.max(speakerCount, 1),
      segments: finalSegments,
      text: result.text.trim(),
    });
  } catch (e) {
    logger.error({ err: e }, "IRAC transcribe failed");
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

export default router;
