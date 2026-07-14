export const TOOL_EXAMPLES: Record<string, { example: Record<string, string>; sampleNote: string }> = {
  "statement-of-claim": {
    sampleNote: "Sample: minority shareholder oppression claim against a Sdn Bhd.",
    example: {
      caseType: "Oppression of Minority Shareholders",
      claimant: "GREENWAVE CAPITAL SDN BHD (Company No. 201601012345 (1234567-A)), a company incorporated in Malaysia under the Companies Act 2016, having its registered address at Suite 12-3, Menara KLK, No. 1 Jalan PJU 7/6, Mutiara Damansara, 47810 Petaling Jaya, Selangor.",
      defendant: "1st Defendant: TAN AH KOW (NRIC No. 720101-14-5555), an adult Malaysian, of No. 88, Jalan Ampang Hilir, 55000 Kuala Lumpur (Managing Director and majority shareholder).\n2nd Defendant: SUNRISE TRADING SDN BHD (Company No. 201001033456 (912345-K)), a company incorporated in Malaysia, having its registered address at Lot 5, Jalan SS 15/4, 47500 Subang Jaya, Selangor.",
      facts: "1. The Claimant holds 30% of the issued share capital of the 2nd Defendant.\n2. From January 2023 onwards, the 1st Defendant excluded the Claimant from board meetings, withheld financial information, and diverted RM 4.2 million in company funds to a related entity (Sunrise Holdings Sdn Bhd) controlled by the 1st Defendant.\n3. On 15 March 2024, the 1st Defendant procured a board resolution to issue 1,000,000 new shares to himself at par value, diluting the Claimant's stake from 30% to 12%.\n4. Demand letters dated 22 April 2024 and 10 June 2024 went unanswered.",
      reliefSought: "(a) A declaration that the affairs of the 2nd Defendant have been conducted in a manner oppressive to the Claimant under s.346 of the Companies Act 2016;\n(b) An order that the 1st Defendant purchase the Claimant's shares at fair value to be determined by an independent valuer;\n(c) An order setting aside the share issuance dated 15 March 2024;\n(d) An account of the RM 4.2 million diverted funds, with interest;\n(e) Costs;\n(f) Such further or other relief as this Honourable Court deems fit."
    }
  },
  "written-submission": {
    sampleNote: "Sample: trial submission for plaintiff in a breach of contract suit.",
    example: {
      applicationType: "Trial Submission",
      partyRepresented: "Plaintiff",
      factsBackground: "The Plaintiff and Defendant entered into a Distribution Agreement dated 1 February 2022 under which the Plaintiff was appointed exclusive distributor of the Defendant's industrial pumps in Peninsular Malaysia for 5 years. On 30 June 2023, the Defendant unilaterally terminated the Agreement, citing alleged underperformance. The Plaintiff claims wrongful termination and seeks damages of RM 8.5 million for loss of profits.",
      issuesForDetermination: "1. Whether the Defendant's termination on 30 June 2023 was lawful under Clause 14 of the Distribution Agreement.\n2. Whether the Plaintiff was in material breach justifying termination.\n3. The quantum of damages, if any, payable by the Defendant.\n4. Whether the Plaintiff's claim for loss of profits is too remote.",
      arguments: "1. Clause 14 required 90 days' written notice and an opportunity to cure — neither was given.\n2. The Defendant's own internal emails (P5 and P6) confirm the Plaintiff exceeded sales targets in 2022.\n3. Loss of profits was within reasonable contemplation per Hadley v Baxendale, applied in Bandar Builder Sdn Bhd v United Malayan Banking Corp Bhd [1993] 3 MLJ 36.\n4. Mitigation is not in issue — the Defendant adduced no evidence on it."
    }
  },
  "affidavit-drafter": {
    sampleNote: "Sample: affidavit in support of summary judgment application.",
    example: {
      affidavitType: "Affidavit in Support",
      deponent: "LIM SIEW MEI (NRIC No. 850315-08-5678), an adult Malaysian, Finance Director of the Plaintiff, of No. 22, Jalan Bukit Bintang, 55100 Kuala Lumpur.",
      caseReference: "Suit No. WA-22NCC-456-08/2024",
      facts: "1. I am the Finance Director of the Plaintiff and am duly authorised to affirm this affidavit on its behalf.\n2. The facts deposed herein are within my personal knowledge save where otherwise stated.\n3. On 15 January 2023, the Plaintiff and the Defendant entered into a Loan Agreement (LIM-1) under which the Plaintiff advanced RM 2,000,000 to the Defendant repayable on 14 January 2024.\n4. The Defendant has paid only RM 200,000 in interest and has failed to repay the principal despite demand letters dated 20 January 2024 and 10 February 2024 (LIM-2 and LIM-3).\n5. The Defendant has raised no bona fide defence and the matter is plainly suitable for summary judgment under O.14 of the Rules of Court 2012."
    }
  },
  "legal-opinion": {
    sampleNote: "Sample: opinion on enforceability of a foreign arbitral award in Malaysia.",
    example: {
      clientName: "Stellar Logistics International Pte Ltd",
      subject: "Enforceability in Malaysia of an SIAC arbitral award dated 12 March 2024 against Maju Cargo Sdn Bhd",
      background: "The Client obtained a final SIAC award in Singapore on 12 March 2024 for USD 3.8 million plus interest and costs against Maju Cargo Sdn Bhd, a Malaysian company. Maju Cargo did not participate in the arbitration despite proper notice. The Client now seeks to enforce in Malaysia, where Maju Cargo holds real property and bank accounts.",
      questionsOfLaw: "1. Is the SIAC award enforceable in Malaysia under the Arbitration Act 2005?\n2. What grounds (if any) might Maju Cargo raise to resist enforcement?\n3. What is the likely timeline and cost of enforcement proceedings?\n4. Should the Client first apply for a Mareva injunction to preserve assets?"
    }
  },
  "demand-letter": {
    sampleNote: "Sample: demand for payment of an outstanding invoice.",
    example: {
      senderDetails: "Messrs. Aziz, Krishnan & Partners\nAdvocates & Solicitors\nLevel 18, Menara Maxis, KLCC\n50088 Kuala Lumpur\nTel: 03-2161 8888\nOur Ref: AKP/CIV/2026/0145",
      recipientDetails: "Mega Construction Sdn Bhd\n(Company No. 201501023456)\nNo. 5, Jalan Industri 3/5\nTaman Perindustrian Puchong\n47100 Puchong, Selangor",
      demandType: "Payment of Debt",
      amount: "RM 487,650.00",
      background: "Our client, BUILDPRO SUPPLIES SDN BHD, supplied building materials to your company between January 2025 and March 2025 against Invoice Nos. 2501-INV-0102, 2502-INV-0210, and 2503-INV-0345. Despite repeated reminders dated 10 April 2025, 5 May 2025 and 1 June 2025, the sum of RM 487,650.00 remains unpaid.",
      deadline: "14 days from the date of this letter"
    }
  },
  "contract-review": {
    sampleNote: "Sample: review of a Sale & Purchase Agreement from the buyer's perspective.",
    example: {
      contractType: "Sale & Purchase Agreement",
      partyRepresented: "Buyer",
      keyClauses: "Clause 5 (Purchase Price): RM 12,000,000 payable as 10% deposit, 90% on completion within 90 days.\nClause 8 (Conditions Precedent): subject to (a) bank financing, (b) regulatory approvals, (c) no material adverse change.\nClause 12 (Warranties): standard title warranties, no environmental warranties, no warranty as to tenancy income.\nClause 18 (Default): if Buyer defaults, deposit forfeited; if Seller defaults, deposit refundable only (no specific performance).\nClause 22 (Dispute Resolution): Malaysian courts, no arbitration option.",
      concerns: "Concerned about (a) absence of environmental warranties given the property's industrial history, (b) one-sided default clause favouring the Seller, (c) tight 90-day completion window given current bank loan turnaround times."
    }
  },
  "defence-counterclaim": {
    sampleNote: "Sample: defence to a debt recovery claim with counterclaim for set-off.",
    example: {
      claimSummary: "The Plaintiff (a supplier) claims RM 850,000 for goods sold and delivered between February and August 2024. The Plaintiff sues on 12 unpaid invoices.",
      defenceGrounds: "1. The goods supplied under Invoices 2406-INV-088 and 2407-INV-101 (totaling RM 320,000) were defective and rejected within 7 days as permitted under the Supply Agreement dated 1 February 2024.\n2. The Plaintiff failed to meet delivery deadlines on 5 occasions, causing the Defendant to incur additional storage and substitute purchase costs of RM 180,000.\n3. The Defendant validly exercised its right of set-off under Clause 9 of the Supply Agreement.\n4. The Plaintiff's claim is therefore overstated by RM 500,000.",
      hasCounterclaim: "Yes",
      counterclaimFacts: "The Defendant counterclaims for: (a) RM 180,000 being the additional cost of substitute purchases; (b) RM 75,000 being lost profits from production delays; (c) interest at 8% per annum; (d) costs."
    }
  },
  "injunction-application": {
    sampleNote: "Sample: Mareva injunction to freeze a defendant's assets pending trial.",
    example: {
      injunctionType: "Mareva Injunction (Freezing Order)",
      applicantDetails: "PRIMA BANKING BERHAD, a licensed commercial bank under the Financial Services Act 2013, having its head office at Menara Prima Bank, Jalan Sultan Ismail, 50250 Kuala Lumpur.",
      respondentDetails: "DATO' RAJA ZULKIFLI BIN ABDULLAH (NRIC No. 660520-10-5432), of No. 28, Jalan Bukit Tunku, 50480 Kuala Lumpur, and EVERGREEN VENTURES SDN BHD (Company No. 201801045678).",
      grounds: "(a) There is a good arguable case that the Respondents fraudulently obtained banking facilities of RM 28,000,000 by submitting falsified financial statements (exhibited as PB-3 and PB-4).\n(b) The Respondents have begun transferring assets — RM 5.2 million was wired to a Singapore account on 14 April 2026 (PB-7) and a Damansara Heights bungalow has been listed for urgent sale (PB-8).\n(c) There is a real risk of dissipation that would render any judgment nugatory.\n(d) The Plaintiff undertakes as to damages and offers fortification by way of bank guarantee."
    }
  },
  "banking-recovery": {
    sampleNote: "Sample: recovery strategy for a defaulted term loan secured by a land charge.",
    example: {
      facilityType: "Term Loan",
      securityHeld: "First-party legal charge over Lot 5678, Mukim Petaling, Daerah Petaling, Selangor (factory property valued at RM 4.5 million in 2023). Personal guarantees from 2 directors. Debenture over all assets of the borrower company.",
      defaultAmount: "RM 3,250,000.00 (principal) plus RM 287,000 accrued interest as at 31 March 2026",
      borrowerDetails: "STAR PRECISION ENGINEERING SDN BHD (Company No. 201201034567), an active Sdn Bhd in the precision engineering business. The company has ceased operations as of February 2026.",
      recoveryAction: "Foreclosure"
    }
  },
  "winding-up-petition": {
    sampleNote: "Sample: winding up petition by an unpaid trade creditor under s.466 CA 2016.",
    example: {
      petitionerDetails: "FAST SUPPLY HOLDINGS SDN BHD (Company No. 201501067890), a creditor in the sum of RM 750,000, having its registered office at Suite 8.02, Wisma Goldhill, 67 Jalan Raja Chulan, 50200 Kuala Lumpur.",
      companyDetails: "BANTAH RETAIL SDN BHD (Company No. 201801087654), a private company limited by shares incorporated in Malaysia, having its registered office at Unit 3-15-A, Pusat Perdagangan Bandar, Persiaran Jalil 1, 57000 Kuala Lumpur.",
      debtAmount: "RM 750,000.00",
      groundsForPetition: "Unable to Pay Debts (s.466)",
      statutoryDemandServed: "Yes - 21 days expired"
    }
  },
  "guarantee-enforcement": {
    sampleNote: "Sample: enforcing a personal guarantee after principal debtor's default.",
    example: {
      guaranteeType: "Personal Guarantee",
      guaranteeDetails: "Personal Guarantee dated 18 May 2021 executed by Mr. Wong Kar Wai (NRIC 700815-14-2233) in favour of Maybank Berhad, capped at RM 5,000,000, securing all obligations of Wong Trading Sdn Bhd under a revolving credit facility. The guarantee is continuing and 'all monies' in nature.",
      defaultDetails: "Wong Trading Sdn Bhd defaulted on the facility on 15 January 2026. As at 1 April 2026, the principal debt is RM 3,800,000 plus interest. The company entered judicial management on 28 February 2026.",
      defencesRaised: "The guarantor's solicitors have indicated they will argue: (1) the guarantee was discharged by a material variation when the bank increased the facility limit from RM 3M to RM 5M on 12 March 2023 without his consent; (2) the bank failed to inform him of the company's deteriorating financial position from late 2024."
    }
  },
  "case-research": {
    sampleNote: "Sample: research on liability of nominee directors under s.217 CA 2016.",
    example: {
      legalIssue: "What is the scope of liability of a nominee director under s.217 of the Companies Act 2016, particularly where the nominee acts on instructions of the appointor in a manner that prejudices the company or minority shareholders?",
      jurisdiction: "Malaysia & Common Law (UK, Singapore, Australia)",
      specificAct: "Companies Act 2016, ss.213, 217, 218"
    }
  },
  "litigation-risk": {
    sampleNote: "Sample: risk assessment for a defendant in a fraudulent misrepresentation claim.",
    example: {
      caseOverview: "The Plaintiff (a private investor) alleges that the Defendant (our client, a property developer) fraudulently misrepresented projected rental yields of 12% p.a. on a serviced apartment investment. Actual yields have averaged 3.5%. The Plaintiff invested RM 2.8 million across 4 units in 2022. Suit was filed in March 2026 in the Kuala Lumpur High Court.",
      clientPosition: "Defendant/Respondent",
      evidence: "(a) Marketing brochures clearly marked 'projected/indicative figures only — past performance not indicative of future returns'; (b) Sale & Purchase Agreement signed by the Plaintiff containing entire-agreement and no-reliance clauses; (c) Internal feasibility study showing the 12% figure was based on full-occupancy assumption explained at the launch event; (d) WhatsApp messages from the Plaintiff acknowledging market risk.",
      opposingCase: "The Plaintiff alleges oral assurances from a senior salesperson that 12% was guaranteed for 3 years. The salesperson has since left the company and may be a hostile witness. The Plaintiff has emails from this salesperson but they post-date the SPA."
    }
  },
  "costs-calculator": {
    sampleNote: "Sample: cost estimate for a moderate-complexity High Court suit.",
    example: {
      caseType: "High Court Suit",
      claimAmount: "2500000",
      complexity: "Moderate",
      stage: "Filing to Close of Pleadings"
    }
  },
  "legal-memo": {
    sampleNote: "Sample: internal memo on a minority oppression claim.",
    example: {
      to: "Senior Partner, Corporate Litigation",
      from: "Aishah binti Rahman, Senior Associate",
      subject: "Preliminary analysis of oppression claim by Mr. Chen against Pacific Holdings Sdn Bhd under s.346 Companies Act 2016",
      issues: "1. Whether the dilutive share issuance to the majority shareholder constitutes 'commercially unfair' conduct.\n2. Whether removal of Mr. Chen as a director (contrary to a quasi-partnership understanding) is actionable.\n3. The appropriate remedy: buy-out order vs winding up on just and equitable grounds.\n4. Limitation issues given some conduct dates back to 2019.",
      relevantFacts: "Mr. Chen, a 25% shareholder and founding director of Pacific Holdings, was removed as director on 12 January 2024 by majority resolution. Two months earlier, the majority shareholder had procured a private placement of new shares to himself, diluting Mr. Chen from 33% to 25%. Pacific Holdings was originally formed in 2010 as a 3-way partnership with mutual understanding that all founders would remain as directors."
    }
  },
  "securities-claim": {
    sampleNote: "Sample: defence of a director in a misleading prospectus claim.",
    example: {
      claimType: "False/Misleading Statements (s.178 CMSA)",
      securityType: "Listed Shares",
      factualBackground: "Our client was a non-executive independent director of TechVision Bhd at the time of its 2023 IPO. The prospectus included revenue projections of RM 180M for FY2024. Actual revenue was RM 92M. The Securities Commission has commenced investigation. Several investors have signaled intention to sue. Our client relied on management representations and a Big-4 accounting firm's review of the financial forecast. He attended all 7 board meetings and asked appropriate questions on revenue assumptions, as recorded in minutes.",
      partyPosition: "Defendant (Individual)"
    }
  },
  "arbitration-clause": {
    sampleNote: "Sample: AIAC clause for a Malaysia–Singapore JV agreement.",
    example: {
      institution: "AIAC (Asian International Arbitration Centre)",
      seatOfArbitration: "Kuala Lumpur, Malaysia",
      numberOfArbitrators: "Three Arbitrators",
      languageOfArbitration: "English",
      governingLaw: "Laws of Malaysia",
      additionalProvisions: "Confidentiality of proceedings; emergency arbitrator provisions to be available; expedited procedure if claim does not exceed RM 5,000,000; tribunal empowered to consolidate related disputes; enforcement contemplated in both Malaysia and Singapore under the New York Convention."
    }
  },
  "case-summary": {
    sampleNote: "Sample: summary of a leading Federal Court case on minority oppression.",
    example: {
      caseName: "Owen Sim Liang Khui v Piasau Jaya Sdn Bhd & Anor [1996] 1 MLJ 113",
      court: "Federal Court",
      judgmentDetails: "The Federal Court considered the scope of relief under s.181 of the Companies Act 1965 (predecessor to s.346 CA 2016) for oppression. The court held that 'oppression' must involve a visible departure from the standards of fair dealing and a violation of the conditions of fair play on which every shareholder is entitled to rely. The remedy is broad and equitable, and the court may grant any order that is just to bring an end to the matters complained of.",
      focusArea: "Corporate Law"
    }
  },
  "case-strategy-planner": {
    sampleNote: "Sample: full strategy plan for a complex shareholder oppression case.",
    example: {
      caseType: "Shareholder Oppression",
      parties: "Plaintiff (our client): Mr. Tan Wei Ming, 35% shareholder and founding director of Greenfield Industries Sdn Bhd.\n1st Defendant: Mr. Lee Hong Wei, 60% shareholder, Managing Director.\n2nd Defendant: Greenfield Industries Sdn Bhd (the company).\n3rd Defendant: GoldenLink Trading Sdn Bhd (related-party entity allegedly receiving diverted funds).",
      claimValue: "12000000",
      facts: "2018: Greenfield Industries founded by Tan and Lee with Tan's wife as 5% shareholder. Mutual understanding that both founders would manage the business jointly.\n2021: Lee began making unilateral decisions; excluded Tan from key supplier negotiations.\n2022: Tan discovered RM 4.5M in payments to GoldenLink (Lee's wife's company) for 'consultancy' with no supporting documentation.\n2023: Lee procured a private placement diluting Tan from 35% to 25%.\nJanuary 2024: Tan removed as director by majority resolution.\nMarch 2024: Tan's salary stopped despite valid employment contract.\nApril 2026: Suit filed.",
      evidence: "Bank statements showing RM 4.5M transfers to GoldenLink; board minutes and emails showing exclusion; valuer's report estimating fair value of Tan's 35% at RM 12M; original shareholders' agreement reflecting quasi-partnership understanding; WhatsApp messages from Lee admitting 'we'll squeeze him out'.",
      opposingPosition: "Defendants will argue: (1) all transactions were arm's length and approved by the board; (2) Tan's removal was for legitimate cause (alleged underperformance); (3) the share placement was needed for working capital; (4) Tan was bought out at fair value already; (5) no quasi-partnership existed.",
      objective: "Favorable Settlement",
      budgetSensitivity: "High but justified for stake size",
      timeUrgency: "Urgent — within 3 months"
    }
  },
  "cross-examination-generator": {
    sampleNote: "Sample: cross-examination plan for an opposing director in a fraud case.",
    example: {
      witnessRole: "Opposing Party (Director)",
      witnessStatement: "The witness (Defendant Director) claims: (1) he had no knowledge of the falsified invoices; (2) he relied entirely on the CFO; (3) he never personally signed any of the disputed payment vouchers; (4) the company's external auditors raised no red flags; (5) he discovered the fraud only in March 2024 after the whistleblower's email.",
      weaknesses: "(1) Internal emails (P12-P15) show the witness was copied on suspicious payment requests as early as June 2022.\n(2) His personal bank account received RM 850,000 in unexplained transfers from a supplier shell company between 2022-2023.\n(3) He attended monthly finance committee meetings where the CFO presented detailed payment summaries.\n(4) He executed cheques personally for 8 of the 14 disputed payments (signature verification confirmed).",
      yourCase: "Our client (the Plaintiff company) alleges the witness orchestrated a kickback scheme with vendors, personally approved fraudulent payments, and used the CFO as a buffer to maintain plausible deniability.",
      objectiveOfCross: "Highlight inconsistencies with documents"
    }
  },
  "cause-of-action-analyzer": {
    sampleNote: "Sample: scenario where a CFO siphoned company funds via fake vendors.",
    example: {
      factualScenario: "Our client is a manufacturing Sdn Bhd that discovered, in March 2026, that its former CFO (employed 2019-2025) had set up 3 fake vendor companies and channelled RM 6.8 million of company funds to them through fictitious invoices. The CFO's spouse was the registered owner of all 3 shell companies. The CFO has since left the country. The shell companies still hold RM 2.1 million in their bank accounts. The CFO's home in Mont Kiara (RM 4 million) is in his spouse's name. Two junior accounts staff had unwittingly processed the payments based on the CFO's instructions. The company's external auditors (Big-4 firm) issued unqualified audit reports throughout the period.",
      clientType: "Corporation (plaintiff)",
      targetDefendant: "(1) The former CFO — primary fraudster.\n(2) The CFO's spouse — registered owner of shell companies and home, alleged knowing receipt.\n(3) The 3 shell companies — recipients of stolen funds.\n(4) The external auditors — for negligent failure to detect.\n(5) The CFO's spouse's brother — listed as a 'director' of one shell company.",
      jurisdiction: "High Court (Commercial Division NCvC)"
    }
  },
  "opposing-argument-predictor": {
    sampleNote: "Sample: predict defences in a guarantee enforcement claim.",
    example: {
      yourClaim: "Our client (Bank) is enforcing a personal guarantee of RM 5 million against Mr. Wong, who guaranteed his company's loan facility in 2021. The company defaulted in January 2026. We rely on the executed guarantee, demand letter, and statement of account.",
      opposingParty: "Mr. Wong is a successful businessman represented by a top-tier litigation firm. Resources are not an issue. Likely approach: aggressive defence with multiple technical and substantive arguments to delay and pressure for settlement.",
      caseStage: "Post-filing, pre-defence",
      knownDefences: "Solicitors' preliminary letter mentioned: (1) variation of terms without consent (the limit was increased from RM 3M to RM 5M in 2023); (2) bank's failure to enforce against company assets first; (3) misrepresentation by the bank's officer at the time of execution."
    }
  },
  "judicial-tendency-analyzer": {
    sampleNote: "Sample: judicial approach to piercing the corporate veil in fraud cases.",
    example: {
      legalIssue: "How have Malaysian courts approached the lifting/piercing of the corporate veil where a Sdn Bhd is alleged to have been used as a vehicle for fraud or to evade existing obligations? What threshold of evidence is required, and what remedies have been granted?",
      courtLevel: "All levels",
      timeframe: "Last 10 years (2016-2026)",
      clientPosition: "Seeking to establish the principle"
    }
  },
  "witness-statement-crafter": {
    sampleNote: "Sample: turning interview notes into a finance director's witness statement.",
    example: {
      witnessName: "Ms. Sarah Goh Mei Lin (NRIC 800504-14-9876), Finance Director of the Plaintiff company since 2019, of No. 12, Jalan Setia 7, Setia Alam, 40170 Shah Alam, Selangor.",
      witnessType: "Factual Witness (Party)",
      rawNotes: "- Joined company 2019 as FC, promoted FD 2021\n- First met defendant CEO at industry event March 2022\n- Defendant approached us June 2022 to supply industrial pumps for their KL Sentral project\n- Signed Supply Agreement 15 August 2022 (saw it personally)\n- We delivered all 47 pumps on schedule between Sept-Dec 2022\n- Total invoice RM 3.2M\n- They paid RM 1M deposit on signing\n- Balance RM 2.2M became due on 31 January 2023\n- They started complaining about 'defects' only in March 2023 — 4 months after delivery\n- I personally inspected with our QC team in April 2023 — pumps were fine\n- Their site engineer admitted to me on call 5 May 2023 the pumps worked fine but their installer wired them wrongly\n- I have email of 6 May 2023 from defendant's project manager asking us to 'help with the installation issue' — proves no defect claim then\n- We sent demand letter June 2023 — they then started alleging defects formally",
      caseContext: "Breach of contract / debt recovery claim. Defendant withheld RM 2.2M payment alleging defective goods. Our position: no defect, payment due, defect allegation is a sham raised only to avoid payment.",
      tone: "Detailed and comprehensive"
    }
  },
  "chronology-builder": {
    sampleNote: "Sample: build chronology from raw correspondence in a contract dispute.",
    example: {
      rawMaterial: "Email 1 Feb 2022 from Plaintiff to Defendant attaching draft Distribution Agreement.\nMeeting on 10 Feb 2022 at Defendant's office — terms agreed in principle.\nDistribution Agreement signed 15 Feb 2022 (5-year term, exclusive Peninsular Malaysia).\nFirst purchase order placed 1 March 2022 — RM 850,000.\nQ2 2022 sales report shows Plaintiff exceeded targets by 18%.\nAugust 2022 — Defendant's CEO emails 'great work, please push harder for Q4'.\nDecember 2022 — Year-end review, Plaintiff achieves 112% of annual target.\nMarch 2023 — Defendant introduces new Sales Director Mr. Krishnan.\nApril 2023 — Krishnan visits Plaintiff, expresses concern about 'channel inefficiency'.\nMay 2023 — Defendant cuts margin from 22% to 15% citing 'market conditions'.\nJune 2023 — Plaintiff objects in writing.\n30 June 2023 — Defendant terminates Distribution Agreement effective immediately.\n5 July 2023 — Defendant appoints Krishnan's former employer as new distributor.",
      additionalFacts: "Bonus payment of RM 250,000 paid by Defendant to Plaintiff on 20 December 2022 for exceeding targets — confirms target performance.",
      perspective: "Plaintiff-favorable narrative",
      focusPeriod: "February 2022 to July 2023"
    }
  },
  "pleading-consistency-checker": {
    sampleNote: "Sample: checking a draft Statement of Claim for issues.",
    example: {
      pleadingText: "1. The Plaintiff is a company incorporated under the Companies Act 2016.\n2. The Defendant is a businessman residing in Kuala Lumpur.\n3. On 15 January 2023, the parties entered into a Sale Agreement for the sale of 100,000 shares in XYZ Bhd at RM 5 per share.\n4. The Defendant paid the deposit of RM 50,000 on 20 January 2023.\n5. Completion was scheduled for 15 March 2023.\n6. The Defendant failed to complete on the agreed date.\n7. The Plaintiff suffered loss as a result.\n8. The Plaintiff claims:\n   (a) Specific performance of the Agreement;\n   (b) Damages;\n   (c) Costs.",
      pleadingType: "Statement of Claim",
      supportingDocs: "Sale Agreement dated 15 January 2023; Deposit receipt dated 20 January 2023; Demand letter dated 30 March 2023; Share certificate XYZ Bhd."
    }
  },
  "settlement-negotiation": {
    sampleNote: "Sample: settlement analysis for a moderate-strength commercial dispute.",
    example: {
      claimAmount: "8500000",
      meritStrength: "Moderate (40-60%)",
      costsBothSides: "RM 650,000 (your costs) + RM 600,000 (their costs)",
      trialTimeline: "1-2 years",
      enforceability: "Defendant has clear assets — fully enforceable",
      nonMonetaryFactors: "Defendant is a long-standing supplier in a small industry; preservation of business relationships matters. Press coverage of the trial would damage both parties' reputations. Confidential settlement preferred."
    }
  },
  "board-resolution-drafter": {
    sampleNote: "Sample: directors' written resolution authorising a litigation suit.",
    example: {
      resolutionType: "Directors' Resolution in Writing (s.195)",
      companyDetails: "ALPHA HOLDINGS SDN BHD (Company No. 201801056789), a private company limited by shares incorporated in Malaysia under the Companies Act 2016, having its registered office at Suite 8.05, Wisma Genting, Jalan Sultan Ismail, 50250 Kuala Lumpur.",
      subjectMatter: "Authorization of Litigation",
      details: "To authorise the commencement of legal proceedings against BETA TRADING SDN BHD (Company No. 201501023456) for breach of the Joint Venture Agreement dated 10 May 2022 and recovery of RM 3,500,000. To appoint Messrs. Aziz, Krishnan & Partners as solicitors. To authorise Mr. Lim Cheng Hock (Managing Director) to execute all documents and affidavits in connection with the proceedings.",
      effectiveDate: "30 April 2026"
    }
  },
  "islamic-banking-advisor": {
    sampleNote: "Sample: BBA facility default with ibra dispute on early settlement.",
    example: {
      facilityType: "Bai Bithaman Ajil (BBA)",
      disputeNature: "Ibra (rebate) on early settlement",
      facilityDetails: "BBA Home Financing Facility executed 5 March 2018. Bank purchased property for RM 600,000 (cost price), sold to customer at RM 1,140,000 (selling price including profit margin). Tenure 25 years. Monthly instalment RM 3,800. Property: a double-storey link house in Cheras, Kuala Lumpur.",
      disputeBackground: "Customer wishes to settle the facility in full as at 30 April 2026 after 8 years. Outstanding balance per the Sale and Buy-Back Agreement is RM 945,000. Customer disputes this and claims the bank must grant ibra (rebate) on the unearned profit portion. The bank initially offered RM 75,000 ibra; customer demands RM 320,000 based on the actual time-value calculation."
    }
  },
  "pdpa-compliance": {
    sampleNote: "Sample: PDPA review of a fintech company's data practices.",
    example: {
      dataActivity: "We collect customer KYC data (NRIC, photo, bank details, income, employment), behavioural data (transaction patterns), and credit bureau data. Data is used for credit scoring, fraud detection, marketing personalisation, and shared with our credit insurance partner in Singapore. Stored on AWS Singapore region. Retained for 7 years post-relationship.",
      dataSubjects: "Customers/Clients",
      crossBorder: "Yes — to countries with adequate protection",
      currentMeasures: "Privacy notice published on website (English only); consent ticked at sign-up; AES-256 encryption at rest; no formal data breach response plan; no DPO appointed; staff PDPA training was last conducted in 2022."
    }
  },
  "judgment-enforcer": {
    sampleNote: "Sample: enforcement strategy for a RM 2.5M judgment against a recalcitrant company.",
    example: {
      judgmentDetails: "Kuala Lumpur High Court Suit No. WA-22NCC-789-05/2024. Judgment dated 15 March 2026. Awarded RM 2,500,000 in damages plus interest at 5% from date of writ, plus costs assessed at RM 80,000. Judgment debtor has filed no appeal. Judgment is final.",
      judgmentAmount: "2580000",
      debtorType: "Sdn Bhd company (active)",
      knownAssets: "(1) Office unit at Plaza Sentral, KL (estimated RM 1.8M, possibly charged to a bank); (2) Maybank current account (balance unknown); (3) Trade receivables from 4 main customers (estimated RM 1.2M); (4) Director (Mr. Tan) owns a Mercedes S-Class and a condo in Mont Kiara — but no personal guarantee was given.",
      previousAttempts: "Two demand letters sent post-judgment in March and April 2026. Debtor's solicitors responded asking for 'time to arrange financing'. No payment received."
    }
  },
  "appeal-merit-assessor": {
    sampleNote: "Sample: assessing appeal prospects after losing at trial.",
    example: {
      decision: "High Court dismissed our client's claim for RM 5.2M in damages for breach of a Distribution Agreement. The trial judge found: (1) the termination by the defendant was lawful as our client had materially breached the agreement by failing to meet sales targets in Q4 2023; (2) the 'cure period' clause did not apply because the breach was incurable; (3) the loss of profits claim was speculative and unsupported by expert evidence. The judge accepted the defendant's witnesses and rejected our client's witnesses on credibility grounds.",
      currentCourt: "High Court (Trial)",
      proposedGrounds: "(1) The judge erred in finding 'material breach' — the Q4 2023 shortfall was 8% which is not material on the facts.\n(2) The judge erred in holding the breach was 'incurable' contrary to the express words of the cure clause.\n(3) The judge wrongly excluded our expert's loss of profit evidence on a technical objection.\n(4) The credibility findings were against the weight of contemporaneous documentary evidence.",
      newEvidence: "Our client recently obtained internal emails (via subject access request to a former employee) showing the defendant's CEO had decided to terminate as early as October 2023 — before the alleged Q4 shortfall. This was not in evidence at trial."
    }
  },
  "shareholder-agreement-analyzer": {
    sampleNote: "Sample: SHA analysis from minority shareholder's perspective.",
    example: {
      keyClauses: "Board Composition (Cl 4): 5 directors — Majority appoints 3, Minority appoints 2. Chairman has casting vote and is appointed by Majority.\nReserved Matters (Cl 7): Limited to (a) winding up; (b) sale of substantially all assets; (c) constitution amendment. Requires 75% approval. No protection on dividends or director remuneration.\nShare Transfer (Cl 9): Pre-emption rights for both parties. No tag-along. No drag-along.\nDeadlock (Cl 12): Russian Roulette provision — either party may serve notice with offer price; other party must buy or sell at that price.\nExit (Cl 14): Put option for Minority after 5 years at fair value (no defined valuation method).\nNon-compete (Cl 16): 3-year post-exit non-compete in Malaysia.\nDividend (Cl 18): 'such dividends as the board determines'.\nDispute Resolution (Cl 22): AIAC arbitration.",
      shareholdingStructure: "Majority Shareholder: Maxwell Holdings Bhd — 60%\nMinority Shareholder: Mr. James Lim (our client) — 40%\nNo other shareholders. Two share classes (ordinary), no preference shares.",
      clientPosition: "Minority shareholder (>25%)",
      concerns: "Concerned about: (1) inability to influence dividend policy; (2) Russian Roulette is dangerous for the minority because the majority has deeper pockets; (3) no defined valuation method for the put option; (4) chairman's casting vote effectively gives majority full control of board decisions."
    }
  },
  "notice-of-appeal": {
    sampleNote: "Sample: Notice of Appeal to the Court of Appeal from a High Court decision.",
    example: {
      appellantDetails: "STARWEST CONSTRUCTION SDN BHD (Company No. 201501045678), having its registered office at Lot 12, Jalan Industri 5, Kawasan Perindustrian Subang, 40150 Shah Alam, Selangor.",
      respondentDetails: "PUTRA DEVELOPMENT BERHAD (Company No. 198901020345), having its registered office at Level 25, Menara Putra, Jalan Sultan Ismail, 50250 Kuala Lumpur.",
      lowerCourt: "High Court of Malaya at Kuala Lumpur",
      lowerCourtCaseNo: "Suit No. WA-22NCC-321-04/2024",
      decisionDate: "10 April 2026",
      decisionDetails: "The learned High Court judge dismissed the Appellant's claim for RM 7,800,000 in respect of construction works completed under the Building Contract dated 5 January 2022, and allowed the Respondent's counterclaim of RM 1,200,000 for liquidated damages.",
      groundsOfAppeal: "(1) The learned judge erred in law in holding that time was of the essence in respect of practical completion when Clause 23 of the Building Contract clearly provided for extensions of time;\n(2) The learned judge erred in fact and in law in failing to consider the architect's certificate of practical completion dated 30 November 2023;\n(3) The learned judge erred in awarding liquidated damages without making any finding as to the actual delay attributable to the Appellant;\n(4) The learned judge's findings of fact were against the weight of evidence."
    }
  },
  "originating-summons": {
    sampleNote: "Sample: Originating Summons for declaratory and consequential relief.",
    example: {
      applicantDetails: "TAN BOON SIONG (NRIC No. 690712-08-5544), an adult Malaysian, of No. 18, Jalan SS 2/65, 47300 Petaling Jaya, Selangor.",
      respondentDetails: "PERMATA REALTY SDN BHD (Company No. 201001025678), having its registered office at Unit 3-15, Wisma Permata, Jalan Maarof, 59000 Kuala Lumpur.",
      reliefSought: "(1) A declaration that the Sale and Purchase Agreement dated 5 March 2024 between the Applicant and the Respondent in respect of Parcel No. A-12-08, Permata Residences, Bangsar (the 'Property') is valid and subsisting;\n(2) An order of specific performance compelling the Respondent to complete the sale of the Property to the Applicant upon payment of the balance purchase price;\n(3) Damages in addition to or in lieu of specific performance;\n(4) Costs;\n(5) Such further or other relief as this Honourable Court deems just.",
      groundsForApplication: "The Applicant has paid the deposit of RM 95,000 and has at all material times been ready, willing and able to complete. The Respondent has wrongfully purported to terminate the Agreement on 20 March 2026 alleging a more attractive third-party offer. The matter is purely a question of construction of the Agreement and entitlement to specific performance — there are no substantial disputes of fact warranting trial.",
      legalBasis: "Specific Relief Act 1950, ss.11-21; Rules of Court 2012, O.7 and O.28."
    }
  },
  "bill-of-costs": {
    sampleNote: "Sample: party-and-party Bill of Costs after a successful High Court trial.",
    example: {
      caseDetails: "High Court of Malaya at Kuala Lumpur, Civil Suit No. WA-22NCC-654-08/2023. Plaintiff: Solid Tradings Sdn Bhd. Defendant: Risky Ventures Sdn Bhd. Judgment delivered 30 March 2026 in favour of the Plaintiff for RM 4.5 million plus costs to be taxed.",
      partyType: "Plaintiff (Successful Party)",
      taxationType: "Party-and-Party",
      workDoneSummary: "Filing of Writ and Statement of Claim (May 2023). Reply to Defence and Defence to Counterclaim (Jul 2023). Application for summary judgment (dismissed, Sep 2023). Discovery — 4 affidavits, inspection of 3,400 documents. Pre-trial case management — 6 attendances. Trial — 8 sitting days with 7 witnesses. Written submissions (200 pages) and reply submissions (60 pages). Decision on 30 March 2026.",
      counselDetails: "Lead Counsel: Datuk Sri Ravi Naidu (15 years' Call). Junior Counsel: Ms. Aisha Tan (8 years' Call). Both attended trial throughout.",
      disbursements: "Filing fees: RM 4,200. Service fees: RM 1,800. Witness allowances: RM 8,500. Photocopying and document bundling: RM 12,000. Expert witness fees (forensic accountant): RM 85,000. Court reporter and transcripts: RM 18,500."
    }
  },
  "reply-pleading": {
    sampleNote: "Sample: Reply and Defence to Counterclaim in a contract dispute.",
    example: {
      caseReference: "Suit No. WA-22NCC-456-08/2024",
      defenceSummary: "The Defence denies the Plaintiff's claim for RM 2.2M unpaid invoices and alleges (i) the goods supplied were defective; (ii) the Plaintiff failed to deliver on time on multiple occasions; (iii) the Defendant validly exercised set-off under Clause 9 of the Supply Agreement. The Defendant counterclaims for RM 350,000 damages.",
      newPointsToAddress: "(1) The Defence raises a new allegation of an oral variation to the Supply Agreement on 15 March 2024 — this is denied. (2) The Defence pleads that the Plaintiff's QC engineer accepted certain defects on 20 May 2024 — this never happened and is contradicted by P-7 (the QC inspection report).",
      hasCounterclaim: "Yes — must draft Defence to Counterclaim",
      counterclaimSummary: "Defendant counterclaims RM 350,000 being (a) RM 180,000 cost of substitute purchases; (b) RM 75,000 lost profits; (c) RM 95,000 storage costs.",
      counterclaimDefence: "(1) The substitute purchase costs are unsubstantiated and the alleged 'urgent' nature is denied. (2) Lost profits claim is too remote and was not within reasonable contemplation. (3) Storage costs were caused by the Defendant's own delay in collection. (4) The Defendant has failed to mitigate."
    }
  },
  "notice-discontinuance": {
    sampleNote: "Sample: Notice of Discontinuance after a settlement is reached.",
    example: {
      caseDetails: "High Court of Malaya at Shah Alam, Civil Suit No. BA-22NCvC-189-03/2025. Plaintiff: Bestbuy Distribution Sdn Bhd. Defendant: Quality Goods Trading Sdn Bhd. Filed 15 March 2025. Pleadings closed; case at pre-trial case management stage.",
      partyDiscontinuing: "Plaintiff",
      reasonForDiscontinuance: "Settlement",
      settlementTerms: "Parties have entered into a confidential Settlement Agreement dated 25 April 2026 under which the Defendant has paid RM 850,000 in full and final settlement of all claims. Each party to bear its own costs.",
      againstWhichParties: "Discontinuance against all Defendants (1st and 2nd Defendants).",
      stageOfProceedings: "Pre-trial case management (no trial dates fixed yet)"
    }
  },
};
