import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APPROVED_PORTAL_LOGOS = [
  { portal: "MyAccidentAI", asset: "../../myaccidentai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyCorpCommBankLitAI", asset: "../../myccblitai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyConveyLitAI", asset: "../../myconveylitai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyCorpLegalAI", asset: "../../mycorplegalai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyCrimAI", asset: "../../mycrimai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyLawAcad", asset: "../../mylawacad/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyLawFirmAI", asset: "../../mylawfirmai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyLitAI", asset: "../../mylitai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MyLitAI IRAC", asset: "../../mylitai-irac/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
  { portal: "MySyariahAI", asset: "../../mysyariahai/public/favicon.svg", sha256: "31cdfad7ee25373dbc9d792dbc6c8b40b71c3f8f0b5b70ba7772ae300cc494e4" },
] as const;

test.describe("official portal logo assets", () => {
  for (const { portal, asset, sha256 } of APPROVED_PORTAL_LOGOS) {
    test(`${portal} logo matches the approved brand asset`, () => {
      const logoPath = fileURLToPath(new URL(asset, import.meta.url));
      const fingerprint = createHash("sha256")
        .update(readFileSync(logoPath))
        .digest("hex");

      expect(
        fingerprint,
        `${portal} logo fingerprint changed. If this is an intentional official brand update, review the replacement asset and approve it by replacing this portal's SHA-256 value in portal-logo-assets.spec.ts.`,
      ).toBe(sha256);
    });
  }
});