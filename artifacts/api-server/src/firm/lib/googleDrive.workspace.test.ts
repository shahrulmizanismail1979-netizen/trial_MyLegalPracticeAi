import { describe, expect, it, vi } from "vitest";

const proxy = vi.hoisted(() => vi.fn());
vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class { proxy = proxy; },
}));
vi.mock("./objectStorage", () => ({
  ObjectStorageService: class {
    getObjectEntityFile() { throw new Error("Subscriber data must not be read for owner Drive sync"); }
  },
}));

import { syncObjectToDrive, syncToDrive, uploadToDrive } from "./googleDrive";
import { runWithFirmWorkspace } from "./workspace";

describe("owner-connected Drive confidentiality", () => {
  it("does not send a subscriber's uploads to the owner's account", async () => {
    await runWithFirmWorkspace(42, async () => {
      syncToDrive(Buffer.from("fixture"), "fixture.txt", "text/plain");
      syncObjectToDrive("/objects/firm/42/uploads/fixture", "fixture.txt", "text/plain");
      await expect(uploadToDrive(Buffer.from("fixture"), "fixture.txt", "text/plain"))
        .rejects.toThrow("owner's Google Drive");
    });
    expect(proxy).not.toHaveBeenCalled();
  });
});