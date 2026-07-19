import { AiProviderError } from "./aiService";
import type { MeetingMinutes } from "../db";

export type GoogleDocResult = { url: string; title: string };

/**
 * Export structured minutes to a Google Doc.
 *
 * Requires the Google Docs integration/connector. Until it is connected this
 * fails explicitly so the caller surfaces a clear 502 rather than pretending
 * the export succeeded.
 */
export async function exportMinutesToGoogleDoc(
  _title: string,
  _minutes: MeetingMinutes,
  _lang: "en" | "ms",
): Promise<GoogleDocResult> {
  throw new AiProviderError(
    "Exporting to Google Docs needs the Google connector. Please connect Google Docs first, or export as Word or PDF instead.",
  );
}
