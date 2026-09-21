import { describe, expect, it } from "vitest";
import { requireGeneratedText } from "./ai-response";

describe("requireGeneratedText", () => {
  it("returns the backend's completed non-stream JSON field", () => {
    expect(requireGeneratedText({ analysis: "Completed analysis" }, "analysis")).toBe(
      "Completed analysis",
    );
  });

  it.each([null, {}, { analysis: "" }, { analysis: "   " }, { analysis: 42 }])(
    "rejects a successful response without usable generated text: %j",
    (payload) => {
      expect(() => requireGeneratedText(payload, "analysis")).toThrow(
        /not returned|incomplete/,
      );
    },
  );
});