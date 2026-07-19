import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { causePapersTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";
import {
  ListCausePapersQueryParams,
  GetCausePaperParams,
} from "../../lib/schemas";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/cause-papers", async (req, res): Promise<void> => {
  const params = ListCausePapersQueryParams.safeParse(req.query);

  const conditions: SQL[] = [];
  if (params.success && params.data.category) {
    conditions.push(eq(causePapersTable.category, params.data.category));
  }
  if (params.success && params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(
      or(
        ilike(causePapersTable.titleEn, search),
        ilike(causePapersTable.titleBm, search),
      )!,
    );
  }
  const gc = gateCondition(causePapersTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const result =
    conditions.length > 0
      ? await db.select().from(causePapersTable).where(and(...conditions)).orderBy(causePapersTable.order)
      : await db.select().from(causePapersTable).orderBy(causePapersTable.order);

  res.json(result);
});

router.get("/cause-papers/:id", async (req, res): Promise<void> => {
  const params = GetCausePaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conds: SQL[] = [eq(causePapersTable.id, params.data.id)];
  const gc = gateCondition(causePapersTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [paper] = await db
    .select()
    .from(causePapersTable)
    .where(and(...conds));

  if (!paper) {
    res.status(404).json({ error: "Cause paper not found" });
    return;
  }

  res.json(paper);
});

router.post("/cause-papers/draft", async (req, res): Promise<void> => {
  const { templateTitleBm, templateTitleEn, templateBm, fieldValues, additionalContext, gate } = req.body;

  if (!templateBm) {
    res.status(400).json({ error: "Template is required" });
    return;
  }

  const fieldSummary = fieldValues && Object.keys(fieldValues).length > 0
    ? Object.entries(fieldValues)
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "No specific field values provided.";

  const gateScope: Record<string, string> = {
    civil: "SKOP BIDANG: Litigasi Sivil Syariah (undang-undang keluarga Islam — perceraian, nafkah, hadhanah, mut'ah, harta sepencarian, pusaka). JANGAN masukkan kandungan jenayah Syariah atau dokumen nasihat/instrumen (wasiat, hibah, wakaf) kecuali templat itu sendiri berkaitan.",
    criminal: "SKOP BIDANG: Litigasi Jenayah Syariah (kesalahan jenayah Syariah, pertuduhan, jaminan, mitigasi, rayuan jenayah — rujuk Akta 559 dan enakmen kesalahan jenayah Syariah negeri). JANGAN masukkan kandungan kekeluargaan sivil (perceraian, nafkah, hadhanah) atau instrumen nasihat (wasiat, hibah, wakaf).",
    advisory: "SKOP BIDANG: Khidmat Nasihat & Konsultansi Syariah (wasiat, hibah, wakaf, faraid, pendapat undang-undang, pematuhan Syariah). JANGAN masukkan kandungan litigasi sivil (perceraian, nafkah) atau jenayah Syariah kecuali templat itu sendiri berkaitan.",
  };
  const gateInstruction = typeof gate === "string" && gateScope[gate] ? `\n${gateScope[gate]}\n` : "";

  const prompt = `Anda adalah AI Paralegal yang pakar dalam penyediaan kertas kausa mahkamah Syariah Malaysia.${gateInstruction} Tugas anda adalah mendraf kertas kausa yang lengkap, profesional, dan sedia untuk difailkan.

ARAHAN PENTING:
1. Draf MESTI dalam Bahasa Melayu sepenuhnya (kecuali nama kes undang-undang dan istilah undang-undang teknikal)
2. Gunakan format rasmi mahkamah Syariah Malaysia
3. Sertakan semua peruntukan undang-undang yang berkaitan (rujuk Akta 303, Akta 585, Akta 561, dll.)
4. Gunakan bahasa undang-undang formal yang sesuai untuk mahkamah
5. Isikan semua maklumat yang diberikan ke dalam templat
6. Bagi maklumat yang tidak diberikan, gunakan placeholder yang jelas: [___]
7. Sertakan klausa-klausa lazim yang diperlukan (relief yang dipohon, sokongan afidavit, dll.)
8. Pastikan format sesuai untuk dicetak dan difailkan

JENIS KERTAS KAUSA: ${templateTitleBm} (${templateTitleEn})

TEMPLAT ASAS:
${templateBm}

MAKLUMAT YANG DIBERIKAN:
${fieldSummary}

${additionalContext ? `ARAHAN TAMBAHAN:\n${additionalContext}` : ""}

Sila draf kertas kausa yang lengkap berdasarkan templat dan maklumat di atas. Draf mestilah dalam format yang boleh terus dicetak dan difailkan di mahkamah Syariah.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user" as const, parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, systemInstruction: PRACTICAL_GUIDANCE },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

export default router;
