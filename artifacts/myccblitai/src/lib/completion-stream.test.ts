import { describe, expect, it, vi } from "vitest";
import { consumeCompletionStream } from "./completion-stream";

function responseFrom(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

describe("consumeCompletionStream", () => {
  it("reassembles events split across transport chunks and accepts explicit completion", async () => {
    const update = vi.fn();
    const result = await consumeCompletionStream(
      responseFrom([
        'data: {"content":"first "}\n\nda',
        'ta: {"content":"second"}\n\ndata: {"done":true}\n\n',
      ]),
      update,
    );

    expect(result).toEqual({ content: "first second", completed: true });
    expect(update).toHaveBeenLastCalledWith("first second");
  });

  it("rejects partial content when the endpoint error event follows it", async () => {
    await expect(
      consumeCompletionStream(
        responseFrom([
          'data: {"content":"unsafe partial"}\n\n',
          'data: {"error":"Generation failed"}\n\n',
        ]),
        () => undefined,
      ),
    ).rejects.toThrow("Generation failed");
  });

  it("rejects EOF without the endpoint's terminal completion event", async () => {
    await expect(
      consumeCompletionStream(
        responseFrom(['data: {"content":"truncated"}\n\n']),
        () => undefined,
      ),
    ).rejects.toThrow("ended before completion");
  });
});