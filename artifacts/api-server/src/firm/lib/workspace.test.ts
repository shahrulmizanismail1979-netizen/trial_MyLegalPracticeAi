import { describe, expect, it } from "vitest";
import { currentFirmWorkspaceId, firmValues, runWithFirmWorkspace } from "./workspace";

describe("firm workspace context", () => {
  it("fails closed rather than using the owner's workspace without authentication", () => {
    expect(() => currentFirmWorkspaceId()).toThrow();
    expect(() => firmValues()).toThrow();
  });

  it("keeps concurrent async requests in their own workspace", async () => {
    const readLater = (id: number) => runWithFirmWorkspace(id, async () => {
      await new Promise((resolve) => setTimeout(resolve, id === 17 ? 5 : 1));
      return firmValues().workspaceId;
    });
    expect(await Promise.all([readLater(17), readLater(28), readLater(0)]))
      .toEqual([17, 28, 0]);
    expect(() => currentFirmWorkspaceId()).toThrow();
  });

  it("rejects malformed workspace identifiers", () => {
    for (const id of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => runWithFirmWorkspace(id, () => undefined)).toThrow();
    }
  });
});