import { describe, expect, it } from "vitest";
import { enforceTerminalSse } from "./ai-stream-fetch";

function sse(body: string) {
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

describe("enforceTerminalSse", () => {
  it("preserves a valid stream with an explicit terminal frame", async () => {
    const response = enforceTerminalSse(sse(
      'data: {"content":"complete"}\n\ndata: {"done":true}\n\n',
    ));
    await expect(response.text()).resolves.toContain('"done":true');
  });

  it("rejects a direct reader stream that ends without a terminal frame", async () => {
    const response = enforceTerminalSse(sse('data: {"content":"partial"}\n\n'));
    await expect(response.text()).rejects.toThrow("before completion");
  });
});