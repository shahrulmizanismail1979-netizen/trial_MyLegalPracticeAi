import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litLegalForms } from "@workspace/db";
import { eq } from "drizzle-orm";
import { streamChat, generateChat, normalizeProvider } from "../lib/aiProvider";

const router: IRouter = Router();

const DRAFTING_SYSTEM = `You are a Senior Malaysian Advocate & Solicitor specialising in banking litigation with 20+ years of practice in Malaysian courts. You produce court-ready legal documents that conform to the Rules of Court 2012 (ROC 2012, PU(A) 205/2012) and all relevant Malaysian legislation.

MANDATORY FORMAT RULES:
- Follow the exact format and requirements of the ROC 2012 for court documents
- Use numbered paragraphs for pleadings and affidavits (Order 18 r 6, Order 41 r 4)
- Include full court heading: "IN THE HIGH COURT IN MALAYA AT [PLACE]" (or Sessions Court / Magistrate's Court as appropriate)
- Civil suit numbers in format: [YEAR]-[DIVISION NUMBER]-[REGISTRY CODE]-[SERIAL NUMBER]-[YEAR]
- Use correct party designations: PLAINTIFF/DEFENDANT, CHARGEE/CHARGOR, PETITIONER/RESPONDENT
- Land descriptions in NLC 1965 format: Geran / H.S.(D) No., Lot / P.T. No., Mukim, District, State
- All monetary amounts in RM with comma separators (e.g., RM 1,500,000.00)
- Mark all case-specific blanks as [PLACEHOLDER] in capital letters inside square brackets
- Exhibits marked as Exhibit "A", "B", "C", etc.
- Signature blocks and attestation clauses as per applicable Rules

PLAIN-TEXT OUTPUT RULES (STRICT):
- Output the document as clean, court-style plain text. Do NOT use Markdown formatting.
- NEVER output horizontal rules or divider lines of any kind (e.g. "---", "***", "===", or repeated dashes/asterisks/underscores such as "- - - - -"). Use a single blank line to separate sections instead.
- Do NOT use Markdown emphasis: no "*" or "_" for bold/italics, and no "**". Where emphasis is genuinely required, use ALL CAPS as is conventional in Malaysian pleadings.
- Do NOT wrap text in backticks or code fences.
- Section headings must be plain UPPERCASE lines (e.g. "STATEMENT OF CLAIM"), not "#"-prefixed Markdown headings.
- Numbered paragraphs use the plain "1." / "2." convention; bullet lists, where unavoidable, use a single "-" followed by one space and real content (never a line consisting only of dashes).

CONTENT REQUIREMENTS:
- Every required legal element for the specific document type must be included
- Cite the exact applicable legislation, rules and subrules (e.g., "pursuant to Order 83 Rule 3(1) ROC 2012")
- Include the appropriate prayer/relief section at the end of pleadings
- Include verification clause for statements of claim (Order 78 ROC 2012)
- Include Commissioner for Oaths / Solicitor attestation block for affidavits
- Standard Malaysian banking litigation boilerplate where appropriate

After the document, include a "─── FILING NOTES ───" section with:
1. Which court to file at and relevant court fee (approximate)
2. Documents to attach as exhibits or annex
3. Service requirements (personal service vs. AR Registered Post)
4. Any mandatory time limits or limitation periods
5. The immediate next procedural step`;

router.get("/", async (req, res) => {
  const forms = await db.select().from(litLegalForms);
  res.json(forms);
});

router.get("/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [form] = await db
    .select()
    .from(litLegalForms)
    .where(eq(litLegalForms.id, id));
  if (!form) {
    res.status(404).json({ error: "Form not found" });
    return;
  }
  res.json(form);
});

router.post("/:id/draft", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [form] = await db
    .select()
    .from(litLegalForms)
    .where(eq(litLegalForms.id, id));
  if (!form) {
    res.status(404).json({ error: "Form not found" });
    return;
  }

  const { clientName, caseDetails, additionalInfo } = req.body;

  const prompt = `${DRAFTING_SYSTEM}

FORM DETAILS:
Form Number: ${form.formNumber}
Form Title: ${form.title}
Purpose: ${form.purpose}
Authorised By: ${form.authorizedBy}
Filing Instructions: ${form.instructions}
Required Fields: ${form.fields.join(", ")}

CASE DETAILS PROVIDED:
- Parties: ${clientName}
- Core Facts / Relief Sought: ${caseDetails}
${additionalInfo ? `- Additional Information: ${additionalInfo}` : ""}

Draft a complete, court-ready ${form.title} (${form.formNumber}) for Malaysian courts. The document must be ready for review by a supervising solicitor with all structural elements in place. Use [PLACEHOLDER] where actual case-specific details must be inserted.`;

  // Stream the response using SSE
  const wantsStream = req.headers.accept === "text/event-stream";

  if (wantsStream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      for await (const piece of streamChat([{ role: "user", text: prompt }], {
        provider: normalizeProvider(req.body?.provider),
        maxOutputTokens: 8192,
      })) {
        if (piece.text) {
          res.write(`data: ${JSON.stringify({ content: piece.text })}\n\n`);
        }
      }
      res.write(
        `data: ${JSON.stringify({
          done: true,
          formNumber: form.formNumber,
          disclaimer:
            "This AI-generated draft is for reference and educational purposes only. It must be reviewed, corrected, and verified by a qualified Malaysian Advocate & Solicitor before filing in any court. This does not constitute legal advice.",
        })}\n\n`
      );
      res.end();
    } catch {
      res.write(
        `data: ${JSON.stringify({ error: "Failed to generate draft", done: true })}\n\n`
      );
      res.end();
    }
  } else {
    // JSON fallback for non-SSE clients
    try {
      const response = await generateChat([{ role: "user", text: prompt }], {
        provider: normalizeProvider(req.body?.provider),
        maxOutputTokens: 8192,
      });

      const draft = response.text ?? "";

      res.json({
        draft,
        formNumber: form.formNumber,
        disclaimer:
          "This AI-generated draft is for reference and educational purposes only. It must be reviewed by a qualified Malaysian Advocate & Solicitor before filing. This does not constitute legal advice.",
      });
    } catch {
      res.status(500).json({ error: "Failed to generate draft" });
    }
  }
});

export default router;
