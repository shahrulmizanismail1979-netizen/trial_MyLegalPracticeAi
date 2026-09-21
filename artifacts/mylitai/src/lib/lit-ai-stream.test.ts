import { describe, expect, it, vi } from "vitest";
import { litAiStream } from "./lit-ai-stream";

function sseResponse(frames: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  }), { status: 200 });
}

describe("litAiStream completion contract", () => {
  it("does not call onDone when a partial stream reaches EOF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse(['data: {"content":"partial"}\n\n']),
    ));
    const onDone = vi.fn();
    const onError = vi.fn();

    await litAiStream("/test", {}, vi.fn(), onDone, onError);

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("before completion"));
    vi.unstubAllGlobals();
  });

  it("calls onDone only after the terminal event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"content":"complete"}\n\n',
        'data: {"done":true}\n\n',
      ]),
    ));
    const onDone = vi.fn();
    const onError = vi.fn();

    await litAiStream("/test", {}, vi.fn(), onDone, onError);

    expect(onDone).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});