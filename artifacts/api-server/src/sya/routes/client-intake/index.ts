import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

const INTAKE_TEMPLATES: Record<string, { titleEn: string; titleBm: string; sections: { labelEn: string; labelBm: string; fields: { key: string; labelEn: string; labelBm: string; type: string; placeholder: string; required: boolean }[] }[] }> = {
  "nafkah": {
    titleEn: "Nafkah (Maintenance) Case Intake",
    titleBm: "Pengambilan Kes Nafkah",
    sections: [
      { labelEn: "Client Information", labelBm: "Maklumat Klien", fields: [
        { key: "clientName", labelEn: "Full Name", labelBm: "Nama Penuh", type: "text", placeholder: "Siti Aishah binti Abdullah", required: true },
        { key: "icNumber", labelEn: "IC Number", labelBm: "No. Kad Pengenalan", type: "text", placeholder: "880101-14-5678", required: true },
        { key: "address", labelEn: "Current Address", labelBm: "Alamat Semasa", type: "textarea", placeholder: "", required: true },
        { key: "phone", labelEn: "Contact Number", labelBm: "No. Telefon", type: "text", placeholder: "012-3456789", required: true },
        { key: "occupation", labelEn: "Occupation & Monthly Income", labelBm: "Pekerjaan & Pendapatan Bulanan", type: "text", placeholder: "Teacher, RM3,500/month", required: true },
      ]},
      { labelEn: "Spouse Information", labelBm: "Maklumat Pasangan", fields: [
        { key: "spouseName", labelEn: "Spouse Full Name", labelBm: "Nama Penuh Pasangan", type: "text", placeholder: "Ahmad bin Ibrahim", required: true },
        { key: "spouseIc", labelEn: "Spouse IC Number", labelBm: "No. KP Pasangan", type: "text", placeholder: "850301-10-1234", required: true },
        { key: "spouseOccupation", labelEn: "Spouse Occupation & Income", labelBm: "Pekerjaan & Pendapatan Pasangan", type: "text", placeholder: "Business owner, estimated RM15,000/month", required: true },
        { key: "spouseAddress", labelEn: "Spouse Current Address", labelBm: "Alamat Semasa Pasangan", type: "textarea", placeholder: "", required: false },
      ]},
      { labelEn: "Marriage Details", labelBm: "Butiran Perkahwinan", fields: [
        { key: "marriageDate", labelEn: "Date of Marriage", labelBm: "Tarikh Perkahwinan", type: "text", placeholder: "15/03/2015", required: true },
        { key: "marriageCertNo", labelEn: "Marriage Certificate No.", labelBm: "No. Sijil Nikah", type: "text", placeholder: "WP 12345/2015", required: true },
        { key: "marriageStatus", labelEn: "Current Status", labelBm: "Status Semasa", type: "select:Married|Divorced|Separated", placeholder: "", required: true },
        { key: "separationDate", labelEn: "Date of Separation (if applicable)", labelBm: "Tarikh Perpisahan (jika ada)", type: "text", placeholder: "01/01/2024", required: false },
      ]},
      { labelEn: "Children Details", labelBm: "Butiran Anak-Anak", fields: [
        { key: "numberOfChildren", labelEn: "Number of Children", labelBm: "Bilangan Anak", type: "text", placeholder: "3", required: true },
        { key: "childrenDetails", labelEn: "Children Names & Ages", labelBm: "Nama & Umur Anak-Anak", type: "textarea", placeholder: "1. Adam - 8 years\n2. Sarah - 5 years\n3. Yusuf - 2 years", required: true },
        { key: "childrenLivingWith", labelEn: "Children Currently Living With", labelBm: "Anak-Anak Tinggal Dengan", type: "text", placeholder: "Mother (client)", required: true },
      ]},
      { labelEn: "Nafkah Details", labelBm: "Butiran Nafkah", fields: [
        { key: "lastNafkahDate", labelEn: "Last Nafkah Payment Date", labelBm: "Tarikh Terakhir Bayaran Nafkah", type: "text", placeholder: "January 2024", required: true },
        { key: "previousNafkahAmount", labelEn: "Previous Monthly Amount (if any)", labelBm: "Jumlah Bulanan Sebelum (jika ada)", type: "text", placeholder: "RM1,500", required: false },
        { key: "claimedAmount", labelEn: "Monthly Amount Claimed", labelBm: "Jumlah Bulanan Dituntut", type: "text", placeholder: "RM3,000", required: true },
        { key: "arrearsMonths", labelEn: "Arrears Period", labelBm: "Tempoh Tunggakan", type: "text", placeholder: "6 months", required: false },
        { key: "monthlyExpenses", labelEn: "Monthly Household Expenses Breakdown", labelBm: "Pecahan Perbelanjaan Bulanan Isi Rumah", type: "textarea", placeholder: "Rent: RM1,200\nFood: RM800\nSchool: RM500\nUtilities: RM300", required: true },
      ]},
    ]
  },
  "fasakh": {
    titleEn: "Fasakh (Judicial Dissolution) Case Intake",
    titleBm: "Pengambilan Kes Fasakh",
    sections: [
      { labelEn: "Client Information", labelBm: "Maklumat Klien", fields: [
        { key: "clientName", labelEn: "Full Name", labelBm: "Nama Penuh", type: "text", placeholder: "Client name", required: true },
        { key: "icNumber", labelEn: "IC Number", labelBm: "No. KP", type: "text", placeholder: "880101-14-5678", required: true },
        { key: "address", labelEn: "Current Address", labelBm: "Alamat Semasa", type: "textarea", placeholder: "", required: true },
        { key: "phone", labelEn: "Contact Number", labelBm: "No. Telefon", type: "text", placeholder: "012-3456789", required: true },
      ]},
      { labelEn: "Marriage Details", labelBm: "Butiran Perkahwinan", fields: [
        { key: "spouseName", labelEn: "Spouse Name", labelBm: "Nama Pasangan", type: "text", placeholder: "", required: true },
        { key: "marriageDate", labelEn: "Date of Marriage", labelBm: "Tarikh Perkahwinan", type: "text", placeholder: "15/03/2015", required: true },
        { key: "marriageCertNo", labelEn: "Marriage Certificate No.", labelBm: "No. Sijil Nikah", type: "text", placeholder: "", required: true },
      ]},
      { labelEn: "Grounds for Fasakh (s.52 AUKI)", labelBm: "Alasan Fasakh (s.52 AUKI)", fields: [
        { key: "grounds", labelEn: "Select Grounds", labelBm: "Pilih Alasan", type: "select:Failure to maintain (3+ months)|Cruelty (physical/mental)|Imprisonment (3+ years)|Impotence|Insanity|Forced marriage|Husband missing (1+ year)|Other valid grounds", placeholder: "", required: true },
        { key: "groundsDetail", labelEn: "Detailed Description of Grounds", labelBm: "Huraian Terperinci Alasan", type: "textarea", placeholder: "Describe in detail what happened, when, where, witnesses...", required: true },
        { key: "evidence", labelEn: "Available Evidence", labelBm: "Bukti Tersedia", type: "textarea", placeholder: "Police reports, medical reports, witnesses, bank statements...", required: true },
        { key: "previousActions", labelEn: "Previous Actions Taken", labelBm: "Tindakan Terdahulu", type: "textarea", placeholder: "Complaints to religious authorities, Sulh attempts, etc.", required: false },
      ]},
    ]
  },
  "hadhanah": {
    titleEn: "Hadhanah (Custody) Case Intake",
    titleBm: "Pengambilan Kes Hadhanah",
    sections: [
      { labelEn: "Client Information", labelBm: "Maklumat Klien", fields: [
        { key: "clientName", labelEn: "Full Name", labelBm: "Nama Penuh", type: "text", placeholder: "", required: true },
        { key: "icNumber", labelEn: "IC Number", labelBm: "No. KP", type: "text", placeholder: "", required: true },
        { key: "address", labelEn: "Current Address", labelBm: "Alamat Semasa", type: "textarea", placeholder: "", required: true },
        { key: "occupation", labelEn: "Occupation & Income", labelBm: "Pekerjaan & Pendapatan", type: "text", placeholder: "", required: true },
      ]},
      { labelEn: "Other Parent Details", labelBm: "Butiran Ibu/Bapa Yang Lain", fields: [
        { key: "otherParent", labelEn: "Other Parent Name", labelBm: "Nama Ibu/Bapa Lain", type: "text", placeholder: "", required: true },
        { key: "otherParentAddress", labelEn: "Other Parent Address", labelBm: "Alamat Ibu/Bapa Lain", type: "textarea", placeholder: "", required: false },
      ]},
      { labelEn: "Children Details", labelBm: "Butiran Anak-Anak", fields: [
        { key: "childrenDetails", labelEn: "Children Names, Ages, Gender", labelBm: "Nama, Umur, Jantina Anak-Anak", type: "textarea", placeholder: "1. Adam bin Ahmad - 5 years - Male\n2. Fatimah binti Ahmad - 3 years - Female", required: true },
        { key: "currentCustody", labelEn: "Current Living Arrangement", labelBm: "Susunan Semasa", type: "textarea", placeholder: "Children currently live with...", required: true },
        { key: "schoolDetails", labelEn: "School/Childcare Details", labelBm: "Butiran Sekolah/Taska", type: "textarea", placeholder: "", required: false },
        { key: "specialNeeds", labelEn: "Special Needs (if any)", labelBm: "Keperluan Khas (jika ada)", type: "textarea", placeholder: "", required: false },
      ]},
      { labelEn: "Grounds for Application", labelBm: "Alasan Permohonan", fields: [
        { key: "grounds", labelEn: "Why Should Custody Be Granted to Client", labelBm: "Mengapa Hak Penjagaan Perlu Diberikan Kepada Klien", type: "textarea", placeholder: "Primary caregiver, stable environment, financial ability...", required: true },
        { key: "otherParentConcerns", labelEn: "Concerns About Other Parent", labelBm: "Kebimbangan Tentang Ibu/Bapa Lain", type: "textarea", placeholder: "", required: false },
      ]},
    ]
  },
};

router.get("/client-intake/templates", (_req, res): void => {
  const templates = Object.entries(INTAKE_TEMPLATES).map(([id, t]) => ({
    id,
    titleEn: t.titleEn,
    titleBm: t.titleBm,
    sectionCount: t.sections.length,
    fieldCount: t.sections.reduce((acc, s) => acc + s.fields.length, 0),
  }));
  res.json(templates);
});

router.get("/client-intake/template/:type", (req, res): void => {
  const template = INTAKE_TEMPLATES[req.params.type];
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(template);
});

router.post("/client-intake/generate-brief", async (req, res): Promise<void> => {
  const { caseType, intakeData, language } = req.body;
  if (!intakeData || typeof intakeData !== "object") {
    res.status(400).json({ error: "intakeData is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";
  const template = INTAKE_TEMPLATES[caseType];

  const BRIEF_PROMPT = `You are a senior Shariah legal practitioner preparing a Case Brief (Ringkasan Kes) from client intake information. Generate a professionally structured case brief that can be used for:
1. Internal case file documentation
2. Preparation for Shariah court proceedings

3. Instructions to counsel

CRITICAL RESTRICTIONS:
- ONLY reference Shariah/Islamic law. NEVER include civil law content (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- Do NOT fabricate case citations, section numbers, or legal references. If unsure, state that verification is needed.

CASE TYPE: ${template?.titleEn || caseType}

CLIENT INTAKE DATA:
${Object.entries(intakeData).map(([k, v]) => `${k}: ${v}`).join("\n")}

INSTRUCTIONS:
Generate a comprehensive Case Brief with the following structure:

1. **CASE REFERENCE** - Suggested case number format, date
2. **PARTIES** - Full details of all parties
3. **SYNOPSIS** - Brief summary of the case in 2-3 paragraphs
4. **CHRONOLOGY OF EVENTS** - Timeline of key events based on the facts
5. **ISSUES** - Numbered list of legal issues to be determined
6. **APPLICABLE LAW** - Relevant Acts, sections, and provisions
7. **INITIAL ASSESSMENT** - Preliminary strength assessment
8. **RECOMMENDED ACTIONS** - Next steps, evidence to gather, filings needed
9. **ESTIMATED SHARIAH COURT FILING FEES** - Only cite standard Shariah court filing fees (typically RM10-RM100 for filing, RM10-RM30 for service). State that professional legal fees should be discussed with the practitioner directly. Do NOT reference SRO, civil court fees, or conveyancing charges.
10. **IMPORTANT DEADLINES** - Limitation periods, filing deadlines

${lang === "bm" ? "Write in Bahasa Melayu." : "Write in English."}
Use markdown formatting. Be thorough and professional.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: BRIEF_PROMPT }] },
        { role: "model" as const, parts: [{ text: "I will generate a comprehensive case brief from the intake data." }] },
        { role: "user" as const, parts: [{ text: "Generate now." }] },
      ],
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
