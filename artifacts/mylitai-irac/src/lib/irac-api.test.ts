import { afterEach, describe, expect, it, vi } from "vitest";
import { runStage } from "./irac-api";

function responseWith(body: string) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("IRAC stream completion contract", () => {
  it("reports EOF without invoking onDone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      responseWith('data: {"content":"partial"}\n\n'),
    ));
    const onDone = vi.fn();
    const error = new Promise<string>((resolve) => {
      runStage("issues", "case-1", {
        onContent: vi.fn(),
        onDone,
        onError: resolve,
      });
    });

    await expect(error).resolves.toContain("before completion");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("invokes onDone after an explicit terminal event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      responseWith('data: {"content":"complete"}\n\ndata: {"done":true}\n\n'),
    ));
    const done = new Promise<void>((resolve, reject) => {
      runStage("issues", "case-1", {
        onContent: vi.fn(),
        onDone: () => resolve(),
        onError: reject,
      });
    });

    await expect(done).resolves.toBeUndefined();
  });
});