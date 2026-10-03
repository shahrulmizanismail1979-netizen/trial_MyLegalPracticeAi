import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import mammoth from "mammoth";
import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as safeFetch } from "undici";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "elevenlabs";

import { stageRecordingForStt } from "../../lib/scribeUpload";
import { logger } from "../../lib/logger";
import {
  streamChat,
  normalizeProvider,
  type AIProvider,
  type ChatMessage,
} from "../lib/aiProvider";
import { requireSubscription } from "./billing";

const router: IRouter = Router();

// Initialize standard official SDKs
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const MODEL = "gemini-2.5-flash";
const TEMPLATE_CHAR_CAP = 40000;
const CHAT_MAX_TURNS = 24;
const CHAT_MSG_CHAR_CAP = 16000;
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_ZIP_ENTRIES = 500;
const MAX_ZIP_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_RATIO = 200;
const MAX_CHARS_PER_FILE = 1_500_000;
const MAX_TOTAL_CHARS = 5_000_000;
const STT_MAX_BYTES = 200 * 1024 * 1024;
const GROUNDED_RAW_CAP = 28_000;
const CASE_TTL_MS = 3 * 60 * 60 * 1000;

interface CaseFileMeta {
  name: string;
  chars: number;
  truncated: boolean;
  source: string;
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
      "Rules of Court 2012",
      "Contracts Act 1950",
      "Specific Relief Act 1950",
      "Civil Law Act 1956",
      "Evidence Act 1950",
      "Limitation Act 1953",
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

function baseCategories(items: {
  cause: DocItem[];
  interlocutory: DocItem[];
  witness: DocItem[];
  trial: DocItem[];
  submissions: DocItem[];
}): DocCategory[] {
  return [
    { id: "cause-papers", label: "Cause Papers & Pleadings", description: "Originating process and pleadings.", items: items.cause },
    { id: "interlocutory", label: "Interlocutory Applications", description: "Applications before trial.", items: items.interlocutory },
    { id: "witness", label: "Witness Statements", description: "Witness statements.", items: items.witness },
    { id: "trial", label: "Trial Documents", description: "Trial bundles.", items: items.trial },
    { id: "submissions", label: "Written Submissions", description: "Submissions.", items: items.submissions },
  ];
}

const COMMON_INTERLOCUTORY: DocItem[] = [
  { id: "summary-judgment", label: "Summary Judgment (O.14)" },
];

const COMMON_TRIAL: DocItem[] = [
  { id: "chronology", label: "Chronology of Events" },
];

const COMMON_WITNESS: DocItem[] = [
  { id: "witness-statement", label: "Witness Statement (O.38)" },
];

const COMMON_SUBMISSIONS: DocItem[] = [
  { id: "submission-trial", label: "Written Submission for Trial" },
];

export const CATALOG: Record<string, DocCategory[]> = {
  "general-civil": baseCategories({
    cause: [
      { id: "writ", label: "Writ of Summons + Statement of Claim" },
    ],
    interlocutory: COMMON_INTERLOCUTORY,
    witness: COMMON_WITNESS,
    trial: COMMON_TRIAL,
    submissions: COMMON_SUBMISSIONS,
  }),
};

const BASE_PERSONA = `You are MyLitAi IRAC — Senior Counsel specialising in Malaysian civil litigation.`;
const GROUNDING_DIRECTIVE = `You are MyLitAi IRAC — Senior Counsel specialising in Malaysian civil litigation.`;

function pathwayContext(pathwayId: string): string {
  const p = PATHWAYS[pathwayId];
  if (!p) return "";
  return `\nSELECTED PATHWAY: ${p.label} — ${p.blurb}\nUsual forum: ${p.court}`;
}

function caseContext(rec: CaseRecord): string {
  const parts: string[] = [];
  const excerpt = rec.combinedText.slice(0, GROUNDED_RAW_CAP);
  parts.push(`\n=== CASE FILE EXCERPT ===\n${excerpt}`);
  if (rec.issues) parts.push(`\n=== ISSUES IDENTIFIED (I) ===\n${rec.issues}`);
  if (rec.rules) parts.push(`\n=== APPLICABLE LAW / RULES (R) ===\n${rec.rules}`);
  if (rec.application) parts.push(`\n=== ANALYSIS / APPLICATION (A) ===\n${rec.application}`);
  if (rec.opinion) parts.push(`\n=== LEGAL OPINION (C) ===\n${rec.opinion}`);
  return parts.join("\n");
}

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

    res.write(
      `data: ${JSON.stringify({
        done: true,
        provider,
        disclaimer: disclaimer || "AI-generated response.",
      })}\n\n`,
    );
    res.end();
    return { text: full, citations: citationList };
  } catch (error) {
    logger.error({ err: error }, "IRAC stream failed");
    res.write(`data: ${JSON.stringify({ error: "Generation failed.", done: true })}\n\n`);
    res.end();
    return null;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

const OCR_MAX_BYTES = 14 * 1024 * 1024;

function imageMimeFor(lower: string): string | null {
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

async function ocrWithGemini(buffer: Buffer, mimeType: string): Promise<string> {
  if (buffer.length > OCR_MAX_BYTES) return "";
  try {
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          inlineData: { mimeType, data: buffer.toString("base64") },
        },
        { text: "Transcribe all readable text verbatim." },
      ],
    });
    return resp.text ?? "";
  } catch (e) {
    logger.warn({ err: e }, "Gemini OCR failed");
    return "";
  }
}

const MEDIA_EXTS = [".mp3", ".wav", ".m4a", ".mp4", ".mov"];

function isMediaFile(name: string): boolean {
  const l = name.toLowerCase();
  return MEDIA_EXTS.some((e) => l.endsWith(e));
}

function mediaMimeFor(lower: string): string {
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "audio/mp4";
  return "application/octet-stream";
}

async function transcribeWithElevenLabs(buffer: Buffer, filename: string): Promise<string> {
  if (buffer.length > STT_MAX_BYTES) return "";
  try {
    const staged = await stageRecordingForStt(buffer, filename, mediaMimeFor(filename.toLowerCase()));
    try {
      const transcription = await elevenlabs.speechToText.convert({
        file: new Blob([buffer]),
        modelId: "scribe_v1",
      });
      return (transcription.text ?? "").trim();
    } finally {
      void staged.cleanup();
    }
  } catch (e) {
    logger.warn({ err: e, file: filename }, "ElevenLabs STT exception");
    return "";
  }
}

interface ScribeWord {
  text?: string;
  start?: number;
  end?: number;
  type?: string;
  speaker_id?: string;
}

export interface TranscriptSegment {
  speaker: string;
  speakerLabel: string;
  startSec: number;
  start: string;
  text: string;
}

async function transcribeDiarized(buffer: Buffer, filename: string): Promise<{ text?: string; words?: ScribeWord[] } | null> {
  if (buffer.length > STT_MAX_BYTES) return null;
  try {
    const staged = await stageRecordingForStt(buffer, filename, mediaMimeFor(filename.toLowerCase()));
    try {
      const transcription = await elevenlabs.speechToText.convert({
        file: new Blob([buffer]),
        modelId: "scribe_v1",
        tagAudioEvents: true,
        timestampsGranularity: "word",
      });
      return transcription as { text?: string; words?: ScribeWord[] };
    } finally {
      void staged.cleanup();
    }
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

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").trim();
}

async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    try {
      const { PDFParse } = (await import("pdf-parse")) as unknown as {
        PDFParse: new (opts: { data: Uint8Array }) => {
          getText: () => Promise<{ text?: string }>;
          destroy?: () => Promise<void>;
        };
      };
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const r = await parser.getText();
      return r.text || "";
    } catch {
      return await ocrWithGemini(buffer, "application/pdf");
    }
  }
  if (lower.endsWith(".docx")) {
    const r = await mammoth.extractRawText({ buffer });
    return r.value || "";
  }
  const imageMime = imageMimeFor(lower);
  if (imageMime) {
    return await ocrWithGemini(buffer, imageMime);
  }
  return buffer.toString("utf-8");
}

function isSupportedDoc(name: string): boolean {
  const l = name.toLowerCase();
  return l.endsWith(".pdf") || l.endsWith(".docx") || l.endsWith(".txt") || imageMimeFor(l) !== null;
}

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array("files", MAX_FILES)(req, res, (err: unknown): void => {
    if (err) {
      return void res.status(400).json({ error: "Upload failed" });
    }
    next();
  });
}

router.post("/extract", uploadMiddleware, async (req, res): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const pathway = String(req.body?.pathway || "general-civil");

  const fileMetas: CaseFileMeta[] = [];
  const segments: string[] = [];

  for (const f of files) {
    const text = await extractText(f.buffer, f.originalname);
    fileMetas.push({ name: f.originalname, source: f.originalname, chars: text.length, truncated: false });
    segments.push(`\n----- DOCUMENT: ${f.originalname} -----\n${text}`);
  }

  const id = randomUUID();
  const combinedText = segments.join("\n").slice(0, MAX_TOTAL_CHARS);
  cases.set(id, { id, createdAt: Date.now(), pathway, files: fileMetas, combinedText, totalChars: combinedText.length });

  res.json({ caseId: id, pathway, files: fileMetas, totalChars: combinedText.length, documentCount: fileMetas.length });
});

router.post("/issues", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found" });
  const prompt = `Identify legal issues for:\n${rec.combinedText}`;
  const result = await streamGenerate(res, prompt, { grounded: false });
  if (result) rec.issues = result.text;
});

router.post("/research", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found" });
  const prompt = `Research law for issues:\n${rec.issues}`;
  const result = await streamGenerate(res, prompt, { grounded: true });
  if (result) rec.rules = result.text;
});

router.post("/application", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found" });
  const prompt = `Apply law:\n${rec.rules}`;
  const result = await streamGenerate(res, prompt, { grounded: true });
  if (result) rec.application = result.text;
});

router.post("/opinion", async (req, res): Promise<void> => {
  const rec = getCase(String(req.body?.caseId || ""));
  if (!rec) return void res.status(404).json({ error: "Case not found" });
  const prompt = `Draft opinion:\n${caseContext(rec)}`;
  const result = await streamGenerate(res, prompt, { grounded: true });
  if (result) rec.opinion = result.text;
});

router.post("/transcribe", async (req, res): Promise<void> => {
  res.status(501).json({ error: "Use standard transcription pipeline." });
});

export default router;