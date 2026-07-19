import { Router, type IRouter } from "express";
import {
  IngestScreenshotBody,
  IngestGmailBody,
  IngestDocumentBody,
  CreateTasksFromDraftsBody,
} from "../apiZod";
import { AiProviderError } from "../lib/aiService";
import {
  parseScreenshot,
  parseEmailsToDrafts,
  parseDocumentToDrafts,
} from "../lib/meetingAi";
import { extractDocumentText, UnsupportedDocumentError } from "../lib/documentText";
import { createTaskFromDraft } from "../lib/meetingService";
import { fetchRecentEmails } from "../lib/gmail";
import { requireManagerSession } from "../lib/managerSession";
import { syncToDrive } from "../lib/googleDrive";
import { aiRateLimit } from "../lib/aiRateLimit";

const router: IRouter = Router();

function aiError(err: unknown, req: any, res: any): boolean {
  if (err instanceof AiProviderError) {
    req.log.error({ err }, "Ingest AI/provider error");
    res.status(502).json({ error: err.message });
    return true;
  }
  return false;
}

// Convert a chat screenshot (WhatsApp) into task drafts
router.post(
  "/ingest/screenshot",
  aiRateLimit,
  async (req, res): Promise<void> => {
    const parsed = IngestScreenshotBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const mime = parsed.data.mimeType || "image/png";
      syncToDrive(
        Buffer.from(parsed.data.imageBase64, "base64"),
        `chat-screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.${mime.split("/")[1] || "png"}`,
        mime,
        { source: "ingest-screenshot" },
      );
      const dataUrl = `data:${mime};base64,${parsed.data.imageBase64}`;
      const { drafts, note } = await parseScreenshot(dataUrl, parsed.data.lang);
      res.json({ source: "whatsapp", drafts, note });
    } catch (err) {
      if (aiError(err, req, res)) return;
      throw err;
    }
  },
);

// Pull recent Gmail messages and convert them into task drafts
router.post(
  "/ingest/gmail",
  aiRateLimit,
  async (req, res): Promise<void> => {
    const parsed = IngestGmailBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const emails = await fetchRecentEmails(parsed.data.max ?? 10);
      const { drafts, note } = await parseEmailsToDrafts(emails, parsed.data.lang);
      res.json({ source: "gmail", drafts, note });
    } catch (err) {
      if (aiError(err, req, res)) return;
      throw err;
    }
  },
);

// Convert an uploaded PDF / Word / text document into task drafts
router.post(
  "/ingest/document",
  aiRateLimit,
  async (req, res): Promise<void> => {
    const parsed = IngestDocumentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Cap decoded size before running the (CPU/memory-heavy) parsers.
    const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
    const approxBytes = Math.floor((parsed.data.fileBase64.length * 3) / 4);
    if (approxBytes > MAX_DOCUMENT_BYTES) {
      res
        .status(413)
        .json({ error: "Document is too large. Upload a file under 15 MB." });
      return;
    }

    let text: string;
    try {
      const buffer = Buffer.from(parsed.data.fileBase64, "base64");
      syncToDrive(
        buffer,
        parsed.data.filename,
        parsed.data.mimeType || "application/octet-stream",
        { source: "ingest-document" },
      );
      text = await extractDocumentText(
        buffer,
        parsed.data.mimeType,
        parsed.data.filename,
      );
    } catch (err) {
      if (err instanceof UnsupportedDocumentError) {
        res.status(400).json({ error: err.message });
        return;
      }
      req.log.error({ err }, "Document text extraction failed");
      res.status(400).json({ error: "The document could not be read." });
      return;
    }

    if (!text) {
      res.json({
        source: "document",
        drafts: [],
        note: "No readable text was found. If this is a scanned image, use the screenshot tab instead.",
      });
      return;
    }

    try {
      const { drafts, note } = await parseDocumentToDrafts(
        text,
        parsed.data.filename,
        parsed.data.lang,
      );
      res.json({ source: "document", drafts, note });
    } catch (err) {
      if (aiError(err, req, res)) return;
      throw err;
    }
  },
);

// Create TaskRadar tasks from confirmed drafts
router.post("/ingest/create-tasks", async (req, res): Promise<void> => {
  const parsed = CreateTasksFromDraftsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const creatorId = await requireManagerSession(req);
  if (creatorId == null) {
    res.status(403).json({ error: "Only managers can create tasks." });
    return;
  }
  const now = new Date();
  const created = [];
  for (const draft of parsed.data.drafts) {
    created.push(
      await createTaskFromDraft(
        {
          title: draft.title,
          description: draft.description ?? null,
          suggestedOwnerId: draft.suggestedOwnerId ?? null,
          suggestedOwnerName: draft.suggestedOwnerName ?? null,
          category: draft.category,
          reason: draft.reason,
          dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
          sourceQuote: draft.sourceQuote ?? null,
        },
        creatorId,
      ),
    );
  }
  res.json({ created });
});

export default router;
