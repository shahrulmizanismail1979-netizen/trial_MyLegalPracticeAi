/**
 * Affidavits & supporting-document library for Malaysian civil litigation
 * (banking-recovery focus).
 *
 * These are the deposition-based and ancillary documents a practitioner drafts
 * repeatedly alongside the core cause papers: affidavits in support / reply /
 * opposition, supplementary affidavits, affidavits verifying documents,
 * affidavits of service, and a few supporting instruments (notice of demand,
 * certificate of urgency).
 *
 * PRACTITIONER CAVEAT: affidavit form and the rules governing them (jurat,
 * attestation, exhibit marking, who may depose, filing sequence) are governed by
 * the Rules of Court 2012 and the practice of the relevant registry. Order
 * numbers below are marked for verification — confirm the current rule and the
 * registry's practice before settling and filing.
 */

export type DocCategory = "affidavit" | "supporting";

export interface AffidavitField {
  /** machine key sent back in the draft request */
  key: string;
  label: string;
  /** rendered as a textarea when true, otherwise a single-line input */
  long?: boolean;
  placeholder?: string;
}

export interface AffidavitType {
  id: string;
  name: string;
  category: DocCategory;
  /** governing provision / rule, with [VERIFY] where the number must be confirmed */
  basis: string;
  description: string;
  /** when a practitioner would reach for this document */
  whenToUse: string;
  /** true if the document ordinarily refers to and exhibits documents */
  hasExhibits: boolean;
  /** drafting traps specific to this document */
  caveats: string[];
}

/**
 * Field set shared by every document. The page renders the same form for all
 * types; blank fields become [PLACEHOLDER] in the draft.
 */
export const AFFIDAVIT_FIELDS: AffidavitField[] = [
  {
    key: "court",
    label: "Court / registry & suit no.",
    placeholder: "e.g. High Court of Malaya at Kuala Lumpur, Suit No. WA-22NCC-___-___/2026",
  },
  {
    key: "parties",
    label: "Parties",
    placeholder: "e.g. ABC Bank Bhd (Plaintiff) v. XYZ Sdn Bhd & Anor (Defendants)",
  },
  {
    key: "deponent",
    label: "Deponent — name, NRIC/passport & capacity",
    placeholder: "e.g. Tan Ah Kow (NRIC 800101-14-5555), authorised officer of the Plaintiff",
  },
  {
    key: "context",
    label: "Application / matter this document relates to",
    placeholder: "e.g. In support of the Plaintiff's O.14 application for summary judgment",
  },
  {
    key: "facts",
    label: "Facts / substance to depose to",
    long: true,
    placeholder:
      "Facility & letter of offer, drawdown, default, demand served, amount outstanding, security, basis of the application…",
  },
  {
    key: "exhibits",
    label: "Exhibits to refer to (one per line)",
    long: true,
    placeholder:
      "Letter of offer dated …\nStatement of account as at …\nLetter of demand dated …",
  },
  {
    key: "additionalDetails",
    label: "Additional details (optional)",
    long: true,
    placeholder: "Anything else the document should reflect",
  },
];

export const AFFIDAVIT_TYPES: AffidavitType[] = [
  {
    id: "affidavit_in_support",
    name: "Affidavit in Support",
    category: "affidavit",
    basis: "Rules of Court 2012, O.41 [VERIFY]",
    description:
      "Deposes to the facts relied on for an interlocutory application (e.g. O.14 summary judgment, an injunction, an O.83 originating summons for order for sale) and exhibits the supporting documents.",
    whenToUse:
      "Filed with almost every application or originating summons to put the supporting evidence before the court.",
    hasExhibits: true,
    caveats: [
      "Depose only to facts within the deponent's own knowledge; sources and grounds of belief must be stated for anything not within personal knowledge [VERIFY O.41 r.5].",
      "An authorised officer of a bank must state the source of authority and that the facts are gleaned from the records kept in the ordinary course of business.",
      "Mark and refer to every exhibit correctly; an exhibit not properly produced may be disregarded.",
    ],
  },
  {
    id: "affidavit_in_reply",
    name: "Affidavit in Reply",
    category: "affidavit",
    basis: "Rules of Court 2012, O.41 [VERIFY]",
    description:
      "Answers the matters raised in the opposing party's affidavit, confined to matters strictly in reply rather than new grounds.",
    whenToUse:
      "Filed after an affidavit in opposition to meet the points taken, before the application is heard.",
    hasExhibits: true,
    caveats: [
      "Keep it in reply — do not introduce a fresh case that should have been in the affidavit in support.",
      "Address each material allegation; matters not denied may be taken as admitted.",
    ],
  },
  {
    id: "affidavit_in_opposition",
    name: "Affidavit in Opposition / Reply (Defendant)",
    category: "affidavit",
    basis: "Rules of Court 2012, O.41 / O.14 r.4 [VERIFY]",
    description:
      "The defendant's affidavit resisting the application — e.g. showing a triable issue or a bona fide defence to defeat O.14 summary judgment.",
    whenToUse:
      "Filed by the party resisting an application or summary judgment to raise the issues warranting a full trial.",
    hasExhibits: true,
    caveats: [
      "To resist O.14, condescend to particulars of the triable issue — bare denials are insufficient.",
      "Exhibit the documents that evidence the defence (e.g. variation, settlement, dispute on quantum).",
    ],
  },
  {
    id: "supplementary_affidavit",
    name: "Supplementary Affidavit",
    category: "affidavit",
    basis: "Rules of Court 2012, O.41 [VERIFY] (leave may be required)",
    description:
      "Puts further evidence before the court after the principal affidavit, e.g. an updated statement of account or a document omitted earlier.",
    whenToUse:
      "When fresh or corrective evidence is needed after the supporting/opposition affidavits have been filed.",
    hasExhibits: true,
    caveats: [
      "The court's leave may be required to file further affidavits — confirm and seek leave if so [VERIFY].",
      "Explain why the evidence was not in the earlier affidavit.",
    ],
  },
  {
    id: "affidavit_verifying_documents",
    name: "Affidavit Verifying List of Documents",
    category: "affidavit",
    basis: "Rules of Court 2012, O.24 [VERIFY]",
    description:
      "Verifies the party's list of documents on discovery, confirming the documents that are or have been in the party's possession, custody or power.",
    whenToUse: "On discovery, to verify the list of documents served.",
    hasExhibits: false,
    caveats: [
      "Claims to privilege/withholding must be properly identified.",
      "The deponent must have authority to verify on the party's behalf.",
    ],
  },
  {
    id: "affidavit_of_service",
    name: "Affidavit of Service",
    category: "affidavit",
    basis: "Rules of Court 2012, O.62 [VERIFY]",
    description:
      "Proves service of the cause papers — the date, time, mode and place of service and on whom effected.",
    whenToUse:
      "After serving cause papers (e.g. writ, notice, sealed order, bankruptcy notice) to put proof of service on the file.",
    hasExhibits: true,
    caveats: [
      "State the precise mode of service and exhibit the AR card / acknowledgement / process server's endorsement.",
      "For personal service, the deponent should be the person who effected service.",
    ],
  },
  {
    id: "affidavit_verifying_translation",
    name: "Affidavit Verifying Translation",
    category: "affidavit",
    basis: "Rules of Court 2012 [VERIFY] / registry practice",
    description:
      "Verifies that a translation of a non-English document exhibited in the proceedings is true and accurate.",
    whenToUse:
      "When documents not in the language of the court are exhibited and a certified translation is required.",
    hasExhibits: true,
    caveats: [
      "The translator's competence and the exhibits (original + translation) must be identified.",
      "Confirm the registry's requirement for certified translations.",
    ],
  },
  {
    id: "notice_of_demand",
    name: "Notice / Letter of Demand",
    category: "supporting",
    basis: "Contractual / pre-action requirement [VERIFY facility terms]",
    description:
      "The pre-action demand requiring payment of the outstanding sum within a stated period, a usual precondition before recovery proceedings.",
    whenToUse:
      "Before commencing recovery — to make demand, fix the default and start time running where the facility requires it.",
    hasExhibits: false,
    caveats: [
      "Reflect the exact contractual notice period and mode of service required by the facility documents.",
      "State the precise sum, the facility, the default and the consequence of non-payment.",
    ],
  },
  {
    id: "certificate_of_urgency",
    name: "Certificate of Urgency",
    category: "supporting",
    basis: "Registry practice / practice direction [VERIFY]",
    description:
      "Certifies the grounds of urgency to obtain an early hearing date for an urgent application (e.g. an injunction).",
    whenToUse: "Filed with urgent applications to justify expedited listing.",
    hasExhibits: false,
    caveats: [
      "State concrete grounds of urgency — generalities will not secure an early date.",
      "Confirm the registry's current form and filing requirement.",
    ],
  },
];

export function findAffidavitType(id: string): AffidavitType | undefined {
  return AFFIDAVIT_TYPES.find((a) => a.id === id);
}
