#!/usr/bin/env tsx
// Generate synthetic cross-file fixtures for Phase 06 tests.
// All content is invented — no real judgments are used.
// Each fixture is paired with a .expected.json acceptance gate.
//
// Run: pnpm --filter @workspace/api-server exec tsx scripts/generate-cross-file-fixtures.ts

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(_dirname, "../../../../fixtures/synthetic/cross-file");
mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Text templates ─────────────────────────────────────────────────────────

const SPLIT_PART1 = `IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR
(COMMERCIAL DIVISION)

SUIT NO: WA-22C-123-04/2022

BETWEEN

MEGA CONSTRUCTION SDN BHD                               PLAINTIFF

AND

URBAN DEVELOPMENT BERHAD                               DEFENDANT

[2022] MLJU 2501

CORAM: MOHD FARID HARUN J

GROUNDS OF JUDGMENT

[1] This is a construction dispute arising out of a contract for the construction of a commercial complex in Kuala Lumpur.

[2] The Plaintiff was engaged under a lump sum contract at RM 45,000,000.00 to design and build the complex by 30 June 2021.

[3] The Defendant withheld three interim payment certificates totalling RM 3,200,000.00, alleging defective works.

[4] The Plaintiff disputes the defects and contends that all works were carried out in accordance with the contract specifications.

[5] The central issues are: (i) whether the alleged defects are substantiated; (ii) whether the Defendant was entitled to withhold payment; and (iii) whether the Plaintiff is entitled to an extension of time.

[6] The Plaintiff called four witnesses and tendered 23 bundles of agreed documents.

[7] The Defendant called three witnesses.

[8] Written submissions were received on 12 October 2022 and oral submissions on 18 November 2022.

[9] Having reviewed all evidence and submissions, the Court is satisfied that the Plaintiff has established its claim on a balance of probabilities.

[10] The Court now proceeds to deal with each issue in turn.

[11] On the issue of progress payments, the Court finds that the Defendant was in breach of contract.

[12] The contract clause 30.1 provides for payment within 30 days of the issuance of an Interim Certificate.

[13] The Defendant's failure to pay three certificates within the contractual period constitutes a repudiatory breach.
`;

const SPLIT_PART2 = `FINDINGS OF THE COURT

[14] Having considered the evidence adduced by both parties and the submissions of counsel, the Court makes the following findings.

[15] On the issue of progress payments, the Court finds that the Defendant was in breach of contract. The contract clause 30.1 provides for payment within 30 days of the issuance of an Interim Certificate.

[16] The Defendant's own expert, Encik Razif bin Hassan, conceded under cross-examination that 89 of the 127 items listed in the Notice of Defects were either non-existent or represented normal wear associated with construction processes. The Court finds that the Notice of Defects was exaggerated.

[17] Judgment is entered for the Plaintiff in the sum of RM 7,320,000.00 together with interest at 5% per annum from the date of service of the Writ.

Costs of the proceedings are awarded to the Plaintiff, to be taxed if not agreed.

(MOHD FARID HARUN)
Judge
High Court of Malaya at Kuala Lumpur

Date: 12 January 2023
`;

const CONTINUATION_FINAL = `[14] The Court, having reviewed the Defendant's Notice of Defects dated 10 January
2022 identifying 127 alleged defects in the works, is not satisfied that the alleged
defects are substantiated by the evidence placed before the Court.

[15] The Plaintiff's expert, Mr. Tan Ah Kow, gave evidence that he inspected the
works on 20 February 2022 and found only 12 items of minor defect, with a combined
rectification cost of RM 48,000. The Court accepts this evidence.

[16] The Defendant's own expert, Encik Razif bin Hassan, conceded under
cross-examination that 89 of the 127 items listed in the Notice of Defects were
either non-existent or represented normal wear associated with construction
processes. The Court finds that the Notice of Defects was exaggerated.

DETERMINATION ON COUNTERCLAIM

[17] The Defendant's counterclaim for delay damages fails. The primary cause of
delay to the works was the Defendant's failure to honour progress payments as
certified. The Notice of Delay issued by the Plaintiff on 5 December 2021 was
validly served and the extension of time claimed is allowed.
`;

const DUPLICATE_CASE = `IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR
(COMMERCIAL DIVISION)

SUIT NO: WA-22C-123-04/2022

BETWEEN

MEGA CONSTRUCTION SDN BHD                               PLAINTIFF

AND

URBAN DEVELOPMENT BERHAD                               DEFENDANT

[2022] MLJU 2501

CORAM: MOHD FARID HARUN J

GROUNDS OF JUDGMENT

[1] This is a construction dispute arising out of a contract for the construction of a commercial complex in Kuala Lumpur.

[2] The parties entered into a standard form construction contract based on the PAM 2006 (With Quantities) form.

[3] The Plaintiff was engaged at a lump sum price of RM 45,000,000.00.

[4] The contract completion date was 30 June 2021. The Plaintiff contends that delays attributable to the Defendant entitled it to an extension of time.

[5] The Defendant withheld three interim payment certificates totalling RM 3,200,000.00 on account of alleged defective works.

[6] Having considered the evidence, judgment is entered for the Plaintiff in the sum of RM 7,320,000.00.

[7] Costs of the action to the Plaintiff, to be taxed if not agreed.

Order accordingly.

(MOHD FARID HARUN)
Judge
High Court of Malaya at Kuala Lumpur
`;

const ALTERNATIVE_VERSION = `IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR
(COMMERCIAL DIVISION)

SUIT NO: WA-22C-123-04/2022

BETWEEN

MEGA CONSTRUCTION SDN BHD (Company No. 198701054321)  ...  PLAINTIFF

AND

URBAN DEVELOPMENT BERHAD (Company No. 199201098765)   ...  DEFENDANT

[2022] MLJU 2501

CORAM: MOHD FARID HARUN J

GROUNDS OF JUDGMENT

[1] This is a construction dispute arising out of a contract for the construction of a commercial complex in Kuala Lumpur.

[2] The parties entered into a standard form construction contract based on the PAM 2006 (With Quantities) form.

[3] The Plaintiff was engaged at a lump sum price of RM 45,000,000.00 to design and build the complex.

[4] The contract completion date was 30 June 2021.

[5] The Defendant withheld interim payment certificates totalling RM 3,200,000.00, alleging defective works.

[6] Having considered the evidence, judgment is entered for the Plaintiff in the sum of RM 7,320,000.00 together with interest.

[10] The Defendant's counterclaim is dismissed with costs.

[11] Costs of the action to the Plaintiff, to be taxed if not agreed.

Order accordingly.

(MOHD FARID HARUN)
Judge
High Court of Malaya at Kuala Lumpur
`;

const RELATED_APPEAL = `IN THE COURT OF APPEAL MALAYSIA
(CIVIL DIVISION)
APPEAL NO: W-02(NCVC)(W)-1987-06/2023

BETWEEN

MEGA CORPORATION SDN BHD (Company No. 198901012345)      APPELLANT

AND

URBAN PROPERTIES BERHAD (Company No. 200001054321)       RESPONDENT

[2024] MLJU 88

CORAM: TAN SRI AZIZAH BINTI HARON JCA

GROUNDS OF JUDGMENT

[1] This is an appeal from the decision of the High Court of Malaya at Kuala Lumpur delivered on 12 January 2023 in Suit No. WA-22C-123-04/2022.

[2] The Appellant appeals against the award of judgment sum of RM 7,320,000.00 and the consequential costs order.

[3] The Appellant contends that the learned High Court Judge erred in: (i) accepting the Respondent's expert evidence without adequate scrutiny; and (ii) failing to give sufficient weight to the Notice of Defects.

[4] After carefully reviewing the grounds of the learned High Court Judge and the evidence on record, this Court finds no basis to disturb the findings of fact made by the court below.

[5] The appeal is dismissed with costs.

ORDER

The appeal is dismissed.

Costs of RM 15,000 to be paid by the Appellant to the Respondent.

TAN SRI AZIZAH BINTI HARON
JUDGE OF COURT OF APPEAL

Date: 19 February 2024
`;

const UNRELATED_CASE = `IN THE HIGH COURT OF SABAH AND SARAWAK AT KUCHING
(CRIMINAL DIVISION)
CRIMINAL CASE NO: KCH-45A-12/2022

PUBLIC PROSECUTOR

v

JAMES ANAK BULAN (NRIC: 800202-13-5678)

[2023] MLJU 512

CORAM: FATIMAH BINTI KASSIM J

GROUNDS OF JUDGMENT

[1] The accused, James anak Bulan, was charged under section 39B(1)(a) of the Dangerous Drugs Act 1952 for trafficking in dangerous drugs, to wit, 800.5 grammes of methamphetamine.

[2] The prosecution called nine witnesses and tendered exhibits P1 to P43 in support of its case.

[3] At the close of the prosecution case, the Court found that the prosecution had made out a prima facie case against the accused and called upon the accused to enter his defence.

[4] The accused elected to give evidence on oath. He denied knowledge of the drugs and claimed he was merely transporting a bag on behalf of a friend known to him only as "Along".

[5] Having considered all the evidence, the Court finds the accused guilty as charged.

[6] The accused has failed to rebut the statutory presumption of knowledge under section 37(da) of the Dangerous Drugs Act 1952 on a balance of probabilities.

[7] The accused is accordingly convicted.

SENTENCE

[8] Pursuant to section 39B(2) of the Dangerous Drugs Act 1952, the mandatory sentence of death is imposed.

FATIMAH BINTI KASSIM
JUDGE
HIGH COURT OF SABAH AND SARAWAK AT KUCHING

Date: 9 January 2023
`;

// ── Expected outcomes ──────────────────────────────────────────────────────

const EXPECTED: Record<string, object> = {
  "split-case-part1.expected.json": {
    description: "First part of a split judgment — has case header and citation but no closing order or judicial signature. Paired with split-case-part2 it forms a POSSIBLE_CONTINUATION.",
    coherence: { HAS_BEGINNING: "PASS", HAS_ENDING: "UNCERTAIN" },
    pairExpectations: [
      { pairedWith: "split-case-part2.txt", allowedRelationshipTypes: ["POSSIBLE_CONTINUATION"] },
      { pairedWith: "unrelated-case.txt", allowedRelationshipTypes: null },
    ],
  },
  "split-case-part2.expected.json": {
    description: "Second (final) part of a split judgment — begins mid-grounds at paragraph [14] with no case header, but has a closing order and judicial signature.",
    coherence: { HAS_BEGINNING: "FAIL", HAS_ENDING: "PASS" },
    pairExpectations: [
      { pairedWith: "split-case-part1.txt", allowedRelationshipTypes: ["POSSIBLE_CONTINUATION"] },
      { pairedWith: "related-appeal.txt", allowedRelationshipTypes: ["RELATED_APPEAL", "POSSIBLE_CONTINUATION", null] },
    ],
  },
  "continuation-final.expected.json": {
    description: "Continuation fragment — starts at paragraph [14] with no case-start signal. Combined with split-case-part1 it should yield a POSSIBLE_CONTINUATION.",
    coherence: { HAS_BEGINNING: "FAIL", HAS_ENDING: "UNCERTAIN" },
    pairExpectations: [
      { pairedWith: "split-case-part1.txt", allowedRelationshipTypes: ["POSSIBLE_CONTINUATION", "RELATED_APPEAL"] },
    ],
  },
  "duplicate-case.expected.json": {
    description: "Duplicate of the construction case — same suit number, parties, and citation. Should yield a duplicate-family relationship when paired with alternative-version.",
    coherence: { HAS_BEGINNING: "PASS", HAS_ENDING: "PASS" },
    pairExpectations: [
      { pairedWith: "alternative-version.txt", allowedRelationshipTypes: ["EXACT_DUPLICATE", "POSSIBLE_DUPLICATE", "ALTERNATIVE_VERSION"] },
    ],
  },
  "alternative-version.expected.json": {
    description: "Alternative version of the construction case — same suit number and citation as duplicate-case.txt but with additional corporate registration detail.",
    coherence: { HAS_BEGINNING: "PASS", HAS_ENDING: "PASS" },
    pairExpectations: [
      { pairedWith: "duplicate-case.txt", allowedRelationshipTypes: ["EXACT_DUPLICATE", "POSSIBLE_DUPLICATE", "ALTERNATIVE_VERSION"] },
    ],
  },
  "related-appeal.expected.json": {
    description: "Court of Appeal judgment appealing from the High Court construction case. Different court level — should not yield EXACT_DUPLICATE.",
    coherence: { HAS_BEGINNING: "PASS", HAS_ENDING: "PASS" },
    pairExpectations: [
      { pairedWith: "split-case-part2.txt", allowedRelationshipTypes: ["RELATED_APPEAL", "POSSIBLE_CONTINUATION", null] },
    ],
  },
  "unrelated-case.expected.json": {
    description: "Completely unrelated criminal case from Sabah — different jurisdiction, court, parties, and subject matter. Should yield null when paired with the construction cases.",
    coherence: { HAS_BEGINNING: "PASS", HAS_ENDING: "PASS" },
    pairExpectations: [
      { pairedWith: "split-case-part1.txt", allowedRelationshipTypes: null },
    ],
  },
};

// ── Write fixtures ─────────────────────────────────────────────────────────

const TEXTS: Record<string, string> = {
  "split-case-part1.txt": SPLIT_PART1,
  "split-case-part2.txt": SPLIT_PART2,
  "continuation-final.txt": CONTINUATION_FINAL,
  "duplicate-case.txt": DUPLICATE_CASE,
  "alternative-version.txt": ALTERNATIVE_VERSION,
  "related-appeal.txt": RELATED_APPEAL,
  "unrelated-case.txt": UNRELATED_CASE,
};

let written = 0;
let skipped = 0;

for (const [filename, content] of Object.entries(TEXTS)) {
  const fullPath = path.join(FIXTURES_DIR, filename);
  if (existsSync(fullPath)) {
    skipped++;
  } else {
    writeFileSync(fullPath, content, "utf8");
    written++;
    console.log(`  wrote ${filename}`);
  }
}

for (const [filename, content] of Object.entries(EXPECTED)) {
  const fullPath = path.join(FIXTURES_DIR, filename);
  writeFileSync(fullPath, JSON.stringify(content, null, 2) + "\n", "utf8");
  written++;
  console.log(`  wrote ${filename}`);
}

console.log(`\nDone. ${written} written, ${skipped} text fixtures already present (skipped).`);
