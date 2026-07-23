// Replaceable adapter registry for the Judgment Research Platform.
// All external capabilities (storage, OCR, search, AI) sit behind these
// interfaces so implementations can be swapped via configuration without
// touching handlers or routes. See docs/ARCHITECTURE.md.

export interface StorageAdapter {
  name: string;
  /** Store bytes under a key; returns the storage key. */
  put(key: string, bytes: Buffer, contentType?: string): Promise<string>;
  /** Delete a stored object (best-effort). */
  remove(key: string): Promise<void>;
}

export interface OcrAdapter {
  name: string;
  /** Whether OCR is configured. Phase 00 ships a stub that is not. */
  isEnabled(): boolean;
  /**
   * OCR a stored container. The stub rejects: scanned content must be routed
   * to human review rather than guessed (docs/PROCESSING_STATES.md).
   */
  recognize(storageKey: string): Promise<string>;
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
  ocr: OcrAdapter;
  search: SearchAdapter;
  ai: AiProviderAdapter;
}

import { objectStorageAdapter } from "./storage/objectStorageAdapter";

const stubOcr: OcrAdapter = {
  name: "stub-ocr",
  isEnabled: () => false,
  async recognize() {
    throw new Error(
      "OCR adapter not configured — route scanned content to human review",
    );
  },
};

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
  ocr: stubOcr,
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
