// Replaceable adapter registry for the Judgment Research Platform.
// All external capabilities (storage, OCR, search, AI) sit behind these
// interfaces so implementations can be swapped via configuration without
// touching handlers or routes. See docs/ARCHITECTURE.md.

export interface StorageAdapter {
  name: string;
  /** Store bytes under a key; returns the storage key. */
  put(key: string, bytes: Buffer, contentType?: string): Promise<string>;
  /** Fetch stored bytes by the key returned from put(). */
  get(key: string): Promise<Buffer>;
  /** Delete a stored object (best-effort). */
  remove(key: string): Promise<void>;
}

// ── Phase 04 extraction contracts (ADR 0005) ─────────────────────────────
// Four independent, versioned, replaceable adapters. A disabled adapter
// never fakes output — callers must route the work to human review.

import type { BoundingBox } from "@workspace/db";

/** A recognised/extracted word with its source coordinates. */
export interface WordBox {
  text: string;
  bbox: BoundingBox;
  /** 0–100 where the engine reports it (OCR); undefined for native text. */
  confidence?: number;
}

export interface ExtractedPage {
  pageNumber: number;
  /** Whether the source page carries a native (embedded) text layer. */
  hasTextLayer: boolean;
  words: WordBox[];
  width: number;
  height: number;
  unit: "px" | "pt";
}

export interface NativeTextExtractorAdapter {
  name: string;
  version: string;
  isEnabled(): boolean;
  supports(mimeType: string): boolean;
  /** Extract per-page words with coordinates from a digital document. */
  extract(bytes: Buffer, mimeType: string): Promise<ExtractedPage[]>;
}

export interface RenderedPageImage {
  pageNumber: number;
  png: Buffer;
  widthPx: number;
  heightPx: number;
  dpi: number;
}

export interface PageImageRendererAdapter {
  name: string;
  version: string;
  isEnabled(): boolean;
  supports(mimeType: string): boolean;
  /** Render each page of a document to a PNG image. */
  render(bytes: Buffer, mimeType: string): Promise<RenderedPageImage[]>;
}

export interface OcrPageResult {
  text: string;
  words: WordBox[];
  /** Mean word confidence 0–100. */
  meanConfidence: number;
  rotationDegrees: number | null;
  rotationConfidence: number | null;
  languages: string[];
}

export interface OcrAdapter {
  name: string;
  version: string;
  /** Whether OCR is configured/available in this environment. */
  isEnabled(): boolean;
  /**
   * OCR a single page image. Implementations must report uncertainty via
   * confidences — never guess or fabricate replacement text.
   */
  recognize(pageImage: Buffer): Promise<OcrPageResult>;
}

export interface AnalyzedBlock {
  blockType:
    | "paragraph"
    | "heading"
    | "header"
    | "footer"
    | "footnote"
    | "table"
    | "page_number"
    | "other";
  text: string;
  bbox: BoundingBox | null;
  readingOrder: number;
  columnIndex: number | null;
  /** Character offsets within the page text produced by the analyzer. */
  charStart: number;
  charEnd: number;
  confidence: number | null;
}

export interface LayoutWarning {
  code:
    | "READING_ORDER_UNCERTAIN"
    | "POSSIBLE_MISSING_TEXT"
    | "ILLEGIBLE_REGION"
    | "LOW_OCR_CONFIDENCE"
    | "PAGE_ROTATION_UNCERTAIN"
    | "LANGUAGE_UNCERTAIN";
  coordinates: BoundingBox | null;
  detail: Record<string, unknown>;
}

export interface LayoutAnalysis {
  /** Full page text in reading order (blocks joined with newlines). */
  pageText: string;
  blocks: AnalyzedBlock[];
  warnings: LayoutWarning[];
}

export interface LayoutAnalyzerAdapter {
  name: string;
  version: string;
  isEnabled(): boolean;
  /** Group word boxes into ordered blocks; surface layout uncertainty. */
  analyze(page: ExtractedPage): LayoutAnalysis;
}

export interface SearchAdapter {
  name: string;
  /** Index a document. Phase 00 stub is a no-op (no corpus exists yet). */
  index(id: string, text: string): Promise<void>;
  search(query: string): Promise<Array<{ id: string; score: number }>>;
}

export interface AiProviderAdapter {
  name: string;
  /** AI is disabled by default (docs/ARCHITECTURE.md). */
  isEnabled(): boolean;
  /**
   * Propose research output for the given prompt. Disabled adapter rejects;
   * enabled implementations (later phases) must return paragraph-level
   * evidence with every substantive proposition.
   */
  propose(prompt: string): Promise<never>;
}

export interface AdapterRegistry {
  storage: StorageAdapter;
  nativeText: NativeTextExtractorAdapter;
  pageRenderer: PageImageRendererAdapter;
  ocr: OcrAdapter;
  layout: LayoutAnalyzerAdapter;
  search: SearchAdapter;
  ai: AiProviderAdapter;
}

import { objectStorageAdapter } from "./storage/objectStorageAdapter";
import {
  popplerNativeTextExtractor,
  popplerPageImageRenderer,
} from "./extraction/popplerAdapters";
import { tesseractOcrAdapter } from "./extraction/tesseractOcr";
import { heuristicLayoutAnalyzer } from "./extraction/layoutAnalyzer";

const postgresSearchStub: SearchAdapter = {
  name: "postgres-search-stub",
  async index() {
    // No corpus exists in Phase 00; indexing arrives with later phases.
  },
  async search() {
    return [];
  },
};

const disabledAi: AiProviderAdapter = {
  name: "disabled-ai",
  isEnabled: () => false,
  async propose() {
    throw new Error(
      "AI provider is disabled by default — enabling it requires an explicit decision record",
    );
  },
};

let registry: AdapterRegistry = {
  storage: objectStorageAdapter,
  nativeText: popplerNativeTextExtractor,
  pageRenderer: popplerPageImageRenderer,
  ocr: tesseractOcrAdapter,
  layout: heuristicLayoutAnalyzer,
  search: postgresSearchStub,
  ai: disabledAi,
};

export function getAdapters(): AdapterRegistry {
  return registry;
}

/** Replace adapters (tests, future configuration). Returns the previous set. */
export function setAdapters(next: Partial<AdapterRegistry>): AdapterRegistry {
  const previous = registry;
  registry = { ...registry, ...next };
  return previous;
}
