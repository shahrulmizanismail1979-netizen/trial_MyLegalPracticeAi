import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rootExperience } from "./route-selection";

describe("landing root experience", () => {
  it("keeps the bare root on the retained chat-first LAWYes surface", () => {
    expect(rootExperience()).toBe("chat");
    expect(rootExperience("?utm_source=portal")).toBe("chat");
    expect(rootExperience("", "#unknown")).toBe("chat");
  });

  it("selects marketing only for explicit checkout returns", () => {
    expect(
      rootExperience("?checkout=success&session_id=cs_test_123"),
    ).toBe("marketing");
    expect(rootExperience("?session_id=cs_test_123")).toBe("chat");
    expect(rootExperience("?checkout=success")).toBe("marketing");
    expect(rootExperience("?checkout=cancelled")).toBe("marketing");
  });

  it("retains the legacy marketing anchors at the root", () => {
    for (const anchor of [
      "pricing",
      "security",
      "apps",
      "about",
      "payment",
      "terms",
      "privacy",
    ]) {
      expect(rootExperience("", `#${anchor}`)).toBe("marketing");
    }
  });

  it("keeps the client and SSR root routes chat-first by default", () => {
    const app = readFileSync(
      fileURLToPath(new URL("./App.tsx", import.meta.url)),
      "utf8",
    );
    const server = readFileSync(
      fileURLToPath(new URL("./entry-server.tsx", import.meta.url)),
      "utf8",
    );
    expect(app).toContain('<Route path="/" component={RootRoute} />');
    expect(app).toContain("<LawYesSafePreview />");
    expect(server).toContain("return <LawYesSafePreview />");
  });

  it("rejects unsupported nested paths instead of mounting a blank workspace", () => {
    const app = readFileSync(
      fileURLToPath(new URL("./App.tsx", import.meta.url)),
      "utf8",
    );
    const server = readFileSync(
      fileURLToPath(new URL("./entry-server.tsx", import.meta.url)),
      "utf8",
    );
    expect(app).not.toContain('path="/lawyes/:matterId/*?"');
    expect(app).not.toContain('path="/contribute/*?"');
    expect(app).not.toContain('path="/lawyes-safe-preview/*?"');
    expect(server).not.toContain('pathname.startsWith("/lawyes/")');
  });
});