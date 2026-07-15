import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

const SURAH_INDEX: Array<{ number: number; nameEn: string; nameBm: string; nameAr: string; ayahCount: number; revelation: "Makki" | "Madani" }> = [
  { number: 1, nameEn: "Al-Fatihah", nameBm: "Al-Fatihah", nameAr: "الفاتحة", ayahCount: 7, revelation: "Makki" },
  { number: 2, nameEn: "Al-Baqarah", nameBm: "Al-Baqarah", nameAr: "البقرة", ayahCount: 286, revelation: "Madani" },
  { number: 3, nameEn: "Aali 'Imran", nameBm: "Aali 'Imran", nameAr: "آل عمران", ayahCount: 200, revelation: "Madani" },
  { number: 4, nameEn: "An-Nisa'", nameBm: "An-Nisa'", nameAr: "النساء", ayahCount: 176, revelation: "Madani" },
  { number: 5, nameEn: "Al-Ma'idah", nameBm: "Al-Ma'idah", nameAr: "المائدة", ayahCount: 120, revelation: "Madani" },
  { number: 6, nameEn: "Al-An'am", nameBm: "Al-An'am", nameAr: "الأنعام", ayahCount: 165, revelation: "Makki" },
  { number: 7, nameEn: "Al-A'raf", nameBm: "Al-A'raf", nameAr: "الأعراف", ayahCount: 206, revelation: "Makki" },
  { number: 8, nameEn: "Al-Anfal", nameBm: "Al-Anfal", nameAr: "الأنفال", ayahCount: 75, revelation: "Madani" },
  { number: 9, nameEn: "At-Tawbah", nameBm: "At-Tawbah", nameAr: "التوبة", ayahCount: 129, revelation: "Madani" },
  { number: 10, nameEn: "Yunus", nameBm: "Yunus", nameAr: "يونس", ayahCount: 109, revelation: "Makki" },
  { number: 11, nameEn: "Hud", nameBm: "Hud", nameAr: "هود", ayahCount: 123, revelation: "Makki" },
  { number: 12, nameEn: "Yusuf", nameBm: "Yusuf", nameAr: "يوسف", ayahCount: 111, revelation: "Makki" },
  { number: 13, nameEn: "Ar-Ra'd", nameBm: "Ar-Ra'd", nameAr: "الرعد", ayahCount: 43, revelation: "Madani" },
  { number: 14, nameEn: "Ibrahim", nameBm: "Ibrahim", nameAr: "إبراهيم", ayahCount: 52, revelation: "Makki" },
  { number: 15, nameEn: "Al-Hijr", nameBm: "Al-Hijr", nameAr: "الحجر", ayahCount: 99, revelation: "Makki" },
  { number: 16, nameEn: "An-Nahl", nameBm: "An-Nahl", nameAr: "النحل", ayahCount: 128, revelation: "Makki" },
  { number: 17, nameEn: "Al-Isra'", nameBm: "Al-Isra'", nameAr: "الإسراء", ayahCount: 111, revelation: "Makki" },
  { number: 18, nameEn: "Al-Kahf", nameBm: "Al-Kahf", nameAr: "الكهف", ayahCount: 110, revelation: "Makki" },
  { number: 19, nameEn: "Maryam", nameBm: "Maryam", nameAr: "مريم", ayahCount: 98, revelation: "Makki" },
  { number: 20, nameEn: "Ta-Ha", nameBm: "Ta-Ha", nameAr: "طه", ayahCount: 135, revelation: "Makki" },
  { number: 21, nameEn: "Al-Anbiya'", nameBm: "Al-Anbiya'", nameAr: "الأنبياء", ayahCount: 112, revelation: "Makki" },
  { number: 22, nameEn: "Al-Hajj", nameBm: "Al-Hajj", nameAr: "الحج", ayahCount: 78, revelation: "Madani" },
  { number: 23, nameEn: "Al-Mu'minun", nameBm: "Al-Mu'minun", nameAr: "المؤمنون", ayahCount: 118, revelation: "Makki" },
  { number: 24, nameEn: "An-Nur", nameBm: "An-Nur", nameAr: "النور", ayahCount: 64, revelation: "Madani" },
  { number: 25, nameEn: "Al-Furqan", nameBm: "Al-Furqan", nameAr: "الفرقان", ayahCount: 77, revelation: "Makki" },
  { number: 26, nameEn: "Ash-Shu'ara'", nameBm: "Ash-Shu'ara'", nameAr: "الشعراء", ayahCount: 227, revelation: "Makki" },
  { number: 27, nameEn: "An-Naml", nameBm: "An-Naml", nameAr: "النمل", ayahCount: 93, revelation: "Makki" },
  { number: 28, nameEn: "Al-Qasas", nameBm: "Al-Qasas", nameAr: "القصص", ayahCount: 88, revelation: "Makki" },
  { number: 29, nameEn: "Al-'Ankabut", nameBm: "Al-'Ankabut", nameAr: "العنكبوت", ayahCount: 69, revelation: "Makki" },
  { number: 30, nameEn: "Ar-Rum", nameBm: "Ar-Rum", nameAr: "الروم", ayahCount: 60, revelation: "Makki" },
  { number: 31, nameEn: "Luqman", nameBm: "Luqman", nameAr: "لقمان", ayahCount: 34, revelation: "Makki" },
  { number: 32, nameEn: "As-Sajdah", nameBm: "As-Sajdah", nameAr: "السجدة", ayahCount: 30, revelation: "Makki" },
  { number: 33, nameEn: "Al-Ahzab", nameBm: "Al-Ahzab", nameAr: "الأحزاب", ayahCount: 73, revelation: "Madani" },
  { number: 34, nameEn: "Saba'", nameBm: "Saba'", nameAr: "سبأ", ayahCount: 54, revelation: "Makki" },
  { number: 35, nameEn: "Fatir", nameBm: "Fatir", nameAr: "فاطر", ayahCount: 45, revelation: "Makki" },
  { number: 36, nameEn: "Ya-Sin", nameBm: "Ya-Sin", nameAr: "يس", ayahCount: 83, revelation: "Makki" },
  { number: 37, nameEn: "As-Saffat", nameBm: "As-Saffat", nameAr: "الصافات", ayahCount: 182, revelation: "Makki" },
  { number: 38, nameEn: "Sad", nameBm: "Sad", nameAr: "ص", ayahCount: 88, revelation: "Makki" },
  { number: 39, nameEn: "Az-Zumar", nameBm: "Az-Zumar", nameAr: "الزمر", ayahCount: 75, revelation: "Makki" },
  { number: 40, nameEn: "Ghafir", nameBm: "Ghafir", nameAr: "غافر", ayahCount: 85, revelation: "Makki" },
  { number: 41, nameEn: "Fussilat", nameBm: "Fussilat", nameAr: "فصلت", ayahCount: 54, revelation: "Makki" },
  { number: 42, nameEn: "Ash-Shura", nameBm: "Ash-Shura", nameAr: "الشورى", ayahCount: 53, revelation: "Makki" },
  { number: 43, nameEn: "Az-Zukhruf", nameBm: "Az-Zukhruf", nameAr: "الزخرف", ayahCount: 89, revelation: "Makki" },
  { number: 44, nameEn: "Ad-Dukhan", nameBm: "Ad-Dukhan", nameAr: "الدخان", ayahCount: 59, revelation: "Makki" },
  { number: 45, nameEn: "Al-Jathiyah", nameBm: "Al-Jathiyah", nameAr: "الجاثية", ayahCount: 37, revelation: "Makki" },
  { number: 46, nameEn: "Al-Ahqaf", nameBm: "Al-Ahqaf", nameAr: "الأحقاف", ayahCount: 35, revelation: "Makki" },
  { number: 47, nameEn: "Muhammad", nameBm: "Muhammad", nameAr: "محمد", ayahCount: 38, revelation: "Madani" },
  { number: 48, nameEn: "Al-Fath", nameBm: "Al-Fath", nameAr: "الفتح", ayahCount: 29, revelation: "Madani" },
  { number: 49, nameEn: "Al-Hujurat", nameBm: "Al-Hujurat", nameAr: "الحجرات", ayahCount: 18, revelation: "Madani" },
  { number: 50, nameEn: "Qaf", nameBm: "Qaf", nameAr: "ق", ayahCount: 45, revelation: "Makki" },
  { number: 51, nameEn: "Adh-Dhariyat", nameBm: "Adh-Dhariyat", nameAr: "الذاريات", ayahCount: 60, revelation: "Makki" },
  { number: 52, nameEn: "At-Tur", nameBm: "At-Tur", nameAr: "الطور", ayahCount: 49, revelation: "Makki" },
  { number: 53, nameEn: "An-Najm", nameBm: "An-Najm", nameAr: "النجم", ayahCount: 62, revelation: "Makki" },
  { number: 54, nameEn: "Al-Qamar", nameBm: "Al-Qamar", nameAr: "القمر", ayahCount: 55, revelation: "Makki" },
  { number: 55, nameEn: "Ar-Rahman", nameBm: "Ar-Rahman", nameAr: "الرحمن", ayahCount: 78, revelation: "Madani" },
  { number: 56, nameEn: "Al-Waqi'ah", nameBm: "Al-Waqi'ah", nameAr: "الواقعة", ayahCount: 96, revelation: "Makki" },
  { number: 57, nameEn: "Al-Hadid", nameBm: "Al-Hadid", nameAr: "الحديد", ayahCount: 29, revelation: "Madani" },
  { number: 58, nameEn: "Al-Mujadilah", nameBm: "Al-Mujadilah", nameAr: "المجادلة", ayahCount: 22, revelation: "Madani" },
  { number: 59, nameEn: "Al-Hashr", nameBm: "Al-Hashr", nameAr: "الحشر", ayahCount: 24, revelation: "Madani" },
  { number: 60, nameEn: "Al-Mumtahanah", nameBm: "Al-Mumtahanah", nameAr: "الممتحنة", ayahCount: 13, revelation: "Madani" },
  { number: 61, nameEn: "As-Saff", nameBm: "As-Saff", nameAr: "الصف", ayahCount: 14, revelation: "Madani" },
  { number: 62, nameEn: "Al-Jumu'ah", nameBm: "Al-Jumu'ah", nameAr: "الجمعة", ayahCount: 11, revelation: "Madani" },
  { number: 63, nameEn: "Al-Munafiqun", nameBm: "Al-Munafiqun", nameAr: "المنافقون", ayahCount: 11, revelation: "Madani" },
  { number: 64, nameEn: "At-Taghabun", nameBm: "At-Taghabun", nameAr: "التغابن", ayahCount: 18, revelation: "Madani" },
  { number: 65, nameEn: "At-Talaq", nameBm: "At-Talaq", nameAr: "الطلاق", ayahCount: 12, revelation: "Madani" },
  { number: 66, nameEn: "At-Tahrim", nameBm: "At-Tahrim", nameAr: "التحريم", ayahCount: 12, revelation: "Madani" },
  { number: 67, nameEn: "Al-Mulk", nameBm: "Al-Mulk", nameAr: "الملك", ayahCount: 30, revelation: "Makki" },
  { number: 68, nameEn: "Al-Qalam", nameBm: "Al-Qalam", nameAr: "القلم", ayahCount: 52, revelation: "Makki" },
  { number: 69, nameEn: "Al-Haqqah", nameBm: "Al-Haqqah", nameAr: "الحاقة", ayahCount: 52, revelation: "Makki" },
  { number: 70, nameEn: "Al-Ma'arij", nameBm: "Al-Ma'arij", nameAr: "المعارج", ayahCount: 44, revelation: "Makki" },
  { number: 71, nameEn: "Nuh", nameBm: "Nuh", nameAr: "نوح", ayahCount: 28, revelation: "Makki" },
  { number: 72, nameEn: "Al-Jinn", nameBm: "Al-Jinn", nameAr: "الجن", ayahCount: 28, revelation: "Makki" },
  { number: 73, nameEn: "Al-Muzzammil", nameBm: "Al-Muzzammil", nameAr: "المزمل", ayahCount: 20, revelation: "Makki" },
  { number: 74, nameEn: "Al-Muddaththir", nameBm: "Al-Muddaththir", nameAr: "المدثر", ayahCount: 56, revelation: "Makki" },
  { number: 75, nameEn: "Al-Qiyamah", nameBm: "Al-Qiyamah", nameAr: "القيامة", ayahCount: 40, revelation: "Makki" },
  { number: 76, nameEn: "Al-Insan", nameBm: "Al-Insan", nameAr: "الإنسان", ayahCount: 31, revelation: "Madani" },
  { number: 77, nameEn: "Al-Mursalat", nameBm: "Al-Mursalat", nameAr: "المرسلات", ayahCount: 50, revelation: "Makki" },
  { number: 78, nameEn: "An-Naba'", nameBm: "An-Naba'", nameAr: "النبأ", ayahCount: 40, revelation: "Makki" },
  { number: 79, nameEn: "An-Nazi'at", nameBm: "An-Nazi'at", nameAr: "النازعات", ayahCount: 46, revelation: "Makki" },
  { number: 80, nameEn: "'Abasa", nameBm: "'Abasa", nameAr: "عبس", ayahCount: 42, revelation: "Makki" },
  { number: 81, nameEn: "At-Takwir", nameBm: "At-Takwir", nameAr: "التكوير", ayahCount: 29, revelation: "Makki" },
  { number: 82, nameEn: "Al-Infitar", nameBm: "Al-Infitar", nameAr: "الانفطار", ayahCount: 19, revelation: "Makki" },
  { number: 83, nameEn: "Al-Mutaffifin", nameBm: "Al-Mutaffifin", nameAr: "المطففين", ayahCount: 36, revelation: "Makki" },
  { number: 84, nameEn: "Al-Inshiqaq", nameBm: "Al-Inshiqaq", nameAr: "الانشقاق", ayahCount: 25, revelation: "Makki" },
  { number: 85, nameEn: "Al-Buruj", nameBm: "Al-Buruj", nameAr: "البروج", ayahCount: 22, revelation: "Makki" },
  { number: 86, nameEn: "At-Tariq", nameBm: "At-Tariq", nameAr: "الطارق", ayahCount: 17, revelation: "Makki" },
  { number: 87, nameEn: "Al-A'la", nameBm: "Al-A'la", nameAr: "الأعلى", ayahCount: 19, revelation: "Makki" },
  { number: 88, nameEn: "Al-Ghashiyah", nameBm: "Al-Ghashiyah", nameAr: "الغاشية", ayahCount: 26, revelation: "Makki" },
  { number: 89, nameEn: "Al-Fajr", nameBm: "Al-Fajr", nameAr: "الفجر", ayahCount: 30, revelation: "Makki" },
  { number: 90, nameEn: "Al-Balad", nameBm: "Al-Balad", nameAr: "البلد", ayahCount: 20, revelation: "Makki" },
  { number: 91, nameEn: "Ash-Shams", nameBm: "Ash-Shams", nameAr: "الشمس", ayahCount: 15, revelation: "Makki" },
  { number: 92, nameEn: "Al-Layl", nameBm: "Al-Layl", nameAr: "الليل", ayahCount: 21, revelation: "Makki" },
  { number: 93, nameEn: "Ad-Duha", nameBm: "Ad-Duha", nameAr: "الضحى", ayahCount: 11, revelation: "Makki" },
  { number: 94, nameEn: "Ash-Sharh", nameBm: "Ash-Sharh", nameAr: "الشرح", ayahCount: 8, revelation: "Makki" },
  { number: 95, nameEn: "At-Tin", nameBm: "At-Tin", nameAr: "التين", ayahCount: 8, revelation: "Makki" },
  { number: 96, nameEn: "Al-'Alaq", nameBm: "Al-'Alaq", nameAr: "العلق", ayahCount: 19, revelation: "Makki" },
  { number: 97, nameEn: "Al-Qadr", nameBm: "Al-Qadr", nameAr: "القدر", ayahCount: 5, revelation: "Makki" },
  { number: 98, nameEn: "Al-Bayyinah", nameBm: "Al-Bayyinah", nameAr: "البينة", ayahCount: 8, revelation: "Madani" },
  { number: 99, nameEn: "Az-Zalzalah", nameBm: "Az-Zalzalah", nameAr: "الزلزلة", ayahCount: 8, revelation: "Madani" },
  { number: 100, nameEn: "Al-'Adiyat", nameBm: "Al-'Adiyat", nameAr: "العاديات", ayahCount: 11, revelation: "Makki" },
  { number: 101, nameEn: "Al-Qari'ah", nameBm: "Al-Qari'ah", nameAr: "القارعة", ayahCount: 11, revelation: "Makki" },
  { number: 102, nameEn: "At-Takathur", nameBm: "At-Takathur", nameAr: "التكاثر", ayahCount: 8, revelation: "Makki" },
  { number: 103, nameEn: "Al-'Asr", nameBm: "Al-'Asr", nameAr: "العصر", ayahCount: 3, revelation: "Makki" },
  { number: 104, nameEn: "Al-Humazah", nameBm: "Al-Humazah", nameAr: "الهمزة", ayahCount: 9, revelation: "Makki" },
  { number: 105, nameEn: "Al-Fil", nameBm: "Al-Fil", nameAr: "الفيل", ayahCount: 5, revelation: "Makki" },
  { number: 106, nameEn: "Quraysh", nameBm: "Quraysh", nameAr: "قريش", ayahCount: 4, revelation: "Makki" },
  { number: 107, nameEn: "Al-Ma'un", nameBm: "Al-Ma'un", nameAr: "الماعون", ayahCount: 7, revelation: "Makki" },
  { number: 108, nameEn: "Al-Kawthar", nameBm: "Al-Kawthar", nameAr: "الكوثر", ayahCount: 3, revelation: "Makki" },
  { number: 109, nameEn: "Al-Kafirun", nameBm: "Al-Kafirun", nameAr: "الكافرون", ayahCount: 6, revelation: "Makki" },
  { number: 110, nameEn: "An-Nasr", nameBm: "An-Nasr", nameAr: "النصر", ayahCount: 3, revelation: "Madani" },
  { number: 111, nameEn: "Al-Masad", nameBm: "Al-Masad", nameAr: "المسد", ayahCount: 5, revelation: "Makki" },
  { number: 112, nameEn: "Al-Ikhlas", nameBm: "Al-Ikhlas", nameAr: "الإخلاص", ayahCount: 4, revelation: "Makki" },
  { number: 113, nameEn: "Al-Falaq", nameBm: "Al-Falaq", nameAr: "الفلق", ayahCount: 5, revelation: "Makki" },
  { number: 114, nameEn: "An-Nas", nameBm: "An-Nas", nameAr: "الناس", ayahCount: 6, revelation: "Makki" },
];

router.get("/tafsir/surahs", (_req, res): void => {
  res.json(SURAH_INDEX);
});

router.post("/tafsir/generate", async (req, res): Promise<void> => {
  const { surah, ayah, language, focus } = req.body as {
    surah?: number;
    ayah?: number;
    language?: string;
    focus?: string;
  };

  const surahMeta = SURAH_INDEX.find(s => s.number === surah);
  if (!surahMeta) {
    res.status(400).json({ error: "Invalid surah number (1-114)" });
    return;
  }
  const ayahNum = Number(ayah);
  if (!ayahNum || ayahNum < 1 || ayahNum > surahMeta.ayahCount) {
    res.status(400).json({ error: `Invalid ayah for ${surahMeta.nameEn} (1-${surahMeta.ayahCount})` });
    return;
  }

  const lang: "en" | "bm" | "ar" = language === "bm" ? "bm" : language === "ar" ? "ar" : "en";
  const focusLabel = focus === "ahkam" ? "Ahkam (Legal Rulings)"
    : focus === "linguistic" ? "Linguistic & Balaghah"
    : focus === "asbab" ? "Asbab al-Nuzul (Occasion of Revelation)"
    : focus === "malaysia" ? "Malaysian Shariah Application"
    : "Comprehensive";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const langInstr = lang === "bm"
    ? "Tulis SELURUH tafsir dalam Bahasa Melayu yang formal dan ilmiah."
    : lang === "ar"
    ? "اكتب التفسير كاملاً باللغة العربية الفصحى الأكاديمية."
    : "Write the ENTIRE tafsir in formal academic English.";

  const TAFSIR_PROMPT = `You are a Mufassir (Quranic exegete) trained in the classical Sunni tradition with specialisation in Shafi'i fiqh and Malaysian Shariah jurisprudence. You are producing a scholarly tafsir entry for ${surahMeta.nameEn} (${surahMeta.nameAr}), Surah ${surahMeta.number} — Ayah ${ayahNum}. The Surah is ${surahMeta.revelation}.

${langInstr}

FOCUS: ${focusLabel}

CRITICAL RULES:
- Draw on the established classical tafsir tradition: Tafsir al-Tabari (Jami' al-Bayan), Tafsir Ibn Kathir, Tafsir al-Qurtubi (Al-Jami' li-Ahkam al-Quran), Tafsir al-Jalalayn, Tafsir al-Razi (Mafatih al-Ghayb), Tafsir al-Baghawi, and for the Malaysian context: Tafsir Pimpinan Ar-Rahman by Sheikh Abdullah Basmeih.
- Be HONEST about uncertainty. If a particular Asbab al-Nuzul is contested or weak (da'if), say so explicitly. Do NOT fabricate hadith chains, narrators, or specific page references.
- Quote the Arabic ayah text exactly. If you are not certain of the exact wording for a long ayah, state the ayah reference and provide your translation rather than risk a misquoted Arabic text.
- For ahkam (legal) ayat, distinguish between (i) the literal meaning, (ii) the school positions (Hanafi/Maliki/Shafi'i/Hanbali), and (iii) what is currently codified in Malaysian state Shariah enactments.
- Do NOT issue fatwa. This is academic tafsir for legal practitioners' study, not a binding ruling.

ABSOLUTE NON-FABRICATION RULES FOR MALAYSIAN LEGAL CITATIONS:
- Do NOT invent Malaysian case citations (e.g., "[2018] CLJ 123", "JH 38/1 234"). Do not reference cases by specific party names and citations unless the case is universally well-known (e.g., Lina Joy v Majlis Agama Islam Wilayah Persekutuan).
- Do NOT invent specific section numbers of state Shariah enactments. Refer generally ("the Selangor Islamic Family Law Enactment provides for…") rather than fabricating "section 47(3)".
- Do NOT invent JAKIM Mufti Office rulings, Muzakarah Jawatankuasa Fatwa decisions, or Fatwa Committee resolutions with specific dates/numbers. If unsure, say "this matter has been the subject of fatwa discussion in Malaysia; readers should verify the current published Muzakarah position."
- Do NOT invent specific dates of state enactments or amendments.
- When in doubt, write: "No verified specific Malaysian citation is available; practitioners should consult the published gazette / e-syariah portal / Bahagian Penyelidikan JAKIM directly."

OUTPUT STRUCTURE (use these exact section headings, translated into the output language):

1. **Ayah Text** — Arabic text of the ayah (always in Arabic script, regardless of output language), followed by transliteration and a faithful translation into the output language.

2. **Position in the Surah** — One short paragraph on how this ayah relates to the surrounding ayat and the surah's overall theme.

3. **Asbab al-Nuzul** — The reported occasion(s) of revelation if any are authentically transmitted. State "No specific asbab al-nuzul is reliably reported for this ayah" if that is the case. Never invent.

4. **Classical Commentary Synthesis** — A synthesis of how the major mufassirun (al-Tabari, Ibn Kathir, al-Qurtubi, al-Razi, al-Jalalayn) have explained the ayah. Note any notable differences of interpretation.

5. **Linguistic & Rhetorical Notes** — Key Arabic vocabulary, grammatical points (i'rab where relevant), and balaghah (rhetorical devices) that change the meaning.

6. **Ahkam (Legal Rulings Derived)** — If this is an ayat al-ahkam, list the rulings derived by the four schools, noting where they agree and differ. If there are no direct legal rulings, write "This is not an ayat al-ahkam; the lessons drawn are ethical and spiritual rather than legally binding."

7. **Application in Malaysian Shariah Context** — How this ayah is reflected (or not yet reflected) in current Malaysian state Shariah enactments, the Federal Constitution Article 3, the position of the JAKIM Mufti's Office, or relevant Fatwa Committee resolutions. Be cautious — only cite what is well-known.

8. **Scholarly Cautions** — Any common misreadings, weak narrations sometimes attached to this ayah, or contemporary misuses to be aware of.

End with: "والله أعلم — wallahu a'lam — Allah knows best."

Begin the tafsir now.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: TAFSIR_PROMPT,
      config: { systemInstruction: PRACTICAL_GUIDANCE },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tafsir generation failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
