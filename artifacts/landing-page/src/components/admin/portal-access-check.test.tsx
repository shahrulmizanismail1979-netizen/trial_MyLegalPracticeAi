import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PortalAccessCheck, PortalAccessResults } from "./portal-access-check";

describe("subscriber portal diagnostic UI", () => {
  it("labels the latest-25 sample and offers a manual action without polling", () => {
    const html = renderToStaticMarkup(<PortalAccessCheck />);
    expect(html).toContain("latest-25 sample");
    expect(html).toContain("Not a full audit");
    expect(html).toContain("Check portal access");
    expect(html).toContain("Runs only when requested");
    const source = readFileSync(new URL("./portal-access-check.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/useEffect|setInterval|refetchInterval/);
    expect(source).toContain("disabled={loading}");
    expect(source).toContain('credentials: "same-origin"');
  });

  it("presents loading and error states accessibly", () => {
    expect(renderToStaticMarkup(<PortalAccessResults report={null} loading error={null} />)).toContain('role="status"');
    const html = renderToStaticMarkup(<PortalAccessResults report={null} loading={false} error="Check unavailable" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Check unavailable");
    expect(html).not.toContain("No missing portal access");
  });

  it("shows counts, subscriber IDs, portal issues and unknown intent", () => {
    const html = renderToStaticMarkup(<PortalAccessResults loading={false} error={null} report={{
      sampleLimit: 25, sampled: 25, unknownIntent: 2,
      gaps: [{ subscriberId: 8, portal: "MyCrimAI" }],
    }} />);
    for (const text of ["Checked 25 subscribers", "1 portal issues", "2 with unknown portal intent", "Subscriber #8", "MyCrimAI", "manual review"]) expect(html).toContain(text);
  });

  it("limits healthy copy to the checked sample and is mounted on subscribers page", () => {
    const html = renderToStaticMarkup(<PortalAccessResults loading={false} error={null} report={{ sampleLimit: 25, sampled: 0, unknownIntent: 0, gaps: [] }} />);
    expect(html).toContain("No missing portal access detected in this sample.");
    const page = readFileSync(new URL("../../pages/admin/subscribers.tsx", import.meta.url), "utf8");
    expect(page).toContain("<PortalAccessCheck />");
  });
});