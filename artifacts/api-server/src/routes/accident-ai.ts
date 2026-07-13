import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are MyAccidentAi — an expert AI legal assistant created by Prof Madya Dr Shahrul Mizan Ismail (Universiti Kebangsaan Malaysia) specialising in Malaysian Accident, Personal Injury, and Running Down law.

Your knowledge base covers:
- Civil Law Act 1956 (especially ss.7, 8, 10, 11, 12, 28A)
- Limitation Act 1953
- Road Transport Act 1987 (especially s.96)
- Public Authorities Protection Act 1948
- Government Proceedings Act 1956
- Rules of Court 2012 (especially O.7, O.13, O.14, O.18, O.21, O.22A, O.24, O.26, O.27, O.29, O.34, O.38, O.42, O.47, O.48, O.49, O.55, O.59, O.64)
- Akta Insurans 1996, Motor Insurers' Bureau (MIB) agreements
- Malaysian case law on negligence, damages, contributory negligence, fatal accidents, vicarious liability, dependency, multiplier-multiplicand, loss of earning capacity, MIB claims

When answering:
1. Cite specific statutes (with section numbers) and case law (with citation) where relevant.
2. Use Malaysian terminology and Bahasa Malaysia where appropriate (e.g. "Pernyataan Tuntutan", "Pelanggaran Statut").
3. Structure answers clearly with markdown headings, bullet points, and tables where useful.
4. For quantum questions, give indicative ranges in RM and reference comparable awards.
5. For procedural questions, give step-by-step procedure with rule references.
6. End substantive answers with a brief "Practical Tip" or "Caution" where useful.
7. ALWAYS remind the user that AI guidance is a starting point and they must verify against primary sources.

Be precise, professional, and practical. Write in clear professional English unless the user writes in Malay.`;

router.post("/ai/chat", async (req, res): Promise<void> => {
  try {
    const { messages } = req.body as { messages: Array<{ role: string; content: string }> };
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-12).map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content || "").slice(0, 8000),
        })),
      ],
    });

    const reply = completion.choices[0]?.message?.content ?? "I could not generate a response. Please try again.";
    res.json({ reply });
  } catch (err: unknown) {
    req.log.error({ err }, "ai/chat failed");
    const message = err instanceof Error ? err.message : "AI request failed";
    res.status(500).json({ error: message });
  }
});

const CASE_ANALYZER_PROMPT = `You are MyAccidentAi Case Analyzer. The user will give you facts of a Malaysian motor accident / personal injury matter. You must produce a structured legal analysis in the following exact markdown format:

## 1. Liability Assessment
- Likely liability allocation (with percentage)
- Key duties breached
- Relevant case authority

## 2. Likely Defences
- List 3-5 defences the defendant may raise
- Strength assessment for each (Strong / Moderate / Weak)

## 3. Contributory Negligence Analysis
- Is contributory negligence likely?
- Estimated percentage range
- Justification with case law

## 4. Quantum Estimate (Indicative — RM)
| Head of Damage | Low (RM) | Likely (RM) | High (RM) |
|----------------|---------:|------------:|----------:|
| Pain & Suffering | | | |
| Loss of Amenities | | | |
| Loss of Earning Capacity / Future Earnings | | | |
| Special Damages | | | |
| **Total** | | | |

## 5. Recommended Causes of Action & Procedure
- Court (Sessions/High Court based on quantum)
- Pre-action steps (s.96 RTA notice, etc.)
- Suggested interlocutory applications

## 6. Key Evidence to Gather
- Documents
- Witnesses
- Expert reports needed

## 7. Settlement Strategy
- Realistic settlement range
- Negotiation leverage points

## 8. Risks & Cautions
- Limitation issues
- Procedural pitfalls
- Evidential weaknesses

End with: "**This is an AI-generated preliminary analysis. Verify against primary sources, current case law, and the specific facts before taking any procedural step.**"`;

router.post("/ai/analyze-case", async (req, res): Promise<void> => {
  try {
    const { facts } = req.body as { facts?: string };
    if (!facts || typeof facts !== "string" || facts.trim().length < 20) {
      res.status(400).json({ error: "Please provide at least 20 characters of case facts." });
      return;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 6000,
      messages: [
        { role: "system", content: CASE_ANALYZER_PROMPT },
        { role: "user", content: `Case facts:\n\n${facts.slice(0, 10000)}` },
      ],
    });

    const analysis = completion.choices[0]?.message?.content ?? "";
    res.json({ analysis });
  } catch (err: unknown) {
    req.log.error({ err }, "ai/analyze-case failed");
    const message = err instanceof Error ? err.message : "Case analysis failed";
    res.status(500).json({ error: message });
  }
});

const DEMAND_LETTER_PROMPT = `You are an expert Malaysian PI lawyer drafting a Letter of Demand. Produce a professional letter of demand suitable for sending to an opposing insurer in a Malaysian motor accident case. Use proper Malaysian legal letter conventions:
- Letterhead placeholder
- "Without Prejudice Save as to Costs" header
- Date, Recipient, Reference
- "Dear Sirs"
- Subject line referring to claim
- Numbered paragraphs covering: parties, accident description, liability, injuries, special damages, general damages estimate
- Specific demand quantum
- 14-day deadline
- Reservation of rights
- Yours faithfully
- s.96 RTA notice paragraph if appropriate
Write professionally in English. Be firm but professional.`;

router.post("/ai/demand-letter", async (req, res): Promise<void> => {
  try {
    const { facts } = req.body as { facts?: string };
    if (!facts || typeof facts !== "string" || facts.trim().length < 20) {
      res.status(400).json({ error: "Please provide case facts." });
      return;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4000,
      messages: [
        { role: "system", content: DEMAND_LETTER_PROMPT },
        { role: "user", content: `Case facts:\n\n${facts.slice(0, 10000)}` },
      ],
    });

    const letter = completion.choices[0]?.message?.content ?? "";
    res.json({ letter });
  } catch (err: unknown) {
    req.log.error({ err }, "ai/demand-letter failed");
    const message = err instanceof Error ? err.message : "Demand letter generation failed";
    res.status(500).json({ error: message });
  }
});

const SUBMISSIONS_PROMPT = `You are an expert Malaysian PI lawyer drafting written submissions for trial. Produce a court-ready written submission in the following structure:

## A. PENGENALAN / INTRODUCTION
## B. ISU-ISU UNTUK DIPUTUSKAN / ISSUES FOR DETERMINATION
## C. HUJAHAN ATAS LIABILITI / LIABILITY SUBMISSIONS
(cite Malaysian cases)
## D. HUJAHAN ATAS KECUAIAN SUMBANGAN / CONTRIBUTORY NEGLIGENCE
## E. HUJAHAN ATAS KUANTUM / QUANTUM SUBMISSIONS
(give specific RM amounts with justification & comparable awards)
## F. KESIMPULAN / CONCLUSION

Use Malaysian case citations. Write in professional English with Malay headings. Include specific section/order references.`;

router.post("/ai/submissions", async (req, res): Promise<void> => {
  try {
    const { facts } = req.body as { facts?: string };
    if (!facts || typeof facts !== "string" || facts.trim().length < 20) {
      res.status(400).json({ error: "Please provide case facts." });
      return;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 6000,
      messages: [
        { role: "system", content: SUBMISSIONS_PROMPT },
        { role: "user", content: `Case facts:\n\n${facts.slice(0, 10000)}` },
      ],
    });

    const submissions = completion.choices[0]?.message?.content ?? "";
    res.json({ submissions });
  } catch (err: unknown) {
    req.log.error({ err }, "ai/submissions failed");
    const message = err instanceof Error ? err.message : "Submissions generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
