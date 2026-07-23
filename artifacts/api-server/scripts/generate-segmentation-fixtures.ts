#!/usr/bin/env tsx
// Generate synthetic segmentation fixtures for Phase 05 tests.
// All content is invented — no real judgments are used.
// Each fixture is paired with a .expected.json acceptance gate.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(_dirname, "../../../fixtures/synthetic/segmentation");
mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Template helpers ───────────────────────────────────────────────────────

function caseHeader(n: number, year = 2020): string {
  const parties = [
    `PLAINTIFF${n} SDN BHD v. DEFENDANT${n} BHD`,
    `AHMAD BIN HASSAN v. ZAINAB BINTI ISMAIL`,
    `MAKMAL PERUBATAN SDN BHD v. KESATUAN PEKERJA-PEKERJA`,
    `THE GOVERNMENT OF MALAYSIA v. CHAN AH KOW`,
    `BUMI ENTERPRISE SDN BHD v. PETRONAS CARIGALI SDN BHD`,
  ][n % 5]!;

  return `HIGH COURT OF MALAYA AT KUALA LUMPUR

CIVIL SUIT NO. WA-22NCVC-${100 + n}-${String(year).slice(2)}/2023

${parties}

[${year}] MYCA ${n}

CORAM: DATO' JUSTICE RAHMAN J

Delivered: 15 January ${year}

JUDGMENT

[1] This is a claim brought by the plaintiff arising from a breach of contract.
The plaintiff seeks damages and an order for specific performance.

[2] The facts are not in dispute. The parties entered into a written agreement
dated 1 March ${year - 2}. The defendant has failed to perform its obligations
under the agreement.

[3] After hearing submissions from both parties, I find in favour of the plaintiff.
The defendant is ordered to pay damages of RM ${100000 + n * 50000} together with
costs agreed or to be taxed.

IT IS HEREBY ORDERED that judgment be entered for the plaintiff in the sum of
RM ${100000 + n * 50000} together with costs.

Signed: DATO' JUSTICE RAHMAN J
High Court of Malaya
Date: 15 January ${year}
`;
}

function adminPage(): string {
  return `TABLE OF CONTENTS

1. Introduction
2. List of Cases
3. Index

CAUSE LIST — JANUARY SESSION

Case No.     Parties                              Date
------------------------------------------------------------
WA-22-001    Plaintiff A v Defendant B            10 Jan
WA-22-002    Plaintiff C v Defendant D            12 Jan
WA-22-003    Plaintiff E v Defendant F            15 Jan

SENARAI KES / CAUSE LIST
`;
}

function publisherDivider(): string {
  return `
-------------------------------------------------------------------
© Malayan Law Journal Sdn Bhd. All Rights Reserved.
Printed by CLJ Publications Sdn Bhd, Petaling Jaya.
-------------------------------------------------------------------
`;
}

function quotedTitlePage(title: string): string {
  return `HIGH COURT OF MALAYA AT KUALA LUMPUR

CIVIL SUIT NO. WA-22NCVC-999-01/2023

QUOTED CITATION PLAINTIFF v. QUOTED CITATION DEFENDANT

[2023] MYCA 999

CORAM: JUSTICE SITI J

JUDGMENT

[1] In this matter, the plaintiff relies on the decision in the case of
"${title}" which held that contractual obligations must be performed in good faith.

[2] The defendant disputes the applicability of that case, arguing that the facts
are distinguishable. I disagree. The principle in "${title}" applies fully here.

[3] For the above reasons, the plaintiff's claim succeeds.

IT IS HEREBY ORDERED that judgment be entered for the plaintiff.

Signed: JUSTICE SITI J
`;
}

function blankPage(): string {
  return ``;
}

function incompleteCase(n: number): string {
  return `HIGH COURT OF MALAYA AT KUALA LUMPUR

CIVIL SUIT NO. WA-22NCVC-${200 + n}-06/2023

INCOMPLETE PLAINTIFF v. INCOMPLETE DEFENDANT

[2023] MYCA ${200 + n}

CORAM: JUSTICE INCOMPLETE J

JUDGMENT

[1] This judgment concerns a contractual dispute between the parties.

[2] The plaintiff entered into an agreement with the defendant on 1 January 2022.

[3] Unfortunately, the defendant failed to deliver the promised goods on time.

[4] I have considered all the evidence presented before me. The key issue is
whether the plaintiff is entitled to consequential damages in addition to
direct damages for the breach.
`;
  // Note: NO closing order or signature — this is the "incomplete" case
}

// ── Write fixtures ─────────────────────────────────────────────────────────

function write(name: string, content: string, expected: object): void {
  writeFileSync(path.join(FIXTURES_DIR, name), content, "utf8");
  writeFileSync(
    path.join(FIXTURES_DIR, name.replace(/\.txt$/, ".expected.json")),
    JSON.stringify(expected, null, 2),
    "utf8",
  );
  console.log(`✓ ${name}`);
}

// 1. single-case.txt
write(
  "single-case.txt",
  caseHeader(1, 2020),
  {
    candidateCount: 1,
    candidates: [{ startPage: 1, endPage: 1, reviewRequired: false }],
    unassignedPages: [],
    nonCaseMaterialPages: [],
  },
);

// 2. two-case.txt
write(
  "two-case.txt",
  caseHeader(1, 2020) + "\n" + publisherDivider() + "\n" + caseHeader(2, 2021),
  {
    candidateCount: 2,
    candidates: [
      { startPage: 1, endPage: 1, reviewRequired: false },
      { startPage: 2, endPage: 2, reviewRequired: false },
    ],
    unassignedPages: [],
    nonCaseMaterialPages: [],
  },
);

// 3. ten-case.txt — 10 cases
const tenCases = Array.from({ length: 10 }, (_, i) =>
  caseHeader(i + 1, 2015 + i),
).join("\n\n" + publisherDivider() + "\n\n");
write(
  "ten-case.txt",
  tenCases,
  {
    candidateCount: 10,
    candidates: Array.from({ length: 10 }, (_, i) => ({
      startPage: i + 1,
      endPage: i + 1,
      reviewRequired: false,
    })),
    unassignedPages: [],
    nonCaseMaterialPages: [],
  },
);

// 4. thirty-case.txt — stress test with 30 cases
const thirtyCases = Array.from({ length: 30 }, (_, i) =>
  caseHeader(i + 1, 2010 + (i % 10)),
).join("\n\n" + publisherDivider() + "\n\n");
write(
  "thirty-case.txt",
  thirtyCases,
  {
    candidateCount: 30,
    candidates: Array.from({ length: 30 }, (_, i) => ({
      startPage: i + 1,
      endPage: i + 1,
      reviewRequired: false,
    })),
    unassignedPages: [],
    nonCaseMaterialPages: [],
  },
);

// 5. admin-between-cases.txt
write(
  "admin-between-cases.txt",
  caseHeader(1, 2020) + "\n\n" + adminPage() + "\n\n" + caseHeader(2, 2021),
  {
    candidateCount: 2,
    candidates: [
      { startPage: 1, endPage: 1, reviewRequired: false },
      { startPage: 3, endPage: 3, reviewRequired: false },
    ],
    unassignedPages: [],
    nonCaseMaterialPages: [2],
  },
);

// 6. quoted-titles.txt — repeated citation inside quotation should NOT trigger new candidate
const quotedTitle = "[2019] MYCA 42";
write(
  "quoted-titles.txt",
  caseHeader(1, 2020) +
    "\n\n" +
    quotedTitlePage(quotedTitle) +
    "\n\n" +
    caseHeader(3, 2022),
  {
    candidateCount: 2,
    candidates: [
      { startPage: 1, endPage: 1, reviewRequired: false },
      { startPage: 3, endPage: 3, reviewRequired: false },
    ],
    unassignedPages: [],
    nonCaseMaterialPages: [],
    note: "Page 2 is a new case (different citation/parties); quoted title inside page 2 body must NOT create a spurious third candidate",
  },
);

// 7. no-neutral-citation.txt — cases identified only by parties + court
const noNeutralCase = (n: number) => `HIGH COURT OF MALAYA AT KUALA LUMPUR

CIVIL SUIT NO. WA-22NCVC-${300 + n}-${n}/2023

PARTY${n}A SDN BHD v. PARTY${n}B BHD

CORAM: JUSTICE WANGSA J

Delivered: ${n + 10} March 2023

JUDGMENT

[1] This matter concerns a civil dispute.

[2] Having considered all the evidence, I find for the plaintiff.

IT IS HEREBY ORDERED that judgment be entered for the plaintiff with costs.

Signed: JUSTICE WANGSA J
`;
write(
  "no-neutral-citation.txt",
  noNeutralCase(1) + "\n\n" + publisherDivider() + "\n\n" + noNeutralCase(2),
  {
    candidateCount: 2,
    candidates: [
      { startPage: 1, endPage: 1, reviewRequired: false },
      { startPage: 2, endPage: 2, reviewRequired: false },
    ],
    unassignedPages: [],
    nonCaseMaterialPages: [],
  },
);

// 8. page-restart.txt — page number restarts mid-file (two booklets)
const booklet1 = caseHeader(1, 2019);
const booklet2 = `- 1 -

HIGH COURT OF MALAYA AT IPOH

CIVIL SUIT NO. BA-22NCVC-88-01/2023

BOOKLET TWO PLAINTIFF v. BOOKLET TWO DEFENDANT

[2023] MYCA 88

CORAM: JUSTICE BOOKLET J

JUDGMENT

[1] This is the second booklet case.

IT IS HEREBY ORDERED that judgment be entered for the plaintiff.

Signed: JUSTICE BOOKLET J
`;
write(
  "page-restart.txt",
  booklet1 + "\n\n" + booklet2,
  {
    candidateCount: 2,
    candidates: [
      { startPage: 1, endPage: 1, reviewRequired: false },
      { startPage: 2, endPage: 2, reviewRequired: false },
    ],
    unassignedPages: [],
    nonCaseMaterialPages: [],
  },
);

// 9. incomplete-final-case.txt
write(
  "incomplete-final-case.txt",
  caseHeader(1, 2020) + "\n\n" + publisherDivider() + "\n\n" + incompleteCase(1),
  {
    candidateCount: 2,
    candidates: [
      { startPage: 1, endPage: 1, reviewRequired: false },
      { startPage: 2, endPage: 2, reviewRequired: true },
    ],
    unassignedPages: [],
    nonCaseMaterialPages: [],
    note: "Last case has no closing order or signature — its end boundary should route to review",
  },
);

// 10. no-judgment.txt — administrative/index document only
write(
  "no-judgment.txt",
  adminPage(),
  {
    candidateCount: 0,
    candidates: [],
    unassignedPages: [1],
    nonCaseMaterialPages: [1],
    note: "Zero candidates expected; no review required",
  },
);

console.log("\n✅ All segmentation fixtures generated successfully.");
