import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  proxy: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));
vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = mocks.proxy;
  },
}));
vi.mock("./scribeUpload", () => ({
  stageRecordingForStt: vi.fn(async () => ({
    url: "https://private.invalid/signed",
    cleanup: mocks.cleanup,
  })),
}));

const { evidenceKind, extractMediaEvidence } = await import("./mediaEvidence");

describe("media evidence extraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns image OCR confidence, warnings, and source provenance", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({ text: "Exhibit A", confidence: 73, warnings: ["Blurred signature"] }),
    });
    const result = await extractMediaEvidence({
      buffer: Buffer.from("image"),
      fileName: "exhibit.png",
      contentType: "image/png",
      sourceObjectPath: "/objects/private-image",
    });
    expect(result).toMatchObject({
      kind: "image",
      text: "Exhibit A",
      confidence: 73,
      provenance: {
        provider: "Replit AI Integrations",
        sourceObjectPath: "/objects/private-image",
      },
    });
    expect(result.warnings).toContain("Blurred signature");
    expect(result.warnings.some((warning) => warning.includes("verification threshold"))).toBe(true);
  });

  it("retains timestamped transcription provenance and always cleans staging", async () => {
    mocks.proxy.mockResolvedValue(new Response(JSON.stringify({
      text: "Good morning",
      words: [
        { text: "Good", start: 1.2, end: 1.5, speaker_id: "speaker_0", type: "word" },
        { text: "morning", start: 1.6, end: 2.1, speaker_id: "speaker_0", type: "word" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await extractMediaEvidence({
      buffer: Buffer.from("recording"),
      fileName: "hearing.mp4",
      contentType: "video/mp4",
      sourceObjectPath: "/objects/private-video",
    });
    expect(result.kind).toBe("video");
    expect(result.provenance.timestamps).toEqual([
      { startSec: 1.2, endSec: 1.5, speaker: "speaker_0", text: "Good" },
      { startSec: 1.6, endSec: 2.1, speaker: "speaker_0", text: "morning" },
    ]);
    expect(result.warnings[0]).toContain("unverified");
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects a transcript without reliable timestamps and still cleans staging", async () => {
    mocks.proxy.mockResolvedValue(new Response(JSON.stringify({
      text: "Un-timestamped speech",
      words: [{ text: "speech", speaker_id: "speaker_0", type: "word" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(extractMediaEvidence({
      buffer: Buffer.from("recording"),
      fileName: "hearing.mp3",
      contentType: "audio/mpeg",
      sourceObjectPath: "/objects/private-audio",
    })).rejects.toThrow("no reliable timestamps");
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects unsupported content types", () => {
    expect(evidenceKind("application/pdf")).toBeNull();
  });
});