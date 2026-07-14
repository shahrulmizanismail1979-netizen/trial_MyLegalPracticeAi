// Standard Malaysian Banking Litigation Document Templates
// Based on Rules of Court 2012 (PU(A) 205/2012) and established practice
// These are template precedents — fill [BRACKETED] fields with actual details

export interface SampleDoc {
  name: string;
  description: string;
  content: string;
}

export const SAMPLE_DOCUMENTS: Record<string, SampleDoc> = {
  "Letter of Demand": {
    name: "Letter of Demand",
    description: "Pre-litigation demand letter to defaulting borrower",
    content: `[BANK LETTERHEAD]
[Date]

BY HAND / REGISTERED POST / AR REGISTERED

[Borrower's Full Name]
[Borrower's Full Address]
[Postcode, State]

Dear Sir / Madam,

RE: LOAN ACCOUNT NO. [ACCOUNT NUMBER]
    OUTSTANDING LOAN AMOUNT: RM [AMOUNT]
    LETTER OF DEMAND

We act for and on behalf of [Bank Name] ("the Bank") in respect of the above matter.

1. We are instructed by our client that pursuant to the [Loan Agreement / Facility Agreement] dated [Date] ("the Agreement"), our client extended to you a [type of facility, e.g., Term Loan / Overdraft / Home Loan] facility of RM[Principal Amount] ("the Facility").

2. We are further instructed that you have defaulted in your repayment obligations under the Agreement in that you have failed to make the monthly instalments due since [Month, Year].

3. As at [Date], the total outstanding amount due and owing to our client under the Agreement is as follows:

   Principal Outstanding:    RM [Amount]
   Interest / Profit:        RM [Amount]
   Late Payment Charges:     RM [Amount]
   ─────────────────────────────────────
   TOTAL OUTSTANDING:        RM [Amount]
   ─────────────────────────────────────

4. TAKE NOTICE that we hereby DEMAND payment of the total outstanding sum of RM[Total Amount] together with interest at the rate of [X]% per annum from the date of this letter until full settlement within FOURTEEN (14) DAYS from the date of this letter.

5. IN DEFAULT of payment of the aforesaid sum within the stipulated time, our client shall, without further notice to you, exercise all rights and remedies available to it under the Agreement and at law, including but not limited to:
   (a) commencing legal proceedings against you to recover the full outstanding sum together with costs;
   (b) enforcing the security provided under the Agreement; and/or
   (c) filing a bankruptcy petition against you.

6. This letter is issued without prejudice to all other rights and remedies of our client.

Yours faithfully,

[FIRM NAME]
Advocates & Solicitors
[Address]
[Tel / Fax]
[File Reference]

cc: [Bank Name], [Branch]`,
  },

  "Writ of Summons": {
    name: "Writ of Summons (Form 1)",
    description: "Form 1, Appendix A, Rules of Court 2012 — commencing action by writ",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / SHAH ALAM / IPOH / JOHOR BAHRU]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

                         WRIT OF SUMMONS

To the Defendant(s) above named:

THIS WRIT OF SUMMONS has been issued against you by the above-named Plaintiff.

WITHIN FOURTEEN (14) DAYS after the service of this Writ of Summons on you, counting the day of service, you must either satisfy the claim or return the accompanying Acknowledgment of Service to the Court.

If you fail to do so, the Plaintiff may proceed with the action and judgment may be given against you in your absence without further notice to you.

Take note that you may appear before the court personally or through a solicitor.

INDORSEMENT OF CLAIM

The Plaintiff's claim against the Defendant is for:

1. The sum of RM[Amount] being the outstanding sum due and owing by the Defendant to the Plaintiff pursuant to the [Loan Agreement / Facility Agreement] dated [Date];

2. Interest on the sum of RM[Amount] at the rate of [X]% per annum from the date of this Writ until full realization;

3. Costs of this action on a solicitor-client basis or on such other basis as this Honourable Court deems fit; and

4. Such further and/or other relief as this Honourable Court deems fit.

Issued by: [FIRM NAME]
           Advocates & Solicitors for the Plaintiff
           [Address]
           [Tel / Fax / Email]

Date of Issue: [Date]

This Writ of Summons was issued by [Firm Name], Advocates & Solicitors for the Plaintiff, whose address for service is [Address].`,
  },

  "Statement of Claim": {
    name: "Statement of Claim",
    description: "Pleading setting out the Plaintiff's cause of action in detail",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

                      STATEMENT OF CLAIM

1. The Plaintiff, [Bank Name], is a licensed bank/financial institution incorporated in Malaysia, with its principal place of business at [Address], and is at all material times in the business of providing banking and financial services.

2. The Defendant, [Defendant's Name] (NRIC No.: [Number]), is an individual ordinarily resident at [Address].

3. By a [Loan Agreement / Housing Loan Agreement / Term Loan Agreement] dated [Date] ("the Agreement") made between the Plaintiff and the Defendant, the Plaintiff agreed to grant and the Defendant agreed to accept a [type] facility of RM[Principal Amount] ("the Facility") subject to the terms and conditions set out in the Agreement.

4. By way of security for the Facility, the Defendant executed [a Charge / a Guarantee / a Letter of Set-Off] dated [Date] in favour of the Plaintiff.

5. The Defendant drew down / utilized the Facility on or about [Date].

6. Under the Agreement, the Defendant was obliged to make monthly repayments of RM[Instalment Amount] commencing [Date] and every month thereafter until full repayment.

7. In breach of the Agreement, the Defendant has failed, refused and/or neglected to make the monthly repayments as due and owing. The Defendant last made payment on [Date / has not made any payment].

8. The Plaintiff has duly demanded payment of the outstanding sum by its solicitors' Letter of Demand dated [Date], but the Defendant has failed, refused and/or neglected to pay the same or any part thereof.

9. As at [Date], the total outstanding sum due and owing by the Defendant to the Plaintiff is:

   (a) Principal outstanding:            RM [Amount]
   (b) Interest / Profit accrued:        RM [Amount]
   (c) Late payment charges:             RM [Amount]
                                         ──────────────────
   TOTAL:                                RM [Amount]
                                         ══════════════════

10. Interest continues to accrue at the rate of [X]% per annum from [Date] until full settlement.

AND THE PLAINTIFF CLAIMS:

(i)   The sum of RM[Total Amount] as particularised above;
(ii)  Interest at the rate of [X]% per annum on the sum of RM[Principal] from [Date] until full realization;
(iii) Costs of this action on a solicitor and client basis; and
(iv)  Such further and/or other relief as this Honourable Court deems just and fit.

DATED this [Date]

.....................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff`,
  },

  "Originating Summons (Order for Sale)": {
    name: "Originating Summons — Order for Sale (Order 83, ROC 2012)",
    description: "Application for Order for Sale under Order 83 ROC 2012 for charged land",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

ORIGINATING SUMMONS NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

IN THE MATTER OF A CHARGE
over [Description of Property, e.g., all that piece and parcel of land held under
Geran / H.S.(D) No. [Number], Lot / P.T. No. [Number], Mukim of [Mukim],
District of [District], State of [State]] ("the Property")

AND IN THE MATTER OF the National Land Code 1965

AND IN THE MATTER OF Order 83 of the Rules of Court 2012

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF / CHARGEE

AND

[CHARGOR'S FULL NAME (NRIC NO. [NUMBER])]          ...DEFENDANT / CHARGOR

                    ORIGINATING SUMMONS

Let the Defendant / Chargor within FOURTEEN (14) DAYS after service of this Originating Summons on him/her (inclusive of the day of service) show cause why the following Orders should not be made:

1. An Order for Sale of all that piece and parcel of land held under [Title Details], the Property being charged to the Plaintiff vide Charge No. [Number] dated [Date] and registered on [Date] ("the Charge");

2. The outstanding sum due under the Charge as at [Date] is RM[Amount] and interest thereon continues to accrue at the rate of [X]% per annum;

3. That the reserved price for the sale of the Property be fixed at RM[Amount] or such other reserved price as this Honourable Court deems fit;

4. That the costs of this application be fixed on a solicitor and client basis;

5. Such further and/or other relief as this Honourable Court deems fit.

This Originating Summons is taken out by [FIRM NAME], Advocates & Solicitors for the Plaintiff, whose address for service is [Address].

Issued at [Place] on [Date].

.....................................
REGISTRAR / DEPUTY REGISTRAR
High Court in Malaya at [State]`,
  },

  "Affidavit in Support (Order for Sale)": {
    name: "Affidavit in Support — Order for Sale",
    description: "Supporting affidavit for Order 83 Order for Sale application",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
ORIGINATING SUMMONS NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME]                                         ...PLAINTIFF

AND

[CHARGOR'S NAME]                                   ...DEFENDANT

                   AFFIDAVIT IN SUPPORT

I, [Deponent's Full Name] (NRIC No.: [Number]), [Designation, e.g., Senior Legal Officer] of [Bank Name], with address at [Address], do hereby solemnly and sincerely affirm as follows:—

1. I am duly authorised by the Plaintiff to make this Affidavit on its behalf. I have personal knowledge of the matters stated herein and am duly authorised to make this Affidavit.

2. The Plaintiff is a licensed [bank / financial institution / development financial institution] incorporated in Malaysia and is at all material times in the business of providing banking and financial services.

3. Annexed hereto and marked as **Exhibit "A"** is a copy of the [Facility Agreement / Loan Agreement] dated [Date] made between the Plaintiff and the Defendant for the principal sum of RM[Amount].

4. Pursuant to the said Agreement and as security for the Facility granted thereunder, the Defendant charged the Property described in the Originating Summons herein to the Plaintiff vide Charge No. [Charge Number] registered on [Date]. Annexed hereto and marked as **Exhibit "B"** is a certified true copy of the registered charge and the relevant title/document.

5. The Defendant defaulted in the repayment of the Facility. The Defendant's last payment was made on [Date / the Defendant has not made any payment].

6. The Plaintiff's solicitors issued a Letter of Demand dated [Date] demanding payment of the outstanding sum. The Defendant has failed to comply with the said demand.

7. As at [Date], the total outstanding sum due and owing by the Defendant to the Plaintiff is:

   Principal outstanding:     RM [Amount]
   Interest / Profit:         RM [Amount]
   Late payment charges:      RM [Amount]
   ─────────────────────────────────────
   TOTAL:                     RM [Amount]

8. Annexed hereto and marked as **Exhibit "C"** is a certified true copy of the Plaintiff's Statement of Account confirming the outstanding sum.

9. I am advised and verily believe that the Plaintiff is entitled to apply for an Order for Sale of the Property pursuant to Chapter 3, Part Sixteen of the National Land Code 1965 and Order 83 of the Rules of Court 2012.

AFFIRMED at [Place]          )
on [Date]                    )    .....................................
                             )    [Deponent's Signature]
Before me,                   )
                             )
.....................................
Commissioner for Oaths / Solicitor`,
  },

  "Creditor's Petition": {
    name: "Creditor's Petition (Insolvency Act 1967)",
    description: "Petition by creditor to adjudicate the debtor as bankrupt",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
INSOLVENCY / BANKRUPTCY DIVISION

BANKRUPTCY PETITION NO. [YEAR]-[REGISTRY]-[NUMBER]-[YEAR]

IN THE MATTER OF [DEBTOR'S FULL NAME]
(NRIC No.: [Number])

AND IN THE MATTER OF THE INSOLVENCY ACT 1967 (ACT 360)

                      CREDITOR'S PETITION

We, [Firm Name], Advocates & Solicitors, acting for and on behalf of the Petitioning Creditor, [Creditor's Name (Company No. / NRIC No.)], of [Address], humbly petition this Honourable Court and state as follows:—

1. The Petitioning Creditor is [a bank licensed under the Financial Services Act 2013 (Act 758) / an individual] having a registered address at [Address].

2. The Debtor is [Debtor's Name] (NRIC No.: [Number]), who ordinarily resides at or has a place of business at [Address].

3. The Petitioning Creditor is a creditor of the Debtor, the Debtor being indebted to the Petitioning Creditor in the sum of RM[Amount], which is not less than RM50,000.00 (the minimum threshold prescribed under the Insolvency Act 1967 as amended by the Insolvency (Amendment) Act 2023).

4. The debt arose as follows: [Brief description of how debt arose — loan agreement, judgment, etc.]

5. A judgment in the sum of RM[Amount] and costs of RM[Costs] was obtained against the Debtor in [Court] Civil Suit No. [Number] on [Date].

6. A Bankruptcy Notice (No. [Number]) dated [Date] was served on the Debtor on [Date] requiring the Debtor to pay the sum of RM[Amount] within seven (7) days. The Debtor has failed, refused and/or neglected to comply with the said Bankruptcy Notice.

7. The act of bankruptcy upon which this Petition is founded is the Debtor's failure to comply with the Bankruptcy Notice served on him/her.

8. To the best of the Petitioning Creditor's knowledge and information, the Debtor—
   (a) is not a Limited Liability Partnership;
   (b) has within the period of one year before the presentation of this Petition ordinarily resided or had a dwelling-house or place of business within the jurisdiction of this Court.

WHEREFORE the Petitioning Creditor prays that [Debtor's Name] may be adjudicated a bankrupt and that such other order may be made as is just.

Dated this [Date]

.....................................
[FIRM NAME]
Advocates & Solicitors for the Petitioning Creditor`,
  },

  "Summary Judgment Application": {
    name: "Summons in Chambers — Order 14 Application",
    description: "Application for summary judgment under Order 14, Rules of Court 2012",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO.)]                          ...PLAINTIFF

AND

[DEFENDANT'S NAME (NRIC NO.)]                      ...DEFENDANT

              SUMMONS IN CHAMBERS
           (FOR SUMMARY JUDGMENT UNDER ORDER 14, RULES OF COURT 2012)

LET the Defendant / all parties concerned attend before the Judge in Chambers at the High Court of Malaya at [Place] on [Date] at [Time] on the hearing of an application by the Plaintiff for:

1. Summary Judgment against the Defendant for the sum of RM[Amount] being the total sum outstanding and due and owing under the [Loan / Facility Agreement] dated [Date];

2. Interest on the Judgment sum at the rate of [X]% per annum or as this Honourable Court deems fit from the date of Judgment until full realization;

3. Costs of this application and the Suit on a solicitor and client basis; and

4. Such further and/or other relief as this Honourable Court deems just and fit.

This application is supported by the Affidavit in Support affirmed by [Name] on [Date].

GROUNDS FOR APPLICATION:
The Defendant has no real prospect of successfully defending the claim. The debt is not disputed — it is liquidated and certain, arising from a written Facility Agreement. The Defendant has failed to raise any bona fide triable issue in his/her Defence (if any has been filed).

Dated this [Date]

.....................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff

Take Notice: If you do not attend, the Court may proceed in your absence.`,
  },

  "Affidavit in Support (Summary Judgment)": {
    name: "Affidavit in Support — Order 14 Summary Judgment",
    description: "Affidavit verifying the debt for summary judgment application",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN [BANK NAME] ...PLAINTIFF  AND  [DEFENDANT'S NAME] ...DEFENDANT

               AFFIDAVIT IN SUPPORT OF ORDER 14 APPLICATION

I, [Deponent's Name] (NRIC No.: [Number]), [Designation] of the Plaintiff, do solemnly and sincerely affirm:

1. I am duly authorised to make this Affidavit on behalf of the Plaintiff. I have personal knowledge of the facts herein.

2. This Affidavit is filed in support of the Plaintiff's application for Summary Judgment under Order 14 of the Rules of Court 2012.

3. The Plaintiff's claim as set out in the Statement of Claim is for the sum of RM[Amount] being monies due and owing under the [Facility Agreement] dated [Date]. I refer to the Agreement (Exhibit "A") and confirm the debt is certain and undisputed.

4. As at [Date], the total outstanding is:
   Principal:   RM [Amount]
   Interest:    RM [Amount]
   Charges:     RM [Amount]
   TOTAL:       RM [Amount]

   Annexed as **Exhibit "B"** is a certified Statement of Account.

5. The Defendant has filed a Defence. The Defence does not disclose any bona fide triable issue. The Defendant merely [deny the amount / allege setoff without particulars / other]. The Defendant has adduced no evidence to support any defence.

6. There is no dispute as to the Plaintiff's entitlement to the debt. The Defendant has no real prospect of successfully defending this claim.

AFFIRMED at [Place]          )
on [Date]                    )    .....................................
                             )    [Signature]
Before me,                   )
                             )
.....................................
Commissioner for Oaths / Solicitor`,
  },

  "Charging Order Application": {
    name: "Charging Order Application (Order 50, ROC 2012)",
    description: "Application for a charging order over the judgment debtor's land",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[JUDGMENT CREDITOR / BANK NAME]                    ...PLAINTIFF

AND

[JUDGMENT DEBTOR'S NAME]                           ...DEFENDANT

         SUMMONS IN CHAMBERS — CHARGING ORDER APPLICATION
         (ORDER 50, RULES OF COURT 2012)

LET the Defendant and all parties concerned attend before the Judge in Chambers at the High Court of Malaya at [Place] on [Date] at [Time] on the hearing of an application by the Plaintiff/Judgment Creditor for the following orders:—

1. A Charging Order nisi to be made absolute over the Defendant's/Judgment Debtor's interest in the property known as [Property Address / Title Description] held under [Title / H.S.(D) No.], Lot / P.T. No. [Number], Mukim of [Mukim], District of [District], State of [State];

2. Upon the making absolute of the Charging Order, that the said property stand charged with payment of the judgment sum of RM[Amount] and costs of RM[Costs Amount] as obtained by the Plaintiff against the Defendant in this suit on [Date of Judgment];

3. Costs of this application; and

4. Such further and/or other relief as this Honourable Court deems fit.

Grounds: The Plaintiff is a judgment creditor. The Defendant has failed to satisfy the judgment. The Defendant has a beneficial interest in the above property.

Dated this [Date]

.....................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff / Judgment Creditor`,
  },

  "Notice to Chargee to Redeem": {
    name: "Notice to Redeem Charge (Form 16D, NLC 1965)",
    description: "Notice by chargor to chargee of intention to redeem the charge",
    content: `FORM 16D
[National Land Code 1965, Section 243]

                    NOTICE OF INTENTION TO REDEEM

To: [Chargee Bank Name]
    [Address of Chargee / Chargee's Solicitors]

AND TO: The Land Administrator, [District / Division]

I / We, [Chargor's Full Name(s)] (NRIC No.: [Number]), of [Address], being the registered [proprietor / chargors] of the undermentioned land, hereby give you notice of my/our intention to redeem the charge held by you over the said land.

PARTICULARS OF LAND:
Description:  [All that piece and parcel of land known as / held under]
Title No.:    [Geran / H.S.(D) No. [Number]]
Lot No.:      [Lot / P.T. No. [Number]]
Mukim:        [Mukim]
District:     [District]
State:        [State]
Area:         [Approximately [X] square metres / [X] acres]

PARTICULARS OF CHARGE:
Charge No.:   [Number]
Date:         [Date of Charge]
Amount:       RM [Amount]

NOTICE IS HEREBY GIVEN that I / we intend to redeem the abovementioned charge on [Date — minimum 1 month from date of notice] and I / we request that you furnish the redemption statement / redemption sum no later than [Date].

Dated this [Date]

.....................................
[Chargor's Signature]
[Chargor's Full Name]

Note: This Notice is given pursuant to Section 243 of the National Land Code 1965. The charge may be redeemed by payment of the redemption sum as certified by the chargee on the date of redemption.`,
  },

  "Garnishee Order Application": {
    name: "Garnishee Order Application (Order 49, ROC 2012)",
    description: "Application to garnish monies in the judgment debtor's bank account",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[JUDGMENT CREDITOR / BANK]                        ...PLAINTIFF

AND

[JUDGMENT DEBTOR'S NAME]                           ...DEFENDANT

        EX PARTE SUMMONS IN CHAMBERS
        GARNISHEE ORDER NISI
        (ORDER 49, RULES OF COURT 2012)

LET [Judgment Creditor / Bank Name] attend before the Judge in Chambers for an Order that:—

1. All debts due or accruing due from [Garnishee's Name, e.g., Malayan Banking Berhad] ("the Garnishee") to [Judgment Debtor's Name] ("the Judgment Debtor") in respect of [Account No. [Number] / all accounts maintained by the Judgment Debtor with the Garnishee] be attached and paid to the Plaintiff/Judgment Creditor to satisfy the judgment sum of RM[Amount] and costs of RM[Costs] obtained on [Date];

2. A Garnishee Order nisi to be served on the Garnishee and the Judgment Debtor; and

3. The matter be fixed for hearing inter partes on [Date] for the Garnishee Order to be made absolute.

This application is made pursuant to Order 49 Rules 1 and 2 of the Rules of Court 2012.

Dated this [Date]

.....................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff / Judgment Creditor`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PART II: PLEADINGS AND INTERLOCUTORY DOCUMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  "Memorandum of Appearance": {
    name: "Memorandum of Appearance (Form 15, Appendix A, ROC 2012)",
    description: "Filed by defendant within 14 days of service of Writ of Summons to indicate intention to defend — Order 12 r 1 ROC 2012",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / SHAH ALAM / IPOH / JOHOR BAHRU]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

                  MEMORANDUM OF APPEARANCE
                  (ORDER 12, RULES OF COURT 2012)

TAKE NOTICE that [Defendant's Full Name] (NRIC No. [Number]) of [Defendant's address] ("the Defendant"), the above-named Defendant, hereby appears to the Writ of Summons issued herein and served on the Defendant on [Date of Service].

The Defendant intends to defend this action.

The Defendant's address for service is:

        [Law Firm Name / or Defendant in Person]
        [Address]
        [Tel: xxx-xxxxxxxx]
        [Fax: xxx-xxxxxxxx]
        [Email: xxx@xxx.com]

Dated this [Day] day of [Month] [Year].

................................................
[FIRM NAME]
Advocates & Solicitors for the Defendant
[Address]
[Tel / Fax / Email]
[File Reference]

To: The Plaintiff (through its solicitors)
    [Plaintiff's Solicitors' Name & Address]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Time limit: 14 days from date of service of Writ (Order 12 r 1 ROC 2012)
• Form: Appendix A, Form 15 of the Rules of Court 2012
• Failure to enter appearance: Plaintiff may apply for Judgment in Default of Appearance under Order 13 ROC 2012
• Defendant may still raise preliminary objections to jurisdiction even after entering appearance, by way of a Notice to Strike Out under Order 18 r 19 or application under Order 12 r 7
─────────────────────────────────────────────────────────────`,
  },

  "Defence": {
    name: "Defence (Order 18 r 2, ROC 2012)",
    description: "Statement setting out the Defendant's grounds of defence to the Plaintiff's claim in a banking loan recovery action",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

                              DEFENCE
                  (ORDER 18 r 2, RULES OF COURT 2012)

The Defendant, by way of Defence to the Plaintiff's Statement of Claim filed herein, states as follows:

PRELIMINARY MATTERS

1.   The Defendant admits that he/she is the borrower under the [Facility Agreement / Loan Agreement] dated [Date] ("the Agreement"). Save as expressly admitted herein, the Defendant denies each and every allegation in the Statement of Claim.

ADMISSION AND DENIAL

2.   Paragraph 1 of the Statement of Claim — Admitted.

3.   Paragraph 2 of the Statement of Claim — Admitted that the Agreement was executed on [Date]. Denied that the Plaintiff has performed all its obligations thereunder.

4.   Paragraph 3 of the Statement of Claim — Not Admitted. The Defendant requires the Plaintiff to strictly prove the outstanding amount claimed, including the computation of interest and charges applied.

5.   Paragraphs 4 and 5 of the Statement of Claim — Denied. The Defendant avers as follows:

DEFENCE ON THE MERITS

6.   [PLEA 1 — PAYMENT / PARTIAL PAYMENT]
     The Defendant avers that he/she has made payments to the Plaintiff as follows:

     (a)  Payment of RM[Amount] on [Date];
     (b)  Payment of RM[Amount] on [Date];
     (c)  Payment of RM[Amount] on [Date];

     Accordingly, the sum claimed by the Plaintiff is overstated and the Plaintiff's computation of the alleged outstanding amount is inaccurate.

7.   [PLEA 2 — MISREPRESENTATION / UNDUE INFLUENCE]
     Further and/or in the alternative, the Defendant avers that he/she was induced to execute the Agreement by the Plaintiff's officers' representations that [particulars of representation], which representations were false, misleading, or without reasonable basis. The Defendant avers that but for these representations, he/she would not have entered into the Agreement.

8.   [PLEA 3 — UNCONSCIONABILITY]
     Further and/or in the alternative, the terms of the Agreement, and in particular the interest rate / penalty charges provision at Clause [X], are unconscionable within the meaning of ss. 24B–24D of the Contracts Act 1950 (Act 136), and the Defendant invites the Court to exercise its discretion to set aside or vary those terms.

9.   [PLEA 4 — SET-OFF]
     Further and/or in the alternative, the Defendant has a valid and subsisting claim against the Plaintiff for damages in the sum of RM[Amount] arising from the Plaintiff's breach of its duty of care to the Defendant. The Defendant will rely on this claim by way of set-off or counterclaim.

10.  By reason of the matters aforesaid, the Plaintiff's claim is denied in whole [or in the amount of RM[X]].

COUNTERCLAIM [if applicable]
(See attached / will be filed separately)

WHEREFORE the Defendant prays that the Plaintiff's claim be dismissed with costs, and that [any counterclaim relief] be granted.

Dated this [Day] day of [Month] [Year].

................................................
[FIRM NAME]
Advocates & Solicitors for the Defendant
[Address]
[Tel / Fax / Email]
[File Reference]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Time limit for filing Defence: 14 days after entering appearance (Order 18 r 2 ROC 2012). Court may extend on application.
• Failure to file Defence: Plaintiff may apply for Judgment in Default of Defence under Order 19 r 3 ROC 2012.
• Defence must plead specifically to each material allegation in the SOC — a bare denial is insufficient (Order 18 r 13 ROC 2012).
• Affirmative defences (e.g. payment, limitation, set-off) must be pleaded positively.
• Counterclaim: If relying on counterclaim, include it in the same document (Order 15 r 2 ROC 2012).
─────────────────────────────────────────────────────────────`,
  },

  "Reply to Defence": {
    name: "Reply to Defence (Order 18 r 3, ROC 2012)",
    description: "Plaintiff's reply addressing new matters raised in the Defendant's Defence in a banking litigation action",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

                           REPLY TO DEFENCE
                  (ORDER 18 r 3, RULES OF COURT 2012)

The Plaintiff, by way of Reply to the Defence filed herein on [Date], states as follows:

1.   The Plaintiff joins issue with the Defendant on each and every material allegation raised in the Defence save where expressly admitted below.

2.   In reply to paragraph 6 of the Defence (alleged payments):

     (a)  The Plaintiff admits receiving payments totalling RM[Amount] from the Defendant up to [Date]. These payments have been duly credited and are reflected in the Statement of Account exhibited at "PL-3" to the Supporting Affidavit.

     (b)  The Plaintiff avers that the outstanding balance of RM[Amount] as stated in the Statement of Claim is computed after deducting all payments received. The Defendant's averment that additional payments were made is put to strict proof.

3.   In reply to paragraph 7 of the Defence (alleged misrepresentation):

     (a)  The Plaintiff denies that any misrepresentation was made by its officers. The Agreement at Clause [X] expressly provides that the Defendant acknowledges that it has read, understood, and independently verified all terms before execution.

     (b)  The Plaintiff avers that any pre-contractual representation, if made, was duly incorporated into the Agreement or merged upon execution of the same.

     (c)  The Defendant had the benefit of independent legal advice before executing the Agreement, as evidenced by the solicitor's certificate at Exhibit "D" to the Defence.

4.   In reply to paragraph 8 of the Defence (unconscionability):

     The Plaintiff avers that the interest rate / penalty charges stipulated in the Agreement are commercially reasonable, were specifically agreed by the Defendant, and are consistent with market practice. The provisions are not unconscionable within the meaning of s. 24B Contracts Act 1950. The Plaintiff relies on the decision in [Relevant Case].

5.   In reply to paragraph 9 of the Defence (set-off):

     The Plaintiff denies any breach of duty on its part. The Defendant's alleged counterclaim is speculative and unsupported by particulars. Further, even if established (which is denied), it cannot extinguish the Defendant's primary obligation to repay the loan.

6.   The Plaintiff repeats and relies on its Statement of Claim.

WHEREFORE the Plaintiff reiterates its prayer for judgment as set out in the Statement of Claim.

Dated this [Day] day of [Month] [Year].

................................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff
[Address]
[Tel / Fax / Email]
[File Reference]

─────────────────────────────────────────────────────────────
FILING NOTES:
• A Reply is only required if the Defendant raises new matters / affirmative defences in the Defence that are not answered by the SOC (Order 18 r 3 ROC 2012).
• If no Reply is filed, all allegations in the Defence are deemed to be denied (Order 18 r 14(2) ROC 2012) — but it is best practice to file a Reply to new matters.
• Do not repeat the SOC in the Reply — only address new matters raised in the Defence.
• After Reply, pleadings close (Order 18 r 20 ROC 2012) unless Court grants leave for further pleadings.
─────────────────────────────────────────────────────────────`,
  },

  "Request for Further and Better Particulars": {
    name: "Request for Further and Better Particulars (Order 18 r 12, ROC 2012)",
    description: "Request by Defendant for Plaintiff to provide further details of its claim — Order 18 r 12(3) ROC 2012",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

          REQUEST FOR FURTHER AND BETTER PARTICULARS
              OF THE STATEMENT OF CLAIM
          (ORDER 18 r 12, RULES OF COURT 2012)

The Defendant requests from the Plaintiff further and better particulars of the Statement of Claim as follows:—

─────────────────────────────────────────────────────────────────────────
OF PARAGRAPH 2:
─────────────────────────────────────────────────────────────────────────

Under the words "the outstanding sum of RM[Amount]":—

REQUEST 1:
State the full breakdown of the sum of RM[Amount] alleged to be outstanding as at the date of the Statement of Claim, specifying separately:
(a)  The original principal sum disbursed;
(b)  The total instalments paid to date;
(c)  The interest / profit rate applied and the basis thereof;
(d)  The total interest / profit accrued to date;
(e)  Any penalty charges or default interest applied and the basis thereof;
(f)  Any legal costs or other charges debited to the account.

REQUEST 2:
State the precise date on which each alleged default in payment occurred and the amount of each default.

─────────────────────────────────────────────────────────────────────────
OF PARAGRAPH 3:
─────────────────────────────────────────────────────────────────────────

Under the words "the Plaintiff demanded payment" —

REQUEST 3:
State:
(a)  The date, mode, and address of service of each demand made by the Plaintiff;
(b)  Whether each demand was served personally or by post;
(c)  The name and designation of the Plaintiff's officer who issued each demand.

─────────────────────────────────────────────────────────────────────────

Dated this [Day] day of [Month] [Year].

................................................
[FIRM NAME]
Advocates & Solicitors for the Defendant

To: [Plaintiff's Solicitors]
    [Address]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Filed under Order 18 r 12(3) ROC 2012 — must be by way of written request served on the opposite party, not a formal court application.
• If the party fails to give satisfactory particulars, the requesting party may apply to Court for an Order to provide particulars (Order 18 r 12(4) ROC 2012).
• Particulars are not evidence but clarify the scope of the pleaded case.
• Do not use RFBP as a discovery device — it is limited to clarifying pleadings.
─────────────────────────────────────────────────────────────`,
  },

  "Judgment in Default of Appearance": {
    name: "Judgment in Default of Appearance (Order 13 r 2, ROC 2012)",
    description: "Application for judgment where Defendant has failed to enter appearance after service of Writ of Summons",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

          JUDGMENT IN DEFAULT OF APPEARANCE
          (ORDER 13 r 2, RULES OF COURT 2012)

UPON the Writ of Summons herein having been duly served on the Defendant on [Date of Service] as shown by the Affidavit of Service filed herein on [Date];

AND UPON the time limited for the Defendant to enter appearance having expired on [Date] (being 14 days after service);

AND UPON no Memorandum of Appearance having been filed by or on behalf of the Defendant;

IT IS ORDERED AND ADJUDGED that the Defendant do pay to the Plaintiff:

1.   The sum of RM[Principal Amount] being the outstanding sum due and owing under the [Loan Agreement / Facility Agreement] dated [Date];

2.   Interest on the said sum of RM[Principal Amount] at the rate of [X]% per annum from [Date of Default / Date of Writ] until the date of full payment;

     OR

     Post-judgment interest at the rate of 5% per annum pursuant to Order 42 r 12 of the Rules of Court 2012 from the date of this judgment until the date of full payment;

3.   Costs of this action fixed at RM[Amount] (solicitor-client basis) [or as taxed].

Judgment given this [Day] day of [Month] [Year].

                              REGISTRAR / DEPUTY REGISTRAR
                              HIGH COURT IN MALAYA AT [STATE]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Applicable under Order 13 r 2 ROC 2012 where Writ was for a liquidated demand (fixed sum).
• Must file Affidavit of Service confirming proper service of the Writ BEFORE applying for JID.
• Where Writ is for unliquidated damages, Plaintiff must apply to the Registrar for assessment of damages — judgment in default only on liability (Order 13 r 4 ROC 2012).
• JID may be set aside under Order 13 r 8 ROC 2012 if the Defendant can show a good reason for non-appearance and a meritorious defence.
• Penal interest under Order 42 r 12 ROC 2012 is 5% per annum on the judgment sum.
• Bank must ensure service was proper — defective service invalidates the JID.
─────────────────────────────────────────────────────────────`,
  },

  "Judgment in Default of Defence": {
    name: "Judgment in Default of Defence (Order 19 r 3, ROC 2012)",
    description: "Application for judgment where Defendant has entered appearance but failed to file a Defence within the prescribed time",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME (COMPANY NO. [REG NO.])]                ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]         ...DEFENDANT

          JUDGMENT IN DEFAULT OF DEFENCE
          (ORDER 19 r 3, RULES OF COURT 2012)

UPON the Defendant having entered a Memorandum of Appearance on [Date of Appearance];

AND UPON the Statement of Claim having been served on the Defendant's solicitors on [Date of Service of SOC];

AND UPON the time limited for filing a Defence (14 days after service of Statement of Claim) having expired on [Date];

AND UPON no Defence having been filed by or on behalf of the Defendant;

IT IS ORDERED AND ADJUDGED that the Defendant do pay to the Plaintiff:

1.   The sum of RM[Amount] being the outstanding sum due and owing under the [Loan Agreement / Facility Agreement] dated [Date];

2.   Interest on the sum of RM[Amount] at the contractual rate of [X]% per annum from [Date] until full payment;
     AND / OR
     Post-judgment interest at 5% per annum pursuant to Order 42 r 12 ROC 2012 from the date of this judgment until the date of full payment;

3.   Costs of this action fixed at RM[Amount] [or as taxed].

Judgment given this [Day] day of [Month] [Year].

                              REGISTRAR / DEPUTY REGISTRAR
                              HIGH COURT IN MALAYA AT [STATE]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Applicable under Order 19 r 3 ROC 2012 where claim is for a liquidated demand and Defendant has appeared but not filed a Defence.
• File Certificate of Non-Filing of Defence (obtainable from Court Registry) before applying.
• SOC must have been properly served on Defendant / Defendant's solicitors before time starts running.
• JID for unliquidated damages: only judgment on liability granted; quantum assessed by Registrar (Order 19 r 4 ROC 2012).
• Application to set aside: Defendant may apply under Order 19 r 9 ROC 2012 — Court will consider whether there is a meritorious defence and explanation for failure to file in time.
─────────────────────────────────────────────────────────────`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PART III: NLC STATUTORY FORMS (FORECLOSURE)
  // ─────────────────────────────────────────────────────────────────────────────

  "Form 16C (Notice Before Foreclosure)": {
    name: "Form 16C — Notice Before Foreclosure (National Land Code 1965)",
    description: "Statutory notice served on chargor specifying default and demanding remedy — mandatory precondition to Order for Sale proceedings under s. 254 NLC 1965",
    content: `FORM 16C
NATIONAL LAND CODE 1965

NOTICE BEFORE FORECLOSURE
[Section 254(1) National Land Code 1965]

FROM: [BANK NAME]                                       Date: [Date]
      [Bank's Address]
      (hereinafter referred to as "the Chargee")

TO:   [CHARGOR'S FULL NAME]
      [CHARGOR'S NRIC / COMPANY REG. NO.]
      [CHARGOR'S ADDRESS]
      (hereinafter referred to as "the Chargor")

─────────────────────────────────────────────────────────────────────────
PARTICULARS OF CHARGE
─────────────────────────────────────────────────────────────────────────
Property     : [Lot No. / P.T. No.], [Mukim / Town / Village],
               [District], [State]
Title        : [H.S.(D) No. / Geran No. / Pajakan No.], [Lot No.]
Title No.    : [Title Reference Number]
Facility     : [Loan / Facility Agreement dated [Date]]
Account No.  : [Account Number]

─────────────────────────────────────────────────────────────────────────
NOTICE
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that the Chargee has registered a charge over the above property pursuant to the [Facility Agreement / Charge] dated [Date] ("the Charge").

AND TAKE NOTICE that you have defaulted in your obligations under the Facility Agreement and the Charge in that:

(a) You have failed to pay the monthly instalments due since [Month Year];

(b) The total outstanding amount due and owing under the Charge as at the date of this Notice is as follows:

    Principal Outstanding:       RM [Amount]
    Interest / Profit Accrued:   RM [Amount]
    Penalty / Late Charges:      RM [Amount]
    Legal Charges (if any):      RM [Amount]
    ────────────────────────────────────────
    TOTAL OUTSTANDING:           RM [Amount]
    ────────────────────────────────────────

AND TAKE FURTHER NOTICE that you are hereby required to remedy the aforesaid default by paying the total outstanding sum of RM [Amount] together with interest accruing thereon at the rate of [X]% per annum from the date of this Notice until full payment, within ONE (1) MONTH from the date of service of this Notice.

IN DEFAULT of payment of the aforesaid sum within the said period, the Chargee shall, without further notice, exercise its right to apply to the High Court for an Order for Sale of the above charged property pursuant to Section 254 of the National Land Code 1965 and Order 83 of the Rules of Court 2012.

This Notice is without prejudice to all other rights and remedies of the Chargee.

Dated this [Day] day of [Month] [Year].

................................................
For and on behalf of
[BANK NAME]
[Authorised Signatory's Name & Designation]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Mandatory under s. 254(1) NLC 1965 — service of Form 16C is a CONDITION PRECEDENT to Order for Sale proceedings.
• Minimum notice period: ONE (1) MONTH from date of service.
• Must state the default specifically and amount outstanding.
• Mode of service: Personal service or by prepaid registered post to chargor's last known address (s. 431 NLC 1965).
• Keep Proof of Service (affidavit of service or AR card / registered post receipt) — it must be exhibited in the OS affidavit.
• After expiry of Form 16C notice without remedy: proceed to Form 16D.
─────────────────────────────────────────────────────────────`,
  },

  "Form 16D (Foreclosure Notice)": {
    name: "Form 16D — Notice of Application for Order for Sale (National Land Code 1965)",
    description: "Statutory notice of intention to apply for Order for Sale served at least one month before filing Originating Summons — s. 254 NLC 1965 and Order 83 r 3 ROC 2012",
    content: `FORM 16D
NATIONAL LAND CODE 1965

NOTICE OF APPLICATION FOR ORDER FOR SALE
[Section 254(1) National Land Code 1965; Order 83 r 3, Rules of Court 2012]

FROM: [BANK NAME]                                       Date: [Date]
      [Bank's Address]
      (hereinafter referred to as "the Chargee")

TO:   [CHARGOR'S FULL NAME]
      [CHARGOR'S NRIC / COMPANY REG. NO.]
      [CHARGOR'S ADDRESS]
      (hereinafter referred to as "the Chargor")

─────────────────────────────────────────────────────────────────────────
PARTICULARS OF CHARGE
─────────────────────────────────────────────────────────────────────────
Property     : [Lot No. / P.T. No.], [Mukim / Town / Village],
               [District], [State]
Title        : [H.S.(D) No. / Geran No. / Pajakan No.], [Lot No.]
Title No.    : [Title Reference Number]
Facility     : [Loan / Facility Agreement dated [Date]]
Account No.  : [Account Number]

─────────────────────────────────────────────────────────────────────────
NOTICE
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that the Chargee served a Notice Before Foreclosure (Form 16C) on you on [Date of Form 16C Service] requiring you to remedy the default by payment of the total outstanding sum of RM[Amount] within one (1) month.

AND TAKE NOTICE that you have FAILED to remedy the default as required by the said Form 16C Notice.

ACCORDINGLY, pursuant to Section 254 of the National Land Code 1965 and Order 83 r 3 of the Rules of Court 2012, the Chargee hereby gives notice that it INTENDS TO APPLY to the High Court for an Order for Sale of the above-described charged property:

    Property:   [Full description of property]
    Title No.:  [Title Reference]
    District:   [District], [State]

The total outstanding amount as at the date of this Notice is:

    Principal Outstanding:       RM [Amount]
    Interest / Profit Accrued:   RM [Amount]
    Penalty / Late Charges:      RM [Amount]
    Legal Charges:               RM [Amount]
    ────────────────────────────────────────
    TOTAL OUTSTANDING:           RM [Amount]
    ────────────────────────────────────────

The Chargee intends to file its application for Order for Sale after the expiration of ONE (1) MONTH from the date of service of this Notice.

You are hereby NOTIFIED that you have the right to apply to the High Court to restrain the proposed Order for Sale if you have a legitimate defence. Any application to restrain must be made before the hearing of the Originating Summons.

This Notice is without prejudice to all other rights and remedies of the Chargee.

Dated this [Day] day of [Month] [Year].

................................................
For and on behalf of
[BANK NAME]
[Authorised Signatory's Name & Designation]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Form 16D must be served AT LEAST ONE (1) MONTH before filing the Originating Summons for Order for Sale.
• Form 16D can only be served AFTER expiry of the Form 16C notice period without remedy of default.
• Mode of service: Same as Form 16C — personal service or registered post (s. 431 NLC 1965).
• Keep all proof of service documents — they are exhibited in the OS affidavit as mandatory exhibits.
• Minimum period between Form 16C notice and filing OS: at least 2 months (1 month Form 16C + 1 month Form 16D).
• If chargor pays after Form 16D but before OS is filed, proceedings should be stayed.
─────────────────────────────────────────────────────────────`,
  },

  "Proclamation of Sale": {
    name: "Proclamation of Sale (Public Auction — Order for Sale)",
    description: "Notice of public auction of charged property by Land Administrator pursuant to Order for Sale — s. 256 National Land Code 1965",
    content: `PROCLAMATION OF SALE
[Section 256, National Land Code 1965]
[HIGH COURT IN MALAYA AT [STATE] — ORIGINATING SUMMONS NO. [NUMBER]]

LAND ADMINISTRATOR / PENTADBIR TANAH
[DISTRICT], [STATE]

IN THE MATTER OF THE NATIONAL LAND CODE 1965
AND IN THE MATTER OF AN ORDER FOR SALE DATED [DATE]
OF THE HIGH COURT IN MALAYA AT [STATE] IN ORIGINATING SUMMONS NO. [NUMBER]

IN THE MATTER OF:

Property : [Description of Land / Lot Number]
Title    : [H.S.(D) / Geran / Pajakan No.], Lot [No.]
Mukim    : [Mukim/Town], District of [District], [State]
Land Area: [Area in sq. metres / acres / hectares]
Category : [Agricultural / Building / Industry]
Encumbrance: Registered Charge in favour of [Bank Name]

DESCRIPTION OF PROPERTY:
[Full description including improvements, e.g., "A [single-storey / double-storey / 
three-storey] [detached / semi-detached / terrace] [house / shophouse / factory / land] 
bearing postal address [No., Street, Town, Postcode, State]"]

RESERVED PRICE: RM [Amount]
(Based on market value as assessed by [Registered Valuer's Name & Firm] dated [Valuation Date])

CONDITIONS OF SALE:
1.  A deposit of TEN PERCENT (10%) of the purchase price shall be paid immediately upon the fall of the hammer, by BANK DRAFT payable to the Land Administrator.
2.  The balance of the purchase price shall be paid within NINETY (90) DAYS from the date of the auction [or HUNDRED AND TWENTY (120) DAYS for foreign purchasers].
3.  The property is sold in its existing state and condition and subject to all existing conditions and encumbrances noted on the title and all prior registered interests (if any).
4.  The purchaser shall bear all stamp duty, legal fees, and registration costs.
5.  Bidders must register before the auction and produce their NRIC / Passport and comply with all anti-money laundering requirements.
6.  The sale is subject to the approval of the relevant State Authority where required.
7.  The Land Administrator reserves the right to postpone or adjourn the sale without prior notice.

NOTICE IS HEREBY GIVEN that the above property will be sold by PUBLIC AUCTION on:

    Date  : [Day], [Date] [Month] [Year]
    Time  : [Time] [a.m. / p.m.]
    Venue : [Location of Auction, e.g., Office of the Land Administrator,
              District Land Office, [Town], [State]]

For further information and inspection of the property, please contact:

[BANK'S SOLICITORS' NAME]
[Address]
[Tel / Fax / Email]
Reference: [File Reference]

Land Administrator / Pentadbir Tanah
[District Land Office]
[Address]
[Tel / Fax]

Dated: [Date]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Proclamation is issued by the Land Administrator under s. 256 NLC 1965 based on the Order for Sale.
• Valuation report must not be more than 12 months old at the time of auction.
• Reserved price is set by the Court in the Order for Sale based on valuation.
• Chargee may apply to Court to vary the reserved price (Liberty to Apply clause in Order for Sale).
• Auction proceeds priority: (1) Land Administrator's costs; (2) Chargee's outstanding debt + costs; (3) Surplus to Chargor.
• If no bidder at the reserved price, auction may be adjourned and chargee may apply to court to reduce reserved price.
─────────────────────────────────────────────────────────────`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PART IV: CORPORATE INSOLVENCY DOCUMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  "Statutory Demand (Companies Act 2016)": {
    name: "Statutory Demand under s. 466(1)(a) Companies Act 2016",
    description: "Written demand served on company before filing winding up petition — minimum debt RM10,000, 21-day response period",
    content: `STATUTORY DEMAND
[Section 466(1)(a), Companies Act 2016 (Act 777)]
[Companies (Winding Up) Rules 1972, Form 69 — Adapted]

DATE: [Date]

TO:   [COMPANY NAME (COMPANY REGISTRATION NO. [REG NO.])]
      [Registered Office Address]
      (hereinafter referred to as "the Company")

FROM: [BANK NAME (COMPANY REGISTRATION NO. [REG NO.])]
      [Bank's Address]
      (hereinafter referred to as "the Creditor")

─────────────────────────────────────────────────────────────────────────
STATUTORY DEMAND FOR PAYMENT
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that the above-named Creditor is a creditor of the Company for the sum of RM[Amount] (Ringgit Malaysia [Amount in words]) as particularised below, being a debt due and payable:

PARTICULARS OF DEBT:

    Facility            : [Type of Facility, e.g., Term Loan / Overdraft]
    Agreement No.       : [Account / Agreement Reference]
    Facility Agreement  : Dated [Date]
    Outstanding Principal: RM [Amount]
    Interest / Profit   : RM [Amount]
    Penalty / Charges   : RM [Amount]
    ─────────────────────────────────────────────
    TOTAL DEMANDED      : RM [Amount]
    ─────────────────────────────────────────────

AND TAKE NOTICE that the Creditor hereby demands that the Company, within TWENTY-ONE (21) DAYS from the date of service of this demand:

(a)  Pay the said sum of RM[Amount] in full, together with interest continuing to accrue at [X]% per annum from the date of this demand until full payment; OR

(b)  Secure or compound the said sum to the reasonable satisfaction of the Creditor.

TAKE FURTHER NOTICE that if the Company fails to comply with this demand within the said 21-day period, the Creditor will be entitled to file a Petition for the winding up of the Company in the High Court on the ground that the Company is unable to pay its debts, pursuant to Sections 465(1)(e) and 466(1)(a) of the Companies Act 2016.

The Company may apply to the High Court to set aside this Statutory Demand within the 21-day period if the Company has a bona fide dispute as to the debt or if there are other grounds recognised by law.

This demand is without prejudice to all other rights and remedies of the Creditor.

Dated this [Day] day of [Month] [Year].

................................................
For and on behalf of
[BANK NAME]
[Authorised Signatory's Name & Designation]
[Bank's Address]
[Tel / Fax]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Minimum threshold: RM10,000 (s. 466(1)(a) CA 2016).
• The 21-day period runs from the date of service at the registered office.
• Service: At the company's REGISTERED OFFICE (not just business address) — s. 581 CA 2016.
• Keep proof of service (process server's affidavit or AR registered post receipt).
• Winding up petition must be PRESENTED WITHIN 4 MONTHS of the expiry of the statutory demand (if relying on s. 466(1)(a)).
• If company disputes the debt: Do not proceed to petition — a disputed debt cannot found a winding up petition (established by Malaysian courts).
• Distinguish from BANKRUPTCY NOTICE (for individual debtors under Insolvency Act 1967, minimum RM50,000).
─────────────────────────────────────────────────────────────`,
  },

  "Winding Up Petition": {
    name: "Winding Up Petition (Form 3, Companies Winding Up Rules 1972)",
    description: "Petition to wind up a company unable to pay its debts under s. 465(1)(e) and s. 466 Companies Act 2016",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
COMPANIES (WINDING UP) DIVISION

COMPANIES WINDING UP NO. [YEAR]-[NUMBER]

IN THE MATTER OF
[COMPANY NAME (COMPANY REGISTRATION NO. [REG NO.])]

AND IN THE MATTER OF THE COMPANIES ACT 2016

                         PETITION
                  FOR WINDING UP OF COMPANY

To the Honourable the Judge of the above Court:

THE PETITION OF [BANK NAME] (Company Registration No. [Reg No.]) of [Address] (hereinafter referred to as "the Petitioner") HUMBLY SHOWETH:

1.   [COMPANY NAME] (Company Registration No. [Reg No.]) ("the Company") was incorporated in Malaysia under the Companies Act [1965 / 2016] on [Date of Incorporation] and has its registered office at [Registered Office Address].

2.   The principal business of the Company is [description of business, e.g., property development / trading / manufacturing / services].

3.   The nominal / authorised share capital of the Company is RM[Amount] divided into [Number] ordinary shares of RM[Face Value] each, of which [Number] shares have been issued and are fully paid up.

4.   The Petitioner is a creditor of the Company in the sum of RM[Amount] particulars whereof are as follows:

     (a)  Pursuant to a [Facility Agreement / Loan Agreement] dated [Date] ("the Agreement"), the Petitioner extended to the Company a [Term Loan / Overdraft Facility] of RM[Principal Amount];

     (b)  The Company defaulted in its repayment obligations under the Agreement commencing [Month, Year];

     (c)  As at the date of this Petition, the total sum outstanding and payable by the Company to the Petitioner is RM[Amount] comprising:

          Principal Outstanding:   RM [Amount]
          Interest Accrued:        RM [Amount]
          Penalty Charges:         RM [Amount]
          ─────────────────────────────────────
          TOTAL:                   RM [Amount]
          ─────────────────────────────────────

5.   On [Date], the Petitioner served on the Company at its registered address a Statutory Demand pursuant to Section 466(1)(a) of the Companies Act 2016, demanding payment of the said sum of RM[Amount] within twenty-one (21) days.

6.   The Company has failed, neglected, or refused to pay the said sum or any part thereof, or to compound or secure the same to the satisfaction of the Petitioner, within the said period or at all.

7.   The Company is therefore unable to pay its debts within the meaning of Section 466(1)(a) of the Companies Act 2016, and it is just and equitable that the Company be wound up.

8.   No winding up petition has previously been presented against the Company (or if so: "A previous petition was presented on [Date] but was [withdrawn / dismissed / resolved]").

9.   To the best of the Petitioner's knowledge and belief, the estimated assets of the Company are worth approximately RM[Amount] and the estimated liabilities of the Company are approximately RM[Amount].

10.  The Petitioner submits that this Court has jurisdiction to wind up the Company under Section 464(1) of the Companies Act 2016.

THE PETITIONER THEREFORE HUMBLY PRAYS that:

(a)  [COMPANY NAME] (Company Registration No. [Reg No.]) may be wound up by the Court under the provisions of the Companies Act 2016;

(b)  The Official Receiver be appointed as provisional liquidator pending the appointment of a liquidator;

(c)  Such further or other order or orders may be made as this Honourable Court shall deem fit.

Signed: ................................................
        Authorised Officer of [Bank Name]
        [Designation]
        
The Petitioner's address for service is:
[FIRM NAME]
[Address]
[Tel / Fax / Email]
[File Reference]

This Petition was presented by [Firm Name], Advocates & Solicitors for the Petitioner.

Dated this [Day] day of [Month] [Year].

─────────────────────────────────────────────────────────────
FILING NOTES:
• Must be filed in the High Court (Commercial Division / Company Division).
• Must be accompanied by: (a) Verifying Affidavit; (b) proof of service of statutory demand; (c) Certificate of Search / Company Search from SSM.
• Service: Sealed petition must be served at the company's REGISTERED OFFICE under Order 65 r 2 ROC 2012 or s. 581 CA 2016.
• Advertisement: Must advertise in TWO Malaysian newspapers (one BM, one English) at least SEVEN CLEAR DAYS before hearing — Companies (Winding Up) Rules 1972.
• Filing time: Petition must be presented within 4 months of expiry of the statutory demand (s. 466(1)(a) CA 2016).
• If company disputes the debt: Court may dismiss the petition. Winding up is NOT a debt collection mechanism — it is reserved for clearly insolvent companies.
─────────────────────────────────────────────────────────────`,
  },

  "Verifying Affidavit (Winding Up)": {
    name: "Verifying Affidavit (Winding Up Petition) — Companies Winding Up Rules 1972",
    description: "Affidavit by petitioner's officer verifying the facts in the winding up petition — filed together with the petition",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
COMPANIES (WINDING UP) DIVISION

COMPANIES WINDING UP NO. [YEAR]-[NUMBER]

IN THE MATTER OF
[COMPANY NAME (COMPANY REGISTRATION NO. [REG NO.])]

AND IN THE MATTER OF THE COMPANIES ACT 2016

VERIFYING AFFIDAVIT OF [PETITIONER'S OFFICER NAME]
(Companies Winding Up Rules 1972)

I, [FULL NAME OF DEPONENT] (NRIC No. [Number]), [Designation, e.g., Senior Manager / Credit Recovery Officer] of [Bank Name] of [Bank's Address], do solemnly and sincerely affirm as follows:

1.   I am a duly authorised officer of [Bank Name] ("the Petitioner") and am authorised to make this Affidavit on its behalf. I have personal knowledge of the facts herein, save where otherwise stated.

2.   I have read the Winding Up Petition filed herein and the facts therein stated are, to the best of my knowledge and belief, true, correct, and accurate.

3.   The Petitioner is a licensed bank incorporated in Malaysia and is a creditor of [Company Name] ("the Company") in respect of a [Facility Agreement / Loan Agreement] dated [Date] ("the Agreement").

4.   The Company has defaulted in its repayment obligations under the Agreement. As at [Date], the total outstanding sum due from the Company to the Petitioner is RM[Amount], computed as follows:

     (a)  Principal Outstanding:   RM [Amount]
     (b)  Interest Accrued:        RM [Amount]
     (c)  Penalty Charges:         RM [Amount]
                                  ────────────
          TOTAL:                   RM [Amount]

     Exhibited hereto and marked as Exhibit "WA-1" is a Statement of Account confirming the above.

5.   On [Date], the Petitioner served a Statutory Demand on the Company at its registered office at [Address], demanding payment of the outstanding sum within twenty-one (21) days. The Statutory Demand is exhibited hereto and marked as Exhibit "WA-2".

6.   Service of the Statutory Demand was effected by [Personal Service / Prepaid Registered Post] on [Date]. Exhibited hereto and marked as Exhibit "WA-3" is [the affidavit of the process server / the AR card / registered post acknowledgment].

7.   The twenty-one (21) day period for payment expired on [Date]. As at the date of swearing this Affidavit, the Company has failed to pay the demanded sum or any part thereof.

8.   Exhibited hereto and marked as Exhibit "WA-4" is a Company Search obtained from the Suruhanjaya Syarikat Malaysia ("SSM") confirming the registered office and directors of the Company.

9.   To the best of my knowledge and belief, the Company has no subsisting application before any court to set aside the Statutory Demand.

10.  I make this Affidavit in support of the Petition for Winding Up.

Affirmed at [Town / City]   )
on this [Day] day of        )
[Month] [Year]              )

Before me:

................................................
Commissioner for Oaths / Magistrate
[Name, Address, Registration No.]

─────────────────────────────────────────────────────────────
FILING NOTES:
• The Verifying Affidavit must be affirmed (NOT sworn) by an officer of the Petitioner who has personal knowledge of the debt.
• Exhibits must be properly indexed and exhibited with the deponent's initials.
• Must be filed contemporaneously with the Winding Up Petition.
• The deponent must be authorised by a Board Resolution or power of attorney to swear on behalf of the bank — attach a copy of the authorisation.
• Commissioner for Oaths: Under s. 4 of the Oaths and Affirmations Act 2012 (Act 728), affidavits filed in court must be affirmed before a Commissioner for Oaths or Judge / Magistrate.
─────────────────────────────────────────────────────────────`,
  },

  "Proof of Debt (Winding Up)": {
    name: "Proof of Debt (Winding Up) — Form 78, Companies Winding Up Rules 1972",
    description: "Filed by creditors (including banks) with the liquidator to prove the debt and participate in dividend distribution",
    content: `PROOF OF DEBT
(GENERAL FORM)
[Companies Winding Up Rules 1972, Form 78]

In the matter of the winding up of:

Company Name  : [COMPANY NAME]
Company No.   : [Registration Number]
Date of Winding Up Order: [Date]
Court Reference : [Companies Winding Up No.]
Name of Liquidator: [Liquidator's Name & Firm]

─────────────────────────────────────────────────────────────────────────
PART A: CREDITOR'S PARTICULARS
─────────────────────────────────────────────────────────────────────────

Full Name of Creditor : [BANK NAME]
Company Reg. No.      : [Registration Number]
Address               : [Bank's Address]
Contact Person        : [Name, Tel, Email]
Represented by        : [Firm Name, Address] (Solicitors)

─────────────────────────────────────────────────────────────────────────
PART B: PARTICULARS OF DEBT
─────────────────────────────────────────────────────────────────────────

1.   Nature of Debt / Claim:
     [Describe: e.g., "Outstanding balance under Term Loan Facility Agreement dated [Date]"]

2.   Total Debt as at Date of Winding Up Order ([Date]):

     (a) Principal Outstanding:                       RM [Amount]
     (b) Interest / Profit (up to date of WU order):  RM [Amount]
     (c) Penalty / Default Charges:                   RM [Amount]
     (d) Other Charges (specify):                     RM [Amount]
         ─────────────────────────────────────────────
         TOTAL DEBT CLAIMED:                          RM [Amount]
         ─────────────────────────────────────────────

3.   Is the creditor a secured creditor?
     [ ] YES — describe security: [e.g., registered charge over title H.S.(D) No. [X], Lot [X]]
              Value of security:  RM [Amount] (as at [Date], per valuation by [Valuer])
              Claim as unsecured for shortfall: RM [Amount]
     [X] NO  — creditor is an unsecured creditor for the full amount

4.   Has the creditor received any payments or security since the date of the winding up order?
     [ ] YES — provide details: ___________________
     [X] NO

─────────────────────────────────────────────────────────────────────────
PART C: DOCUMENTS ANNEXED
─────────────────────────────────────────────────────────────────────────

(i)   Certified copy of Facility Agreement dated [Date]
(ii)  Statement of Account as at date of winding up order
(iii) Demand letters / correspondence
(iv)  Judgment (if any) obtained against the Company
(v)   Charge document / debenture (if applicable)
(vi)  Other supporting documents: ________________

─────────────────────────────────────────────────────────────────────────
DECLARATION
─────────────────────────────────────────────────────────────────────────

I, [Name & Designation] of [Bank Name], hereby declare that the above is a full, true, and complete statement of the debt owing by the above-named Company to [Bank Name] as at the date of the Winding Up Order.

Signed: ................................................
        [Name & Designation]
        For and on behalf of [Bank Name]

Date  : [Date]

─────────────────────────────────────────────────────────────
FILING NOTES:
• File with the Liquidator (not the Court) within the period specified in the notice to creditors.
• For secured creditors: You may either (a) realise the security and prove for the shortfall; (b) surrender the security and prove for the full amount; or (c) value the security and prove for the balance.
• Post-winding-up interest does NOT accrue on unsecured debts.
• Proof of debt must be submitted BEFORE the distribution of dividend — late proofs may be rejected.
• If the Liquidator rejects the proof, the creditor may apply to Court within 21 days of notice of rejection.
─────────────────────────────────────────────────────────────`,
  },

  "Notice of Appointment of Receiver and Manager": {
    name: "Notice of Appointment of Receiver and Manager (s. 384, Companies Act 2016)",
    description: "Notice of appointment of Receiver and Manager under a debenture — must be filed with Registrar of Companies within 14 days and served on the company",
    content: `NOTICE OF APPOINTMENT OF RECEIVER AND MANAGER
[Section 384, Companies Act 2016 (Act 777)]

DATE OF APPOINTMENT: [Date]                        TIME: [Time]

COMPANY NAME      : [COMPANY NAME]
COMPANY REG. NO.  : [Registration Number]
REGISTERED OFFICE : [Registered Office Address]
(hereinafter referred to as "the Company")

APPOINTING PARTY  : [BANK NAME]
                    (hereinafter referred to as "the Appointor" or "the Chargee")

─────────────────────────────────────────────────────────────────────────
NOTICE OF APPOINTMENT
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that pursuant to the powers conferred by the Debenture dated [Date] and/or Fixed and Floating Charge dated [Date] ("the Debenture") executed by the Company in favour of [Bank Name], and pursuant to Section 381 and Section 382 of the Companies Act 2016, [Bank Name] hereby gives notice that it has appointed:

        [RECEIVER AND MANAGER'S FULL NAME]
        [Firm Name]
        [Firm Address]
        Licensed Insolvency Practitioner (Licence No. [Number])

as RECEIVER AND MANAGER ("the Receiver") of [ALL / the following] assets, property, and undertaking of the Company secured under the Debenture:

    [List assets under charge, e.g.:]
    (a)  All fixed assets including land and buildings [specify title numbers];
    (b)  All plant and machinery;
    (c)  All book debts and receivables;
    (d)  All cash and bank balances;
    (e)  The goodwill and all other assets of the Company's business;
    (f)  [Other specifically charged assets]

The appointment of the Receiver is made consequent upon the occurrence of the following event(s) of default under the Debenture:

    [Specify default: e.g., "The Company has failed to pay the sum of RM[Amount] due under Clause [X] of the Debenture Agreement dated [Date] upon demand made on [Date]."]

The powers of the Receiver and Manager are as set out in the Debenture and as provided by Sections 381-412 of the Companies Act 2016, including but not limited to:
• Taking possession of and managing the Company's assets;
• Carrying on the Company's business;
• Selling or otherwise disposing of the Company's assets;
• Collecting the Company's debts;
• Making payments to creditors in order of priority.

ALL persons indebted to the Company are hereby directed to pay their debts to the Receiver and Manager and NOT to the Company or its directors.

ALL persons in possession of assets of the Company are hereby required to deliver possession of such assets to the Receiver and Manager.

The directors of the Company are hereby notified that their powers in relation to the property and undertaking subject to the Debenture are SUSPENDED from the date of this Notice.

Dated this [Day] day of [Month] [Year].

................................................
For and on behalf of [BANK NAME]
[Authorised Signatory's Name & Designation]

ACCEPTANCE OF APPOINTMENT:

I, [Receiver's Full Name], hereby confirm my acceptance of appointment as Receiver and Manager of [Company Name] on the terms set out above.

................................................
[Receiver's Name]
Licensed Insolvency Practitioner
[Firm Name & Address]
Date: [Date]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Receiver must file notice of appointment with the Registrar of Companies (Suruhanjaya Syarikat Malaysia) within 14 days of appointment — s. 384 CA 2016 (failure is an offence).
• Receiver must also notify the company's employees.
• Receiver must prepare Statement of Affairs within 14 days of receipt from the company's directors.
• First Report: Receiver must submit report to the Registrar within 30 days of appointment.
• The Receiver acts as agent of the Company (NOT the bank) — the Chargee bank is NOT liable for the Receiver's acts.
• Moratorium: Winding up petition does NOT automatically discharge the Receiver — but court leave is required to continue proceedings against the company.
─────────────────────────────────────────────────────────────`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PART V: HIRE PURCHASE ACT 1967 — STATUTORY NOTICES
  // ─────────────────────────────────────────────────────────────────────────────

  "Second Schedule Notice (Hire Purchase)": {
    name: "Notice of Default — Second Schedule, Hire-Purchase Act 1967",
    description: "Mandatory notice of default served on hirer before repossession — s. 16(1)(b) Hire-Purchase Act 1967. 21-day response period.",
    content: `NOTICE OF DEFAULT
[SECOND SCHEDULE, HIRE-PURCHASE ACT 1967 (ACT 212)]
[Section 16(1)(b), Hire-Purchase Act 1967]

TO:   [HIRER'S FULL NAME (NRIC NO. [NUMBER])]          Date: [Date]
      [Hirer's Address]

FROM: [BANK / FINANCE COMPANY NAME]
      (hereinafter referred to as "the Owner")

─────────────────────────────────────────────────────────────────────────
HIRE PURCHASE AGREEMENT PARTICULARS
─────────────────────────────────────────────────────────────────────────

Agreement No.   : [HP Agreement Number]
Agreement Date  : [Date of HP Agreement]
Description     : [Vehicle Make, Model, Year, e.g., "Toyota Vios 2021, White"]
Registration No.: [Vehicle Registration Number]
Chassis No.     : [Chassis Number]
Engine No.      : [Engine Number]
HP Price        : RM [Total Hire Purchase Price]
Deposit Paid    : RM [Amount]
Balance HP Price: RM [Amount]
Monthly Instalment: RM [Amount]
Total No. of Instalments: [Number] months

─────────────────────────────────────────────────────────────────────────
NOTICE
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that you have defaulted in your payment obligations under the above Hire Purchase Agreement. As at the date of this Notice, the amount overdue is as follows:

    Number of Instalments Overdue:         [Number] months
    Monthly Instalment Amount:             RM [Amount]
    Total Overdue Instalment Amount:       RM [Amount]
    Late Payment Charges:                  RM [Amount]
    ──────────────────────────────────────────────────
    TOTAL AMOUNT NOW DUE FOR PAYMENT:      RM [Amount]
    ──────────────────────────────────────────────────

    Arrears Period: From [Month/Year] to [Month/Year]

TAKE FURTHER NOTICE that unless you pay the total overdue amount of RM[Amount] to the Owner at [Payment Address] within TWENTY-ONE (21) DAYS from the date of service of this Notice, the Owner may exercise its right to repossess the above vehicle pursuant to Section 16(1) of the Hire-Purchase Act 1967.

This Notice is issued pursuant to the Second Schedule of the Hire-Purchase Act 1967.

This Notice is without prejudice to the Owner's right to take legal proceedings to recover the full outstanding balance under the Hire Purchase Agreement.

Dated this [Day] day of [Month] [Year].

................................................
For and on behalf of [BANK / FINANCE COMPANY NAME]
[Authorised Signatory's Name & Designation]
[Address]
[Tel / Fax]

─────────────────────────────────────────────────────────────
FILING NOTES:
• This notice is MANDATORY before any repossession — failure to serve renders any repossession unlawful (s. 16(1)(b) HPA 1967).
• The 21-day period runs from DATE OF SERVICE (not date on notice).
• Service: Personal service OR by prepaid registered post to hirer's last known address.
• ONE-THIRD RULE (s. 16(2) HPA 1967): If hirer has paid ONE-THIRD or more of the HP price, the Owner CANNOT repossess without a court order, even after the 21-day notice expires.
• Calculate the one-third paid: Total HP Price ÷ 3 = threshold. Compare against total amount paid by hirer (deposit + instalments paid).
• Failure to comply with statutory notice requirements: Owner cannot sue for deficiency (s. 23 HPA 1967).
─────────────────────────────────────────────────────────────`,
  },

  "Third Schedule Notice (Hire Purchase)": {
    name: "Notice After Repossession — Third Schedule, Hire-Purchase Act 1967",
    description: "Notice served on hirer within 7 days of repossession informing of right to redeem — s. 17(1) Hire-Purchase Act 1967",
    content: `NOTICE AFTER REPOSSESSION OF GOODS
[THIRD SCHEDULE, HIRE-PURCHASE ACT 1967 (ACT 212)]
[Section 17(1), Hire-Purchase Act 1967]

TO:   [HIRER'S FULL NAME (NRIC NO. [NUMBER])]          Date: [Date]
      [Hirer's Address]

FROM: [BANK / FINANCE COMPANY NAME]
      (hereinafter referred to as "the Owner")

─────────────────────────────────────────────────────────────────────────
HIRE PURCHASE AGREEMENT PARTICULARS
─────────────────────────────────────────────────────────────────────────

Agreement No.   : [HP Agreement Number]
Description     : [Vehicle Make, Model, Year]
Registration No.: [Vehicle Registration Number]
Date of Repossession: [Date]
Place of Repossession: [Address/Location]
Name of Repossessing Officer: [Name, Designation]
Present Location of Vehicle: [Storage Yard / Compound Address]

─────────────────────────────────────────────────────────────────────────
NOTICE OF REPOSSESSION AND RIGHT TO REDEEM
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that the Owner has repossessed the above-described vehicle on [Date] pursuant to the powers conferred under the Hire-Purchase Act 1967.

The repossession was effected due to your default in payment under the Hire Purchase Agreement, particulars of which are as follows:

    Total Outstanding Balance as at Date of Repossession: RM [Amount]
    Comprising:
    (a) Remaining HP Instalments:                         RM [Amount]
    (b) Overdue Instalments:                              RM [Amount]
    (c) Late Payment Charges:                             RM [Amount]
    (d) Repossession Costs:                               RM [Amount]
    ────────────────────────────────────────────────────────────
    TOTAL AMOUNT REQUIRED TO REDEEM VEHICLE:              RM [Amount]
    ────────────────────────────────────────────────────────────

YOU ARE HEREBY NOTIFIED of your right to REDEEM the above vehicle within TWENTY-ONE (21) DAYS from the date of service of this Notice by paying the total redemption sum of RM[Amount] to the Owner at:

        [Payment Office Address]
        [Tel: xxx-xxxxxxxx]
        [Business Hours: xxx am to xxx pm, Monday to Friday]

If you wish to redeem the vehicle, please contact the Owner at the above address / telephone number.

FURTHER NOTICE:

If the vehicle is NOT redeemed within the said 21-day period, the Owner shall be entitled to sell the vehicle at public auction or by private treaty pursuant to Section 18 of the Hire-Purchase Act 1967. You will be given at least [X] days' notice of any intended sale.

If the net sale proceeds are LESS than the total outstanding balance, you may be liable to pay the DEFICIENCY to the Owner. If the net proceeds are MORE than the outstanding balance, the SURPLUS will be returned to you.

Dated this [Day] day of [Month] [Year].

................................................
For and on behalf of [BANK / FINANCE COMPANY NAME]
[Authorised Signatory's Name & Designation]
[Address]
[Tel / Fax]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Must be served within SEVEN (7) DAYS of the date of repossession (s. 17(1) HPA 1967) — failure is a criminal offence.
• The hirer has a right to redeem the vehicle within 21 days of service of this notice (s. 17(1) HPA 1967).
• Right to redeem CONTINUES until the actual date of sale (not just 21 days).
• If you sell before giving the hirer reasonable notice of the sale, the deficiency claim may be defeated.
• Notice of sale: Under s. 18 HPA 1967, Owner must notify hirer of the date, time, and place of proposed sale at least [X] days in advance.
• Deficiency claim (s. 20 HPA 1967): Owner may sue for deficiency ONLY if all statutory notices were properly served and sale was conducted in compliance with HPA 1967. Limitation period: 6 years from date of sale.
─────────────────────────────────────────────────────────────`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PART VI: PERSONAL INSOLVENCY DOCUMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  "Bankruptcy Notice": {
    name: "Bankruptcy Notice (Form 1, Insolvency Rules 2017)",
    description: "Served on individual judgment debtor to demand payment within 7 days — failure constitutes act of bankruptcy under s. 3(1)(i) Insolvency Act 1967",
    content: `BANKRUPTCY NOTICE
[FORM 1, INSOLVENCY RULES 2017]
[Section 3(1)(i), Insolvency Act 1967 (Act 360)]

IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
INSOLVENCY DIVISION

BANKRUPTCY NOTICE NO. [YEAR]-[NUMBER]-[YEAR]

TO:   [DEBTOR'S FULL NAME (NRIC NO. [NUMBER])]
      [Debtor's Last Known Address]

FROM: [BANK NAME / JUDGMENT CREDITOR]
      [Address]
      (hereinafter referred to as "the Judgment Creditor")

─────────────────────────────────────────────────────────────────────────
PARTICULARS OF JUDGMENT / COURT ORDER
─────────────────────────────────────────────────────────────────────────

Court         : High Court in Malaya at [State]
Suit Number   : [Civil Suit / OS No.]
Date of Judgment: [Date]
Judgment Sum  : RM [Principal + Interest up to date of judgment]
Post-judgment interest: [X]% per annum / RM [Amount] per day
Costs awarded : RM [Amount]

─────────────────────────────────────────────────────────────────────────
DEMAND
─────────────────────────────────────────────────────────────────────────

TAKE NOTICE that pursuant to a judgment / order of the High Court in Malaya at [State] dated [Date] made in [Suit No.], you are indebted to [Bank Name] ("the Judgment Creditor") in the sum of RM[Judgment Sum].

The total amount now due (including post-judgment interest up to the date of this Notice) is:

    Judgment Sum:                              RM [Amount]
    Post-judgment interest ([X]% p.a.
    from [Date] to [Date of Notice]):          RM [Amount]
    Costs awarded (if not yet paid):           RM [Amount]
    ────────────────────────────────────────────────────
    TOTAL DUE AS AT [DATE OF NOTICE]:          RM [Amount]
    ────────────────────────────────────────────────────

YOU ARE HEREBY REQUIRED, within SEVEN (7) DAYS from the date of service of this Bankruptcy Notice on you:

(a)  To pay to the Judgment Creditor the said sum of RM[Total Amount]; OR

(b)  To satisfy the Judgment Creditor that you have a counter-claim, set-off, or cross-demand which equals or exceeds the judgment debt; OR

(c)  To secure or compound the said sum to the satisfaction of the Judgment Creditor.

TAKE FURTHER NOTICE that if you fail to comply with this Bankruptcy Notice within the said period, you will have committed an ACT OF BANKRUPTCY within the meaning of Section 3(1)(i) of the Insolvency Act 1967, and the Judgment Creditor may present a CREDITOR'S PETITION against you in the High Court for a Bankruptcy Order.

Payment should be made to: [Bank Name / Solicitors' Trust Account]
Account Number: [Account No.]
Bank: [Bank Name, Branch]
Reference: [Debtor's Name / File Ref]

IMPORTANT: You may apply to the High Court to set aside this Bankruptcy Notice if you have a genuine counter-claim, set-off, or cross-demand against the Judgment Creditor. Any such application should be made promptly.

Dated this [Day] day of [Month] [Year].

................................................
[FIRM NAME]
Advocates & Solicitors for the Judgment Creditor
[Address]
[Tel / Fax / Email]
[File Reference]

─────────────────────────────────────────────────────────────
FILING NOTES:
• Minimum debt threshold: RM50,000 (as amended by Insolvency (Amendment) Act 2017 — Act 1013).
• Bankruptcy Notice must be based on a FINAL JUDGMENT — not an interlocutory order.
• Time for service: Bankruptcy Notice must be served within 6 MONTHS of issue.
• Act of bankruptcy: Non-compliance with the BN within 7 days is the act of bankruptcy (s. 3(1)(i) IA 1967).
• Creditor's Petition must be filed within 6 MONTHS of the act of bankruptcy.
• Setting aside: Court will set aside BN if debtor has genuine cross-claim equal to or exceeding the debt.
• Debtor currently abroad: Alternative service may be ordered — obtain court order first.
• Important: Bankruptcy proceedings CANNOT proceed against guarantors if principal debtor is still alive and able to be sued first (check whether to proceed via writ against guarantor first).
─────────────────────────────────────────────────────────────`,
  },

  "Creditor's Petition (Bankruptcy)": {
    name: "Creditor's Petition — Bankruptcy (Form 7, Insolvency Rules 2017)",
    description: "Petition by creditor for bankruptcy order against individual debtor who has committed an act of bankruptcy — s. 5 Insolvency Act 1967",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
INSOLVENCY DIVISION

BANKRUPTCY PETITION NO. [YEAR]-[NUMBER]-[YEAR]

IN THE MATTER OF
[DEBTOR'S FULL NAME (NRIC NO. [NUMBER])]

AND IN THE MATTER OF THE INSOLVENCY ACT 1967

                      CREDITOR'S PETITION
                  [FORM 7, INSOLVENCY RULES 2017]

To the Honourable Judge of the above Court:

THE PETITION OF [BANK NAME] (Company Registration No. [Reg No.]) of [Address] (hereinafter referred to as "the Petitioner") HUMBLY SHOWETH:

1.   [DEBTOR'S FULL NAME] (NRIC No. [Number]) of [Debtor's address] ("the Debtor") is a [natural person / individual] and is not a [corporation / body corporate]. The Debtor is subject to the jurisdiction of this Court in that [the Debtor is ordinarily resident in Malaysia / the Debtor has property in Malaysia].

2.   The Debtor is indebted to the Petitioner in the sum of RM[Amount], being the total outstanding sum due under a judgment of the High Court in Malaya at [State] dated [Date] in Civil Suit No. [Number] ("the Judgment"). The Judgment debt with post-judgment interest as at the date of this Petition is as follows:

     (a)  Judgment Sum:                              RM [Amount]
     (b)  Post-judgment interest at [X]% p.a.        RM [Amount]
          (from [Date] to [Date of Petition])
     (c)  Taxed costs:                               RM [Amount]
          ──────────────────────────────────────────────────────
          TOTAL DEBT AS AT [DATE]:                   RM [Amount]
          ──────────────────────────────────────────────────────

3.   On [Date], the Petitioner caused to be served on the Debtor a Bankruptcy Notice (No. [BN No.]) requiring the Debtor to pay the sum of RM[Amount] within seven (7) days of service of the Notice.

4.   The Bankruptcy Notice was duly served on the Debtor on [Date of Service] at [address] by [mode of service — personal service / substituted service ordered by the Court on [Date]].

5.   The Debtor committed an act of bankruptcy on [Date] (being 7 days after service of the Bankruptcy Notice) in that the Debtor failed to pay, compound, or secure the said debt within the time required by the Bankruptcy Notice.

6.   The act of bankruptcy on which this Petition is grounded occurred within SIX (6) MONTHS before the presentation of this Petition.

7.   The total amount of the debt owed by the Debtor to the Petitioner is RM[Amount], which exceeds RM50,000 [the statutory minimum under s. 5(1)(b) Insolvency Act 1967 as amended in 2017].

8.   The Petitioner believes that the Debtor is unable to pay, secure, or compound the said debt.

9.   [Where applicable:] The Petitioner has no knowledge of any other creditor having presented a bankruptcy petition against the Debtor.

THE PETITIONER THEREFORE HUMBLY PRAYS that:

(a)  [DEBTOR'S FULL NAME] be adjudged bankrupt;

(b)  [Upon making of the bankruptcy order] the Director General of Insolvency / Official Assignee be constituted the trustee of the property of the bankrupt;

(c)  Such further or other relief as this Honourable Court deems fit.

Signed: ................................................
        [Name & Designation of Petitioner's Officer]
        For and on behalf of [Bank Name]

The Petitioner's address for service is:
[FIRM NAME]
[Address]
[Tel / Fax / Email]
[File Reference]

Dated this [Day] day of [Month] [Year].

─────────────────────────────────────────────────────────────
FILING NOTES:
• Must be accompanied by: (a) Verifying Affidavit (Form 8); (b) Bankruptcy Notice (copy); (c) Judgment (certified copy); (d) Affidavit of Service of Bankruptcy Notice.
• Must be filed within 6 MONTHS of the act of bankruptcy (s. 6 Insolvency Act 1967).
• Minimum debt: RM50,000 (post-2017 amendment). For debts below RM50,000, consider civil action / garnishee / charging order instead.
• Service of Petition: At least 7 days before hearing — personal service required (r. 99 Insolvency Rules 2017); substituted service by court order if personal service impracticable.
• Verification: Petition must be verified by Verifying Affidavit (Form 8) made by the Petitioner or an authorised officer.
• First hearing: Court fixes a hearing date. If Debtor does not appear and no grounds for dismissal, Bankruptcy Order is made.
• Effect of Bankruptcy Order: Debtor's property vests in DGI (Director General of Insolvency) under s. 46 IA 1967.
─────────────────────────────────────────────────────────────`,
  },

  "Garnishee Order Absolute": {
    name: "Garnishee Order Absolute (Order 49 r 4, ROC 2012)",
    description: "Final court order directing the garnishee (third-party bank) to pay the judgment debt to the judgment creditor — made at the show cause hearing",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[BANK NAME / JUDGMENT CREDITOR]                   ...PLAINTIFF

AND

[JUDGMENT DEBTOR'S NAME]                           ...DEFENDANT

─────────────────────────────────────────────────────────────────────────
GARNISHEE ORDER ABSOLUTE
(ORDER 49 r 4, RULES OF COURT 2012)
─────────────────────────────────────────────────────────────────────────

UPON the Garnishee Order Nisi dated [Date] having been served on [Garnishee's Name, e.g., Malayan Banking Berhad ("the Garnishee")] and on the Judgment Debtor [Judgment Debtor's Name] on [Date of Service];

AND UPON the matter coming on for hearing inter partes on [Date];

AND UPON reading the Garnishee Order Nisi and the affidavit of service filed herein;

AND UPON [the Garnishee confirming that it holds funds of the Judgment Debtor in Account No. [Number] in the amount of RM[Amount] / the Garnishee not appearing to show cause];

AND UPON the Judgment Debtor [not appearing / not showing cause why the order should not be made absolute];

BY CONSENT / ON THE MERITS, IT IS ORDERED that:

1.   The Garnishee Order Nisi dated [Date] be and is hereby made ABSOLUTE.

2.   [GARNISHEE'S NAME] ("the Garnishee") do pay to the Judgment Creditor [Bank Name] the sum of RM[Amount] [or such lesser sum as may be standing to the credit of the Judgment Debtor in Account No. [Number] held with the Garnishee] out of the debt due and accruing from the Garnishee to the Judgment Debtor [Name], in partial / full satisfaction of the Judgment Creditor's judgment dated [Date] in the sum of RM[Judgment Amount] with costs.

3.   The costs of this Garnishee application are fixed at RM[Amount] [or as taxed] to be paid by the Judgment Debtor to the Judgment Creditor.

4.   Upon payment in compliance with this Order, the Garnishee shall be discharged from all liability to the Judgment Debtor in respect of the sum so paid.

Made this [Day] day of [Month] [Year].

                              JUDGE / REGISTRAR / DEPUTY REGISTRAR
                              HIGH COURT IN MALAYA AT [STATE]

─────────────────────────────────────────────────────────────
FILING NOTES:
• The Garnishee Order Absolute is the final enforceable order compelling the garnishee to pay.
• Upon service of this Order Absolute on the Garnishee, the Garnishee MUST pay the specified sum to the Judgment Creditor.
• The payment by the Garnishee to the Judgment Creditor operates as a discharge of the Garnishee's debt to the Judgment Debtor.
• If the Garnishee disputes the debt: It must appear at the show cause hearing and file an affidavit — if it disputes owing a debt to the Judgment Debtor, the court may order a full hearing (Order 49 r 5 ROC 2012).
• IMPORTANT: Before serving the Order Nisi, ensure the judgment creditor actually holds a valid UNSATISFIED JUDGMENT — otherwise the garnishee order cannot issue.
• Concurrent proceedings: If Judgment Debtor has been adjudicated bankrupt, all garnishee proceedings must stop and the creditor must file Proof of Debt with the DGI.
─────────────────────────────────────────────────────────────`,
  },
  "Statement of Claim (Personal Injury)": {
    name: "Statement of Claim — Personal Injury (Motor Vehicle Accident)",
    description: "Pleading for personal injury claim arising from motor vehicle accident negligence",
    content: `IN THE [HIGH COURT IN MALAYA / SESSIONS COURT] AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S FULL NAME (NRIC NO. [NUMBER])]              ...PLAINTIFF

AND

[1ST DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]          ...1ST DEFENDANT

[2ND DEFENDANT (INSURANCE COMPANY) SDN BHD]              ...2ND DEFENDANT

                           STATEMENT OF CLAIM

1. The Plaintiff is [name], (NRIC: [number]), a [occupation] residing at [address].

2. The 1st Defendant is [name], (NRIC: [number]), the registered owner and/or driver of motor vehicle registration number [Vehicle No.].

3. The 2nd Defendant is [Insurance Company Name], a company duly incorporated in Malaysia and the insurer of the said motor vehicle at all material times.

4. On [Date] at approximately [Time], the Plaintiff was travelling [in motor vehicle registration no. [Vehicle No.] / as a pedestrian] along [road name], [town], [state] when the 1st Defendant's motor vehicle bearing registration number [Vehicle No.] [description of how accident occurred, e.g., "suddenly and negligently encroached into the Plaintiff's lane and collided with the Plaintiff's vehicle"].

5. By reason of the 1st Defendant's negligence, the Plaintiff suffered personal injuries, pain and suffering, and consequential losses.

                  PARTICULARS OF NEGLIGENCE
The 1st Defendant was negligent in that he/she:
(a) drove at an excessive speed;
(b) failed to keep a proper lookout;
(c) failed to maintain proper control of the said motor vehicle;
(d) failed to brake in time or at all;
(e) [other specific acts / omissions as applicable].

                  PARTICULARS OF INJURIES
The Plaintiff sustained the following injuries:
(a) [Injury 1 — e.g., fracture of the right tibia and fibula];
(b) [Injury 2 — e.g., laceration to the forehead requiring [X] stitches];
(c) [Injury 3 — e.g., whiplash injury to the cervical spine];
(d) [Injury 4 — as per attached medical reports].

6. The Plaintiff was hospitalised at [Hospital Name] from [Date] to [Date] and received treatment for the injuries sustained. The Plaintiff continues to receive outpatient treatment.

7. By reason of the said negligence and injuries, the Plaintiff has suffered loss and damage as set out in the Schedule of Special Damages annexed hereto.

AND THE PLAINTIFF CLAIMS against the 1st and 2nd Defendants jointly and severally:

(i)   General damages for pain, suffering, and loss of amenities;
(ii)  General damages for loss of future earnings / loss of earning capacity;
(iii) Special damages as per the Schedule annexed hereto;
(iv)  Interest pursuant to the Courts of Judicature Act 1964;
(v)   Costs of this action; and
(vi)  Such further and/or other relief as this Honourable Court deems just and fit.

DATED this [Date]

.....................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff

─────────────────────────────────────────────────────────────
                  SCHEDULE OF SPECIAL DAMAGES

1. Hospital bills (Government hospital):              RM [Amount]
2. Hospital bills (Private hospital):                 RM [Amount]
3. Specialist consultation fees:                      RM [Amount]
4. Physiotherapy / Rehabilitation:                    RM [Amount]
5. Medications and medical supplies:                  RM [Amount]
6. Transportation to hospital / clinic:               RM [Amount]
7. Medical equipment (wheelchair, crutches, etc.):    RM [Amount]
8. Loss of income during hospitalization:
   [Monthly salary RM [Amount] ÷ 26 × [X] days]:     RM [Amount]
9. Vehicle repair / total loss:                       RM [Amount]
10. Miscellaneous (receipts attached):                RM [Amount]
   ──────────────────────────────────────────────────
   TOTAL SPECIAL DAMAGES:                             RM [Amount]
   ══════════════════════════════════════════════════

NOTE: Support all items with original receipts, invoices, and medical reports.`,
  },

  "Notice of Appeal": {
    name: "Notice of Appeal — Court of Appeal",
    description: "Form to appeal against a High Court decision to the Court of Appeal",
    content: `IN THE COURT OF APPEAL OF MALAYSIA
PUTRAJAYA

CIVIL APPEAL NO. [YEAR]-[DIVISION]-[NUMBER]-[YEAR]
(In the Matter of High Court at [State] Civil Suit No. [Year]-[Division]-[Registry]-[Number]-[Year])

BETWEEN

[APPELLANT'S FULL NAME / COMPANY NAME]               ...APPELLANT
(Formerly the [Plaintiff / Defendant] in the Court below)

AND

[RESPONDENT'S FULL NAME / COMPANY NAME]              ...RESPONDENT
(Formerly the [Plaintiff / Defendant] in the Court below)

                         NOTICE OF APPEAL

TAKE NOTICE that the above-named Appellant appeals to the Court of Appeal against [the whole of / so much of] the judgment / order of [the Honourable [Mr Justice / Judicial Commissioner] [Name]] dated [Date] in the above-named action, whereby it was ordered / adjudged that:

[SET OUT THE TERMS OF THE ORDER/JUDGMENT BEING APPEALED]

                    GROUNDS OF APPEAL

The Appellant will rely on the following grounds of appeal at the hearing:

1. The learned Judge erred in law in [holding / finding] that [state the specific legal error].

2. The learned Judge misdirected himself/herself on the applicable legal test by [describe the misdirection].

3. The decision is against the weight of the evidence in that [describe the evidential error].

4. The learned Judge failed to give adequate consideration to [specific evidence, authority, or argument] which was material to the decision.

5. The damages / quantum awarded is excessive / insufficient because [state reasons].

6. [Further specific grounds — be precise and detailed; each ground should identify a specific finding and why it is wrong].

                    ORDERS SOUGHT

The Appellant seeks the following orders from the Court of Appeal:

(a) That the judgment / order of the High Court dated [Date] be set aside / varied as follows: [specify];
(b) That judgment be entered for the Appellant in the sum of RM[Amount] / that the claim be dismissed;
(c) That the costs of this appeal and of the proceedings below be paid by the Respondent to the Appellant;
(d) Such further or other relief as this Honourable Court deems fit.

FILED at [Place] this [Date].

.....................................
[FIRM NAME]
Advocates & Solicitors for the Appellant
[Address]
[Tel / Fax / Email]
[File Reference]

TO: The Registrar, Court of Appeal, Putrajaya
TO: [Respondent's Solicitors — Name, Address]

─────────────────────────────────────────────────────────────
FILING NOTES:
• File at the HIGH COURT Registry (not the Court of Appeal) within 30 days of the decision.
• Pay RM200 filing fee.
• Attach a certified true copy of the sealed High Court order/judgment.
• Serve on all parties within the filing period.
• A separate stay application must be filed if execution is to be stayed.`,
  },

  "Written Submissions": {
    name: "Written Submissions / Skeleton Arguments",
    description: "Structured written arguments for court hearings and applications",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S NAME]                                   ...PLAINTIFF

AND

[DEFENDANT'S NAME]                                   ...DEFENDANT

              WRITTEN SUBMISSIONS / SKELETON ARGUMENTS
                  On behalf of the [Plaintiff / Defendant]
                     Hearing Date: [Date and Time]
               Presiding Judge: [Y.A. / Y.A.A. Name]

─────────────────────────────────────────────────────────────

                     A. INTRODUCTION

1. This is a [summary judgment application / trial / interlocutory application] in which the [Plaintiff/Defendant] seeks [brief statement of what is sought].

2. The issues before this Honourable Court are:
   (a) [Issue 1];
   (b) [Issue 2]; and
   (c) [Issue 3].

─────────────────────────────────────────────────────────────

                     B. BRIEF FACTS

3. [Set out the essential, non-disputed facts chronologically — be concise. Every fact should be referenced to an exhibit or paragraph of an affidavit.]

   3.1  On [Date], [Fact 1 — reference: Exhibit "A", para X of Affidavit in Support].
   3.2  On [Date], [Fact 2 — reference: Exhibit "B"].
   3.3  On [Date], [Fact 3].

─────────────────────────────────────────────────────────────

                     C. SUBMISSIONS

ISSUE 1: [State the issue]

4. The [Plaintiff/Defendant] submits that [state the conclusion on this issue].

5. The applicable legal principle is established in [Case Name, citation]:
   "....[relevant extract from judgment]...."

6. Applying this principle to the present facts: [apply the law to the specific facts of this case. Be analytical, not merely descriptive.]

7. [Opposing argument]: The [Defendant/Plaintiff] may contend that [anticipated counter-argument]. However, this contention is misconceived because [rebuttal — cite authority].

─────────────────────────────────────────────────────────────

ISSUE 2: [State the issue]

8. [Arguments on Issue 2 — follow the same structure: principle, authority, application, rebuttal.]

─────────────────────────────────────────────────────────────

                     D. TABLE OF AUTHORITIES

Cases:
[Case Name] [citation] ........................ [Brief point for which case is cited]
[Case Name] [citation] ........................ [Brief point]

Legislation:
[Act Name, section] — [provision relied upon]

─────────────────────────────────────────────────────────────

                     E. CONCLUSION

9. For the foregoing reasons, the [Plaintiff/Defendant] respectfully submits that this Honourable Court should:
   (a) [Order 1];
   (b) [Order 2]; and
   (c) Award costs to the [Plaintiff/Defendant].

Respectfully submitted by:

.....................................
[FIRM NAME]
Advocates & Solicitors for the [Plaintiff/Defendant]
[Date]`,
  },

  "Payment Claim (CIPAA)": {
    name: "Payment Claim — CIPAA 2012 Section 5",
    description: "Statutory payment claim under Construction Industry Payment and Adjudication Act 2012",
    content: `CONSTRUCTION INDUSTRY PAYMENT AND ADJUDICATION ACT 2012 (CIPAA 2012)
PAYMENT CLAIM PURSUANT TO SECTION 5

                         PAYMENT CLAIM NO. [PC-NUMBER / YEAR]

Date: [Date]

TO (Respondent):
[Company Name]
[Company Registration No.]
[Registered Address]
[Attention: [Name], [Designation]]

FROM (Claimant):
[Company Name]
[Company Registration No.]
[Registered Address]
[Contact: [Name], [Tel], [Email]]

─────────────────────────────────────────────────────────────

1. CONSTRUCTION CONTRACT

This Payment Claim is made pursuant to the following construction contract:

   Contract Title:     [Project Name and Description]
   Contract Date:      [Date of Contract]
   Contract Value:     RM[Contract Sum]
   Project/Site:       [Address of Project Site]
   Employer:           [Name of Employer]
   Main Contractor:    [Name of Main Contractor]
   [Sub-Contractor / Supplier: [Name] — where applicable]

2. SCOPE OF PAYMENT CLAIM

This Payment Claim relates to:
   [x] Work done under the Contract — Progress Claim No. [Number]
   [ ] Variations approved or claimed
   [ ] Retention monies due for release
   [ ] Unpaid previous Payment Claims

─────────────────────────────────────────────────────────────

3. BREAKDOWN OF AMOUNT CLAIMED

A. Contract Works (as per Bill of Quantities / Schedule of Rates)
   Cumulative value of works completed to date:        RM [Amount]
   Less: Previous certified / paid amount:            (RM [Amount])
                                            ─────────────
   Net value of works this claim:                      RM [Amount]

B. Approved Variations (as per Variation Orders attached)
   Variation Order No. [X] — [Description]:            RM [Amount]
   Variation Order No. [X] — [Description]:            RM [Amount]
                                            ─────────────
   Total Variations:                                   RM [Amount]

C. Release of Retention Monies (if applicable)
   [Practical completion achieved on [Date] — Release of 50% retention]:
                                                       RM [Amount]

D. Other Claims (if any — with particulars):           RM [Amount]

─────────────────────────────────────────────────────────────
   TOTAL CLAIMED (BEFORE TAX):                         RM [Amount]
   SST / GST (if applicable):                          RM [Amount]
   ═══════════════════════════════════════════════════
   GRAND TOTAL CLAIMED:                                RM [Amount]
   ═══════════════════════════════════════════════════

4. PAYMENT DUE DATE

Payment is due under the Contract on [Date] / within [X] days of this Payment Claim.

5. NOTICE TO RESPONDENT

TAKE NOTICE that pursuant to Section 7 of CIPAA 2012, the Respondent must serve a Payment Response within TEN (10) WORKING DAYS of receipt of this Payment Claim.

FAILURE TO SERVE A PAYMENT RESPONSE WITHIN THE STIPULATED TIME will entitle the Claimant to treat the ENTIRE CLAIMED AMOUNT as not disputed and to proceed with adjudication under CIPAA 2012.

Yours faithfully,

.....................................
For and on behalf of [Claimant Company Name]
[Authorised Signatory Name and Designation]

Attachments:
[ ] Progress Measurement Sheet
[ ] Bill of Quantities / Schedule of Rates
[ ] Variation Order(s)
[ ] Supporting photographs / site records`,
  },

  "Specific Performance Originating Summons": {
    name: "Originating Summons — Specific Performance of Sale and Purchase Agreement",
    description: "Application for court order to compel specific performance of an SPA",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

ORIGINATING SUMMONS NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

IN THE MATTER OF a Sale and Purchase Agreement
dated [Date] made between [Plaintiff's Name] and [Defendant's Name]
in respect of the property known as [Property Address / Description]

AND IN THE MATTER OF the Specific Relief Act 1950 (Act 137)

AND IN THE MATTER OF the Contract Act 1950 (Act 136)

BETWEEN

[PLAINTIFF'S FULL NAME (NRIC NO. [NUMBER])]          ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. [NUMBER])]          ...DEFENDANT

                       ORIGINATING SUMMONS

LET the Defendant attend before the Judge in Chambers at the High Court at [Place] on [Date] at [Time] on the hearing of an application by the Plaintiff for the following Orders:—

1. That the Defendant be ordered to specifically perform the Sale and Purchase Agreement dated [Date] ("the Agreement") made between the Plaintiff and the Defendant for the sale and purchase of the property described as [full description of property — address, title number, lot number, mukim, district, state] ("the Property") at the agreed purchase price of RM[Purchase Price];

2. That the Defendant do execute and deliver to the Plaintiff a valid Memorandum of Transfer (Form 14A / Form 14B under the National Land Code 1965) within [X] days of this Order, upon the Plaintiff's payment of the balance purchase price as stated in the Agreement;

3. That the Defendant do [describe any other specific act to be performed — e.g., deliver vacant possession, discharge any encumbrance on the Property];

4. In the alternative, if specific performance cannot be granted, that damages be assessed and awarded to the Plaintiff in lieu of specific performance;

5. That the costs of this application and action be paid by the Defendant to the Plaintiff on a [solicitor-client / standard] basis;

6. Such further and/or other relief as this Honourable Court deems just and fit.

GROUNDS:
(a) The Agreement is a valid and binding contract for the sale and purchase of the Property.
(b) The Plaintiff has at all times been ready, willing, and able to complete the purchase in accordance with the Agreement.
(c) The Defendant has failed, refused, and/or neglected to [complete the sale / execute the transfer / deliver vacant possession / other] in breach of the Agreement.
(d) The Property is unique — damages are not an adequate remedy.

This Originating Summons is taken out by [FIRM NAME], Advocates & Solicitors for the Plaintiff, whose address for service is [Address].

Issued at [Place] on [Date].

.....................................
REGISTRAR / DEPUTY REGISTRAR
High Court in Malaya at [State]`,
  },

  "Writ of Seizure and Sale": {
    name: "Writ of Seizure and Sale — Enforcement of Judgment (Form 83)",
    description: "Order 45–47 ROC 2012 — writ directing Bailiff to seize and sell judgment debtor's property",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[JUDGMENT CREDITOR / PLAINTIFF]                      ...PLAINTIFF

AND

[JUDGMENT DEBTOR / DEFENDANT]                        ...DEFENDANT

                    WRIT OF SEIZURE AND SALE
                  (Order 45–47, Rules of Court 2012)

ELIZABETH II [or as applicable] by the Grace of God, &c.

To: THE BAILIFF(S) of the High Court / [Sessions Court] at [State]

WHEREAS the above-named Plaintiff / Judgment Creditor obtained judgment in this action on [Date of Judgment] against the above-named Defendant / Judgment Debtor for:

   Judgment sum:                                  RM [Amount]
   Post-judgment interest at 5% p.a.
   from [Date of Judgment] to [Date]:             RM [Amount]
   Costs (as taxed / fixed):                      RM [Amount]
   ─────────────────────────────────────────────────────────
   TOTAL NOW DUE AND OWING:                        RM [Amount]
   ═════════════════════════════════════════════════════════

And the Plaintiff / Judgment Creditor has represented to us that the said Judgment remains wholly / partly [unsatisfied / unsatisfied in the amount of RM[Amount]]:

WE COMMAND YOU to levy upon the movable property of the said Defendant / Judgment Debtor [at [Last Known Address of Defendant]] to the value of the total sum outstanding as set out above, together with the costs and expenses of this execution;

AND ALSO to detain the said property until the Defendant / Judgment Debtor pays the said sum or such lesser amount as may be outstanding at the time of levy, together with the charges and expenses of seizure;

AND if payment is not made to you within [14] days of seizure, then to sell so much of the said property as may be necessary to satisfy the judgment and your charges;

AND to pay to the Plaintiff / Judgment Creditor the net proceeds of sale after deducting your lawful charges and expenses;

AND to return this Writ to the Registrar within three months from the date hereof with your endorsement of what you have done pursuant to it.

EXEMPT FROM SEIZURE (per Order 46 r 3 ROC 2012):
• Clothing and bedding of the Judgment Debtor and family up to RM200 in value
• Tools and implements of trade up to RM200 in value
• Personal earnings / salary (subject to conditions)

WITNESS [Name of Registrar], Registrar of the High Court in Malaya at [State]
Dated the [Day] of [Month] [Year].

.....................................
REGISTRAR / DEPUTY REGISTRAR
High Court in Malaya at [State]

─────────────────────────────────────────────────────────────
                  BAILIFF'S RETURN OF SERVICE

I, [Bailiff's Name], Bailiff of the [High Court / Sessions Court] at [State], hereby certify that I attended at [Address] on [Date] and [seize the following goods / was unable to locate seizable property].

Goods seized: [Description, estimated value]
Sale date (if applicable): [Date]
Net proceeds: RM [Amount]

Signed: .......................
Date: [Date]`,
  },

  "Consent Judgment": {
    name: "Consent Judgment / Consent Order — Settlement Terms",
    description: "Court-recorded agreement settling litigation between the parties",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S FULL NAME]                              ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME]                              ...DEFENDANT

                         CONSENT JUDGMENT / ORDER
                      (By Agreement of the Parties)

UPON the Plaintiff and the Defendant having settled the within action by agreement and UPON the solicitors for both parties having consented to judgment being entered herein in the following terms:

BY CONSENT, it is hereby ORDERED AND ADJUDGED as follows:—

1. JUDGMENT is entered against the Defendant in favour of the Plaintiff for the sum of RM[Judgment Amount] ("the Settlement Sum"), subject to the following payment terms:

   (a) RM[First Instalment] to be paid on or before [Date];
   (b) Thereafter, RM[Monthly Instalment] per month payable on the [Day] of each month commencing [Month, Year] and continuing for [X] months;
   (c) Final payment of RM[Final Balance] on or before [Date].

2. Interest on the Settlement Sum at the rate of [X]% per annum / [nil interest] from the date of this Consent Judgment until full settlement.

3. [If all instalments are paid on time]: The full and final settlement sum of RM[Net Settlement Figure] shall be accepted in full and final satisfaction of all claims by the Plaintiff against the Defendant arising out of this suit.

4. In the event the Defendant defaults in any one instalment payment, the entire outstanding balance shall immediately become due and payable and the Plaintiff shall be at liberty to execute this Judgment for the full outstanding amount forthwith without further notice or order.

5. The Plaintiff's action against the Defendant is DISCONTINUED / settled by this Consent Judgment with no further claims by either party against the other in connection with the subject matter of this suit.

6. Each party to bear their own costs [OR: Costs of this suit fixed at RM[Amount] to be paid by the Defendant to the Plaintiff].

7. Liberty to apply.

DATED this [Day] of [Month] [Year].

.....................................          .....................................
[PLAINTIFF'S SOLICITORS]                    [DEFENDANT'S SOLICITORS]
Advocates & Solicitors                      Advocates & Solicitors
for the Plaintiff                           for the Defendant
[Address]                                   [Address]

CONSENTED TO / NOTED:

.....................................
[JUDGE / REGISTRAR / DEPUTY REGISTRAR]
High Court in Malaya at [State]
Date: [Date]`,
  },

  "Affidavit of Service": {
    name: "Affidavit of Service — Proof of Personal Service",
    description: "Sworn evidence that court process was personally served on a party",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S NAME]                                   ...PLAINTIFF

AND

[DEFENDANT'S NAME]                                   ...DEFENDANT

                        AFFIDAVIT OF SERVICE
                          (1st Affidavit)

I, [Deponent's Full Name] (NRIC No.: [Number]), [occupation — e.g., Litigation Clerk / Process Server], of [Firm Name / Address], do hereby solemnly and sincerely affirm as follows:—

1. I am duly authorised to make this Affidavit. The facts herein are within my personal knowledge.

2. On [Date] at approximately [Time], I attended at [Address — state specifically: unit number, building name, street, town, state] ("the Service Address") for the purpose of personally serving [the Defendant / [Name of person to be served]] with the documents listed in paragraph 3 below.

3. The documents served were:
   (a) [Document 1 — e.g., Sealed Writ of Summons dated [Date]];
   (b) [Document 2 — e.g., Statement of Claim dated [Date]];
   (c) [Document 3 — e.g., Memorandum of Appearance (blank form)]; and
   (d) [Any other documents].

4. Upon my arrival at the Service Address, [describe what happened]:
   Option A: I met [Name of person served] (NRIC: [Number]) who identified himself/herself to me as the [Defendant / [description — e.g., Director of the Defendant company]]. I then handed all the above documents directly to [him/her].

   Option B: The door was answered by a person who identified [him/herself] as [Name], [relationship, e.g., spouse / housemate] of the [Defendant]. I handed all the above documents to the said [Name] and informed [him/her] of the nature of the documents.

5. The [Defendant / person served] [acknowledged receipt / appeared to read the documents / declined to sign any acknowledgment — I nevertheless left the documents in [his/her] presence].

6. I am satisfied that the said [Defendant] has been personally served with all the documents listed in paragraph 3 above.

AFFIRMED at [Place]          )
on [Date]                    )    .....................................
                             )    [Deponent's Signature]
Before me,                   )
                             )
.....................................
Commissioner for Oaths / Solicitor
[Name and COS/Solicitor No.]

─────────────────────────────────────────────────────────────
FILING NOTES:
• File the Affidavit of Service before applying for any default judgment.
• For default judgment in default of appearance: must show personal service on defendant.
• If personal service was not possible, file Affidavit of Attempts at Service first, then apply for substituted service.
• For service on a company: serve on a director / the company secretary at registered office.`,
  },

  "Petition for Divorce": {
    name: "Petition for Divorce — Law Reform (Marriage and Divorce) Act 1976",
    description: "Form 8A divorce petition for non-Muslim married couples",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
FAMILY DIVISION

DIVORCE PETITION NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

IN THE MATTER OF:
[PETITIONER'S FULL NAME (NRIC NO. [NUMBER])]         ...PETITIONER

AND

[RESPONDENT'S FULL NAME (NRIC NO. [NUMBER])]         ...RESPONDENT

                      PETITION FOR DIVORCE

TO THE HONOURABLE JUDGE of the above-named Court:

The Petition of [Petitioner's Full Name] ("the Petitioner") humbly shows that:

1.   The Petitioner, [name], (NRIC: [number]), is a [nationality] citizen residing at [address] and is of the [gender — male / female] sex.

2.   The Respondent, [name], (NRIC: [number]), is a [nationality] citizen residing at [address] and is of the [gender] sex.

3.   On [Date of Marriage], the Petitioner and the Respondent were lawfully married at [Registry / Church / Temple] in [State], and a marriage certificate was duly issued [Marriage Certificate No.: [Number]].

4.   There [are / are no] children of the marriage. The children are:
     (a) [Child's Name], [NRIC/Birth Cert No.], Date of Birth: [Date], currently residing with [Petitioner / Respondent];
     (b) [Child's Name], [NRIC/Birth Cert No.], Date of Birth: [Date], currently residing with [Petitioner / Respondent].

5.   The marriage has irretrievably broken down.

6.   The ground on which this Petition is presented is: [Select applicable]:
     (a) ADULTERY: The Respondent has committed adultery with [Co-Respondent's Name if known] and the Petitioner finds it intolerable to live with the Respondent;
     OR
     (b) UNREASONABLE BEHAVIOUR: The Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent, particulars of which are as follows:
         (i)  [Specific incident/behaviour — date and description];
         (ii) [Specific incident/behaviour — date and description];
         (iii)[Specific incident/behaviour — date and description];
     OR
     (c) SEPARATION FOR TWO YEARS: The parties have lived apart for a continuous period of at least two years immediately preceding the presentation of this Petition, and the Respondent consents to a decree being granted;
     OR
     (d) SEPARATION FOR FIVE YEARS: The parties have lived apart for a continuous period of at least five years immediately preceding the presentation of this Petition.

7.   [If applicable] There have been no previous proceedings in any court in Malaysia or elsewhere with reference to this marriage / the following previous proceedings: [details].

                        PRAYER

The Petitioner therefore prays:

(a) That the marriage solemnized between the Petitioner and the Respondent on [Date] may be dissolved by decree nisi to be made absolute after the prescribed period;

(b) As to custody: That the [Petitioner / Respondent / both parties jointly] have custody, care and control of the children of the marriage, namely [names];

(c) As to maintenance for children: That the [Respondent / Petitioner] do pay monthly maintenance of RM[Amount] per month per child / RM[Amount] for all children;

(d) As to maintenance for the [wife / Petitioner]: That the Respondent do pay the Petitioner a monthly maintenance of RM[Amount] per month;

(e) As to matrimonial assets: That the matrimonial assets be divided equally / in [X]% : [Y]% proportion;

(f) That the costs of this petition be paid by the Respondent;

(g) Such further and other relief as this Honourable Court deems fit.

DATED this [Date].

.....................................
[FIRM NAME]
Advocates & Solicitors for the Petitioner

Verification: I, [Petitioner's Name], the Petitioner in the above petition, make oath that the contents of this Petition are true to the best of my knowledge, information and belief.

.....................................
Petitioner's Signature

Sworn before me on [Date].
.....................................
Commissioner for Oaths`,
  },

  "Originating Summons (Judicial Review)": {
    name: "Originating Summons — Application for Judicial Review (Order 53)",
    description: "Commencement of judicial review proceedings against a public authority",
    content: `IN THE HIGH COURT IN MALAYA AT KUALA LUMPUR
ADMINISTRATIVE LAW DIVISION

ORIGINATING SUMMONS NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

IN THE MATTER OF an application for judicial review
of the decision of [Name of Public Authority / Tribunal / Inferior Court]

AND IN THE MATTER OF Order 53 of the Rules of Court 2012

BETWEEN

[APPLICANT'S FULL NAME (NRIC NO. / COMPANY NO.)]    ...APPLICANT

AND

[1ST RESPONDENT — PUBLIC AUTHORITY / MINISTER / TRIBUNAL]
                                                     ...1ST RESPONDENT

[2ND RESPONDENT — ATTORNEY GENERAL OF MALAYSIA]     ...2ND RESPONDENT

                       ORIGINATING SUMMONS

LET the Respondents attend before the Judge in Chambers at the High Court at Kuala Lumpur on [Date] at [Time] on the hearing of an application by the Applicant, pursuant to Order 53 of the Rules of Court 2012, for the following Orders:—

1.   A Declaration that the decision / act / omission of the 1st Respondent dated [Date] [briefly describe the decision] is unlawful, ultra vires, null and void, and of no legal effect;

2.   An Order of Certiorari to quash the decision of the 1st Respondent dated [Date];

3.   An Order of Mandamus commanding the 1st Respondent to [specific act to be performed, e.g., "reconsider the Applicant's application for [X] in accordance with the law"];

4.   [If applicable] A Declaration that the Applicant's rights under [Article [X] of the Federal Constitution / relevant statutory provision] have been infringed;

5.   [If applicable] An Injunction restraining the 1st Respondent from [implementing the impugned decision] pending the hearing and determination of this application;

6.   Costs of this application be paid by the 1st Respondent to the Applicant;

7.   Such further and/or other relief as this Honourable Court deems just and fit.

                         GROUNDS

(a) The 1st Respondent acted ultra vires its powers under [relevant statutory provision] in that [specify the ultra vires act];

(b) The 1st Respondent breached the rules of natural justice in that [specify — e.g., the Applicant was not given a proper opportunity to be heard before the decision was made];

(c) The decision of the 1st Respondent is irrational / unreasonable in the Wednesbury sense in that [specify];

(d) The 1st Respondent failed to take into account relevant considerations / took into account irrelevant considerations;

(e) The 1st Respondent acted in breach of the Applicant's legitimate expectation that [specify the legitimate expectation].

This Originating Summons is supported by the Affidavit of [Applicant / Deponent Name] affirmed on [Date] and the Statement filed herewith pursuant to Order 53 r 3(2) of the Rules of Court 2012.

Issued at Kuala Lumpur on [Date].

.....................................
REGISTRAR / DEPUTY REGISTRAR
High Court in Malaya at Kuala Lumpur
(Administrative Law Division)`,
  },

  "Defence and Counterclaim": {
    name: "Defence and Counterclaim — Combined Pleading",
    description: "Defendant's denial of the plaintiff's claim plus assertion of a cross-claim",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S FULL NAME]                              ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME]                              ...DEFENDANT

                     DEFENCE AND COUNTERCLAIM

                           A. DEFENCE

1.   The Defendant admits paragraphs [X] and [X] of the Statement of Claim.

2.   The Defendant denies paragraphs [X], [X], and [X] of the Statement of Claim and puts the Plaintiff to strict proof thereof.

3.   Save as admitted above, the Defendant does not admit the whole of the Statement of Claim and puts the Plaintiff to strict proof of each allegation.

4.   In answer to paragraph [X] of the Statement of Claim, the Defendant says that [specific response to specific allegation — not a bare denial; plead your version of the facts].

5.   In answer to paragraph [X] of the Statement of Claim (the alleged agreement), the Defendant says that [e.g., "no such agreement was ever made" / "the agreement pleaded was subject to a condition precedent which was not fulfilled" / "the agreement was varied / rescinded by mutual consent on [Date]"].

6.   The Defendant denies that he/she is indebted to the Plaintiff in the sum claimed or at all. [Set out any positive defence — limitation, payment, set-off, estoppel, frustration, contributory negligence, etc.]

7.   [LIMITATION DEFENCE (if applicable)]: The Plaintiff's claim is time-barred under the Limitation Act 1953 in that more than [6 / 3 / 2] years have elapsed since the cause of action accrued on [Date].

8.   [CONTRIBUTORY NEGLIGENCE (if applicable)]: Without prejudice to the foregoing, the Plaintiff's loss and damage was caused or contributed to by the Plaintiff's own negligence, particulars of which are: [list].

9.   The Defendant denies that the Plaintiff is entitled to the relief sought or to any relief at all.

─────────────────────────────────────────────────────────────

                         B. COUNTERCLAIM

10.  The Defendant repeats paragraphs [1] to [9] above and relies on the same facts and matters in support of this Counterclaim.

11.  In addition to the foregoing, [set out the additional facts founding the counterclaim].

12.  By reason of the [breach of contract / negligence / conversion / other cause of action] of the Plaintiff / Counterclaim Defendant, the Defendant / Counterclaim Plaintiff has suffered loss and damage.

                PARTICULARS OF LOSS AND DAMAGE
(a) [Head of damage 1]:                              RM [Amount]
(b) [Head of damage 2]:                              RM [Amount]
(c) Loss of [profit / income / business]:            RM [Amount]
                                          ─────────────
TOTAL COUNTERCLAIM:                                  RM [Amount]

AND THE DEFENDANT / COUNTERCLAIM PLAINTIFF CLAIMS:

(i)   The sum of RM[Amount] as particularised above;
(ii)  Interest at [X]% per annum / as provided by law from [Date] until full payment;
(iii) Costs of this action on a [solicitor-client / standard] basis; and
(iv)  Such further and other relief as this Honourable Court deems fit.

DATED this [Date].

.....................................
[FIRM NAME]
Advocates & Solicitors for the Defendant / Counterclaim Plaintiff`,
  },

  "Statement of Claim (Defamation)": {
    name: "Statement of Claim — Defamation (Libel / Slander)",
    description: "Pleading for civil defamation claim under Defamation Act 1957",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S FULL NAME (NRIC NO. [NUMBER])]          ...PLAINTIFF

AND

[DEFENDANT'S FULL NAME (NRIC NO. / COMPANY NO.)]     ...DEFENDANT

                    STATEMENT OF CLAIM

1.   The Plaintiff, [name], (NRIC: [number]), is a [occupation / status — e.g., "practising advocate and solicitor" / "businessman" / "public officer"] residing / carrying on business at [address].

2.   The Defendant, [name], (NRIC / Company No.: [number]), is [an individual / a company] [residing at / having its registered office at] [address]. The Defendant publishes / operates [a newspaper / a website / a social media account / a broadcasting channel] known as "[Name]".

3.   On [Date], the Defendant [published in the newspaper "[Name]" / posted on the website "[URL]" / broadcast on [channel]] the following words ("the Words Complained Of"):

     "[Set out the EXACT, verbatim words complained of — for libel, reproduce the entire article or the relevant passage in full. If in Bahasa Malaysia or another language, provide both the original and a certified translation.]"

4.   In their natural and ordinary meaning, the Words Complained Of meant and were understood to mean:
     (a) [First defamatory imputation — e.g., "that the Plaintiff is corrupt and dishonest"];
     (b) [Second defamatory imputation — e.g., "that the Plaintiff is guilty of criminal conduct"]; and
     (c) [Third defamatory imputation — e.g., "that the Plaintiff is professionally incompetent and unfit for his/her position"].

5.   [IF INNUENDO MEANING RELIED UPON] In the further alternative, the Words Complained Of carried the following innuendo meaning by reason of the extrinsic facts set out below:

     Extrinsic facts: [Identify the special knowledge of particular readers that makes the words carry a defamatory meaning beyond their natural and ordinary meaning.]

     Innuendo meaning: [State the meaning conveyed to those with the special knowledge.]

6.   The Words Complained Of were published to the following persons: [identify the class or specific persons who read / heard the publication — e.g., "subscribers and readers of the said newspaper throughout Malaysia" / "users of the social media platform with access to the Defendant's public account"].

7.   The Words Complained Of were false and were not published on any privileged occasion.

8.   By reason of the publication of the Words Complained Of, the Plaintiff has suffered serious injury to [his/her] reputation, has been held in contempt, dislike, and ridicule, and has suffered embarrassment, distress, and loss of business and professional standing.

                   PARTICULARS OF SPECIAL DAMAGE (if any)
(a) [Specific financial loss — e.g., termination of contract by [Company X] on [Date]:   RM [Amount]
(b) [Loss of business / clients]:                                                         RM [Amount]

AND THE PLAINTIFF CLAIMS:

(i)   General damages (injury to reputation, hurt and distress, loss of standing);
(ii)  [If pleaded] Special damages as particularised above: RM[Amount];
(iii) An injunction restraining the Defendant from further publishing or republishing the said Words Complained Of or words to the like effect;
(iv)  Costs of this action; and
(v)   Such further and other relief as this Honourable Court deems fit.

DATED this [Date].

.....................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff`,
  },

  "Notice of Change of Solicitor": {
    name: "Notice of Change of Solicitor (Order 64 r 1 ROC 2012)",
    description: "Formal notification of change of legal representation",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S NAME]                                   ...PLAINTIFF

AND

[DEFENDANT'S NAME]                                   ...DEFENDANT

                   NOTICE OF CHANGE OF SOLICITOR
              (Order 64 rule 1, Rules of Court 2012)

TAKE NOTICE that [the Plaintiff / the Defendant / [Party Name]], previously represented by [Previous Firm Name], Advocates & Solicitors, of [Previous Address], has CHANGED SOLICITORS.

With effect from [Date], the [Plaintiff / Defendant / [Party Name]] will now be represented by:

NEW SOLICITORS:
   Firm Name:      [New Firm Name]
   Address:        [New Full Address]
   Tel:            [Telephone Number]
   Fax:            [Fax Number]
   Email:          [Email Address]
   Ref:            [File Reference Number]
   Contact Person: [Name of Solicitor in Charge]

All future correspondence, documents, and pleadings in this matter are to be served on the above-named New Solicitors at the address stated above.

The Previous Solicitors, [Previous Firm Name], are hereby DISCHARGED from further acting in this matter.

This Notice of Change of Solicitor is served on:
(a) The Registrar of the [High Court / Sessions Court / Magistrates' Court] at [State];
(b) All other parties in this action (through their solicitors); and
(c) The Previous Solicitors, [Previous Firm Name].

Dated this [Day] of [Month] [Year].

.....................................
[NEW FIRM NAME]
Advocates & Solicitors for the [Plaintiff / Defendant]

─────────────────────────────────────────────────────────────
CERTIFICATE OF SERVICE

I hereby certify that this Notice of Change of Solicitor was served on:

(a) [Previous Firm Name], Advocates & Solicitors
    [Address] — by [hand / AR registered post] on [Date];

(b) [Opposing Party's Solicitors]
    [Address] — by [hand / AR registered post] on [Date].

.....................................
[Name], [New Firm Name]
Advocates & Solicitors for the [Plaintiff / Defendant]
Date: [Date]`,
  },

  "Bill of Costs": {
    name: "Bill of Costs — Contentious Business (Litigation)",
    description: "Detailed bill for taxation of legal costs in litigation matters",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
CIVIL DIVISION

CIVIL SUIT NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF'S NAME]                                   ...PLAINTIFF

AND

[DEFENDANT'S NAME]                                   ...DEFENDANT

                          BILL OF COSTS
             [Solicitor-Client / Party-Party (Order 59 ROC 2012)]
         On behalf of: [PLAINTIFF / DEFENDANT] ([Receiving Party])
       Against:        [DEFENDANT / PLAINTIFF] ([Paying Party])
    Nature of Order:  Costs ordered on [Date] by [Y.A. Judge's Name]

─────────────────────────────────────────────────────────────

                    SECTION 1: GETTING UP THE CASE

No. | Date       | Description of Work Done                       | Amount (RM)
────┼────────────┼─────────────────────────────────────────────────┼────────────
 1  | [Date]     | Instructions received and brief perused        | [Amount]
 2  | [Date]     | Settling and drafting Writ of Summons          | [Amount]
 3  | [Date]     | Settling and drafting Statement of Claim       | [Amount]
 4  | [Date]     | Filing Writ and Statement of Claim             | [Amount]
 5  | [Date]     | Letters written to [parties / court] (×[no.]) | [Amount]
 6  | [Date]     | Affidavit in Support — Order 14 (settling,     |
    |            | engrossing, swearing, filing)                   | [Amount]
 7  | [Date]     | Settling and drafting Written Submissions       | [Amount]
 8  | [Date]     | Research on [X issues] — [No.] hours at RM[X]  | [Amount]
 9  | [Date]     | Advice to client (written / in conference)      | [Amount]
10  | [Date]     | Review of documents (Exhibit "A"-"H")           | [Amount]
    |            |                          SUBTOTAL SECTION 1:    | RM[Amount]

─────────────────────────────────────────────────────────────

                 SECTION 2: ATTENDANCE AT COURT

No. | Date       | Description of Attendance                      | Amount (RM)
────┼────────────┼─────────────────────────────────────────────────┼────────────
 1  | [Date]     | Attendance before [Y.A.] for [purpose,         |
    |            | e.g., mention / PTI / O.14 hearing]            | [Amount]
 2  | [Date]     | Attendance before [Y.A.] for [purpose]         | [Amount]
 3  | [Date]     | Attendance before [Y.A.] for [purpose]         | [Amount]
    |            | (Duration: [X] hours)                          |          
    |            |                          SUBTOTAL SECTION 2:    | RM[Amount]

─────────────────────────────────────────────────────────────

                   SECTION 3: DISBURSEMENTS

No. | Description                                              | Amount (RM)
────┼──────────────────────────────────────────────────────────┼────────────
 1  | Court filing fee — Writ of Summons                      | [Amount]
 2  | Court filing fee — Summons in Chambers (O.14)           | [Amount]
 3  | Affidavit filing fee(s) (×[no.] affidavits at RM40)     | [Amount]
 4  | Process server / service fees                           | [Amount]
 5  | Stamp duty on [document]                                | [Amount]
 6  | Court search / Registry search fee                      | [Amount]
 7  | Photocopying (bundles, cause papers)                    | [Amount]
 8  | Facsimile / courier charges                             | [Amount]
 9  | Expert fee: [Name of Expert]                            | [Amount]
10  | Miscellaneous out-of-pocket expenses                    | [Amount]
    |                              SUBTOTAL SECTION 3:         | RM[Amount]

─────────────────────────────────────────────────────────────

                         GRAND TOTAL

   Section 1 — Getting Up:                                 RM [Amount]
   Section 2 — Court Attendance:                           RM [Amount]
   Section 3 — Disbursements:                              RM [Amount]
   ─────────────────────────────────────────────────────────────────
   TOTAL CLAIMED:                                          RM [Amount]
   ═════════════════════════════════════════════════════════════════

Dated this [Date].

.....................................
[FIRM NAME]
Advocates & Solicitors for the [Plaintiff / Defendant]

─────────────────────────────────────────────────────────────
                  CERTIFICATE OF TAXATION

Taxed by the Learned [Registrar / Deputy Registrar] [Name]
on [Date]:

Amount allowed:  RM [Amount]
Amount taxed off: RM [Amount]

.....................................
REGISTRAR / DEPUTY REGISTRAR
High Court in Malaya at [State]`,
  },

  "Private Caveat (Form 19B)": {
    name: "Private Caveat — Form 19B (National Land Code 1965)",
    description: "Statutory lodgement to protect a claimed interest in land from dealings",
    content: `NATIONAL LAND CODE 1965
Section 322

                         PRIVATE CAVEAT
                (Form 19B — to be lodged at Land Registry)

                    ─── FOR LAND REGISTRY USE ONLY ───
Presentation No.:  _______________
Date of Presentation: _______________
Time: _______________
Registry Officer: _______________
                    ─────────────────────────────────────

                         SECTION A — LAND PARTICULARS

Title No.:            [Geran / H.S.(D) No. ________________]
Lot / P.T. No.:       [_________________________________]
Mukim:                [_________________________________]
District:             [_________________________________]
State:                [_________________________________]
Registered Proprietor: [Full Name as in Title, NRIC No.]

─────────────────────────────────────────────────────────────

                         SECTION B — CAVEATOR

Full Name of Caveator:  [___________________________]
NRIC / Company No.:     [___________________________]
Address:                [___________________________]
                        [___________________________]
                        [___________________________]
Contact No.:            [___________________________]

─────────────────────────────────────────────────────────────

                     SECTION C — NATURE OF CLAIM

The Caveator claims the following interest or right in the above land:

[   ] Purchaser under a Sale and Purchase Agreement dated [Date]
[   ] Beneficiary under a trust / resulting trust
[   ] Chargee / mortgagee pursuant to an agreement dated [Date]
[   ] Judgment creditor (charging order)
[   ] Other (specify): [___________________________]

Documents creating the interest (description and date):
[___________________________________________________________]

─────────────────────────────────────────────────────────────

                     SECTION D — PROHIBITION

The Caveator hereby requests that no dealing or transmission affecting the above land shall be registered or noted without the caveator's written consent or until further order of the High Court.

─────────────────────────────────────────────────────────────

                     SECTION E — DECLARATION

I, [Caveator's Name / Solicitor's Name], solemnly and sincerely declare that the particulars stated in this Caveat are true to the best of my knowledge and belief, and that the Caveator has a genuine and bona fide claim to the interest in the land described above.

Signed: .....................................
Name:   [___________________________]
NRIC:   [___________________________]
Date:   [___________________________]

─────────────────────────────────────────────────────────────
                  SOLICITOR'S CERTIFICATE

I, [Solicitor's Name], (Advocate & Solicitor No.: [Number]), of [Firm Name], hereby certify that the Caveator has, in my presence, signed / affirmed the contents of this Caveat and that I have explained to the Caveator the nature, effect, and consequences of lodging a caveat.

Signed: .....................................
[Solicitor's Name]
[Firm Name]
Date: [Date]

─────────────────────────────────────────────────────────────
FILING NOTES:
• File at the Land Registry (Pejabat Pendaftar Tanah) of the district where the land is situated.
• Pay Land Registry lodgement fee: RM100 per title (fees vary by state).
• The caveat is effective for 6 years from lodgement (NLC 1965, s.322).
• An aggrieved registered proprietor may apply to remove the caveat under s.327 NLC.
• Upon receipt of s.327 notice, the caveator has 14 days to commence court proceedings — failing which the caveat will be removed.
• WARNING: Lodging a caveat without reasonable grounds renders the caveator liable to compensate the proprietor for loss caused by the caveat (s.329 NLC 1965).`,
  },

  "Adjudication Response (CIPAA)": {
    name: "Adjudication Response — CIPAA 2012 (s.10)",
    description: "Respondent's formal reply to adjudication claim in CIPAA proceedings",
    content: `CONSTRUCTION INDUSTRY PAYMENT AND ADJUDICATION ACT 2012 (CIPAA 2012)
ADJUDICATION RESPONSE PURSUANT TO SECTION 10

AIAC ADJUDICATION REFERENCE NO. [AIAC-ARB/ADJ-YEAR-NUMBER]

Date: [Date]

TO: [Adjudicator's Name]
    [Address / As notified by AIAC]

CC: [Claimant's Company Name and Address]

FROM (Respondent):
[Company Name]
[Company Registration No.]
[Registered Address]
[Contact Person, Tel, Email]

─────────────────────────────────────────────────────────────

1. INTRODUCTION

This Adjudication Response is filed pursuant to Section 10 of the Construction Industry Payment and Adjudication Act 2012 (CIPAA 2012) in response to the Adjudication Claim served on us on [Date] by [Claimant's Name].

The Respondent refers to:
   Construction Contract:   [Project Name, Contract Date]
   Payment Claim No.:       [Number] dated [Date]
   Adjudication Claim:      Served [Date]

─────────────────────────────────────────────────────────────

2. SUMMARY OF RESPONDENT'S POSITION

The Respondent [DISPUTES / PARTLY DISPUTES] the Adjudication Claim.

   Amount Claimed by Claimant:                  RM [Amount]
   Amount ADMITTED by Respondent:               RM [Amount]
   Amount DISPUTED by Respondent:               RM [Amount]

─────────────────────────────────────────────────────────────

3. ITEM-BY-ITEM RESPONSE TO ADJUDICATION CLAIM

ITEM 1: [Description of claim item, e.g., "Contract Works — Progress Claim No. 5"]
   Claimed:           RM [Amount]
   Admitted:          RM [Amount]
   Disputed:          RM [Amount]
   Grounds of Dispute: [Set out specific grounds — e.g., "work not completed to specification", "defective workmanship as evidenced by [Exhibit "R-1"]", "variation not approved in writing as required by Clause [X] of the Contract"].

ITEM 2: [Description]
   Claimed:           RM [Amount]
   Admitted:          RM [Amount]
   Disputed:          RM [Amount]
   Grounds of Dispute: [Specific grounds with reference to contractual clauses and evidence].

ITEM 3: [Retention money claim]
   Claimed:           RM [Amount]
   Disputed entirely.
   Grounds: Practical completion certificate has not been issued. Under Clause [X] of the Contract, the [first half / second half] of retention is only releasable upon issuance of the Certificate of Practical Completion / Certificate of Making Good Defects. [Exhibit "R-2": Contract extract].

─────────────────────────────────────────────────────────────

4. RESPONDENT'S CROSS-CLAIM (if applicable)

The Respondent further relies on the following cross-claim / set-off against the Claimant:

(a) Liquidated Damages for Delay: The Claimant completed the works [X] days late, entitling the Respondent to liquidated damages at RM[Amount] per day under Clause [X] of the Contract:
    [X] days × RM[Amount] per day = RM [Amount];

(b) Cost of Rectifying Defects: RM [Amount] (Exhibit "R-3": Defect rectification invoices).

Total Cross-Claim:                                           RM [Amount]

─────────────────────────────────────────────────────────────

5. CONCLUSION

In the circumstances, the Respondent submits that:

(a) The Adjudication Claim be dismissed / reduced to RM [Amount];
(b) The Respondent's cross-claim of RM [Amount] be allowed; and
(c) The net amount payable (if any) be RM [Amount] [by Claimant to Respondent / by Respondent to Claimant].

                       LIST OF EXHIBITS
R-1: [Description of exhibit]
R-2: [Description of exhibit]
R-3: [Description of exhibit]

Yours faithfully,

.....................................
For and on behalf of [Respondent Company Name]
[Authorised Signatory Name and Designation]`,
  },

  "Affidavit of Means": {
    name: "Affidavit of Means — Matrimonial / Family Proceedings",
    description: "Full financial disclosure affidavit in matrimonial proceedings",
    content: `IN THE HIGH COURT IN MALAYA AT [KUALA LUMPUR / STATE]
FAMILY DIVISION

DIVORCE PETITION NO. [YEAR]-[DIVISION]-[REGISTRY]-[NUMBER]-[YEAR]

IN THE MATTER OF:
[PETITIONER'S NAME]                                  ...PETITIONER

AND

[RESPONDENT'S NAME]                                  ...RESPONDENT

                        AFFIDAVIT OF MEANS
                          (1st Affidavit)

I, [Deponent's Full Name] (NRIC No.: [Number]), [Petitioner / Respondent] in the above proceedings, of [address], do hereby solemnly and sincerely affirm as follows:—

                       A. PERSONAL PARTICULARS

1.   I am the [Petitioner / Respondent] in the above-named divorce proceedings. My date of birth is [Date]. I am a [Malaysian citizen / Permanent Resident]. My occupation is [occupation] with [Employer Name] at [Address of Employer].

                         B. INCOME

2.   My gross monthly income is as follows:

     Basic salary:                                      RM [Amount]
     Fixed allowances (specify: []):                    RM [Amount]
     Overtime (average per month):                      RM [Amount]
     Annual bonus (÷ 12 months):                        RM [Amount]
     Rental income from [Property]:                     RM [Amount]
     Dividend income (from shares / investments):       RM [Amount]
     Other income (specify: []):                        RM [Amount]
     ──────────────────────────────────────────────────
     TOTAL GROSS MONTHLY INCOME:                        RM [Amount]

     Exhibited hereto and marked as Exhibit "A" are copies of my:
     (a) Latest 3 months' salary slips; and
     (b) Latest Income Tax Return (Form BE / B).

                         C. MONTHLY EXPENSES

3.   My estimated monthly expenses are:

     Housing / rent / mortgage instalment:              RM [Amount]
     Car loan instalment:                               RM [Amount]
     Utilities (electricity, water, internet):          RM [Amount]
     Food / groceries:                                  RM [Amount]
     Children's school fees / tuition:                  RM [Amount]
     Children's pocket money:                           RM [Amount]
     Clothing and personal care:                        RM [Amount]
     Medical / insurance premiums:                      RM [Amount]
     Transport (petrol, toll, parking):                 RM [Amount]
     Other: [specify]:                                  RM [Amount]
     ──────────────────────────────────────────────────
     TOTAL MONTHLY EXPENSES:                            RM [Amount]

                    D. ASSETS AND LIABILITIES

4.   IMMOVABLE PROPERTY:

     Property 1: [Address]
     Title No.: [Number] | Estimated Market Value: RM [Amount]
     Outstanding Loan: RM [Amount] | Net Equity: RM [Amount]
     [Sole owner / jointly owned with [Name] — [X]% share]

     Property 2: [Address] (if applicable)
     [Details as above]

5.   MOVABLE PROPERTY:

     Bank Accounts:
     (a) [Bank Name], Account No. [Number], Balance: RM [Amount]
     (b) [Bank Name], Account No. [Number], Balance: RM [Amount]

     EPF (Employees Provident Fund):
     EPF Account No.: [Number], Balance: RM [Amount] (as at [Date])
     [Exhibit "B": EPF Statement]

     Vehicles:
     (a) [Make / Model / Year / Plate No.], Est. Value: RM [Amount], Loan O/S: RM [Amount]

     Shares / Unit Trust / ASB:
     (a) [Fund / Scrip Name], Units / Shares: [Number], Value: RM [Amount]

     Insurance Policies:
     (a) [Insurer], Policy No. [Number], Sum Assured: RM [Amount], Surrender Value: RM [Amount]

     Other assets (specify: []):                       RM [Amount]

     TOTAL ASSETS:                                     RM [Amount]
     TOTAL LIABILITIES:                               (RM [Amount])
     ──────────────────────────────────────────────────
     NET ASSETS:                                       RM [Amount]

6.   I make this Affidavit in full and frank disclosure of all my financial resources and needs as required by the Rules of Court and the directions of this Honourable Court.

AFFIRMED at [Place]          )
on [Date]                    )    .....................................
                             )    [Deponent's Signature]
Before me,                   )
                             )
.....................................
Commissioner for Oaths / Solicitor
[Name and COS/Solicitor No.]`,
  },

  "Claimant's Statement of Case (Industrial Court)": {
    name: "Claimant's Statement of Case — Industrial Court",
    description: "Employee's formal pleading in Industrial Court unfair dismissal proceedings",
    content: `INDUSTRIAL COURT OF MALAYSIA
KUALA LUMPUR / [STATE REGISTRY]

INDUSTRIAL COURT CASE NO. [YEAR]-[CASE NO.]-[STATE]

IN THE MATTER OF:

[CLAIMANT / EMPLOYEE FULL NAME]                      ...CLAIMANT

AND

[RESPONDENT / EMPLOYER COMPANY NAME]                 ...RESPONDENT

                    CLAIMANT'S STATEMENT OF CASE

                       INTRODUCTION

1.   This is the Claimant's Statement of Case filed pursuant to the directions of this Honourable Court in connection with the dismissal of the Claimant without just cause and excuse by the Respondent.

                       PART A: BACKGROUND

2.   CLAIMANT'S PARTICULARS:

     Full Name:            [Name]
     NRIC No.:             [Number]
     Address:              [Address]
     Date of Appointment:  [Date]
     Job Title:            [e.g., Senior Executive, Human Resources]
     Department:           [Department Name]
     Last Basic Salary:    RM [Amount] per month
     Last Total Remuneration (with fixed allowances): RM [Amount] per month
     EPF Employer No.:     [Number]
     Date of Dismissal:    [Date]

3.   RESPONDENT'S PARTICULARS:

     Company Name:         [Name]
     Registration No.:     [Number]
     Registered Address:   [Address]
     Nature of Business:   [e.g., Manufacturing / Services / Trading]

                       PART B: EMPLOYMENT HISTORY

4.   The Claimant was employed by the Respondent on [Date] as a [designation] under a written contract of employment dated [Date] ("the Employment Contract"). [Exhibit CL-1: Employment Contract].

5.   [Narrative of promotions / transfers / performance reviews, if relevant.]

6.   At all material times, the Claimant performed his/her duties satisfactorily and received [no formal warnings / the following awards and commendations: (details)].

                       PART C: CIRCUMSTANCES OF DISMISSAL

7.   On or about [Date], the Respondent [served a show cause letter / summoned the Claimant / conducted a domestic inquiry (DI)] in connection with the following alleged misconduct: [describe alleged misconduct].

8.   [IF DOMESTIC INQUIRY WAS HELD]:
     A Domestic Inquiry ("DI") was held on [Date(s)] before a panel comprising [Name(s) and Designation(s)]. The Claimant was [represented by [Name] / not permitted representation]. The outcome of the DI was [guilty / not guilty of charge no. [X]].

9.   [IF NO DOMESTIC INQUIRY]:
     No Domestic Inquiry was held before the dismissal. The Respondent dismissed the Claimant without according the Claimant an opportunity to be heard in breach of the principles of natural justice.

10.  On [Date], the Respondent dismissed the Claimant by [written letter / verbal notice] effective [Date]. The dismissal letter stated: "[Quote relevant part of dismissal letter]" [Exhibit CL-2].

                       PART D: GROUNDS FOR CHALLENGING DISMISSAL

11.  The Claimant submits that the dismissal was without just cause or excuse for the following reasons:

     (a) [GROUND 1 — e.g., "The alleged misconduct is denied in full. The Claimant did not [the alleged act] — [explain factual denial]"];

     (b) [GROUND 2 — e.g., "Even if the alleged act occurred, it does not constitute misconduct of sufficient gravity to warrant dismissal — a lesser penalty such as a warning or suspension was appropriate"];

     (c) [GROUND 3 — e.g., "The Domestic Inquiry was procedurally flawed in that the Claimant was not given adequate notice of the charges / the panel was not impartial / the Claimant was denied the right to cross-examine witnesses"];

     (d) [GROUND 4 — e.g., "The dismissal was motivated by [victimisation / retaliation for union activity / discrimination] rather than genuine misconduct"].

                         PART E: RELIEF SOUGHT

12.  The Claimant respectfully requests this Honourable Court to make the following award:

     (a) REINSTATEMENT to the former position with all seniority and emoluments intact, effective from [Date of Dismissal]; AND

     (b) BACK WAGES from [Date of Dismissal] to [Date of Award] at RM [Last Basic Salary] per month, less the Claimant's earnings from alternative employment (if any); OR

     (c) In the alternative to reinstatement, COMPENSATION IN LIEU OF REINSTATEMENT equivalent to [1 month's wages per year of service / as this Honourable Court deems just], being RM[Estimated Compensation Amount].

                           LIST OF WITNESSES

     CW-1: [Claimant's Name] (the Claimant)
     CW-2: [Witness Name, e.g., Colleague who witnessed relevant events]

                           LIST OF EXHIBITS

     CL-1: Employment Contract
     CL-2: Dismissal Letter dated [Date]
     CL-3: Show Cause Letter and Claimant's Reply
     CL-4: Domestic Inquiry Notes of Proceedings (if available)
     CL-5: [Other relevant documents]

DATED this [Date].

.....................................
[FIRM NAME / TRADE UNION REPRESENTATIVE / CLAIMANT IN PERSON]
For and on behalf of the Claimant`,
  },

  "Notice of Application (Form 57)": {
    name: "Notice of Application — Form 57 (Chambers Application)",
    description: "Generic Notice of Application in chambers under Order 32 ROC 2012 (formerly Summons in Chambers)",
    content: `IN THE HIGH COURT IN MALAYA AT [PLACE]
[CIVIL DIVISION]

CIVIL SUIT NO. WA-[YEAR]-[DIVISION]-[NUMBER]-[YEAR]

BETWEEN

[PLAINTIFF NAME (NRIC / COMPANY NO.)]                       ...PLAINTIFF

AND

[DEFENDANT NAME (NRIC / COMPANY NO.)]                       ...DEFENDANT

                       NOTICE OF APPLICATION
                  (Order 32 r 1, Rules of Court 2012)
                  [State substantive Order, e.g., Order 14 / Order 18 r 19 / Order 24]

LET ALL PARTIES concerned attend before the [Judge in Chambers / Senior Assistant Registrar] of the High Court at [Place] on [Date] at [Time] (or so soon thereafter as Counsel can be heard) on the hearing of an Application by the [Plaintiff/Defendant/Applicant] for the following Orders:

1. [State first prayer with precision — e.g., "That summary judgment be entered against the Defendant under Order 14 r 1 of the Rules of Court 2012 for the sum of RM[Amount] together with interest thereon at the rate of [X]% per annum from [Date] until full settlement."];

2. [State second prayer — e.g., "That the Defendant do pay the costs of this Application and of the action on a [solicitor-and-client / standard] basis."];

3. Such further or other Orders as this Honourable Court deems just and fit.

This Application is supported by the Affidavit affirmed by [DEPONENT'S NAME] on [Date] and filed herein.

GROUNDS OF APPLICATION (briefly stated):
[Concise statement of legal and factual grounds — e.g., "The Defendant has no real prospect of successfully defending the claim and there is no other compelling reason why the case should proceed to trial."]

Dated this [Day] day of [Month], [Year].

............................................................
[FIRM NAME]
Advocates & Solicitors for the [Plaintiff/Defendant/Applicant]
[Address]
[Telephone / Email / Reference]

To:
1. The Senior Assistant Registrar / Judge in Chambers, High Court at [Place].
2. [Opposing party's solicitors, name and address].

TAKE NOTICE: If you do not attend at the hearing, the Court may make such Order as it considers appropriate in your absence, including ordering you to pay the costs of this Application.

[FILED PURSUANT TO ORDER 32 r 1, RULES OF COURT 2012]`,
  },

  "Affidavit in Support (Chambers Application)": {
    name: "Affidavit in Support — Form 65 (Generic Chambers)",
    description: "Generic affidavit in support of an interlocutory application under Order 41 ROC 2012",
    content: `IN THE HIGH COURT IN MALAYA AT [PLACE]
[CIVIL DIVISION]

CIVIL SUIT NO. WA-[YEAR]-[DIVISION]-[NUMBER]-[YEAR]

BETWEEN [PLAINTIFF NAME] ...PLAINTIFF AND [DEFENDANT NAME] ...DEFENDANT

                          AFFIDAVIT IN SUPPORT
                     (Order 41, Rules of Court 2012)

I, [DEPONENT'S FULL NAME], NRIC No. [NRIC], of [Full Address], a [Position/Occupation, e.g., "Senior Recovery Officer of the Plaintiff"], do solemnly and sincerely [affirm/swear] and say as follows:

1. I am the [position] of the [Plaintiff/Defendant] herein and am duly authorised to affirm this Affidavit on its behalf. Save where otherwise stated, the facts deposed to herein are within my own personal knowledge. Where the facts are derived from documents or information conveyed to me by others, I identify the source and verily believe such information to be true.

2. I crave leave to refer to the Cause Papers herein and the documents exhibited to this Affidavit. There is now produced and shown to me marked as Exhibit "[INITIALS-1]" a true copy of [identify document], at pages [pp.] of the Exhibit Bundle.

[3.–N. — Set out, paragraph by paragraph, the factual narrative supporting each prayer of the Notice of Application. Refer to exhibits inline. Address each element of the legal test (e.g., for Order 14: liquidated demand; debt due and owing; no real defence). Be precise as to dates, sums, communications, and conduct. Avoid argument or legal submission — those belong in written submissions.]

[N+1]. In the premises, I respectfully pray that this Honourable Court allow the Application as prayed in the Notice of Application dated [Date] herein, with costs.

AFFIRMED by the abovenamed                         )
[DEPONENT'S NAME]                                  )
at [Place] on this [Day] day                       )    .....................................
of [Month], [Year]                                 )    [DEPONENT'S SIGNATURE]

Before me,

............................................................
COMMISSIONER FOR OATHS / NOTARY PUBLIC
[Stamp and Seal]

This Affidavit is filed by Messrs [FIRM NAME], Advocates & Solicitors for the [Plaintiff/Defendant], at [Address].

EXHIBITS LIST:
Exhibit "[INITIALS-1]": [Description] (pp. ___–___)
Exhibit "[INITIALS-2]": [Description] (pp. ___–___)
... [continue]`,
  },

  "Notice of Application (Interim Injunction)": {
    name: "Notice of Application — Interim Injunction (Inter Partes)",
    description: "Inter partes application for an interim prohibitory or mandatory injunction under Order 29 ROC 2012",
    content: `IN THE HIGH COURT IN MALAYA AT [PLACE]
CIVIL DIVISION

CIVIL SUIT NO. WA-[YEAR]-[DIVISION]-[NUMBER]-[YEAR]

BETWEEN [PLAINTIFF] ...PLAINTIFF AND [DEFENDANT] ...DEFENDANT

                        NOTICE OF APPLICATION
                    (Order 29 r 1 & Order 32 r 1, Rules of Court 2012;
                     Specific Relief Act 1950, ss. 50–55;
                     Courts of Judicature Act 1964, s. 25(2) & Schedule)

LET ALL PARTIES concerned attend before the Judge in Chambers of the High Court at [Place] on [Date] at [Time] on the hearing of an Application by the Plaintiff for the following Orders:

1. That an Order of Interim [Prohibitory / Mandatory] Injunction be granted restraining the Defendant, by himself, his servants, agents, employees, representatives or any of them or otherwise howsoever, from [precise act to be restrained, e.g., "soliciting, contacting, dealing with or providing services to any of the Plaintiff's clients listed in Schedule A annexed hereto"] [OR mandating: "to deliver up to the Plaintiff's solicitors all confidential documents identified in Schedule B"] until the trial of this action or further order of this Honourable Court;

2. That the Defendant do pay the costs of this Application;

3. Such further or other Orders as this Honourable Court deems just and fit.

THE PLAINTIFF HEREBY GIVES THE USUAL UNDERTAKING AS TO DAMAGES — that is, an undertaking to abide by any Order this Honourable Court may make as to damages in the event that this Honourable Court is later of the opinion that the Defendant has sustained any damage by reason of this Order which the Plaintiff ought to pay.

This Application is supported by the Affidavit of [DEPONENT] affirmed on [Date].

Dated this [Day] day of [Month], [Year].

............................................................
[FIRM NAME]
Advocates & Solicitors for the Plaintiff

To: 1. The Registrar, High Court at [Place].
    2. The Defendant, c/o [Solicitors], [Address].

TAKE NOTICE: If you do not attend, the Court may proceed in your absence and grant the Orders prayed for.`,
  },

  "Draft Injunction Order with Penal Notice": {
    name: "Draft Injunction Order — with Penal Notice",
    description: "Sealed-form Order granting interim injunction, with penal notice for enforcement under Order 45 r 7 ROC 2012",
    content: `IN THE HIGH COURT IN MALAYA AT [PLACE]
CIVIL DIVISION

CIVIL SUIT NO. WA-[YEAR]-[DIVISION]-[NUMBER]-[YEAR]

BETWEEN [PLAINTIFF] ...PLAINTIFF AND [DEFENDANT] ...DEFENDANT

         BEFORE THE HONOURABLE [JUDGE'S NAME] IN CHAMBERS
                       ON THIS [DATE]

                                ORDER

UPON the Application of the Plaintiff by Notice of Application dated [Date] coming on for hearing this day AND UPON READING the Affidavit of [Deponent] affirmed on [Date] AND UPON HEARING [Counsel] of Counsel for the Plaintiff and [Counsel] of Counsel for the Defendant AND THE PLAINTIFF BY ITS COUNSEL UNDERTAKING TO ABIDE BY ANY ORDER THIS HONOURABLE COURT MAY MAKE AS TO DAMAGES,

IT IS HEREBY ORDERED THAT:

1. The Defendant, by himself, his servants, agents, employees, representatives or any of them or otherwise howsoever, BE AND IS HEREBY RESTRAINED from [precise terms of restraint], until the trial of this Action or further Order;

2. The costs of and incidental to this Application be costs in the cause [or as ordered].

GIVEN under my hand and the Seal of the Court this [Day] day of [Month], [Year].

............................................................
SENIOR ASSISTANT REGISTRAR / JUDGE IN CHAMBERS
HIGH COURT OF MALAYA AT [PLACE]

══════════════════════════════════════════════════════════════
                          PENAL NOTICE
══════════════════════════════════════════════════════════════

IF YOU, THE WITHIN-NAMED DEFENDANT, [DEFENDANT'S NAME], DISOBEY THIS ORDER YOU WILL BE LIABLE TO BE COMMITTED TO PRISON FOR CONTEMPT OF COURT. ANY OTHER PERSON WHO KNOWS OF THIS ORDER AND DOES ANYTHING WHICH HELPS OR PERMITS THE DEFENDANT TO BREACH THIS ORDER MAY ALSO BE COMMITTED TO PRISON, FINED, OR HAVE THEIR ASSETS SEIZED.

══════════════════════════════════════════════════════════════

This Order is filed by Messrs [FIRM NAME], Advocates & Solicitors for the Plaintiff.`,
  },

  "Striking Out Application (Order 18 r 19)": {
    name: "Notice of Application — Striking Out (Order 18 r 19 ROC 2012)",
    description: "Application to strike out pleadings under Order 18 r 19 ROC 2012 and inherent jurisdiction (Order 92 r 4)",
    content: `IN THE HIGH COURT IN MALAYA AT [PLACE]
CIVIL DIVISION

CIVIL SUIT NO. WA-[YEAR]-[DIVISION]-[NUMBER]-[YEAR]

BETWEEN [PLAINTIFF] ...PLAINTIFF AND [DEFENDANT] ...DEFENDANT

                          NOTICE OF APPLICATION
                  (Order 18 r 19 & Order 92 r 4, Rules of Court 2012)

LET ALL PARTIES concerned attend before the [Judge in Chambers / SAR] of the High Court at [Place] on [Date] at [Time] on the hearing of an Application by the [Defendant/Plaintiff] for the following Orders:

1. That the [Statement of Claim / Defence / specific paragraphs] herein be struck out under Order 18 r 19(1) of the Rules of Court 2012 and/or under the inherent jurisdiction of this Honourable Court (Order 92 r 4) on one or more of the following grounds:
   (a) it discloses no reasonable cause of action [or defence];
   (b) it is scandalous, frivolous or vexatious;
   (c) it may prejudice, embarrass or delay the fair trial of the action;
   (d) it is otherwise an abuse of the process of the Court;

2. That, consequent upon the striking out, the action be dismissed [or judgment entered for the Defendant];

3. That the [Plaintiff/Defendant] do pay the costs of this Application and the action on a [solicitor-and-client / standard] basis;

4. Such further or other Orders as this Honourable Court deems just and fit.

This Application is supported by the Affidavit of [Deponent] affirmed on [Date].

GROUNDS (briefly stated):
The [pleading complained of] is plainly and obviously unsustainable; it raises no triable issue and is an abuse of process. Reliance is placed upon, inter alia, *Bandar Builder Sdn Bhd v UMBC Bhd* [1993] 3 MLJ 36; *Tractors Malaysia Bhd v Tio Chee Hing* [1975] 2 MLJ 1.

Dated this [Day] day of [Month], [Year].

............................................................
[FIRM NAME]
Advocates & Solicitors for the [Defendant/Plaintiff]`,
  },
};

export function getSampleDocument(docName: string): SampleDoc | null {
  // Try exact match first
  if (SAMPLE_DOCUMENTS[docName]) return SAMPLE_DOCUMENTS[docName];
  // Try case-insensitive / partial match
  const lowerName = docName.toLowerCase();
  for (const [key, doc] of Object.entries(SAMPLE_DOCUMENTS)) {
    if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase().split(' ')[0].toLowerCase())) {
      return doc;
    }
  }
  return null;
}

export function getAllDocumentNames(): string[] {
  return Object.keys(SAMPLE_DOCUMENTS);
}
