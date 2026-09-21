import { describe, expect, it, vi } from "vitest";
import { consumeSse } from "./sse";

function responseWith(body: string) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  }));
}

describe("consumeSse completion contract", () => {
  it("rejects an EOF without a terminal event", async () => {
    const onError = vi.fn();
    await expect(consumeSse(
      responseWith('data: {"content":"partial"}\n\n'),
      { onEvent: vi.fn(), onError },
    )).rejects.toThrow("before completion");
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("before completion"));
  });

  it("accepts a stream with an explicit done event", async () => {
    const onEvent = vi.fn();
    await expect(consumeSse(
      responseWith('data: {"content":"complete"}\n\ndata: {"done":true}\n\n'),
      { onEvent },
    )).resolves.toBeUndefined();
    expect(onEvent).toHaveBeenLastCalledWith({ done: true });
  });
});