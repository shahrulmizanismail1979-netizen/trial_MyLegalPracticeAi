import { describe, expect, it } from "vitest";
import { retrieveVerifiedMalaysianAuthorities } from "./lawyesVerifiedResearch";

describe("LAWYes verified research retrieval", () => {
  it("executes the rights-gated index query and returns no invented fallback", async () => {
    const results = await retrieveVerifiedMalaysianAuthorities({
      instruction: "zzzxxyy no matching Malaysian authority token 918273645",
      matterType: "integration-test",
      limit: 2,
    });

    expect(results).toEqual([]);
  });
});