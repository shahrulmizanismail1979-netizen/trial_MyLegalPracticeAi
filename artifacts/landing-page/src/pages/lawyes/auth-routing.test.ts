import { describe, expect, it } from "vitest";
import {
  practitionerAuthDestination,
  validatedLawyesReturnTo,
} from "./auth-routing";

describe("LAWYes practitioner return routing", () => {
  const origin = "https://example.test";

  it("retains a direct matter detail and its URL state", () => {
    expect(
      practitionerAuthDestination(
        "/lawyes/42?tab=documents#conversation",
        "/lawyes/7?tab=documents#conversation",
        origin,
      ),
    ).toBe("/lawyes/42?tab=documents#conversation");
  });

  it("accepts only local LAWYes workspace return paths", () => {
    expect(
      validatedLawyesReturnTo(
        "/lawyes/7?tab=documents#conversation",
        origin,
      ),
    ).toBe("/lawyes/7?tab=documents#conversation");
    expect(validatedLawyesReturnTo("/lawyes/7/", origin)).toBe("/lawyes/7/");
    expect(validatedLawyesReturnTo("/pricing", origin)).toBe("/lawyes");
    expect(
      validatedLawyesReturnTo("https://attacker.example/collect", origin),
    ).toBe("/lawyes");
    expect(validatedLawyesReturnTo("//attacker.example/collect", origin)).toBe(
      "/lawyes",
    );
    expect(validatedLawyesReturnTo("/lawyes/7/unsupported", origin)).toBe(
      "/lawyes",
    );
  });

  it("uses validated returnTo for standalone sign-in", () => {
    expect(
      practitionerAuthDestination(
        "/sign-in",
        "/lawyes/42?view=chat",
        origin,
      ),
    ).toBe("/lawyes/42?view=chat");
    expect(practitionerAuthDestination("/sign-in", null, origin)).toBe(
      "/lawyes",
    );
    expect(
      practitionerAuthDestination(
        "/lawyes/42/unsupported",
        "/lawyes/7",
        origin,
      ),
    ).toBe("/lawyes/7");
  });
});