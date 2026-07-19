import { AiProviderError } from "./aiService";
import type { EmailInput } from "./meetingAi";

/**
 * Fetch recent Gmail messages for task ingestion.
 *
 * Requires the Gmail integration/connector. Until it is connected this fails
 * explicitly so the caller surfaces a clear 502 rather than returning silently
 * empty results.
 */
export async function fetchRecentEmails(_max: number): Promise<EmailInput[]> {
  throw new AiProviderError(
    "Reading email needs the Gmail connector. Please connect Gmail first.",
  );
}
