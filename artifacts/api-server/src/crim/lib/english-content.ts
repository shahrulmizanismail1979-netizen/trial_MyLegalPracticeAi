type SeedRow = Record<string, unknown> & { id: number; title: string };

const causeDirections: Record<number, [string, string, string]> = {
  1: ["sections 152 and 153 of the Criminal Procedure Code", "that the charge be read and explained to the accused and the plea recorded", "state the date, time, place, act or omission, victim or property, and every essential ingredient without duplicity"],
  2: ["sections 388 and 389 of the Criminal Procedure Code", "that the accused be admitted to reasonable bail pending disposal of the charge", "address attendance, interference with witnesses, repetition risk, local ties, health, employment and a suitable surety"],
  3: ["section 311 of the Criminal Procedure Code", "that execution of sentence be stayed and the appellant be admitted to bail pending appeal", "identify the arguable appeal, exceptional circumstances, likely appeal timetable and absence of flight or interference risk"],
  4: ["section 51A of the Criminal Procedure Code", "that the prosecution supply the listed statements and documents within the period directed", "identify each document precisely, explain its relevance and preserve any application arising from late or incomplete disclosure"],
  5: ["section 402A of the Criminal Procedure Code", "that the prosecution take notice that the accused will rely on alibi", "identify the place, material period and witnesses accurately and serve within the statutory period"],
  6: ["the Evidence Act 1950 and applicable case-management directions", "that leave be granted to adduce the identified expert evidence", "set out the expert's discipline, qualifications, issues addressed, report served and availability for cross-examination"],
  7: ["sections 173(f) or 180 of the Criminal Procedure Code, as applicable", "that the accused be acquitted and discharged at the close of the prosecution case", "test every ingredient by maximum evaluation, identify evidential gaps, material contradictions and failures in identification or chain of custody"],
  8: ["sections 24 to 27 of the Evidence Act 1950", "that a trial within a trial be held and the impugned statement excluded", "particularise any inducement, threat, promise or oppression and require the prosecution to prove voluntariness beyond reasonable doubt"],
  9: ["sections 145 and 155 of the Evidence Act 1950", "that the witness's credit be impeached in accordance with the prescribed procedure", "identify the prior statement, direct the witness to the relevant passage, establish the contradiction and tender proof only after an opportunity to explain"],
  10: ["section 425 of the Criminal Procedure Code", "that the identified witness be recalled for limited further examination", "explain why recall is essential to a just decision, the questions proposed, why they were not asked earlier and why no unfair prejudice arises"],
  11: ["the court's sentencing jurisdiction and governing sentencing principles", "that a proportionate sentence at the lowest appropriate end be imposed", "address the plea, remorse, antecedents, cooperation, restitution, dependants, health, rehabilitation, parity, totality and comparable cases"],
  12: ["section 307 of the Criminal Procedure Code", "that notice be recorded of the appeal against conviction, sentence or both", "identify the decision, date, court, case number, appellant and precise extent of the appeal and file within time"],
  13: ["section 307(iii) of the Criminal Procedure Code", "that the conviction be quashed, an acquittal entered, a retrial ordered, or the sentence varied as justice requires", "state separate numbered grounds identifying errors of law, fact, direction, admissibility, procedural fairness or sentence without arguing evidence in the ground itself"],
  14: ["sections 323 to 325 of the Criminal Procedure Code", "that the record be called for and the impugned order corrected in revision", "identify illegality, impropriety, incorrectness or material irregularity and explain why revision, rather than appeal, is properly invoked"],
  15: ["Article 5(2) of the Federal Constitution and the court's habeas corpus jurisdiction", "that the detainee be produced immediately and released unless lawful detention is established", "identify the custodian, place and chronology of detention, challenged statutory power, non-compliance and absence of lawful justification"],
  16: ["section 413 of the Criminal Procedure Code and the court's control over exhibits", "that the specified property be returned to its lawful owner subject to appropriate safeguards", "prove ownership, identify the seizure and exhibit references, explain why retention is no longer required and offer preservation or production undertakings"],
  17: ["the Security Offences (Special Measures) Act 2012 and the applicable substantive security law", "that detention and charging decisions be reviewed and every available lawful release order made", "separate SOSMA procedure from the underlying offence, verify notice and access rights, challenge non-compliance and address the statutory bail position precisely"],
  18: ["the Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001", "that the seizure be revoked, property released, or forfeiture refused", "trace legitimate ownership and funds, challenge nexus and proportionality, answer the statutory presumptions and exhibit banking and commercial records"],
  19: ["the Malaysian Anti-Corruption Commission Act 2009 and Criminal Procedure Code", "that reasonable bail be granted and the charge or proposed prosecution be reconsidered", "analyse gratification, corrupt intent, agent-principal relationship, statutory presumptions, documentary trail, cooperation and non-interference safeguards"],
  20: ["the Sexual Offences Against Children Act 2017 and applicable special evidence provisions", "that the charge and evidential applications be determined with all statutory safeguards observed", "protect the child while preserving a fair trial; test age, prohibited conduct, identity, digital continuity, special witness arrangements and restrictions on publication"],
  21: ["the Firearms (Increased Penalties) Act 1971 and Arms Act 1960", "that the charge be dismissed or the legally appropriate verdict and sentence be entered", "test the exact weapon and offence, possession or use, knowledge, common intention, forensic continuity and any reverse-onus provision strictly"],
  22: ["the Immigration Act 1959/63 and applicable regulations", "that the charge be withdrawn, compounded where lawful, or disposed of proportionately", "verify status records, entry and permit history, identity, knowledge, employer responsibility, statutory presumptions and mitigation"],
  23: ["the Customs Act 1967", "that the charge or forfeiture be withdrawn, compounded where lawful, or otherwise determined according to proof", "identify goods, tariff and duty, prove custody and valuation, test knowledge and fraudulent intent, and address statutory compounding separately"],
  24: ["sections 41 and 45A of the Road Transport Act 1987, as applicable", "that the accused be acquitted or receive a proportionate sentence and disqualification order", "distinguish dangerous from careless driving, reconstruct road conditions and causation, and scrutinise specimen, instrument, operator and statutory compliance evidence"],
  25: ["the Child Act 2001 and the Criminal Procedure Code", "that the Court for Children adopt a lawful, welfare-sensitive and rehabilitative disposal", "verify age and court constitution, guardian attendance, privacy, explanation of charge, probation report, diversion, rehabilitation and detention as a last resort"],
};

function causeBody(row: SeedRow): string {
  const [basis, prayer, focus] = causeDirections[row.id];
  return `IN THE [MAGISTRATES' / SESSIONS / HIGH] COURT OF MALAYA AT [PLACE]
CRIMINAL CASE / APPLICATION NO.: [NUMBER]

PUBLIC PROSECUTOR
… PROSECUTION / RESPONDENT

AND

[FULL NAME OF ACCUSED / APPLICANT]
… ACCUSED / APPLICANT

${row.title.toUpperCase()}

NOTICE / APPLICATION

TAKE NOTICE that the Accused/Applicant applies under ${basis} for an order ${prayer}, together with any consequential order that this Honourable Court considers just.

GROUNDS

1. The relevant charge, decision or investigative action is dated [date] and concerns [brief, neutral particulars].
2. This Court has jurisdiction because [state territorial, subject-matter and statutory basis].
3. The material chronology is:
   (a) [date and event];
   (b) [date and event]; and
   (c) [date and event].
4. The supporting facts are verified by [the attached affidavit / the court record / exhibits marked A–__].
5. In particular, the Court is respectfully invited to ${focus}.
6. The application is made promptly and in good faith. Any delay of [period] arose because [full explanation].
7. The order sought causes no irremediable prejudice. Any legitimate concern may be met by [proposed condition or direction].

RELIEF

The Accused/Applicant respectfully asks for:
(a) ${prayer};
(b) such timetable, service or preservation directions as are necessary; and
(c) any further order that this Honourable Court considers just.

Dated: [date]

........................................
Solicitor for the Accused/Applicant
[firm, address, email and telephone]

SUPPORTING AFFIDAVIT / RECORD

I, [name, identification number and address], solemnly affirm that:
1. I am [the applicant / solicitor with conduct] and am authorised to affirm this affidavit.
2. Unless otherwise stated, the facts are within my knowledge. Matters from the file are true to the best of my information and belief, and their sources are identified.
3. Exhibited as [A] is [document]. Exhibited as [B] is [document].
4. The chronology and grounds in the application are true. I seek the relief stated above.

Affirmed at [place] on [date] before a Commissioner for Oaths.

PRACTICE NOTE
Adapt the originating process, parties, affidavit and service requirements to the court and statute actually engaged. Verify current legislation, practice directions, filing time limits and authorities before filing. Replace every bracketed instruction; do not plead unsupported facts.`;
}

const sampleSections: Record<number, string[]> = {
  1: ["Client authority and scope", "I appoint [firm/lawyer] to advise and represent me in [matter].", "The lawyer may inspect the court file, correspond, receive documents and appear, but may not compromise or change my plea without my express instructions.", "This authority remains effective until concluded or revoked in writing."],
  2: ["Attendance particulars", "Record date, time, place, attendees, interpreter and custody status.", "Record the client's account in the client's own words; separate fact, inference and advice.", "List urgent limitation, remand, bail, disclosure, evidence-preservation and conflict-check actions."],
  3: ["Engagement terms", "Define the charge, court and work included, responsible lawyer and exclusions.", "State professional fees, service tax, disbursements, trust-money arrangements and billing stages transparently.", "Explain cooperation, confidentiality, termination, document retention, complaints and that no outcome is guaranteed."],
  4: ["Representation to the Public Prosecutor", "Identify the investigation or charge and the statutory ingredients objectively.", "Set out the supported factual and legal reasons for no further action, withdrawal, reduction or lawful alternative disposal.", "Index every enclosure, preserve privilege, request written consideration and avoid any improper contact with witnesses."],
  5: ["Written submission at close of defence", "State the issues and burden: the prosecution must prove every ingredient beyond reasonable doubt.", "Analyse agreed facts, disputed ingredients, witness reliability, exhibits, defence evidence and applicable authorities issue by issue.", "Conclude with the precise verdict sought; distinguish evidential gaps from minor discrepancies."],
  6: ["Sentencing submissions", "Set out the lawful range and aggravating factors fairly.", "For the defence, address plea, antecedents, remorse, restitution, personal circumstances, rehabilitation, parity and totality with documents.", "For the prosecution, address harm, culpability, prevalence, victim impact and consistency without seeking a crushing sentence."],
  7: ["Appeal submission", "Identify jurisdiction, decision, procedural history and the numbered grounds pursued.", "For each ground state the standard of appellate intervention, material record references, error and resulting miscarriage or sentencing impact.", "State the exact appellate order sought and provide a chronology and properly paginated authorities."],
  8: ["Cross-examination plan", "For each witness identify the proposition, supporting source, necessary admissions and risk.", "Use short leading questions, one fact at a time; put the defence case fairly and preserve impeachment procedure.", "Record answers and exhibit references. Do not ask a question without a forensic purpose or known risk."],
  9: ["Bail oral submissions", "Identify the statutory bail position and acknowledge the court's discretion.", "Address attendance, local ties, antecedents, witness interference, reoffending, health, delay and strength of evidence without conducting a mini-trial.", "Offer proportionate conditions, identified surety and passport/reporting arrangements; state why unaffordable bail would defeat release."],
  10: ["Defence witness schedule", "Record full contact details confidentially, relevance, facts personally observed and documents the witness can authenticate.", "Prepare a neutral will-say summary, availability and interpreter or protection needs.", "Do not coach evidence; preserve prior accounts and disclose only as law and strategy require."],
  11: ["Confidential advice on plea", "Explain the charge, each ingredient, prosecution material, available defence and unresolved disclosure.", "Compare trial risks and sentencing consequences of guilty and not-guilty pleas, including credit for an early plea without promising a fixed discount.", "Record that the plea is the client's voluntary and informed decision and identify further instructions."],
  12: ["Trial-readiness checklist", "Confirm section 51A material, witness statements, alibi and expert notices, admissibility objections and agreed facts.", "Confirm witness conferences, subpoenas, exhibit continuity, defence theory and cross-examination plans.", "Confirm bundles, authorities, skeleton submissions, client advice, attendance, interpreters, accessibility and all court directions."],
  13: ["First appearance and remand checklist", "Verify arrest time, grounds, access to counsel, treatment, medical needs and the investigation steps said to require remand.", "At charge, check identity, language, understanding, particulars, jurisdiction and bail status before advice on plea.", "Prepare surety and bail documents, request disclosure, diary the next date and give written advice on conditions and preservation of evidence."],
};

function sampleBody(row: SeedRow): string {
  const [heading, ...clauses] = sampleSections[row.id];
  return `${row.title.toUpperCase()}

Matter: [client / court / case number]
Date: [date]
Prepared by: [lawyer]
Privileged and confidential where applicable

${heading.toUpperCase()}

1. ${clauses[0]}

2. ${clauses[1]}

3. ${clauses[2]}

CASE-SPECIFIC DETAILS

Relevant chronology:
• [date] — [event and source]
• [date] — [event and source]
• [date] — [event and source]

Key persons and contact details: [insert]
Key documents / exhibits and page references: [insert]
Applicable statutory provisions and current authorities: [insert after verification]
Outstanding factual or disclosure questions: [insert]
Next action, responsible person and deadline: [insert]

CONFIRMATION / SIGNATURE

I confirm that this document accurately records my instructions / professional work (as applicable), subject to the qualifications stated above.

Signed: ____________________  Name: [name]  Date: [date]

PRACTICE NOTE
Delete inapplicable alternatives and replace every bracketed prompt. Verify the current statute, court directions, filing and service requirements. Keep factual assertions supported by instructions or the record, and keep legal advice and non-privileged correspondence in the correct separate form.`;
}

export function englishCausePaper(row: SeedRow) {
  return {
    title: row.title.replace(/\s*\([^)]*(?:Rayuan|Surat|Hujahan)[^)]*\)/gi, ""),
    court: row.court,
    category: row.category,
    description: `${row.description} Complete English-language drafting precedent for Malaysian criminal practice.`,
    templateContent: causeBody(row),
    language: "en",
    sourceId: row.id,
    stableKey: `crim-cause-paper-${row.id}-en`,
  };
}

export function englishSampleDocument(row: SeedRow) {
  return {
    title: row.title.replace(/\s*\([^)]*(?:Surat|Nota|Hujahan|Senarai|Pelan|Nasihat)[^)]*\)/gi, ""),
    documentType: row.document_type,
    category: row.category,
    description: `${row.description} Complete English-language working document for Malaysian criminal practice.`,
    content: sampleBody(row),
    language: "en",
    sourceId: row.id,
    stableKey: `crim-sample-document-${row.id}-en`,
  };
}