export interface WFDocument {
  id: string;
  title: string;
  type: 'template' | 'form' | 'letter';
  note: string;
  sample: string;
}

export interface WFStep {
  id: number;
  phase: string;
  label: string;
  timeframe?: string;
  legalBasis?: string;
  tip?: string;
  documents?: WFDocument[];
}

export interface Workflow {
  id: string;
  title: string;
  category: string;
  difficulty: 'Basic' | 'Intermediate' | 'Advanced';
  duration: string;
  summary: string;
  legislation: string[];
  steps: WFStep[];
}

export const WORKFLOW_CATEGORIES = [
  'Sub-Sale (Secondary Market)',
  'Developer / Primary Market',
  'Loan & Financing',
  'Strata & Management Corporation',
  'Estate, Probate & Transmission',
  'Caveats',
  'Tenancy & Lease',
  'Foreclosure & Auction',
  'Special & Commercial Transactions',
  'Land Office Administrative',
];

export const WORKFLOWS: Workflow[] = [
  // ─── SUB-SALE ─────────────────────────────────────────────────
  {
    id: 'SS-01',
    title: 'Sub-Sale — Freehold Individual Title (Cash Purchase)',
    category: 'Sub-Sale (Secondary Market)',
    difficulty: 'Basic',
    duration: '3–4 months',
    summary: 'The simplest form of property transaction — direct sale between two private parties using a freehold property with an issued individual title, financed by cash (no bank loan involved).',
    legislation: ['National Land Code 1965 (s.215, s.340)', 'Contracts Act 1950', 'Stamp Act 1949', 'Real Property Gains Tax Act 1976'],
    steps: [
      {
        id: 1, phase: 'Pre-Contract', label: 'Earnest Deposit & Offer to Purchase',
        timeframe: 'Day 1', legalBasis: 'Contracts Act 1950 — s.10 (valid offer & acceptance)',
        tip: 'Ensure the OTP contains the full property description including lot number, title number, and mukim.',
        documents: [
          { id: 'ss01-d1', title: 'Letter of Offer to Purchase (OTP)', type: 'template', note: 'Binds both parties to proceed to SPA. The earnest deposit (1–2%) is held by the agent as stakeholder.', sample: 'LETTER OF OFFER TO PURCHASE\n\nDate: [Date]\n\nTo: [Vendor Full Name / NRIC No]\n\nDear Sir/Madam,\n\nPROPERTY: [Property Address]\nTitle No: [Geran/QT No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nI/We, [Purchaser Full Name] (NRIC: [No]), hereby offer to purchase the abovementioned property subject to the following terms:\n\n1. PURCHASE PRICE: RM [Amount] (Ringgit Malaysia [Amount in Words] only).\n2. EARNEST DEPOSIT: RM [Amount] (equivalent to [1/2]% of the purchase price) paid herewith as earnest money to [Agent/Firm] as stakeholders.\n3. BALANCE DEPOSIT: 8% of the purchase price (RM [Amount]) payable upon signing of the Sale and Purchase Agreement.\n4. EXECUTION OF SPA: The SPA shall be executed within 14 working days from the Vendor\'s written acceptance hereof.\n5. COMPLETION: 90 days from the SPA date, subject to any extension agreed in writing.\n6. DEFAULT: If the Purchaser defaults, the Earnest Deposit is forfeited. If the Vendor defaults, the Vendor shall refund double the Earnest Deposit.\n\nSolicitor appointed by Purchaser: [Law Firm Name]\n\nSigned: __________________________ (Purchaser)\nDate: __________________________\n\nACCEPTED by Vendor:\nSigned: __________________________ (Vendor)\nDate: __________________________' },
          { id: 'ss01-d2', title: 'Stakeholder Receipt', type: 'letter', note: 'Issued by the agent or solicitor confirming receipt of the earnest deposit.', sample: 'OFFICIAL STAKEHOLDER RECEIPT\n\nNo: [SR-001]\nDate: [Date]\n\nReceived from: [Purchaser Name]\nI.C. No.: [NRIC]\n\nThe sum of: Ringgit Malaysia [Amount in Words] Only (RM [Amount])\nBeing: Earnest deposit (2%) for the proposed purchase of [Property Address].\n\nThis sum is held by us as STAKEHOLDERS and will be released as follows:\n— To Vendor: upon the execution of the SPA\n— Forfeited to Vendor: if Purchaser withdraws\n— Refunded to Purchaser: if Vendor fails to execute SPA\n\n___________________________\nFor [Agency/Law Firm Name]\nLicence No: [No]' }
        ]
      },
      {
        id: 2, phase: 'Contract', label: 'Execution of Sale and Purchase Agreement (SPA)',
        timeframe: 'Day 14', legalBasis: 'Contracts Act 1950; Specific Relief Act 1950',
        tip: 'Ensure CKHT forms are signed by the vendor on the same day as the SPA to meet the 60-day submission deadline.',
        documents: [
          { id: 'ss01-d3', title: 'Standard Sub-Sale SPA', type: 'template', note: 'Principal agreement. Balance deposit of 8% paid on signing. Time is of the essence.', sample: 'SALE AND PURCHASE AGREEMENT\n\nDated the [   ] day of [Month] [Year]\n\nBETWEEN:\n[VENDOR FULL NAME] (NRIC: [No]) ("the Vendor")\nAND\n[PURCHASER FULL NAME] (NRIC: [No]) ("the Purchaser")\n\nWHEREAS the Vendor is the registered proprietor of the property described below:\n\nPROPERTY DESCRIPTION:\nTitle No.: [Geran / QT No.], Lot [No.], Mukim [Name], Daerah [Name], Negeri [State]\nAddress: [Full street address]\nLand Area: Approximately [   ] square feet\n\nNOW IT IS AGREED as follows:\n\n1. PURCHASE PRICE AND PAYMENT\n   1.1 Purchase Price: RM [Amount]\n   1.2 Paid prior as Earnest Deposit: RM [Amount]\n   1.3 Balance Deposit (8%) paid on signing: RM [Amount]\n   1.4 Balance Purchase Price (90%) payable on Completion: RM [Amount]\n\n2. COMPLETION\n   The balance purchase price shall be paid within 90 days from the date of this Agreement ("Completion Date").\n\n3. INTEREST ON LATE PAYMENT\n   Interest at 8% per annum shall be payable on any overdue amount calculated on a daily basis.\n\n4. OUTGOINGS\n   Quit rent and assessment are apportioned as at the Completion Date.\n\n5. TITLE\n   The Vendor warrants good title free of encumbrances (save and except the existing charge which shall be redeemed on Completion).\n\n6. VENDOR\'S DEFAULT\n   The Vendor shall refund all monies paid and pay the Purchaser\'s legal costs if the Vendor fails to complete.\n\n7. PURCHASER\'S DEFAULT\n   All deposits shall be forfeited as agreed liquidated damages.\n\n8. COSTS\n   The Purchaser bears stamp duty on the MOT and legal fees for the SPA. The Vendor bears RPGT and legal fees for the redemption.' },
          { id: 'ss01-d4', title: 'CKHT 1A Form (Vendor)', type: 'form', note: 'RPGT declaration by the disposer. Due within 60 days of SPA date.', sample: 'BORANG CKHT 1A\n(PENYATA PELUPUSAN HARTA TANAH)\n\nKepada: Ketua Pengarah Hasil Dalam Negeri\n\nSaya/Kami yang bertandatangan di bawah ini, iaitu pihak yang melupus harta tanah yang dinyatakan di bawah, dengan ini mengisytiharkan bahawa:\n\n1. BUTIRAN PELUPUS:\n   Nama: [Nama Penuh Vendor]\n   No. K/P: [NRIC]\n   Alamat: [Alamat]\n\n2. BUTIRAN HARTA TANAH:\n   Nombor Lot/PT: [Lot No]\n   No. Hakmilik: [Geran/QT No]\n   Alamat: [Alamat Harta]\n\n3. BUTIRAN PELUPUSAN:\n   Tarikh SPA: [Date]\n   Harga Pelupusan: RM [Amount]\n   Harga Perolehan: RM [Amount]\n   Keuntungan Boleh Cukai: RM [Amount]\n\n4. TARIF CGPT: [X]%\n5. CUKAI DIANGGAR: RM [Amount]\n\n___________________________\nTandatangan Pelupus / Tarikh' },
          { id: 'ss01-d5', title: 'CKHT 2A Form (Purchaser)', type: 'form', note: 'Purchaser\'s acquisition return. The 3% retention sum must also be remitted.', sample: 'BORANG CKHT 2A\n(PENYATA PEROLEHAN HARTA TANAH)\n\nKepada: Ketua Pengarah Hasil Dalam Negeri\n\n1. BUTIRAN PEMEROLEH:\n   Nama: [Nama Penuh Purchaser]\n   No. K/P: [NRIC]\n   Alamat: [Alamat]\n\n2. BUTIRAN HARTA TANAH:\n   No. Hakmilik: [No]\n   Alamat: [Alamat]\n\n3. BUTIRAN PEROLEHAN:\n   Tarikh SPA: [Date]\n   Harga Perolehan: RM [Amount]\n\n4. JUMLAH DITAHAN (3%): RM [Amount]\n\n___________________________\nTandatangan Pemeroleh / Tarikh' }
        ]
      },
      {
        id: 3, phase: 'Stamping', label: 'Stamping of SPA at LHDN',
        timeframe: 'Within 30 days of SPA execution', legalBasis: 'Stamp Act 1949 — s.47A (time for stamping)',
        tip: 'Stamp within 30 days to avoid a 5x penalty. Use LHDN\'s MyStamp online portal for faster processing.',
        documents: [
          { id: 'ss01-d6', title: 'PDS 1 Form (e-Stamp for SPA)', type: 'form', note: 'Stamping of the principal SPA document. Fee: RM10 per copy.', sample: 'PDS 1 (Stamp Duty Form)\n\nInstrument: Sale and Purchase Agreement\nDate of Instrument: [Date]\nParties: [Vendor] and [Purchaser]\nProperty: [Full Description]\nConsideration: RM [Amount]\n\nStamp Duty Computation:\nFirst RM100,000 @ 1%: RM 1,000\nNext RM400,000 @ 2%: RM 8,000\nNext RM[X] @ 3%: RM [X]\n\nTotal Stamp Duty: RM [Amount]\n\n[LHDN Stamp & Reference Number]' }
        ]
      },
      {
        id: 4, phase: 'Title Search & Requisitions', label: 'Official Land Search & Raise Requisitions on Title',
        timeframe: 'After SPA; within 2 weeks', legalBasis: 'NLC — conveyancing practice; Bar Council Guidelines',
        tip: 'Conduct searches for: (1) private caveats, (2) charges, (3) registrar\'s caveat, (4) bankruptcy search, (5) quit rent outstanding.',
        documents: [
          { id: 'ss01-d7', title: 'Land Search Request Letter', type: 'letter', note: 'Written request to PTG for official title search showing all registered dealings.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nPendaftar Hakmilik\nPejabat Tanah dan Galian [State]\n\nDear Sir,\n\nREQUEST FOR OFFICIAL LAND SEARCH\n\nTitle No: [Geran/QT No]\nLot No: [No]\nMukim: [Name] / Daerah: [Name]\n\nWe act for [Purchaser Name] in the purchase of the above land. Kindly conduct a title search and provide us with the current state of the register showing all registered dealings, charges, caveats, and restrictions.\n\nSearch fee of RM [Amount] (Bank Draft/Banker\'s Cheque) is enclosed.\n\nYours faithfully,\n[Lawyer Name / Firm]' }
        ]
      },
      {
        id: 5, phase: 'Completion', label: 'Payment of Balance Purchase Price & Collection of Title Documents',
        timeframe: 'Completion Date (Day 90)', legalBasis: 'SPA terms; NLC s.215',
        tip: 'Prepare a completion account statement showing the balance purchase price less any apportionments for quit rent, assessment, and maintenance.',
        documents: [
          { id: 'ss01-d8', title: 'Completion Statement', type: 'letter', note: 'Account showing the exact balance payable on completion after deducting all apportionments.', sample: 'COMPLETION ACCOUNT\n\nDate of Completion: [Date]\n\nPurchase Price:                               RM [Amount]\nLess: Earnest Deposit (2%):               (RM [Amount])\nLess: Balance Deposit (8%) paid on SPA: (RM [Amount])\nBalance Purchase Price (90%):              RM [Amount]\n\nADJUSTMENTS:\nApportionment of Quit Rent (Vendor\'s share):\n  [X] months @ RM [Rate] p.a.:            (RM [Amount])\nApportionment of Assessment (Vendor\'s share):\n  [X] months @ RM [Rate] p.a.:            (RM [Amount])\n\nNET BALANCE PAYABLE TO VENDOR:             RM [Amount]\n\nPayment by: Banker\'s cheque / Online Transfer' },
          { id: 'ss01-d9', title: 'Form 14A (Memorandum of Transfer)', type: 'form', note: 'Statutory instrument under NLC to transfer title. Must be attested by an advocate & solicitor.', sample: 'MEMORANDUM OF TRANSFER\n(Section 215 of the National Land Code, 1965)\n\nFORM 14A\n\nTO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:\n\nI/We, [VENDOR FULL NAME] (NRIC: [No]) of [Address], the registered proprietor of the land described below HEREBY TRANSFER to [PURCHASER FULL NAME] (NRIC: [No]) of [Address] ALL the land known as:\n\nTitle No: [Geran No]\nLot No: [No]\nMukim: [Name]\nDaerah/District: [Name]\nState: [State]\nArea: [  ] square metres/feet\n\nSubject to: [any restrictions/conditions]\n\nFor the consideration of RM [Amount] (Ringgit Malaysia [Amount in Words] only).\n\nDATE: ____________________\n\n________________________________\nSignature of Transferor (Vendor)\n\nI, [SOLICITOR NAME], an Advocate & Solicitor of the High Court of Malaya, certify that the above-named Transferor personally appeared before me and acknowledged the execution of this instrument.\n\n________________________________\nAdvocate & Solicitor\n[Bar Council Roll No]' }
        ]
      },
      {
        id: 6, phase: 'Presentation & Registration', label: 'Presentation of Form 14A at Land Office',
        timeframe: 'Within 3 days of completion', legalBasis: 'NLC s.298 (presentment); s.304 (registration)',
        tip: 'Conduct a priority search on the same morning of presentment to ensure no intervening dealings since the earlier search.',
        documents: [
          { id: 'ss01-d10', title: 'Covering Letter — Presentation of Form 14A', type: 'letter', note: 'Formal letter to the Land Registrar enclosing all documents for registration.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nPendaftar Hakmilik / Pentadbir Tanah\nPejabat Tanah [District], [State]\n\nDear Sir,\n\nPRESENTATION OF FORM 14A (MEMORANDUM OF TRANSFER)\nTitle No: [Geran No], Lot [No], Mukim [Name], Daerah [Name]\n\nWe, the solicitors for the Purchaser, hereby present the following for registration:\n\n1. Original Issue Document of Title (IDT)\n2. Form 14A (Memorandum of Transfer) duly executed and stamped\n3. Copy of Purchaser\'s NRIC (Certified True Copy)\n4. Copy of Vendor\'s NRIC (Certified True Copy)\n5. Stamped SPA\n6. CKHT Clearance / Exemption letter\n7. Registration fees: RM [Amount] (Money Order/Bank Draft No: [No])\n\nKindly register the transfer and issue the IDT in the Purchaser\'s name.\n\nYours faithfully,\n[Lawyer Name]\n[Firm Name]' }
        ]
      }
    ]
  },
  {
    id: 'SS-02',
    title: 'Sub-Sale — Freehold Individual Title (With Bank Loan)',
    category: 'Sub-Sale (Secondary Market)',
    difficulty: 'Intermediate',
    duration: '3–5 months',
    summary: 'The most common property transaction in Malaysia. Involves both a sub-sale SPA and a concurrent housing loan with a bank, requiring simultaneous discharge of the vendor\'s existing charge and registration of the purchaser\'s new charge.',
    legislation: ['NLC 1965 (s.215, s.241, s.278)', 'Contracts Act 1950', 'Stamp Act 1949', 'RPGT Act 1976', 'Moneylenders Act 1951'],
    steps: [
      { id: 1, phase: 'Pre-Contract', label: 'OTP, Earnest Deposit & Loan Pre-Approval', timeframe: 'Day 1–14', legalBasis: 'Contracts Act 1950', tip: 'Purchaser must obtain a Letter of Offer from the bank within the OTP period, otherwise the OTP may lapse.' },
      { id: 2, phase: 'Contract', label: 'Execution of SPA & Loan Documents', timeframe: 'Day 14', legalBasis: 'Contracts Act 1950; NLC s.241', tip: 'The SPA and Loan Agreement must be executed simultaneously or within days of each other. The loan is conditional on the SPA being signed.', documents: [{ id: 'ss02-d1', title: 'Memorandum of Charge (Form 16A)', type: 'form', note: 'Registered charge created by the Purchaser (Chargor) in favour of the Bank (Chargee) to secure the housing loan.', sample: 'MEMORANDUM OF CHARGE\n(Section 241 of the National Land Code, 1965)\n\nFORM 16A\n\nI/We, [PURCHASER NAME] (NRIC: [No]) ("the Chargor") HEREBY CHARGE the land described below to [BANK NAME] (Registration No: [No]) ("the Chargee") as security for the repayment of the sum of RM [Loan Amount] together with interest thereon at the rate of [Rate]% per annum in the manner specified in the Loan Agreement dated [Date].\n\nLAND CHARGED:\nTitle No: [Geran No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nCONDITIONS OF CHARGE:\n1. Principal sum: RM [Amount]\n2. Interest: [Rate]% p.a. (variable/fixed)\n3. Tenure: [X] years\n4. Monthly instalment: RM [Amount]\n\nDATE: ____________________\n\n________________________________\nSignature of Chargor (Purchaser)\n\nAttested by:\n________________________________\nAdvocate & Solicitor' }] },
      { id: 3, phase: 'Bank Undertaking & Redemption', label: 'Exchange of Bank Undertakings (Vendor\'s Bank & Purchaser\'s Bank)', timeframe: 'Day 14–30', legalBasis: 'NLC s.278 (Discharge); Bar Council practice', tip: 'This is the critical coordination step. Purchaser\'s bank agrees to release loan proceeds in exchange for Vendor\'s bank\'s undertaking to discharge the existing charge.', documents: [{ id: 'ss02-d2', title: 'Undertaking to Discharge (Vendor\'s Bank)', type: 'letter', note: 'Vendor\'s bank undertakes to discharge the existing charge upon receipt of the redemption sum from the Purchaser\'s bank.', sample: '[Vendor\'s Bank Letterhead]\n\nDate: [Date]\n\nTo: [Purchaser\'s Bank Name]\n\nDear Sir,\n\nPROPERTY: [Full Description & Title No]\nBORROWER/CHARGOR: [Vendor Name]\nOUR LOAN ACCOUNT NO: [Account No]\nREDEMPTION SUM: RM [Amount] (valid until [Redemption Date])\n\nWe, [Vendor\'s Bank], hereby UNDERTAKE to execute and present a valid Form 16N (Discharge of Charge) to the Land Registry within [14/21] working days of receiving the redemption sum of RM [Amount] from your bank.\n\nUpon registration of the Discharge, we will forward the original IDT to your office.\n\nThis undertaking is subject to the condition that the above redemption sum is received in cleared funds by [Redemption Date].\n\nYours faithfully,\n[Authorised Signatory]\n[Vendor\'s Bank]' }] },
      { id: 4, phase: 'Stamping', label: 'Stamping of SPA, Loan Agreement & Form 16A', timeframe: 'Within 30 days', legalBasis: 'Stamp Act 1949', tip: 'Three separate stampings are required: (1) SPA, (2) Loan Agreement (0.5% on loan amount), (3) Form 14A (ad valorem MOT).' },
      { id: 5, phase: 'Completion', label: 'Drawdown of Loan & Payment of Balance Purchase Price', timeframe: 'Completion Date', legalBasis: 'SPA; Loan Agreement', tip: 'Bank releases loan proceeds to Vendor\'s bank (redemption sum) and balance to Vendor. All cheques should be banker\'s cheques.' },
      { id: 6, phase: 'Discharge & Transfer', label: 'Registration of Discharge (Form 16N) & Transfer (Form 14A) & New Charge (Form 16A)', timeframe: 'Within 3 months of completion', legalBasis: 'NLC s.278, s.215, s.241', tip: 'All three instruments are presented together or in sequence at the Land Office. Priority search must be done on the morning of presentment.', documents: [{ id: 'ss02-d3', title: 'Form 16N — Discharge of Charge', type: 'form', note: 'Executed by the Vendor\'s bank to release the existing charge. Must be stamped at RM10.', sample: 'DISCHARGE OF CHARGE\n(Section 278 of the National Land Code, 1965)\n\nFORM 16N\n\nI/We, [BANK NAME] ("the Chargee") HEREBY DISCHARGE the charge registered as [Presentation No. & Date] against the land described as:\n\nTitle No: [Geran No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nfrom all further liability under the said charge.\n\nDATED: ____________________\n\n________________________________\nAuthorised Signatory (Chargee / Bank)\n[Bank Seal]' }] }
    ]
  },
  {
    id: 'SS-03',
    title: 'Sub-Sale — Leasehold Land with State Consent Required',
    category: 'Sub-Sale (Secondary Market)',
    difficulty: 'Intermediate',
    duration: '4–8 months',
    summary: 'Where the land carries a restriction in interest (e.g. "cannot be transferred without state authority consent"), the SPA is conditional on state consent. Completion cannot occur until this consent is obtained.',
    legislation: ['NLC 1965 (s.119, s.214A)', 'State Land Rules', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'Pre-Contract', label: 'OTP with State Consent Condition', timeframe: 'Day 1', legalBasis: 'NLC s.119; Contracts Act 1950', tip: 'The OTP and SPA must be expressly conditional on state consent being granted within a specified period (typically 3–6 months).' },
      { id: 2, phase: 'Contract', label: 'Execution of Conditional SPA', timeframe: 'Day 14', legalBasis: 'Contracts Act 1950 s.28 (conditional contracts)', tip: 'If state consent is not obtained within the specified period, the SPA is deemed null and all deposits are refunded.' },
      { id: 3, phase: 'State Consent Application', label: 'Application for State Authority Consent to Transfer', timeframe: 'Day 14–120', legalBasis: 'NLC s.214A (consent to transfer restricted land)', tip: 'The application is made to the State Director of Lands or State Authority. Processing time varies widely (2 weeks in Selangor to 6 months in other states).', documents: [{ id: 'ss03-d1', title: 'Application Letter for State Consent (s.214A)', type: 'letter', note: 'Formal letter with supporting documents: copy of SPA, parties\' IDs, title extract, statutory declaration.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nPengarah Tanah dan Galian\nNegeri [State]\n\nDear Sir,\n\nAPPLIKASI UNTUK KEBENARAN PINDAHMILIK DI BAWAH SEKSYEN 214A KANUN TANAH NEGARA 1965\n\nHAKMILIK: [Title No], LOT [No], MUKIM [Name], DAERAH [Name]\n\nKami mewakili [Purchaser Name] (No. K/P: [No]) dalam pembelian tanah di atas daripada [Vendor Name] (No. K/P: [No]) pada harga RM [Amount].\n\nOleh kerana hakmilik tanah ini mengandungi syarat sekatan kepentingan "Tanah ini tidak boleh dipindahmilik, dipajak atau dicagarkan tanpa kebenaran Pihak Berkuasa Negeri", kami dengan ini memohon kebenaran Pihak Berkuasa Negeri untuk pindahmilik tersebut.\n\nDilampirkan bersama:\n1. Salinan SPA yang telah setem\n2. Salinan K/P Pembeli dan Penjual\n3. Salinan hakmilik tanah (title search)\n4. Yuran permohonan: RM [Amount]\n\nYours faithfully,\n[Lawyer Name / Firm]' }] },
      { id: 4, phase: 'Post-Consent', label: 'Completion upon Receipt of State Consent', timeframe: 'Within 3 months of consent', legalBasis: 'NLC s.215', tip: 'Once consent is received, the parties proceed to completion as per a standard sub-sale transaction.' }
    ]
  },
  {
    id: 'SS-04',
    title: 'Sub-Sale — No Individual Title (Deed of Assignment)',
    category: 'Sub-Sale (Secondary Market)',
    difficulty: 'Intermediate',
    duration: '3–5 months',
    summary: 'Where the property (usually a condominium or apartment) has been built but the individual strata title has not yet been issued by the developer. The purchaser\'s rights are protected by a Deed of Assignment of the original SPA rights.',
    legislation: ['Contracts Act 1950', 'Housing Development Act 1966', 'Strata Titles Act 1985', 'NLC 1965'],
    steps: [
      { id: 1, phase: 'Due Diligence', label: 'Verification of Developer\'s Master Title & Existing Charges', timeframe: 'Day 1–7', legalBasis: 'NLC; HDA', tip: 'Check if the developer\'s master title has been charged to a bridging financier. The purchaser must ensure this will be redeemed upon sub-sale.' },
      { id: 2, phase: 'Contract', label: 'Execution of Sub-Sale SPA (No Individual Title)', timeframe: 'Day 14', legalBasis: 'Contracts Act 1950; HDA 1966', tip: 'The sub-sale SPA must be carefully drafted to address the absence of a title. Include a clause requiring the developer to eventually transfer the strata title when issued.' },
      { id: 3, phase: 'Assignment', label: 'Execution of Deed of Assignment', timeframe: 'Day 14', legalBasis: 'Common law equity; Contracts Act 1950', tip: 'The Deed of Assignment assigns all the original purchaser\'s rights under the OG SPA to the new buyer. Requires developer\'s consent if the OG SPA so stipulates.', documents: [{ id: 'ss04-d1', title: 'Deed of Assignment (Sub-Sale, No Title)', type: 'template', note: 'The key instrument protecting the buyer when no individual title exists. The Assignor (sub-vendor) assigns all their rights under the original SPA to the Assignee (sub-purchaser).', sample: 'DEED OF ASSIGNMENT\n\nDate: [Date]\n\nBETWEEN:\n[ASSIGNOR FULL NAME] (NRIC: [No]) of [Address] ("the Assignor")\nAND\n[ASSIGNEE FULL NAME] (NRIC: [No]) of [Address] ("the Assignee")\n\nRECITALS:\nA. By a Sale and Purchase Agreement dated [Date] ("the Original SPA"), [Developer Name] agreed to sell to the Assignor the property known as [Unit No], [Building/Project Name], [Address] for the sum of RM [Original Price].\nB. The Assignor has agreed to sell and the Assignee has agreed to purchase the said property for the sum of RM [Sub-sale Price].\nC. As no individual strata/unit title has yet been issued for the said property, it is not possible at the present time to effect a transfer in the conventional manner.\n\nNOW IN CONSIDERATION of the sum of RM [Amount] paid by the Assignee to the Assignor, the Assignor HEREBY ABSOLUTELY ASSIGNS to the Assignee, ALL the rights, title, interest and benefits vested in or accruing to the Assignor under the Original SPA.\n\n[Standard covenants, developer consent clause, etc.]\n\nIN WITNESS WHEREOF...' }] },
      { id: 4, phase: 'Stamping', label: 'Stamping of Sub-Sale SPA & Deed of Assignment', timeframe: 'Within 30 days', legalBasis: 'Stamp Act 1949', tip: 'The Deed of Assignment is stamped separately. Ad valorem duty is charged on the higher of the sub-sale price or the market value.' },
      { id: 5, phase: 'Notification', label: 'Notice of Assignment to Developer', timeframe: 'Within 7 days of execution', legalBasis: 'Contracts Act 1950 s.4(4) (assignment)', tip: 'A formal Notice of Assignment must be served on the developer to make the assignment effective against the developer.', documents: [{ id: 'ss04-d2', title: 'Notice of Assignment to Developer', type: 'letter', note: 'Notifies the developer of the change in ownership so future correspondence goes to the new owner.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nTo: [Developer Company Name]\n\nDear Sir/Madam,\n\nNOTICE OF ASSIGNMENT\nProperty: Unit [No], [Project Name], [Address]\nOriginal SPA dated: [Date] between [Developer] and [Assignor]\n\nWe act for the Assignee, [Assignee Name].\n\nPlease be informed that by a Deed of Assignment dated [Date], [Assignor Name] ("the Assignor") has absolutely assigned all rights, title, interest and benefits under the abovementioned SPA to [Assignee Name] ("the Assignee") for the consideration of RM [Amount].\n\nYou are requested to note the assignment in your records and to direct all future correspondence in relation to the property to the Assignee at the address above.\n\nYours faithfully,\n[Lawyer Name / Firm]' }] }
    ]
  },
  {
    id: 'SS-05',
    title: 'Sub-Sale — Malay Reserve Land',
    category: 'Sub-Sale (Secondary Market)',
    difficulty: 'Advanced',
    duration: '6–12 months',
    summary: 'Land classified as Malay Reserve under the Malay Reservations Enactment can only be transferred between Malay persons. Non-Malay vendors/purchasers may only deal with such land in specific circumstances or with a state exemption.',
    legislation: ['Malay Reservations Enactment 1913 (and State equivalents)', 'NLC 1965 (s.8)', 'Federal Constitution (Art. 89)'],
    steps: [
      { id: 1, phase: 'Eligibility Check', label: 'Verify Malay Reserve Status & Parties\' Eligibility', timeframe: 'Before OTP', legalBasis: 'Malay Reservations Enactment; NLC s.8', tip: 'CRITICAL: Conduct a title search first. If the land is Malay Reserve, both vendor and purchaser must be Malay (as defined in the applicable enactment). A non-Malay purchaser cannot proceed.' },
      { id: 2, phase: 'Pre-Contract', label: 'OTP & SPA (Between Malay Parties)', timeframe: 'Day 1–14', legalBasis: 'Contracts Act 1950', tip: 'The SPA should include a warranty by the vendor that the land is Malay Reserve and the purchaser confirms their Malay status.' },
      { id: 3, phase: 'Application', label: 'Application for State Authority Consent (if Restriction in Interest)', timeframe: 'Day 14–90+', legalBasis: 'NLC s.214A; Malay Reservations Enactment', tip: 'Even between two Malay parties, state consent may be required if the title carries a restriction in interest (separately from the Malay Reserve status).' },
      { id: 4, phase: 'Completion', label: 'Completion & Registration', timeframe: 'Upon consent', legalBasis: 'NLC s.215', tip: 'Registration will be rejected if either party is found to be non-Malay at the time of presentment.' }
    ]
  },
  {
    id: 'SS-06',
    title: 'Sub-Sale — Commercial Property with Loan',
    category: 'Sub-Sale (Secondary Market)',
    difficulty: 'Intermediate',
    duration: '3–5 months',
    summary: 'Purchase of commercial property (shop lots, office units, warehouse, factory) from an existing owner using a bank loan. Similar to residential sub-sale but with higher stamp duty, no first-home exemptions, and different loan structure.',
    legislation: ['NLC 1965', 'Contracts Act 1950', 'Stamp Act 1949', 'RPGT Act 1976'],
    steps: [
      { id: 1, phase: 'Pre-Contract', label: 'OTP & Loan Pre-Approval', timeframe: 'Day 1–14', legalBasis: 'Contracts Act 1950', tip: 'Commercial properties typically require a higher down payment (20–30%) and have different loan-to-value ratios than residential properties.' },
      { id: 2, phase: 'Contract', label: 'SPA & Loan Agreement Execution', timeframe: 'Day 14', legalBasis: 'Contracts Act 1950; NLC s.241', tip: 'No stamp duty exemption for commercial properties regardless of buyer\'s status. Full ad valorem stamp duty applies.' },
      { id: 3, phase: 'Stamping & Searches', label: 'Stamping at LHDN & Conduct All Searches', timeframe: 'Day 14–30', legalBasis: 'Stamp Act 1949', tip: 'Also check with the local authority for any outstanding quit rent, assessment, or planning orders affecting the commercial property.' },
      { id: 4, phase: 'Completion', label: 'Payment, Transfer & Charge Registration', timeframe: 'Completion Date', legalBasis: 'NLC s.215, s.241', tip: 'Ensure transfer of all tenancy agreements and deposits if the commercial property has existing tenants.' }
    ]
  },

  // ─── DEVELOPER / PRIMARY ─────────────────────────────────────
  {
    id: 'DEV-01',
    title: 'Purchase from Developer — Schedule G (Landed, Individual Title)',
    category: 'Developer / Primary Market',
    difficulty: 'Intermediate',
    duration: '18–48 months (construction period)',
    summary: 'Statutory purchase from a licensed housing developer for landed residential property (terrace, semi-D, bungalow) under the Housing Development Act 1966. The SPA must be in the prescribed Schedule G format and cannot be materially altered.',
    legislation: ['Housing Development (Control and Licensing) Act 1966', 'Housing Development Regulations 1989 (Schedule G)', 'NLC 1965', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Booking', label: 'Payment of Booking Fee (Maximum RM500)', timeframe: 'Day 1', legalBasis: 'Housing Development Regulations 1989 — Reg. 11(1)', tip: 'The booking fee is capped at RM500 under the HDA. Any amount in excess is illegal and the excess must be refunded.' },
      { id: 2, phase: 'SPA Execution', label: 'Signing of Schedule G SPA (Within 21 Days)', timeframe: 'Day 1–21', legalBasis: 'Housing Development Act 1966 — s.7(1); Schedule G', tip: 'The 10% deposit (less booking fee) is payable upon signing. Developer must deliver the signed SPA within 21 days of the purchaser signing. Failure entitles the purchaser to a refund.', documents: [{ id: 'dev01-d1', title: 'HDA Schedule G SPA', type: 'template', note: 'Prescribed statutory form for landed residential property. Clauses cannot be varied to the purchaser\'s detriment.', sample: 'SALE AND PURCHASE AGREEMENT (SCHEDULE G)\n[Housing Development (Control and Licensing) Regulations 1989]\n\nDate: [Date]\n\nBETWEEN: [DEVELOPER NAME] (Developer Licence No: [No]; Advertisement Permit No: [No]) ("the Vendor")\nAND: [PURCHASER NAME] (NRIC: [No]) ("the Purchaser")\n\n1. SALE AND PURCHASE\n   The Vendor sells and the Purchaser purchases the housing accommodation described in the Schedule for RM [Amount].\n\n2. PAYMENT SCHEDULE (PROGRESSIVE PAYMENT)\n   Stage 1 — Upon SPA: 10% (RM [Amount])\n   Stage 2 — Foundation completed: [X]% (RM [Amount])\n   Stage 3 — Superstructure (Ground Floor): [X]% (RM [Amount])\n   ...[continue per Architect\'s Certificates]\n   Stage 13 — VP: Remaining [X]% (RM [Amount])\n\n3. VACANT POSSESSION\n   Shall be delivered within [24/36] months from SPA date.\n\n4. LAD\n   If VP is not delivered by the said date, LAD at 10% per annum on the purchase price shall be payable.\n\n5. DEFECT LIABILITY PERIOD\n   24 months from VP date. Vendor to repair all defects notified in writing.\n\n[Standard clauses per Schedule G — cannot be varied]' }] },
      { id: 3, phase: 'Progressive Billing', label: 'Progressive Payment Billings (by Architect\'s Certificate)', timeframe: 'During construction', legalBasis: 'Housing Development Regulations 1989 — Schedule G, cl.3', tip: 'Each billing must be supported by an Architect\'s Certificate confirming the completion of that particular stage of construction. Do NOT pay without the certificate.' },
      { id: 4, phase: 'Vacant Possession', label: 'Acceptance of Vacant Possession (VP)', timeframe: 'Within 24/36 months of SPA', legalBasis: 'Housing Development Regulations 1989 — Schedule G, cl.17', tip: 'Conduct a thorough defect inspection before accepting VP. Note all defects in writing on the VP form. The 24-month DLP begins from the VP date.', documents: [{ id: 'dev01-d2', title: 'VP Acceptance Form with Defect List', type: 'template', note: 'Form to accept VP while reserving the right to claim for defects noticed upon inspection.', sample: 'NOTICE OF DELIVERY OF VACANT POSSESSION\n\nDate: [Date]\n\nTo: [Developer Name]\n\nWe act for [Purchaser Name] in respect of the property at [Unit Address].\n\nOur client has today received the keys and accepted delivery of Vacant Possession subject to the following defects noted upon inspection:\n\n1. Crack in bedroom wall (Item ref: [No])\n2. Leaking roof at [location] (Item ref: [No])\n3. Non-functioning electrical outlet in kitchen (Item ref: [No])\n\nPlease arrange for all the above defects to be rectified within 30 days of this notice in accordance with Clause [X] of the Sale and Purchase Agreement.\n\nThis acceptance of VP is WITHOUT PREJUDICE to our client\'s rights in respect of the above defects and any latent defects which may subsequently come to light during the Defect Liability Period.\n\nYours faithfully,\n[Purchaser / Purchaser\'s Solicitor]' }] },
      { id: 5, phase: 'Strata Title', label: 'Receipt of Individual Title (Geran)', timeframe: 'Within 36 months of VP (developer\'s obligation)', legalBasis: 'NLC s.215; HDA Schedule G cl.21', tip: 'Under Schedule G, the developer is obligated to present the Form 14A for registration within 36 months of VP. Failure triggers LAD at 10% p.a. on the unpaid portion.' }
    ]
  },
  {
    id: 'DEV-02',
    title: 'Purchase from Developer — Schedule H (Strata, Subdivided Building)',
    category: 'Developer / Primary Market',
    difficulty: 'Intermediate',
    duration: '24–60 months',
    summary: 'Purchase of a unit in a subdivided building (apartment, condominium, serviced apartment) from a licensed developer under HDA Schedule H. Key additional elements include strata title application by developer and eventual Management Corporation formation.',
    legislation: ['HDA 1966; Housing Development Regulations 1989 (Schedule H)', 'Strata Titles Act 1985', 'Strata Management Act 2013'],
    steps: [
      { id: 1, phase: 'Booking', label: 'Booking Fee (Max RM500) & Brochure Review', timeframe: 'Day 1', legalBasis: 'Housing Development Regulations 1989 — Reg. 11(1)', tip: 'Review the advertisement permit and developer\'s licence number. Do not pay more than RM500 as booking fee.' },
      { id: 2, phase: 'SPA Execution', label: 'Signing of Schedule H SPA', timeframe: 'Day 1–21', legalBasis: 'Housing Development Regulations 1989 — Schedule H', tip: 'Pay careful attention to the strata title application clause — the developer must apply within [X] months of CCC.' },
      { id: 3, phase: 'Progressive Billing', label: 'Progressive Payment Billings', timeframe: 'During construction', legalBasis: 'Housing Development Regulations 1989 — Schedule H, cl.3', tip: 'Each stage is certified by the architect. Keep copies of all billings and receipts.' },
      { id: 4, phase: 'CCC & VP', label: 'Certificate of Completion & Compliance (CCC) & Vacant Possession', timeframe: 'Contractual VP date', legalBasis: 'Street, Drainage and Building Act 1974 (amended); Schedule H cl.17', tip: 'CCC must be obtained by the developer before VP. No CCC = cannot legally occupy the unit.' },
      { id: 5, phase: 'JMB Formation', label: 'Formation of Joint Management Body (JMB)', timeframe: 'Within 12 months of VP', legalBasis: 'Strata Management Act 2013 (s.17)', tip: 'The JMB is constituted at a general meeting called by the developer. All purchasers are members. The JMB takes over management from the developer.' },
      { id: 6, phase: 'Strata Title', label: 'Issuance of Strata Title by Developer', timeframe: 'Within contractual period after CCC', legalBasis: 'Strata Titles Act 1985; Schedule H cl.21', tip: 'Once the strata title is issued, the JMB will be dissolved and a Management Corporation (MC) constituted.' }
    ]
  },

  // ─── LOAN & FINANCING ─────────────────────────────────────────
  {
    id: 'LF-01',
    title: 'First Charge — Freehold Individual Title',
    category: 'Loan & Financing',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'Creation of a first legal charge (Form 16A) over a freehold property with individual title in favour of a bank to secure a housing loan.',
    legislation: ['NLC 1965 (s.241–s.277)', 'Contracts Act 1950', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Letter of Offer', label: 'Acceptance of Bank\'s Letter of Offer', timeframe: 'Day 1–14', legalBasis: 'Contracts Act 1950 — acceptance', tip: 'Check the Letter of Offer carefully for the interest rate type (variable vs fixed), lock-in period, early redemption penalty, and progressive drawdown conditions.' },
      { id: 2, phase: 'Loan Documents', label: 'Execution of Loan Agreement & Form 16A', timeframe: 'Day 7–21', legalBasis: 'NLC s.241; Contracts Act 1950', tip: 'The Chargor must personally appear before the attesting solicitor. The attestation cannot be done by affidavit.', documents: [{ id: 'lf01-d1', title: 'Housing Loan Agreement', type: 'template', note: 'The principal loan contract setting out the terms of borrowing. Governs the relationship between Chargor and Chargee.', sample: 'HOUSING LOAN AGREEMENT\n\nDate: [Date]\n\nBETWEEN:\n[BANK NAME] ("the Bank" or "the Lender")\nAND\n[BORROWER NAME] (NRIC: [No]) ("the Borrower")\n\n1. LOAN AMOUNT: RM [Amount]\n2. PURPOSE: To finance the purchase of [Property Address] at Title No [Geran No].\n3. INTEREST RATE: [Rate]% per annum, [variable/fixed], calculated on a daily rest basis.\n4. TENURE: [X] years from first drawdown.\n5. MONTHLY INSTALMENT: RM [Amount] (subject to variation upon rate changes).\n6. SECURITY: A first legal charge (Form 16A) over the Property.\n7. DRAWDOWN: Upon presentation of Form 14A and all security documents to the Bank\'s satisfaction.\n8. LOCK-IN PERIOD: [X] years. Early full redemption within lock-in attracts a [X]% penalty on the outstanding principal.\n9. FIRE INSURANCE: The Borrower shall maintain fire insurance (and MRTA if required) at all times.\n\n[Standard covenants, events of default, acceleration clause]' }] },
      { id: 3, phase: 'Stamping', label: 'Stamping of Loan Agreement & Form 16A', timeframe: 'Within 30 days', legalBasis: 'Stamp Act 1949', tip: 'Stamp duty on a loan agreement: 0.5% on loan amount. Form 16A: RM10 flat (the duty is already computed as part of the loan agreement stamp).' },
      { id: 4, phase: 'Registration', label: 'Presentation & Registration of Form 16A', timeframe: 'Upon drawdown/completion', legalBasis: 'NLC s.241 & s.298', tip: 'The charge is only effective upon registration. Submit the IDT, stamped Form 16A, and covering letter to the Land Office for presentment.' }
    ]
  },
  {
    id: 'LF-02',
    title: 'Refinancing — Full Redemption & New First Charge',
    category: 'Loan & Financing',
    difficulty: 'Intermediate',
    duration: '2–4 months',
    summary: 'A borrower discharges an existing charge and simultaneously creates a new charge with a different bank to take advantage of better interest rates or to unlock equity.',
    legislation: ['NLC 1965 (s.241, s.278)', 'Stamp Act 1949', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'New Loan Application', label: 'Apply for Refinancing Loan & Letter of Offer', timeframe: 'Day 1–30', legalBasis: 'Contracts Act 1950', tip: 'Check the lock-in period of the existing loan. If still within lock-in, an early redemption penalty applies (typically 2–5% on outstanding loan).' },
      { id: 2, phase: 'Redemption Request', label: 'Request Redemption Statement from Existing Bank', timeframe: 'Day 1–14', legalBasis: 'NLC; loan agreement terms', tip: 'Request a redemption statement with a specific redemption date. The statement is typically valid for 3 months.' },
      { id: 3, phase: 'Undertakings', label: 'Exchange of Solicitor\'s Undertakings Between Old & New Banks', timeframe: 'Day 14–30', legalBasis: 'Solicitor\'s professional obligations; NLC', tip: 'New bank undertakes to pay the redemption sum; old bank undertakes to discharge the existing charge upon receipt.' },
      { id: 4, phase: 'Execution', label: 'Execute New Loan Agreement & Form 16A', timeframe: 'Day 14–45', legalBasis: 'NLC s.241', tip: 'Stamp duty on the new loan agreement is chargeable on the entire new loan amount, not just the additional amount.' },
      { id: 5, phase: 'Simultaneous Registration', label: 'Register Discharge (16N) & New Charge (16A) Simultaneously', timeframe: 'Completion date', legalBasis: 'NLC s.298, s.304', tip: 'Present both instruments simultaneously or request the Land Registrar to process them in priority order (Discharge first, then new Charge).' }
    ]
  },
  {
    id: 'LF-03',
    title: 'Discharge of Charge — Full Redemption',
    category: 'Loan & Financing',
    difficulty: 'Basic',
    duration: '1–2 months',
    summary: 'Upon full repayment of a housing loan, the bank executes a Form 16N (Discharge of Charge) to release the security over the property, leaving the owner with a clean, unencumbered title.',
    legislation: ['NLC 1965 (s.278)', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Full Repayment', label: 'Final Repayment of Loan Balance', timeframe: 'Day 1', legalBasis: 'Loan agreement', tip: 'Request a final redemption statement before making the last payment to confirm the exact amount required to fully redeem the loan.' },
      { id: 2, phase: 'Discharge Documents', label: 'Bank Executes Form 16N & Releases IDT', timeframe: 'Day 1–30', legalBasis: 'NLC s.278', tip: 'The bank may take 2–6 weeks to release the discharge documents. Follow up promptly to avoid delays.', documents: [{ id: 'lf03-d1', title: 'Request Letter for Discharge Documents', type: 'letter', note: 'Written request to the bank upon full settlement to release Form 16N and the original IDT.', sample: '[Client Letterhead or Firm Letterhead]\n\nDate: [Date]\n\nTo: [Bank Name]\nLoan Department\n[Bank Address]\n\nDear Sir/Madam,\n\nFULL REDEMPTION OF HOUSING LOAN\nLoan Account No: [Account No]\nProperty: [Address, Title No]\n\nThis is to confirm that on [Date], the sum of RM [Redemption Sum] being the full outstanding balance on the above loan account was remitted to you via [transfer details].\n\nAs the loan has been fully redeemed, please arrange for:\n1. Execution of the Form 16N (Discharge of Charge)\n2. Release of the original Issue Document of Title (IDT)\n3. Cancellation of any power of attorney held by the bank\n\nPlease forward the above documents to [Lawyer Name / Client] at the above address.\n\nYours faithfully,\n[Client / Solicitor Name]' }] },
      { id: 3, phase: 'Stamping', label: 'Stamping of Form 16N', timeframe: 'Within 30 days of execution', legalBasis: 'Stamp Act 1949', tip: 'Form 16N is a fixed duty document stamped at RM10.' },
      { id: 4, phase: 'Registration', label: 'Presentation of Form 16N at Land Office', timeframe: 'Within 7 days of receipt', legalBasis: 'NLC s.278 & s.298', tip: 'Present the original IDT and stamped Form 16N to the Land Registrar. The charge notation will be removed from the title register.' }
    ]
  },
  {
    id: 'LF-04',
    title: 'Islamic Financing — Musharakah Mutanaqisah',
    category: 'Loan & Financing',
    difficulty: 'Advanced',
    duration: '2–4 months',
    summary: 'An Islamic home financing structure based on a diminishing partnership where the bank and customer jointly own the property, and the customer gradually buys out the bank\'s share through monthly payments (rental + purchase of bank\'s portion).',
    legislation: ['NLC 1965; Islamic Financial Services Act 2013 (IFSA); Contracts Act 1950; Stamp Act 1949', 'Bank Negara Malaysia Shariah Advisory Council resolutions'],
    steps: [
      { id: 1, phase: 'Shariah Structure', label: 'Explanation of Musharakah Mutanaqisah Structure to Client', timeframe: 'Day 1', legalBasis: 'Islamic Financial Services Act 2013; BNM Shariah standards', tip: 'The solicitor must explain to the client that this is a joint purchase structure. The bank and client co-own the property in agreed proportions. The client pays \'rental\' for use of the bank\'s portion and separately buys units of the bank\'s share over time.' },
      { id: 2, phase: 'Documentation', label: 'Execution of Musharakah Agreement, Purchase Agreement & Ijarah Agreement', timeframe: 'Day 14–21', legalBasis: 'Contracts Act 1950; IFSA 2013', tip: 'Three separate agreements are typically required: (1) Musharakah (partnership) agreement, (2) Purchase Undertaking, (3) Ijarah (lease) agreement.' },
      { id: 3, phase: 'Charge', label: 'Registration of Charge (Form 16A) as Security', timeframe: 'Day 21–45', legalBasis: 'NLC s.241', tip: 'Despite the Islamic structure, Malaysian law requires a conventional charge (Form 16A) to be registered as security for the bank\'s financing interest.' },
      { id: 4, phase: 'Redemption', label: 'Full Buyout & Discharge (Form 16N)', timeframe: 'Upon full payment', legalBasis: 'NLC s.278', tip: 'Upon full payment of all instalments (representing full purchase of the bank\'s share), the charge is discharged via Form 16N and title is held unencumbered.' }
    ]
  },

  // ─── STRATA & MC ─────────────────────────────────────────────
  {
    id: 'ST-01',
    title: 'Formation of Joint Management Body (JMB)',
    category: 'Strata & Management Corporation',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'Under the Strata Management Act 2013, the developer must convene the first Annual General Meeting (AGM) within 12 months of delivery of VP to form the Joint Management Body (JMB), which then takes over management of common property.',
    legislation: ['Strata Management Act 2013 (s.17–s.27)', 'Strata Management (Maintenance and Management) Regulations 2015'],
    steps: [
      { id: 1, phase: 'Developer\'s Obligation', label: 'Developer Calls First AGM', timeframe: 'Within 12 months of VP', legalBasis: 'Strata Management Act 2013 — s.17(1)', tip: 'The developer MUST call the first AGM within 12 months of delivering VP to the first purchaser. Failure is an offence under the Strata Management Act.' },
      { id: 2, phase: 'AGM', label: 'First AGM & Election of JMB Committee', timeframe: 'At AGM', legalBasis: 'SMA 2013 — s.19', tip: 'The JMB comprises all purchasers (or their representatives) who are present at the AGM. A committee is elected to manage the JMB on a day-to-day basis.', documents: [{ id: 'st01-d1', title: 'Notice of First AGM (JMB)', type: 'letter', note: 'Notice to all parcel owners calling the first AGM for JMB formation.', sample: 'NOTICE OF FIRST ANNUAL GENERAL MEETING\nFOR THE PURPOSES OF FORMING THE JOINT MANAGEMENT BODY\n\nPURSUANT TO SECTION 17 OF THE STRATA MANAGEMENT ACT 2013\n\nTo: All Purchasers/Parcel Owners of [Building Name]\n\nNOTICE IS HEREBY GIVEN that the First Annual General Meeting of the purchasers/parcel owners of [Building Name], [Address], will be held at:\n\nDate: [Date]\nTime: [Time]\nVenue: [Venue]\n\nAGENDA:\n1. Opening by the Developer\'s Representative\n2. Presentation of Developer\'s account of maintenance charges collected and expended\n3. Election of the Joint Management Committee\n4. Discussion and approval of the maintenance fee rate\n5. Adoption of house rules\n6. Any other business with prior notice\n\nAll purchasers are invited to attend. A proxy form is enclosed.\n\n[Developer Name]\n[Date of Notice]' }] },
      { id: 3, phase: 'Handover', label: 'Developer\'s Handover of Accounts & Documents to JMB', timeframe: 'At or after AGM', legalBasis: 'SMA 2013 — s.24', tip: 'The developer must handover to the JMB: all financial accounts, maintenance charge collection records, building plans, service contracts, and deposit funds.' },
      { id: 4, phase: 'Operations', label: 'JMB Takes Over Management', timeframe: 'Post-AGM', legalBasis: 'SMA 2013 — s.20', tip: 'The JMB may appoint a licensed property management company to assist with day-to-day management. The JMB\'s primary duty is to maintain common property and collect maintenance charges.' }
    ]
  },
  {
    id: 'ST-02',
    title: 'Formation of Management Corporation (MC)',
    category: 'Strata & Management Corporation',
    difficulty: 'Advanced',
    duration: '1–6 months',
    summary: 'Upon the opening of a strata register book, a Management Corporation (MC) is automatically constituted by law. The first AGM of the MC must be called by the developer within 30 days of constitution.',
    legislation: ['Strata Titles Act 1985 (s.39–s.68)', 'Strata Management Act 2013'],
    steps: [
      { id: 1, phase: 'Strata Title Issuance', label: 'Opening of Strata Register Book', timeframe: 'Upon Director of Lands\' approval', legalBasis: 'Strata Titles Act 1985 — s.8 & s.39', tip: 'The MC is automatically constituted upon the opening of the strata register book by the Director of Lands & Mines. No separate registration is required.' },
      { id: 2, phase: 'First MC AGM', label: 'First MC Annual General Meeting', timeframe: 'Within 30 days of MC constitution', legalBasis: 'SMA 2013 — s.32', tip: 'The developer calls the first MC AGM. The JMB (if any) is dissolved and the MC assumes full control.' },
      { id: 3, phase: 'MC Powers', label: 'MC Assumes Powers & Responsibilities', timeframe: 'Immediately after AGM', legalBasis: 'SMA 2013 — s.36', tip: 'The MC has the power to sue and be sued, enter into contracts, impose maintenance charges, and enforce by-laws.' }
    ]
  },

  // ─── ESTATE & PROBATE ─────────────────────────────────────────
  {
    id: 'EP-01',
    title: 'Transmission by Personal Representative (Executor — Form 14B)',
    category: 'Estate, Probate & Transmission',
    difficulty: 'Advanced',
    duration: '6–24 months',
    summary: 'Upon the death of a registered proprietor who has left a will, the executor named in the will obtains a Grant of Probate from the High Court and then applies to have the title transmitted to themselves or to the beneficiaries of the estate.',
    legislation: ['NLC 1965 (s.346–s.349)', 'Probate & Administration Act 1959', 'Small Estates (Distribution) Act 1955 (if applicable)', 'Rules of Court 2012'],
    steps: [
      { id: 1, phase: 'Death & Will', label: 'Obtain Death Certificate & Locate the Will', timeframe: 'Day 1', legalBasis: 'Probate & Administration Act 1959 — s.3', tip: 'The original will must be produced to the High Court Probate Division. A copy is not sufficient for obtaining a Grant of Probate.' },
      { id: 2, phase: 'Probate Application', label: 'Application for Grant of Probate at High Court', timeframe: 'Day 30–180+', legalBasis: 'Probate & Administration Act 1959; Rules of Court 2012 — Order 71', tip: 'Application is made in the High Court of the state where the deceased was domiciled. File the petition, will, death certificate, oath of executor, and schedule of assets.' },
      { id: 3, phase: 'Grant of Probate', label: 'Receipt of Grant of Probate', timeframe: 'Upon High Court Order', legalBasis: 'Probate & Administration Act 1959 — s.32', tip: 'The Grant of Probate authorizes the executor to deal with the estate\'s assets including land.' },
      { id: 4, phase: 'Transmission', label: 'Application for Transmission (Form 14B) at Land Office', timeframe: 'After Grant of Probate', legalBasis: 'NLC s.346 & s.347 (Form 14B)', tip: 'The executor uses Form 14B to have the title transmitted to themselves as personal representative. They can then transfer the land to the beneficiaries by way of assent (Form 14A).', documents: [{ id: 'ep01-d1', title: 'Form 14B — Transmission by Personal Representative', type: 'form', note: 'Filed by the executor to register the estate\'s land in the executor\'s name as personal representative.', sample: 'TRANSMISSION BY PERSONAL REPRESENTATIVE\n(Section 346 of the National Land Code, 1965)\n\nFORM 14B\n\nTO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:\n\nI/We, [EXECUTOR FULL NAME] (NRIC: [No]) of [Address], as the Personal Representative of the estate of [DECEASED FULL NAME] (NRIC: [No]) who died on [Date], APPLY for the registration of a Transmission of all right and interest of the Deceased in the land described below in my/our favour:\n\nTitle No: [Geran No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nI/We attach herewith:\n1. Certified copy of the Grant of Probate / Letters of Administration\n2. Death Certificate of the Deceased\n3. Statutory Declaration\n\nDATE: ____________________\n\n________________________________\nSignature of Personal Representative (Executor)' }] },
      { id: 5, phase: 'Assent to Beneficiary', label: 'Transfer (Assent) to Beneficiary via Form 14A', timeframe: 'After transmission to executor', legalBasis: 'NLC s.215; Administration of Estates Act', tip: 'The executor then executes a Form 14A to transfer the land to the beneficiary named in the will. This is referred to as an "Assent."' }
    ]
  },
  {
    id: 'EP-02',
    title: 'Transmission by Survivor — Joint Tenancy (Form 14D)',
    category: 'Estate, Probate & Transmission',
    difficulty: 'Basic',
    duration: '1–3 months',
    summary: 'Where land is held by two or more persons as joint tenants, on the death of one joint tenant, the survivor(s) automatically acquire the deceased\'s share by the Right of Survivorship, without the need for probate.',
    legislation: ['NLC 1965 (s.348; Form 14D)', 'Probate & Administration Act 1959'],
    steps: [
      { id: 1, phase: 'Death', label: 'Obtain Death Certificate of Deceased Joint Tenant', timeframe: 'Day 1', legalBasis: 'Registration of Births and Deaths Act 1957', tip: 'Check the title to confirm the tenancy is "joint tenancy" and not "tenancy in common." Only joint tenants benefit from the right of survivorship.' },
      { id: 2, phase: 'Application', label: 'File Form 14D at Land Office', timeframe: 'Day 7–30', legalBasis: 'NLC s.348 (Form 14D)', tip: 'Relatively straightforward — no court proceedings required. File Form 14D together with the death certificate at the Land Office.', documents: [{ id: 'ep02-d1', title: 'Form 14D — Transmission by Survivor (Joint Tenancy)', type: 'form', note: 'Applied by the surviving joint tenant to remove the deceased\'s name from the title by right of survivorship.', sample: 'TRANSMISSION BY SURVIVOR\n(Section 348 of the National Land Code, 1965)\n\nFORM 14D\n\nTO THE REGISTRAR OF TITLES:\n\nI/We, [SURVIVOR FULL NAME] (NRIC: [No]) of [Address], being the surviving joint tenant(s) of the land described below, HEREBY APPLY for the registration of my/our right of survivorship following the death of [DECEASED FULL NAME] (NRIC: [No]) on [Date]:\n\nTitle No: [Geran No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nDocuments attached:\n1. Death Certificate of the Deceased (Certified True Copy)\n2. Statutory Declaration by Survivor\n3. Certified copy of Survivor\'s NRIC\n\nDATE: ____________________\n\n________________________________\nSignature of Surviving Joint Tenant' }] },
      { id: 3, phase: 'Registration', label: 'Registration of Transmission', timeframe: 'Within 2–4 weeks', legalBasis: 'NLC s.348', tip: 'The deceased\'s name is removed from the title and the survivor becomes the sole registered proprietor (or if there are multiple survivors, they remain registered as joint tenants).' }
    ]
  },
  {
    id: 'EP-03',
    title: 'Transmission by Beneficiary — Testate Estate (Form 14C)',
    category: 'Estate, Probate & Transmission',
    difficulty: 'Intermediate',
    duration: '3–9 months',
    summary: 'Where a beneficiary under a will (or intestacy) wishes to be registered directly as proprietor (bypassing the executor stage), they may apply using Form 14C, subject to proof of entitlement.',
    legislation: ['NLC 1965 (s.347; Form 14C)', 'Probate & Administration Act 1959'],
    steps: [
      { id: 1, phase: 'Grant', label: 'Obtain Grant of Probate or Letters of Administration', timeframe: 'Month 1–6', legalBasis: 'Probate & Administration Act 1959', tip: 'The grant is still needed to establish the beneficiary\'s entitlement even if the executor (PR) stage is bypassed.' },
      { id: 2, phase: 'Consent', label: 'Obtain Executor\'s Assent & All Relevant Consents', timeframe: 'Month 1–3', legalBasis: 'NLC s.347', tip: 'If there are multiple beneficiaries, all must consent in writing to the application by the specific beneficiary.' },
      { id: 3, phase: 'Application', label: 'File Form 14C at Land Office', timeframe: 'After grant and consents', legalBasis: 'NLC s.347 (Form 14C)', documents: [{ id: 'ep03-d1', title: 'Form 14C — Transmission by Beneficiary', type: 'form', note: 'Applied by the beneficiary to be registered as proprietor directly, with executor\'s consent.', sample: 'TRANSMISSION BY BENEFICIARY\n(Section 347 of the National Land Code, 1965)\n\nFORM 14C\n\nTO THE REGISTRAR OF TITLES:\n\nI/We, [BENEFICIARY FULL NAME] (NRIC: [No]) of [Address], being the beneficiary entitled under the Will of [DECEASED FULL NAME] dated [Date] / the Letters of Administration granted by [Court] on [Date], HEREBY APPLY for the registration of the transmission of the land described below in my/our favour:\n\nTitle No: [Geran No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nDocuments attached:\n1. Certified copy of Grant of Probate/Letters of Administration\n2. Death Certificate\n3. Assent of Personal Representative (if applicable)\n4. Written consent of all other beneficiaries\n\nDATE: ____________________\n\n________________________________\nSignature of Beneficiary' }] }
    ]
  },

  // ─── CAVEATS ─────────────────────────────────────────────────
  {
    id: 'CAV-01',
    title: 'Entry of Private Caveat to Protect Purchaser (Form 19B)',
    category: 'Caveats',
    difficulty: 'Basic',
    duration: '1 day',
    summary: 'A purchaser who has signed a SPA (or even an OTP) but whose transfer has not yet been registered lodges a Private Caveat to protect their equitable interest in the land, preventing the vendor from dealing with the title.',
    legislation: ['NLC 1965 (s.323; Form 19B)'],
    steps: [
      { id: 1, phase: 'Preparation', label: 'Prepare & Execute Form 19B', timeframe: 'Day 1', legalBasis: 'NLC s.323', tip: 'The caveator must have a caveatable interest (e.g. rights as purchaser under SPA). A caveat without a valid interest is wrongful.', documents: [{ id: 'cav01-d1', title: 'Form 19B — Entry of Private Caveat', type: 'form', note: 'Statutory form to enter a private caveat. Must state the interest claimed and be signed by the caveator or solicitor.', sample: 'ENTRY OF PRIVATE CAVEAT\n(Section 323 of the National Land Code, 1965)\n\nFORM 19B\n\nTO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:\n\nI/We, [CAVEATOR FULL NAME] (NRIC: [No]) of [Address], HEREBY CLAIM an interest in the land described below and apply for the entry of a Private Caveat to protect that interest:\n\nLand Description:\nTitle No: [Geran/QT No], Lot [No], Mukim [Name], Daerah [Name], [State]\n\nNature of Interest Claimed:\nI am the Purchaser under a Sale and Purchase Agreement dated [Date] entered into between [Vendor Name] ("the Vendor") and myself, and I have paid a deposit of RM [Amount] in respect of the said land. My interest as purchaser has not yet been registered.\n\nI undertake to withdraw this caveat when my interest is no longer at risk.\n\nDATE: ____________________\n\n________________________________\nSignature of Caveator / Authorised Solicitor\n[Firm Name & Address]' }] },
      { id: 2, phase: 'Lodgement', label: 'Lodge Form 19B at Land Office', timeframe: 'Day 1', legalBasis: 'NLC s.323', tip: 'No fee is payable for the initial lodgement. The caveat is noted immediately upon presentment and remains in force for 6 years unless withdrawn or removed by court order.' }
    ]
  },
  {
    id: 'CAV-02',
    title: 'Withdrawal of Private Caveat (Form 19G)',
    category: 'Caveats',
    difficulty: 'Basic',
    duration: '1–3 days',
    summary: 'After completion of the transaction (or when the caveat is no longer needed), the caveator withdraws the private caveat using Form 19G. Failure to withdraw when the interest no longer exists may make the caveator liable for damages.',
    legislation: ['NLC 1965 (s.327; Form 19G)'],
    steps: [
      { id: 1, phase: 'Preparation', label: 'Prepare & Execute Form 19G', timeframe: 'Day 1', legalBasis: 'NLC s.327', tip: 'Only the caveator (or their solicitor on their behalf) can voluntarily withdraw the caveat using Form 19G.', documents: [{ id: 'cav02-d1', title: 'Form 19G — Withdrawal of Private Caveat', type: 'form', note: 'Used by the caveator to voluntarily remove the private caveat once the interest is protected by registration or is no longer required.', sample: 'WITHDRAWAL OF PRIVATE CAVEAT\n(Section 327 of the National Land Code, 1965)\n\nFORM 19G\n\nTO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:\n\nI/We, [CAVEATOR FULL NAME] (NRIC: [No]) of [Address], being the person(s) on whose application the Private Caveat was entered on the land described below, HEREBY WITHDRAW the said Private Caveat:\n\nTitle No: [Geran/QT No], Lot [No], Mukim [Name], Daerah [Name], [State]\nCaveat No (if any): [No]\nDate of Entry of Caveat: [Date]\n\nReason for withdrawal: [State reason — e.g. Transfer has been registered; SPA completed]\n\nDATE: ____________________\n\n________________________________\nSignature of Caveator / Authorised Solicitor' }] },
      { id: 2, phase: 'Lodgement', label: 'Lodge Form 19G at Land Office', timeframe: 'Day 1', legalBasis: 'NLC s.327', tip: 'The caveat is lifted immediately upon presentment. The Land Registrar updates the title register.' }
    ]
  },
  {
    id: 'CAV-03',
    title: 'Section 322 Notice to Remove Caveat',
    category: 'Caveats',
    difficulty: 'Intermediate',
    duration: '2–3 months',
    summary: 'Where a caveat is blocking a transaction and the caveator refuses to withdraw voluntarily, the registered proprietor or any person with an interest in the land may serve a s.322 NLC notice, giving the caveator 14 days to take court action failing which the caveat lapses.',
    legislation: ['NLC 1965 (s.322)'],
    steps: [
      { id: 1, phase: 'Notice', label: 'Serve Section 322 Notice on Caveator', timeframe: 'Day 1', legalBasis: 'NLC s.322', tip: 'The notice must be served on the caveator personally. The Land Registrar also serves a copy. The caveator has 14 days to commence court action.', documents: [{ id: 'cav03-d1', title: 'Section 322 NLC Notice to Caveator', type: 'letter', note: 'Formal notice demanding the caveator take court action within 14 days or the caveat will lapse.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nTO: [Caveator Full Name]\n[Address]\n\nDear Sir/Madam,\n\nNOTICE PURSUANT TO SECTION 322 OF THE NATIONAL LAND CODE 1965\nProperty: [Address]\nTitle No: [Geran/QT No], Lot [No], Mukim [Name]\n\nWe act for [Client Name], the registered proprietor of the abovementioned land.\n\nYou have entered a Private Caveat against the said land ("the Caveat") on [Date].\n\nPursuant to Section 322(3) of the National Land Code 1965, NOTICE IS HEREBY GIVEN to you that you are required to commence legal proceedings to establish your claim in respect of the Caveat within FOURTEEN (14) DAYS from the date of service of this Notice.\n\nIF you fail to commence such proceedings and lodge with the Registrar of Titles a copy of the originating summons within the said 14 days, the Caveat shall lapse and be withdrawn by the Registrar.\n\nYours faithfully,\n[Lawyer Name]\n[Firm Name]' }] },
      { id: 2, phase: 'Outcome', label: 'Caveat Lapses or Court Action Commenced', timeframe: 'Day 14', legalBasis: 'NLC s.322(3)', tip: 'If the caveator files court proceedings within 14 days, the caveat continues until the court order. If not, the caveat lapses and the Registrar removes it.' }
    ]
  },

  // ─── TENANCY ─────────────────────────────────────────────────
  {
    id: 'TEN-01',
    title: 'Residential Tenancy Agreement',
    category: 'Tenancy & Lease',
    difficulty: 'Basic',
    duration: '1–2 weeks',
    summary: 'Preparation and execution of a residential tenancy agreement between a landlord and tenant, covering rental terms, deposit, duration, and obligations of both parties.',
    legislation: ['Contracts Act 1950', 'Distress Act 1951', 'Stamp Act 1949 (PDS 15)', 'National Land Code 1965 (if lease exceeds 3 years)'],
    steps: [
      { id: 1, phase: 'Negotiation', label: 'Agree on Rental Terms & Special Conditions', timeframe: 'Day 1–3', legalBasis: 'Contracts Act 1950', tip: 'Key terms to agree: monthly rental, security deposit (typically 2 months), utility deposit (0.5–1 month), rental commencement date, duration (typically 1–2 years), diplomatic clause (if any).' },
      { id: 2, phase: 'Drafting', label: 'Draft & Execute Tenancy Agreement', timeframe: 'Day 3–7', legalBasis: 'Contracts Act 1950', tip: 'A tenancy of 3 years or less need not be registered at the Land Office. A lease exceeding 3 years must be registered as a dealing (Form 15A).', documents: [{ id: 'ten01-d1', title: 'Standard Residential Tenancy Agreement', type: 'template', note: 'The principal agreement governing the landlord-tenant relationship.', sample: 'TENANCY AGREEMENT\n\nDate: [Date]\n\nBETWEEN:\n[LANDLORD FULL NAME] (NRIC: [No]) ("the Landlord")\nAND\n[TENANT FULL NAME] (NRIC: [No]) ("the Tenant")\n\nPREMISES: [Full Property Address]\n\n1. TENANCY TERM\n   The Landlord hereby lets and the Tenant hereby takes the Premises for a term of [1/2] year(s) commencing on [Date] and ending on [Date] ("the Tenancy Period").\n\n2. MONTHLY RENTAL\n   RM [Amount] per month, payable in advance on the [1st] day of each calendar month.\n\n3. DEPOSITS\n   (a) Security Deposit: RM [Amount] (equivalent to [2] months\' rental)\n   (b) Utility Deposit: RM [Amount]\n   Both deposits are refundable at the end of tenancy, subject to deductions for outstanding rental and damage (fair wear and tear excepted).\n\n4. QUIET ENJOYMENT\n   The Tenant shall have quiet enjoyment of the Premises throughout the tenancy period without interruption by the Landlord.\n\n5. TENANT\'S OBLIGATIONS\n   (a) Pay rental on time.\n   (b) Not to sublet without Landlord\'s written consent.\n   (c) Maintain the Premises in good condition.\n   (d) Not to cause nuisance to neighbours.\n   (e) Permit Landlord to inspect the Premises with 24 hours\' notice.\n\n6. LANDLORD\'S OBLIGATIONS\n   (a) Ensure the Premises is in good condition at commencement.\n   (b) Maintain structural integrity and major fittings.\n   (c) Pay quit rent and assessment.\n\n7. DIPLOMATIC CLAUSE (if applicable)\n   Either party may terminate this Agreement on [2] months\' written notice if the Tenant is transferred or relocated overseas. The Tenant shall forfeit the security deposit as a service charge in such event.\n\n8. RENEWAL\n   The Tenant shall have an option to renew for a further [1] year at a rental to be agreed, provided written notice is given at least [2] months before expiry.\n\n[Governing law: Malaysian law; dispute: Malaysian courts/mediation]' }] },
      { id: 3, phase: 'Stamping', label: 'Stamp the Tenancy Agreement (LHDN PDS 15)', timeframe: 'Within 30 days', legalBasis: 'Stamp Act 1949', tip: 'Stamp duty on tenancy: RM1 per RM250 of annual rental above RM2,400 (for tenancy > 1 year). Use LHDN\'s MyStamp portal for efficiency.' }
    ]
  },
  {
    id: 'TEN-02',
    title: 'Notice to Vacate — Landlord to Defaulting Tenant',
    category: 'Tenancy & Lease',
    difficulty: 'Basic',
    duration: '1–4 months',
    summary: 'Where a tenant fails to pay rent or breaches the tenancy agreement, the landlord may serve a notice to vacate and, if necessary, apply to the Sessions Court for a possession order.',
    legislation: ['Contracts Act 1950', 'Distress Act 1951', 'Specific Relief Act 1950 (s.7(2))', 'Rules of Court 2012'],
    steps: [
      { id: 1, phase: 'Notice', label: 'Serve Formal Demand for Rental Arrears', timeframe: 'Day 1', legalBasis: 'Contracts Act 1950; tenancy agreement', tip: 'Send the demand letter by registered post and WhatsApp (to evidence delivery). Give the tenant a reasonable time to pay (7–14 days).', documents: [{ id: 'ten02-d1', title: 'Letter of Demand for Rental Arrears & Notice to Vacate', type: 'letter', note: 'Formal demand combining the claim for arrears and a notice to vacate the premises.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nTO: [Tenant Full Name]\n[Address]\n\nDear Sir/Madam,\n\nLETTER OF DEMAND FOR OUTSTANDING RENTAL AND NOTICE TO VACATE\nPremises: [Property Address]\nTenancy Agreement dated: [Date]\n\nWe act for [Landlord Name], the owner of the abovementioned premises.\n\nOur client instructs us that you have failed to pay the following rental amounts:\n\nMonth of [Month/Year]: RM [Amount]\nMonth of [Month/Year]: RM [Amount]\nTotal outstanding: RM [Amount]\n\nYOU ARE HEREBY GIVEN NOTICE to pay the outstanding sum of RM [Amount] within SEVEN (7) DAYS from the date of this letter.\n\nFAILING which, our client shall, without further notice:\n(a) Apply for a Writ of Distress to seize and sell your goods in the premises to recover the rental arrears; and/or\n(b) Commence legal proceedings in the Sessions Court for an order for possession and recovery of the outstanding rental and costs.\n\nYOU ARE FURTHER GIVEN NOTICE TO VACATE the premises by [Date] as your continued occupation is in breach of the tenancy agreement.\n\nYours faithfully,\n[Lawyer Name]\n[Firm Name]' }] },
      { id: 2, phase: 'Legal Proceedings', label: 'File Originating Summons at Sessions Court (if no resolution)', timeframe: 'Day 14+', legalBasis: 'Specific Relief Act 1950 — s.7(2); Rules of Court 2012', tip: 'Under s.7(2), the landlord can apply for immediate possession in the Sessions Court. This is faster than a full trial.' }
    ]
  },

  // ─── FORECLOSURE & AUCTION ────────────────────────────────────
  {
    id: 'FC-01',
    title: 'Bank\'s Application for Order for Sale (High Court)',
    category: 'Foreclosure & Auction',
    difficulty: 'Advanced',
    duration: '6–24 months',
    summary: 'When a chargor defaults on a housing loan, the chargee (bank) may apply to the High Court under Order 83 of the Rules of Court for an Order for Sale to auction the charged land and recover the outstanding debt.',
    legislation: ['NLC 1965 (s.256)', 'Rules of Court 2012 — Order 83', 'Specific Relief Act 1950'],
    steps: [
      { id: 1, phase: 'Default', label: 'Formal Demand Letter to Defaulting Chargor', timeframe: 'Day 1', legalBasis: 'Loan agreement; NLC s.254', tip: 'A formal demand giving the chargor notice of default and demanding repayment of the full outstanding balance within a specified period (usually 1 month).', documents: [{ id: 'fc01-d1', title: 'Demand Notice to Defaulting Chargor', type: 'letter', note: 'First step in enforcement — puts the borrower on formal notice.', sample: '[Bank Letterhead]\n\nDate: [Date]\n\nTO: [Chargor Full Name]\n[Property Address]\n\nDear Sir/Madam,\n\nHOUSING LOAN ACCOUNT NO: [Account No]\nPROPERTY: [Address, Title No]\n\nNOTICE OF DEFAULT AND DEMAND FOR REPAYMENT\n\nWe refer to the above Housing Loan Account. Your loan account is currently in arrears as follows:\n\nOutstanding Principal: RM [Amount]\nAccrued Interest:       RM [Amount]\nPenalties/Charges:     RM [Amount]\nTOTAL OUTSTANDING:     RM [Amount]\n\nYOU ARE HEREBY DEMANDED to settle the full outstanding sum of RM [Amount] within THIRTY (30) DAYS from the date of this notice, failing which we shall, without further notice, take all legal action available to us including applying to the High Court for an Order for Sale of the said property.\n\nYours faithfully,\n[Bank Representative]\n[Bank Name]' }] },
      { id: 2, phase: 'Court Filing', label: 'File Originating Summons & Affidavits at High Court', timeframe: 'Day 30+', legalBasis: 'Rules of Court 2012 — Order 83; NLC s.256', tip: 'File: (1) Originating Summons, (2) Affidavit in Support (by bank officer), (3) Exhibit Bundle (loan agreement, charge, title search, demand letters, statement of account).' },
      { id: 3, phase: 'Court Hearing', label: 'High Court Hearing — Application for Order for Sale', timeframe: 'Month 3–12', legalBasis: 'Rules of Court 2012 — Order 83', tip: 'The chargor may oppose the application. Common defences: (1) bank breach of contract, (2) disputed arrears, (3) Islamic finance dispute, (4) bank failed to give proper notice.' },
      { id: 4, phase: 'Order Obtained', label: 'Order for Sale Granted — Proclamation of Sale Issued', timeframe: 'After court order', legalBasis: 'NLC s.256; Rules of Court 2012 — Order 83 r.7', tip: 'The court approves the Proclamation of Sale (a document detailing the auction conditions, reserve price, and date). Must be advertised in newspapers.' },
      { id: 5, phase: 'Auction', label: 'Public Auction at High Court — Highest Bidder Wins', timeframe: 'Auction date', legalBasis: 'Rules of Court 2012 — Order 83 r.8', tip: 'Bidders must deposit 10% of the reserve price before bidding. The successful bidder pays 25% immediately after the auction and the balance within 120 days.' },
      { id: 6, phase: 'Post-Auction', label: 'Completion by Auction Purchaser & Registration of Vesting Order', timeframe: 'Within 120 days of auction', legalBasis: 'NLC s.258 (vesting order)', tip: 'The court issues a Vesting Order directing the Land Registrar to register the auction purchaser as the new proprietor.' }
    ]
  },
  {
    id: 'FC-02',
    title: 'Purchaser at Auction — Post-Auction Completion',
    category: 'Foreclosure & Auction',
    difficulty: 'Advanced',
    duration: '4–6 months',
    summary: 'The process followed by the successful bidder at a court-ordered auction to complete the purchase, obtain a Vesting Order, and have the title registered in their name.',
    legislation: ['NLC 1965 (s.258)', 'Rules of Court 2012 — Order 83', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Auction Day', label: 'Pay 10% Deposit at Auction & Sign Conditions of Sale', timeframe: 'Auction day', legalBasis: 'Proclamation of Sale conditions', tip: 'The 10% deposit is non-refundable if the purchaser defaults on the balance. Check the reserve price, encumbrances, and outstanding utilities before bidding.' },
      { id: 2, phase: 'Balance Payment', label: 'Pay Balance 90% Within 120 Days', timeframe: 'Within 120 days of auction', legalBasis: 'Proclamation of Sale; Rules of Court 2012', tip: 'Apply for a bank loan promptly. Extension of time applications to court are possible but not guaranteed. Failure to pay forfeits the 10% deposit.' },
      { id: 3, phase: 'Vesting Order', label: 'Court Issues Vesting Order', timeframe: 'After full payment', legalBasis: 'NLC s.258', tip: 'The solicitor files a Summons in Chambers for a Vesting Order once the full purchase price is paid to the bank/court. The order directs the Registrar to register the purchaser as proprietor.' },
      { id: 4, phase: 'Registration', label: 'Present Vesting Order at Land Office for Registration', timeframe: 'After Vesting Order', legalBasis: 'NLC s.304', tip: 'The title is registered in the purchaser\'s name. Note: properties sold at auction are sold "as is where is" — any existing occupants must be evicted separately.' }
    ]
  },

  // ─── SPECIAL TRANSACTIONS ─────────────────────────────────────
  {
    id: 'SP-01',
    title: 'Gift — Transfer of Land Between Family Members',
    category: 'Special & Commercial Transactions',
    difficulty: 'Basic',
    duration: '2–4 months',
    summary: 'A Deed of Gift is executed when a registered proprietor wishes to gift their land to a family member or any other person without monetary consideration. Stamp duty exemptions may apply between immediate family members.',
    legislation: ['NLC 1965 (s.215)', 'Contracts Act 1950 (s.26 — consideration)', 'Stamp Act 1949 (exemptions)', 'RPGT Act 1976'],
    steps: [
      { id: 1, phase: 'Advice', label: 'Advise Donor on Legal Consequences of Gift', timeframe: 'Day 1', legalBasis: 'Contracts Act 1950; equity', tip: 'CRITICAL: Advise the donor that a completed gift is irrevocable in law. Ensure the donor acts freely and not under undue influence.' },
      { id: 2, phase: 'Deed of Gift', label: 'Prepare & Execute Deed of Gift', timeframe: 'Day 7–14', legalBasis: 'NLC s.215 read with Contracts Act s.26(b)', tip: 'The consideration in a gift is "natural love and affection." This is a valid consideration under s.26(b) of the Contracts Act for immediate family members.', documents: [{ id: 'sp01-d1', title: 'Deed of Gift (Inter Vivos)', type: 'template', note: 'Legal instrument effecting the gift. Must be followed by a Form 14A (MOT) for land.', sample: 'DEED OF GIFT\n\nDate: [Date]\n\nBETWEEN:\n[DONOR FULL NAME] (NRIC: [No]) of [Address] ("the Donor")\nAND\n[DONEE FULL NAME] (NRIC: [No]) of [Address] ("the Donee")\n\nRECITALS:\nA. The Donor is the registered proprietor of the property described below.\nB. The Donor, out of natural love and affection for the Donee, wishes to give and transfer the property to the Donee absolutely.\n\nNOW THIS DEED OF GIFT WITNESSES as follows:\n\n1. GIFT\n   In consideration of natural love and affection, the Donor hereby gives, transfers and conveys to the Donee ALL the property described below, to hold the same absolutely and forever.\n\n2. PROPERTY\n   Title No: [Geran No], Lot [No], Mukim [Name], Daerah [Name], [State]\n   [Full property description]\n\n3. COVENANTS\n   The Donor covenants to execute all further documents and do all acts necessary to give full effect to this Deed of Gift.\n\n4. IRREVOCABILITY\n   This gift is irrevocable and is made freely and voluntarily.\n\nIN WITNESS WHEREOF the parties have executed this Deed the day and year first above written.\n\n_________________________\nSignature of Donor\n\n_________________________\nSignature of Donee\n\nWITNESSED BY:\n_________________________\nSolicitor' }] },
      { id: 3, phase: 'Stamp Duty', label: 'Stamp Duty — Check Exemption Eligibility', timeframe: 'Day 14–21', legalBasis: 'Stamp Act 1949; Exemptions', tip: 'Stamp duty exemption is available for gifts between husband and wife (100%) and from parent to child or vice versa (50% discount on ad valorem duty). No exemption for gifts to siblings.' },
      { id: 4, phase: 'Transfer', label: 'Execute Form 14A & Register at Land Office', timeframe: 'Day 21–60', legalBasis: 'NLC s.215', tip: 'RPGT: A gift to an immediate family member is usually exempt from RPGT. Confirm status with LHDN.' }
    ]
  },
  {
    id: 'SP-02',
    title: 'Power of Attorney — Land Dealings',
    category: 'Special & Commercial Transactions',
    difficulty: 'Intermediate',
    duration: '1–2 weeks',
    summary: 'A registered proprietor who is unable to personally attend to sign land documents (due to overseas work, illness, etc.) may grant a Power of Attorney (PA) to an agent to act on their behalf in respect of specific or general land dealings.',
    legislation: ['Powers of Attorney Act 1949', 'NLC 1965 (s.309–s.312)', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'Advice', label: 'Advise Donor on Scope & Risks of PA', timeframe: 'Day 1', legalBasis: 'Powers of Attorney Act 1949', tip: 'A General Power of Attorney is extremely broad. A Specific Power of Attorney limited to the particular transaction is safer. The donor should understand the attorney can legally bind them.' },
      { id: 2, phase: 'Drafting', label: 'Draft & Execute the Power of Attorney', timeframe: 'Day 1–7', legalBasis: 'Powers of Attorney Act 1949 — s.2', tip: 'If the donor is overseas, the PA must be executed before a Notary Public and may require apostille/legalization.', documents: [{ id: 'sp02-d1', title: 'General Power of Attorney — Land Dealings', type: 'template', note: 'Empowers the attorney to execute all documents and attend to all matters relating to a specific land transaction.', sample: 'POWER OF ATTORNEY\n\nI, [DONOR FULL NAME] (NRIC / Passport: [No]) of [Address] HEREBY APPOINT [ATTORNEY FULL NAME] (NRIC: [No]) of [Address] to be my true and lawful attorney to do all or any of the following acts on my behalf:\n\n1. To execute on my behalf the Sale and Purchase Agreement for the sale of the property known as [Property Description, Title No] at the agreed price of RM [Amount] or such price as my Attorney thinks fit.\n\n2. To execute on my behalf the Memorandum of Transfer (Form 14A) for the transfer of the said property.\n\n3. To sign, execute, and deliver all deeds, documents, instruments, certificates, and assurances relating to the above.\n\n4. To appear before any government authority, the Land Registry, or any court for any purpose relating to the above.\n\n5. Generally to act in relation to the above as fully and effectually as I could do if personally present.\n\nThis Power of Attorney shall be irrevocable [for the period of [X] months / until the completion of the said sale] and shall be binding on my successors and assigns.\n\nIN WITNESS WHEREOF I have executed this Power of Attorney on [Date] at [Place].\n\n___________________________\nSignature of Donor\n\nWITNESSED BY:\n___________________________\nNotary Public / Advocate & Solicitor' }] },
      { id: 3, phase: 'Registration', label: 'Register the PA at the High Court (if required)', timeframe: 'Day 7–14', legalBasis: 'Powers of Attorney Act 1949 — s.4', tip: 'Certain PAs (especially irrevocable PAs) must be registered at the High Court to be valid for land dealings. Check the Land Office\'s requirements for the specific state.' }
    ]
  },
  {
    id: 'SP-03',
    title: 'Foreign Purchaser — Sub-Sale with State Authority Consent',
    category: 'Special & Commercial Transactions',
    difficulty: 'Advanced',
    duration: '6–18 months',
    summary: 'A foreigner purchasing property in Malaysia must comply with Foreign Ownership Guidelines and obtain state authority consent. The minimum purchase price threshold for foreigners is RM1 million (for most states). The National Property Information Centre (NAPIC) and MIDA may also be involved.',
    legislation: ['NLC 1965 (s.214A)', 'State Land Enactments & Restrictions', 'Economic Planning Unit (EPU) Guidelines (historical)', 'MM2H Programme rules', 'Foreign Investment Committee (FIC) Guidelines'],
    steps: [
      { id: 1, phase: 'Eligibility Check', label: 'Verify Property Eligibility for Foreign Purchase & Minimum Price', timeframe: 'Before OTP', legalBasis: 'State authority guidelines; Housing Development Act (s.8A)', tip: 'Foreigners CANNOT purchase: Malay Reserve land, low-cost/medium-low-cost units, properties below the minimum foreign purchase threshold (RM1M in most states).' },
      { id: 2, phase: 'OTP', label: 'Conditional OTP (Subject to State Consent)', timeframe: 'Day 1', legalBasis: 'Contracts Act 1950; NLC s.214A', tip: 'The OTP/SPA must be expressly conditional on state authority consent being obtained.' },
      { id: 3, phase: 'State Consent Application', label: 'Apply for State Authority Consent for Foreign Purchase', timeframe: 'Day 14–6 months+', legalBasis: 'NLC s.214A; state guidelines', tip: 'Application submitted to the State Director of Lands/State Secretariat. Processing time can be 3 months to 2 years depending on state.' },
      { id: 4, phase: 'Completion', label: 'Completion Upon Receipt of Consent', timeframe: 'Post-consent', legalBasis: 'NLC s.215', tip: 'Upon registration, a foreign purchaser restriction note may be endorsed on the title requiring future consent for any subsequent disposal.' }
    ]
  },

  // ─── LAND OFFICE ADMINISTRATIVE ──────────────────────────────
  {
    id: 'LO-01',
    title: 'Application to Vary Express Condition / Change of Land Use',
    category: 'Land Office Administrative',
    difficulty: 'Advanced',
    duration: '6–24 months',
    summary: 'A landowner whose land carries an express condition restricting its use (e.g. "for residential purposes only") applies to the State Authority to vary or remove this condition to permit a different use (e.g. commercial or mixed development).',
    legislation: ['NLC 1965 (s.124–s.128)', 'Town and Country Planning Act 1976', 'State Land Rules'],
    steps: [
      { id: 1, phase: 'Preparation', label: 'Obtain Town Planning Approval / Development Order', timeframe: 'Month 1–6', legalBasis: 'Town and Country Planning Act 1976 — s.22', tip: 'The State Authority is unlikely to vary an express condition unless the local planning authority has first approved the proposed change in use. Obtain planning approval first.' },
      { id: 2, phase: 'Application', label: 'File Application to State Director of Lands (PTG) to Vary Express Condition', timeframe: 'Month 1–3', legalBasis: 'NLC s.124 & s.126', tip: 'Include: (1) Certified copy of title, (2) Planning approval letter, (3) Survey plan, (4) Development proposal, (5) Application fee.', documents: [{ id: 'lo01-d1', title: 'Application to Vary Express Condition (s.124 NLC)', type: 'letter', note: 'Formal application to the State Authority to allow a change in the permitted land use.', sample: '[Applicant / Firm Letterhead]\n\nDate: [Date]\n\nPengarah Tanah dan Galian\nNegeri [State]\n\nDear Sir/Madam,\n\nPERMOHONAN UNTUK MEMANSUHKAN/MENGUBAH SYARAT NYATA TANAH\nDI BAWAH SEKSYEN 124 KANUN TANAH NEGARA 1965\n\nHakmilik: [Title No], Lot [No], Mukim [Name], Daerah [Name], [State]\nSyarat Nyata Semasa: "Untuk kegunaan kediaman sahaja"\nSyarat Nyata yang Dipohon: "Untuk kegunaan kediaman dan komersial"\n\nPemohon: [Owner/Company Name]\n\nKami dengan ini memohon kelulusan Pihak Berkuasa Negeri untuk memansuhkan/mengubah syarat nyata tanah di atas daripada "[Existing Condition]" kepada "[Proposed Condition]" bagi membolehkan pembangunan [describe development] di atas tanah tersebut.\n\nDilampirkan bersama:\n1. Salinan hakmilik tanah yang disahkan benar\n2. Kelulusan perancangan (Development Order) dari Majlis Tempatan\n3. Pelan Lokasi dan Pelan Tapak\n4. Cadangan pembangunan\n5. Yuran permohonan: RM [Amount]\n\nYours faithfully,\n[Applicant / Solicitor]' }] },
      { id: 3, phase: 'Approval', label: 'State Authority Approval & Payment of Premium', timeframe: 'Month 6–24', legalBasis: 'NLC s.126(2)', tip: 'The State Authority may impose an additional premium (land value difference) for the change in use. This can be substantial for commercial upgrades.' },
      { id: 4, phase: 'Registration', label: 'Registration of Variation in Title', timeframe: 'After approval & payment', legalBasis: 'NLC s.127', tip: 'The new condition is endorsed on the title. Present the approval letter, receipts, and IDT to the Land Office.' }
    ]
  },
  {
    id: 'LO-02',
    title: 'Replacement of Lost Issue Document of Title (IDT)',
    category: 'Land Office Administrative',
    difficulty: 'Intermediate',
    duration: '3–6 months',
    summary: 'When an original IDT is lost, the registered proprietor must apply to the Land Office for a replacement title. This involves advertising a notice in the Gazette and newspapers and making a statutory declaration.',
    legislation: ['NLC 1965 (s.160–s.164)', 'Statutory Declarations Act 1960'],
    steps: [
      { id: 1, phase: 'Statutory Declaration', label: 'Prepare Statutory Declaration Explaining Loss of IDT', timeframe: 'Day 1', legalBasis: 'Statutory Declarations Act 1960; NLC s.160', tip: 'The SD must describe the circumstances of the loss in detail. If the title is in the possession of a third party, the application is more complex.' },
      { id: 2, phase: 'Application', label: 'File Application for Replacement IDT at Land Office', timeframe: 'Day 1–7', legalBasis: 'NLC s.160 & s.161', tip: 'File: (1) Application letter, (2) Statutory Declaration, (3) Police report (if stolen), (4) Application fee.' },
      { id: 3, phase: 'Advertisement', label: 'Advertisement in Gazette & Local Newspaper', timeframe: 'Day 7–30', legalBasis: 'NLC s.161', tip: 'The Land Office will arrange for publication in the government gazette and require the applicant to advertise in a local newspaper giving notice of the application.' },
      { id: 4, phase: 'Replacement IDT', label: 'Issuance of Replacement IDT', timeframe: 'Month 2–6', legalBasis: 'NLC s.162', tip: 'After the publication period (to allow objections), the replacement IDT is issued. The original, if found later, becomes void.' }
    ]
  },
  {
    id: 'LO-03',
    title: 'Application for Subdivision of Land',
    category: 'Land Office Administrative',
    difficulty: 'Advanced',
    duration: '12–36 months',
    summary: 'A landowner divides a single piece of land into two or more separate lots, each with its own title. This is commonly done for development purposes or to sell portions of land separately.',
    legislation: ['NLC 1965 (s.135–s.148)', 'Town and Country Planning Act 1976', 'Street, Drainage and Building Act 1974'],
    steps: [
      { id: 1, phase: 'Planning', label: 'Obtain Planning Permission / Development Order', timeframe: 'Month 1–12', legalBasis: 'Town and Country Planning Act 1976', tip: 'The local planning authority (MBPJ, DBKL, etc.) must first approve the proposed subdivision layout.' },
      { id: 2, phase: 'Survey', label: 'Commission Licensed Surveyor to Survey the Subdivided Lots', timeframe: 'Month 6–18', legalBasis: 'NLC s.136 (survey requirement)', tip: 'A licensed surveyor (Juruukur Tanah Berlesen) conducts the boundary survey and prepares the cadastral plans for each new lot.' },
      { id: 3, phase: 'Application', label: 'File Application for Subdivision at Land Office (PTG/PTD)', timeframe: 'After survey approval', legalBasis: 'NLC s.135 & s.139', tip: 'Submit: (1) Application form, (2) Approved survey plans, (3) Development Order, (4) Planning permission, (5) Application fees and premium (if any).' },
      { id: 4, phase: 'New Titles Issued', label: 'New Individual Titles Issued for Each Subdivided Lot', timeframe: 'Month 18–36', legalBasis: 'NLC s.139 & s.140', tip: 'The original title is surrendered and new titles are issued for each subdivided lot. Any existing charge on the original land will need to be restructured to cover the new lots.' }
    ]
  },
  {
    id: 'LO-04',
    title: 'Surrender and Re-alienation of Land',
    category: 'Land Office Administrative',
    difficulty: 'Advanced',
    duration: '12–36 months',
    summary: 'A mechanism where existing land (with its existing conditions and tenure) is surrendered to the State Authority and immediately re-alienated with new, improved conditions — typically to remove restrictive conditions, convert leasehold to freehold, or extend a lease.',
    legislation: ['NLC 1965 (s.197–s.200; s.76–s.79)', 'State Land Rules'],
    steps: [
      { id: 1, phase: 'Application', label: 'Apply to State Director of Lands for Surrender & Re-alienation', timeframe: 'Month 1', legalBasis: 'NLC s.197', tip: 'This is an administrative process requiring the State Authority\'s approval in principle before the surrender can proceed. No guarantee of approval.' },
      { id: 2, phase: 'Premium', label: 'Negotiate & Pay Premium for Re-alienation', timeframe: 'Month 3–12', legalBasis: 'NLC s.79', tip: 'The State Authority will impose a premium based on the difference in land value between the old and new conditions. This can be very significant.' },
      { id: 3, phase: 'Surrender', label: 'Execute Form of Surrender at Land Office', timeframe: 'After premium approval', legalBasis: 'NLC s.197', tip: 'All existing charges and caveats must be cleared before the land can be surrendered. Banks must consent to discharge.' },
      { id: 4, phase: 'Re-alienation', label: 'State Authority Re-alienates Land with New Title', timeframe: 'Month 12–36', legalBasis: 'NLC s.76', tip: 'The new title is issued with the improved conditions. The new title is a fresh title free of historical encumbrances (except those agreed to be preserved).' }
    ]
  },

  // ─── SUB-SALE (Additional) ────────────────────────────────────
  {
    id: 'SS-07',
    title: 'Sub-Sale with Developer\'s Consent (Master Title)',
    category: 'Sub-Sale & Resale',
    difficulty: 'Advanced',
    duration: '6–18 months',
    summary: 'Where a development project is still under a master/parent title (individual strata or parcel titles not yet issued), any sub-sale by the first purchaser to a third party requires the developer\'s written consent and the developer\'s solicitor\'s co-operation in attending to the transaction.',
    legislation: ['NLC 1965 (s.215)', 'Housing Development Act 1966 (Schedule G, s.22A)', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'Check Title Status', label: 'Verify Whether Individual/Strata Title Exists', timeframe: 'Day 1', legalBasis: 'NLC; STA 1985', tip: 'If individual title exists, proceed as a normal sub-sale. If still on master title or qualified title, the developer must be involved in the transaction.' },
      { id: 2, phase: 'Developer\'s Consent', label: 'Obtain Developer\'s Written Consent to Sub-Sale', timeframe: 'Day 7–30', legalBasis: 'HDA 1966 — s.22A; SPA conditions', tip: 'The developer usually charges an administrative fee for consent. The developer has a right to ensure the new purchaser meets any conditions (e.g. Bumiputera quota, foreign ownership limits).', documents: [{ id: 'ss07-d1', title: 'Consent to Sub-Sale Letter', type: 'letter', note: 'Written consent from developer confirming they agree to the sub-sale and will co-operate in the documentation.', sample: '[Developer Letterhead]\n\nDate: [Date]\n\nTO: [Vendor Solicitor]\n[Address]\n\nDear Sir/Madam,\n\nCONSENT TO SUB-SALE\nProperty: [Unit/Lot Description]\nMaster Title: [Master Title No]\nOriginal Purchaser (Vendor): [Name, NRIC]\nNew Purchaser: [Name, NRIC]\n\nWe refer to your letter dated [Date] requesting our consent to the sub-sale of the above property.\n\nWe hereby CONSENT to the sub-sale of the above property from [Original Purchaser] to [New Purchaser] on the following conditions:\n\n1. The sub-sale price shall not be less than RM [Amount].\n2. The New Purchaser must comply with all conditions of the original SPA.\n3. Our administrative fee of RM [Amount] must be paid before completion.\n4. The Original Purchaser must settle all outstanding maintenance charges/sinking fund.\n\nYours faithfully,\n[Developer Name]' }] },
      { id: 3, phase: 'Tripartite SPA', label: 'Prepare Tripartite SPA (Developer + Vendor + Purchaser)', timeframe: 'Day 14–30', legalBasis: 'Contracts Act 1950', tip: 'A tripartite agreement involving the developer is necessary to give the new purchaser direct privity with the developer. This ensures the new purchaser receives the remaining defect liability period protection and can claim LAD for delays.' },
      { id: 4, phase: 'Completion', label: 'Settlement & Novation of SPA Obligations', timeframe: 'Day 60–180', legalBasis: 'NLC; Contracts Act 1950', tip: 'Upon completion, the new purchaser steps into the shoes of the original purchaser. The developer acknowledges the new purchaser as the contracting party. Stamp duty is payable on the sub-sale SPA.' }
    ]
  },
  {
    id: 'SS-08',
    title: 'Sale of Undivided Share in Jointly Owned Property',
    category: 'Sub-Sale & Resale',
    difficulty: 'Advanced',
    duration: '3–9 months',
    summary: 'Where two or more parties own land as tenants in common, one co-owner may wish to sell their undivided share to a third party or to the other co-owner(s). This requires careful management of the other co-owner\'s rights and the title mechanics.',
    legislation: ['NLC 1965 (s.342–s.344)', 'Contracts Act 1950', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Right of Pre-emption', label: 'Offer Share to Existing Co-owners First (Right of First Refusal)', timeframe: 'Day 1–30', legalBasis: 'Co-ownership law; any Co-owners\' Agreement', tip: 'Check if there is a co-owners\' agreement granting a right of first refusal. Even without such an agreement, it is good practice to offer the share to existing co-owners first to avoid future disputes.' },
      { id: 2, phase: 'SPA', label: 'Prepare SPA for Sale of Undivided Share', timeframe: 'Day 7–14', legalBasis: 'NLC s.342; Contracts Act 1950', tip: 'The SPA must clearly identify the fractional share being sold (e.g. "half undivided share" in the land). The purchase price may be discounted from the proportionate market value due to the practical difficulties of owning an undivided share.', documents: [{ id: 'ss08-d1', title: 'SPA for Sale of Undivided Share', type: 'template', note: 'Sale agreement for a fractional undivided share in jointly owned land.', sample: 'SALE AND PURCHASE AGREEMENT\n(Sale of Undivided Share)\n\nDate: [Date]\n\nBETWEEN:\n[VENDOR NAME] (NRIC: [No]) ("the Vendor")\nAND\n[PURCHASER NAME] (NRIC: [No]) ("the Purchaser")\n\nBACKGROUND:\nThe Vendor is the registered co-proprietor of [FRACTION, e.g. one-half (1/2)] undivided share in the land described below, held as tenant in common with [Co-Owner Name].\n\nThe Vendor wishes to sell, and the Purchaser wishes to purchase, the said undivided share.\n\nLAND:\nTitle No: [Geran No], Lot [No], Mukim [Name], State [Name]\n\nSHARE SOLD: [Fraction] undivided share\n\nPURCHASE PRICE: RM [Amount]\n\nDEPOSIT: RM [Amount] (paid upon signing)\n\nBALANCE: RM [Amount] (payable within [30/90] days)\n\n[Standard conditions of SPA]' }] },
      { id: 3, phase: 'Transfer', label: 'Execute Form 14A for the Undivided Share', timeframe: 'Day 30–90', legalBasis: 'NLC s.215', tip: 'The Form 14A is executed to transfer only the stated fraction of the land. The purchaser becomes a new co-owner as tenant in common with the remaining co-owners.' },
      { id: 4, phase: 'Registration', label: 'Register the Transfer at Land Office', timeframe: 'Post-execution', legalBasis: 'NLC s.215 & s.298', tip: 'The Land Registrar will update the title to reflect the new proportional ownership. Note: Stamp duty on the SPA is based on the full proportionate value of the share.' }
    ]
  },
  {
    id: 'SS-09',
    title: 'Sub-Sale with Outstanding Progress Billings (Developer Property)',
    category: 'Sub-Sale & Resale',
    difficulty: 'Advanced',
    duration: '4–12 months',
    summary: 'Where a first purchaser wishes to sub-sell a property under construction before all progressive payment instalments have been paid, the sub-sale involves the second purchaser assuming the outstanding progressive payments while the first purchaser receives any profit/premium.',
    legislation: ['Housing Development Act 1966', 'Contracts Act 1950', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'OTP', label: 'Sign OTP Setting Out Premium & Assumptions', timeframe: 'Day 1', legalBasis: 'Contracts Act 1950', tip: 'The premium (first purchaser\'s profit) is the key commercial term. The OTP must clearly state: (1) the premium, (2) the outstanding progressive payments to be assumed by the second purchaser, (3) the total effective purchase price.' },
      { id: 2, phase: 'Developer Consent', label: 'Obtain Developer\'s Consent & Novation', timeframe: 'Day 7–45', legalBasis: 'HDA 1966; original SPA terms', tip: 'A novation agreement must be entered into with the developer, the first purchaser, and the second purchaser. The developer may charge a fee.' },
      { id: 3, phase: 'New Loan', label: 'Second Purchaser Applies for New Bank Loan', timeframe: 'Day 7–60', legalBasis: 'NLC; Contracts Act 1950', tip: 'The bank must be comfortable financing the "total" purchase price (premium + outstanding progressives). Some banks compute LTV based on the total price including the assumed progressives.' },
      { id: 4, phase: 'Completion', label: 'Settlement of Premium & Novation Signing', timeframe: 'Day 60–120', legalBasis: 'Contracts Act 1950', tip: 'After novation, the second purchaser deals directly with the developer for all remaining progress billings and VP.' }
    ]
  },
  {
    id: 'SS-10',
    title: 'Auction Purchase — Private Treaty Sale (Post-Unsuccessful Auction)',
    category: 'Sub-Sale & Resale',
    difficulty: 'Advanced',
    duration: '3–6 months',
    summary: 'Where a mortgagee sale auction fails to attract a successful bidder at the reserve price, the bank may dispose of the property by private treaty (direct sale at or above the reserve price). The purchaser in such a case acquires the property at a negotiated price.',
    legislation: ['NLC 1965 (s.256, s.258)', 'Rules of Court 2012 — Order 83', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Failed Auction', label: 'Bank Declares Auction Unsuccessful — Proceeds to Private Treaty', timeframe: 'After auction date', legalBasis: 'NLC s.256; Order 83', tip: 'The bank must obtain court approval for private treaty sale at a price not less than the reserve price approved by the court. A fresh Summons in Chambers must be filed.' },
      { id: 2, phase: 'Negotiation', label: 'Negotiate Purchase Price with Bank / Bank\'s Solicitors', timeframe: 'Day 1–30', legalBasis: 'Court Order for private treaty', tip: 'The private treaty price must be at least equal to the court-approved reserve price. The purchaser should obtain an independent valuation before negotiating.' },
      { id: 3, phase: 'Letter of Offer', label: 'Bank Issues Letter of Offer for Private Treaty Sale', timeframe: 'Day 14–30', legalBasis: 'Court Order', tip: 'The letter of offer sets out the conditions of sale (price, completion timeline, "as is where is" clause). The 10% deposit is typically non-refundable.' },
      { id: 4, phase: 'Completion & Vesting Order', label: 'Pay Balance & Apply for Vesting Order', timeframe: 'Within agreed period', legalBasis: 'NLC s.258', tip: 'Same process as an auction purchase — upon full payment, the bank applies for a Vesting Order to transfer title to the purchaser without a formal Form 14A (MOT).' }
    ]
  },

  // ─── DEVELOPER / PRIMARY MARKET (Additional) ──────────────────
  {
    id: 'DEV-03',
    title: 'Certificate of Completion and Compliance (CCC) — VP Process',
    category: 'Developer & Primary Market',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'The Certificate of Completion and Compliance (CCC) replaced the Certificate of Fitness (CF) in Malaysia. It is issued by the Principal Submitting Person (PSP — usually the project architect) and is required before Vacant Possession (VP) can be legally delivered to purchasers.',
    legislation: ['Street, Drainage and Building Act 1974 (s.70; UBBL 1984)', 'Housing Development Act 1966 (Schedule G — Clause 26)', 'Housing Development (Control and Licensing) Regulations 1989'],
    steps: [
      { id: 1, phase: 'Completion of Works', label: 'Developer Confirms Physical Completion of the Building', timeframe: 'Month 1', legalBasis: 'SDBA 1974; HDA Schedule G', tip: 'The physical building (including all common facilities and infrastructure) must be substantially complete before the PSP can certify the CCC.' },
      { id: 2, phase: 'PSP Inspection', label: 'Principal Submitting Person Inspects & Certifies CCC', timeframe: 'Month 1–2', legalBasis: 'SDBA 1974 — s.70(16)', tip: 'The PSP (project architect) inspects the completed building and certifies that it was constructed in accordance with the approved plans and the UBBL. The PSP bears personal liability for the CCC.' },
      { id: 3, phase: 'VP Notice', label: 'Developer Issues VP Notice to Purchasers', timeframe: 'After CCC', legalBasis: 'HDA Schedule G — Clause 26', tip: 'The HDA Schedule G requires the developer to give at least 14 days\' notice of VP delivery. The VP date is the critical date for computing LAD.', documents: [{ id: 'dev03-d1', title: 'Notice of Vacant Possession (VP)', type: 'letter', note: 'Formal notice from developer to purchaser of the date and time for taking delivery of the property.', sample: '[Developer Letterhead]\n\nDate: [Date]\n\nTO: [Purchaser Name]\n[Address]\n\nDear Sir/Madam,\n\nNOTICE OF VACANT POSSESSION\nProperty: [Full address / Lot No / Unit No]\nSPA Date: [Date]\n\nWe are pleased to inform you that the above property is now ready for the delivery of Vacant Possession.\n\nA Certificate of Completion and Compliance (CCC) has been issued by [PSP Name, ARB Reg No] on [CCC Date].\n\nYou are hereby notified that Vacant Possession of the above property will be delivered on:\nDate: [VP Delivery Date]\nTime: [Time]\nVenue: [Sales Gallery / Site Office]\n\nPlease ensure all progressive payment instalments are fully paid before the VP date.\n\nYours faithfully,\n[Authorised Signatory]\n[Developer Name]' }] },
      { id: 4, phase: 'VP Delivery', label: 'Purchaser Takes Delivery of Keys & Signs VP Acknowledgement', timeframe: 'VP Date', legalBasis: 'HDA Schedule G — Clause 26', tip: 'The purchaser should inspect the property before signing the VP acknowledgement. Note any defects on the VP checklist — this triggers the 24-month Defect Liability Period (DLP).' }
    ]
  },
  {
    id: 'DEV-04',
    title: 'Defect Liability Period (DLP) Claim Process',
    category: 'Developer & Primary Market',
    difficulty: 'Basic',
    duration: '3–24 months',
    summary: 'After taking VP, purchasers have a 24-month Defect Liability Period to identify and report defects in their property for rectification by the developer at no cost. This is a statutory right under the HDA 1966.',
    legislation: ['Housing Development Act 1966 (Schedule G — Clause 30)', 'Housing Development (Control and Licensing) Regulations 1989'],
    steps: [
      { id: 1, phase: 'DLP Commencement', label: 'DLP Begins Upon VP Delivery — Inspect Property Immediately', timeframe: 'VP date + 24 months', legalBasis: 'HDA Schedule G — Clause 30', tip: 'The 24-month DLP starts from the date of VP delivery. Purchasers should conduct a thorough inspection immediately upon VP and document all defects with photos.' },
      { id: 2, phase: 'Defect Report', label: 'Submit Written Defect Report to Developer', timeframe: 'Within DLP', legalBasis: 'HDA Schedule G — Clause 30', tip: 'Submit the defect report IN WRITING (registered post / email with acknowledgement) within the 24-month DLP. Oral complaints are insufficient.', documents: [{ id: 'dev04-d1', title: 'Defect Report Letter to Developer', type: 'letter', note: 'Written notification to developer of defects found during the DLP period, requesting rectification.', sample: '[Purchaser\'s Address]\n\nDate: [Date]\n\nTO: [Developer Name]\n[Address]\n\nDear Sir/Madam,\n\nDEFECT LIABILITY PERIOD REPORT\nProperty: [Address / Unit No]\nSPA Date: [Date]\nVP Date: [Date]\nDLP Expires: [Date = VP + 24 months]\n\nPursuant to Clause 30 of the Sale and Purchase Agreement (Housing Development Act Schedule G), we hereby give formal notice of the following defects found in the above property:\n\n1. [Defect Description, Location, Photo Reference]\n2. [Defect Description, Location, Photo Reference]\n3. [Defect Description, Location, Photo Reference]\n\nWe request that the above defects be rectified within THIRTY (30) DAYS from the date of this notice.\n\nIf the defects are not rectified within the said period, we reserve the right to:\n(a) Hire contractors to rectify the defects and deduct the cost from any outstanding payment; or\n(b) Lodge a complaint with the Tribunal Tuntutan Pembeli Rumah.\n\nYours sincerely,\n[Purchaser\'s Name & Signature]' }] },
      { id: 3, phase: 'Rectification', label: 'Developer Rectifies Defects Within 30 Days', timeframe: 'Within 30 days of notice', legalBasis: 'HDA Schedule G — Clause 30', tip: 'The developer has 30 days to rectify the reported defects. If they fail, the purchaser can hire contractors at the developer\'s expense or file a complaint with the Housing Tribunal.' },
      { id: 4, phase: 'Unresolved Defects', label: 'Lodge Complaint at Tribunal Tuntutan Pembeli Rumah', timeframe: 'After failed rectification', legalBasis: 'Housing Development Act 1966 (s.16C)', tip: 'The Tribunal provides a fast, cheap alternative to court proceedings. Claims up to RM50,000 are within its jurisdiction. Filing fee is RM10. No lawyers required (but allowed).' }
    ]
  },
  {
    id: 'DEV-05',
    title: 'Release of Bumiputera Lot Restriction',
    category: 'Developer & Primary Market',
    difficulty: 'Advanced',
    duration: '6–24 months',
    summary: 'Certain lots/units in housing developments are designated "Bumiputera lots" — they can only be sold to Bumiputera purchasers. Where a developer cannot find Bumiputera buyers within a reasonable period, they may apply to the State Authority for release of the Bumiputera quota restriction.',
    legislation: ['State Land Enactments (varies by State)', 'Housing Development (Control and Licensing) Act 1966', 'Economic Planning Unit guidelines'],
    steps: [
      { id: 1, phase: 'Marketing Period', label: 'Developer Markets Units to Bumiputera Purchasers (Minimum Period)', timeframe: 'Month 1–12', legalBasis: 'State Authority conditions', tip: 'Most states require the developer to actively market Bumiputera lots to Bumiputera buyers for a minimum period (usually 6–12 months) before applying for release. Evidence of marketing efforts is required.' },
      { id: 2, phase: 'Application', label: 'Apply to State Authority for Release of Bumiputera Quota', timeframe: 'Month 6–12', legalBasis: 'State guidelines on Bumiputera lots', tip: 'Application is made to the State Economic Planning Unit or equivalent. The developer must prove: (1) genuine efforts to sell to Bumiputera, (2) no interested Bumiputera buyers found after reasonable marketing.', documents: [{ id: 'dev05-d1', title: 'Application Letter — Release of Bumiputera Lot Restriction', type: 'letter', note: 'Formal application to State Authority requesting release of Bumiputera lot designation.', sample: '[Developer Letterhead]\n\nDate: [Date]\n\nKetua Setiausaha\nUPE / SUK Negeri [Name]\n[Address]\n\nDear Sir/Madam,\n\nPERMOHONAN PELEPASAN LOT BUMIPUTERA\nProjek: [Project Name]\nLot/Unit: [No]\n\nKami dengan hormatnya memohon pertimbangan Pihak Berkuasa Negeri untuk meluluskan pelepasan lot Bumiputera bagi lot-lot berikut kerana tidak dapat dijual kepada pembeli Bumiputera walaupun usaha pemasaran yang aktif telah dijalankan.\n\nButir-butir projek:\n- Nama projek: [Name]\n- Lokasi: [Address]\n- Kelulusan projek: [Approval Reference]\n- Bilangan lot Bumiputera: [No]\n- Harga jualan: RM [Amount]\n\nUsaha pemasaran (dilampirkan):\n- Iklan akhbar: [Dates]\n- Pameran hartanah: [Events]\n- Surat kepada persatuan Bumiputera: [Dates]\n\nYours faithfully,\n[Developer Representative]' }] },
      { id: 3, phase: 'Approval', label: 'State Authority Approves Release — Open Market Sale Permitted', timeframe: 'Month 12–24', legalBasis: 'State Authority discretion', tip: 'Upon approval, the developer must usually pay a release premium (typically 5–7% of the Bumiputera lot price to compensate the State). The restriction is then noted on the title as released.' }
    ]
  },
  {
    id: 'DEV-06',
    title: 'Developer Winding Up — Purchaser\'s Rights',
    category: 'Developer & Primary Market',
    difficulty: 'Advanced',
    duration: '1–5 years',
    summary: 'Where a housing developer is wound up (company or individual insolvency), purchasers who have paid deposits or progress payments face significant risk. Understanding the legal framework for protecting purchasers in such situations is essential.',
    legislation: ['Housing Development Act 1966 (s.7A–s.7H — Housing Development Account)', 'Companies Act 2016 (winding up)', 'Insolvency Act 1967', 'National Housing Department regulations'],
    steps: [
      { id: 1, phase: 'Warning Signs', label: 'Identify Warning Signs of Developer\'s Financial Distress', timeframe: 'Ongoing', legalBasis: 'HDA 1966; Companies Act 2016', tip: 'Warning signs: (1) construction stoppage, (2) developer\'s cheques bouncing, (3) payment defaults to contractors, (4) CTOS/CCRIS alerts, (5) newspaper reports. Act quickly if these appear.' },
      { id: 2, phase: 'Housing Development Account', label: 'Check if Payments Were Made to Housing Development Account', timeframe: 'Immediately', legalBasis: 'HDA 1966 — s.7A', tip: 'Under HDA, licensed developers must deposit all purchase money (up to 5% for land, up to 10% for buildings) into a Housing Development Account (HDA) controlled by the Housing Controller. These funds are partially protected from developer\'s creditors.' },
      { id: 3, phase: 'Proof of Debt', label: 'Purchaser Files Proof of Debt as Unsecured Creditor (if wound up)', timeframe: 'Within creditor deadline', legalBasis: 'Companies Act 2016 — winding up', tip: 'If the developer is wound up, purchasers must file a Proof of Debt with the liquidator within the stipulated period. Include all evidence of payments (receipts, bank statements, SPA).' },
      { id: 4, phase: 'Rehabilitation', label: 'Monitor Potential Rehabilitation / Step-in by State / Government', timeframe: 'Ongoing', legalBasis: 'HDA s.10A (abandoned housing rehabilitation)', tip: 'The Ministry of Housing may intervene to rehabilitate abandoned projects. Purchasers should register their complaint with KPKT (Kementerian Perumahan) and the State Housing Authority to be included in the rehabilitation scheme.' }
    ]
  },

  // ─── LOAN & FINANCING (Additional) ────────────────────────────
  {
    id: 'LF-05',
    title: 'Partial Discharge of Charge — Release of One Property',
    category: 'Loan & Financing',
    difficulty: 'Intermediate',
    duration: '2–4 months',
    summary: 'Where a borrower has charged multiple properties as composite security for a single loan, and one of those properties is being sold, the bank partially discharges the charge over that specific property while retaining the charge over the remaining properties.',
    legislation: ['NLC 1965 (s.278)', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Negotiation', label: 'Negotiate Partial Discharge Terms with Bank', timeframe: 'Day 1–30', legalBasis: 'Loan agreement; NLC s.278', tip: 'The bank will assess whether the remaining secured properties (after partial discharge) provide sufficient security for the outstanding loan. The bank may require a partial repayment of the loan.' },
      { id: 2, phase: 'Redemption Statement', label: 'Obtain Partial Redemption Figure from Bank', timeframe: 'Day 1–14', legalBasis: 'Loan agreement', tip: 'The bank issues a statement confirming the amount to be repaid (if any) and the conditions for partial discharge of the specified property.' },
      { id: 3, phase: 'Partial Discharge', label: 'Bank Executes Partial Discharge (Form 16N) for the Released Property', timeframe: 'Day 14–60', legalBasis: 'NLC s.278', tip: 'The Form 16N is executed for the specific property being released. The remaining properties continue to be charged to the bank as security.', documents: [{ id: 'lf05-d1', title: 'Request for Partial Discharge of Charge', type: 'letter', note: 'Request to bank for partial discharge of one property from a composite charge.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nThe Manager\nLoan Administration\n[Bank Name]\n[Address]\n\nDear Sir/Madam,\n\nLOAN ACCOUNT NO: [Account No]\nREQUEST FOR PARTIAL DISCHARGE OF CHARGE\n\nWe act for [Client Name] (the Chargor) in respect of the above housing loan account.\n\nOur client is in the process of selling the following property which is part of the composite security held by your bank:\n\nProperty to be released:\nTitle No: [Geran No], Lot [No], Mukim [Name], State [Name]\nAddress: [Property Address]\n\nWe request:\n1. A partial redemption statement showing the amount (if any) to be paid for the partial discharge of the above property.\n2. Your confirmation that upon payment of the stated amount, you will execute and release the Form 16N (Discharge of Charge) for the above property.\n3. Confirmation that the charge over the remaining security properties ([List remaining properties]) will remain in full force.\n\nYours faithfully,\n[Solicitor Name]' }] },
      { id: 4, phase: 'Registration', label: 'Register the Partial Discharge at Land Office', timeframe: 'Day 60–120', legalBasis: 'NLC s.298', tip: 'Present the Form 16N for the released property at the Land Office. The charge notation is removed from that specific title while remaining on the other properties.' }
    ]
  },
  {
    id: 'LF-06',
    title: 'Variation of Charge — Increasing Loan Amount (Top-Up Loan)',
    category: 'Loan & Financing',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'An existing chargor who requires additional funds may apply to the same bank for a "top-up" loan, which increases the amount secured by the existing charge. This is effected by a Supplemental Charge (Form 16A) or Variation of Charge agreement.',
    legislation: ['NLC 1965 (s.241)', 'Contracts Act 1950', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Application', label: 'Apply for Top-Up / Additional Loan from Existing Bank', timeframe: 'Day 1–30', legalBasis: 'Contracts Act 1950', tip: 'Top-up loans are typically available if: (1) the loan is current (no arrears), (2) the current market value of the property has increased sufficiently to support the additional loan, (3) the borrower\'s income is sufficient for the higher installment.' },
      { id: 2, phase: 'Valuation', label: 'Bank Conducts New Valuation of Property', timeframe: 'Day 7–21', legalBasis: 'Banking guidelines', tip: 'The bank commissions a new valuation to determine the current market value, which in turn determines the maximum loan that can be made.' },
      { id: 3, phase: 'Supplemental Documents', label: 'Execute Supplemental Loan Agreement & Form 16A', timeframe: 'Day 21–45', legalBasis: 'NLC s.241', tip: 'A Supplemental Loan Agreement (or an addendum to the existing loan agreement) is executed. A fresh or supplemental Form 16A is executed to secure the increased amount.' },
      { id: 4, phase: 'Stamp & Registration', label: 'Stamp Supplemental Documents & Register Variation at Land Office', timeframe: 'Day 45–90', legalBasis: 'Stamp Act 1949; NLC s.241', tip: 'Stamp duty is computed on the additional amount only (not the full original loan). The Land Office notes the variation on the title.' }
    ]
  },
  {
    id: 'LF-07',
    title: 'Transfer of Charge — Bank Merger / Loan Assignment',
    category: 'Loan & Financing',
    difficulty: 'Intermediate',
    duration: '2–6 months',
    summary: 'Where a bank merges with another, or sells its loan portfolio to another institution, the registered charges must be transferred to the acquiring bank. This is effected by a Transfer of Charge (Form 16G) at the Land Office.',
    legislation: ['NLC 1965 (s.268)', 'Financial Services Act 2013; Islamic Financial Services Act 2013 (Bank Negara approval)'],
    steps: [
      { id: 1, phase: 'Regulatory Approval', label: 'Obtain Bank Negara Malaysia Approval for Merger / Portfolio Transfer', timeframe: 'Month 1–12', legalBasis: 'Financial Services Act 2013', tip: 'Bank mergers and large portfolio transfers require prior approval from BNM. Individual chargor notification is usually a regulatory requirement.' },
      { id: 2, phase: 'Chargor Notification', label: 'Notify Chargor of Transfer of Charge', timeframe: 'After BNM approval', legalBasis: 'Loan agreement; common law', tip: 'The chargor must be notified of the change in chargee (the bank to which their loan has been assigned). Future loan payments are directed to the new bank.' },
      { id: 3, phase: 'Form 16G', label: 'Execute & Register Form 16G (Transfer of Charge) at Land Office', timeframe: 'Month 2–6', legalBasis: 'NLC s.268 (Form 16G)', tip: 'Form 16G is presented at each Land Office for each property in the portfolio. For large portfolio transfers, banks often engage specialised law firms to bulk-process these transactions. Fixed duty: RM10 per Form 16G.' }
    ]
  },
  {
    id: 'LF-08',
    title: 'Second Charge — Additional Loan with Existing Charge',
    category: 'Loan & Financing',
    difficulty: 'Advanced',
    duration: '2–4 months',
    summary: 'An owner whose property is already charged to a first bank may obtain a second loan from another lender (or the same bank) by creating a second charge over the same property. The second charge is subordinate to the first in priority.',
    legislation: ['NLC 1965 (s.241, s.271)', 'Stamp Act 1949', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'First Chargee Consent', label: 'Check First Loan Agreement — Consent Clause & Obtain Consent if Required', timeframe: 'Day 1–14', legalBasis: 'NLC s.241; First loan agreement', tip: 'Many loan agreements contain a clause prohibiting the creation of further charges without the first chargee\'s written consent. Obtain this consent before proceeding or risk a technical breach of the first loan agreement.' },
      { id: 2, phase: 'Valuation', label: 'New Bank Commissions Valuation — Assesses Residual Value Above First Charge', timeframe: 'Day 7–21', legalBasis: 'Banking guidelines', tip: 'The second bank will lend only on the "equity" available above the first charge outstanding balance. E.g. if property value is RM500k and first charge is RM400k, the equity is RM100k (and the second bank may lend a portion of that).' },
      { id: 3, phase: 'Second Loan Documents', label: 'Execute Second Loan Agreement & Form 16A (Second Charge)', timeframe: 'Day 21–45', legalBasis: 'NLC s.241', tip: 'The Form 16A must identify it as a second charge. The second bank takes the IDT from the first bank (or holds the land registry copy).' },
      { id: 4, phase: 'Registration', label: 'Register Second Charge at Land Office', timeframe: 'Day 45–90', legalBasis: 'NLC s.241, s.271 & s.298', tip: 'The second charge is registered immediately after the first charge in priority. The title will show both charges. In default, the first chargee is satisfied in full before the second chargee gets anything.' }
    ]
  },

  // ─── STRATA & MC (Additional) ─────────────────────────────────
  {
    id: 'ST-03',
    title: 'Application for Strata Title by Developer',
    category: 'Strata & Management Corporation',
    difficulty: 'Advanced',
    duration: '2–5 years',
    summary: 'The legal obligation of a developer to apply for strata titles upon completion of a strata building. Under the Strata Titles Act 1985, the developer must apply within a prescribed period of obtaining the CCC.',
    legislation: ['Strata Titles Act 1985 (s.8)', 'National Land Code 1965', 'Strata Titles (Amendment) Act 2013'],
    steps: [
      { id: 1, phase: 'CCC Obtained', label: 'CCC Issued — Developer\'s Obligation Begins', timeframe: 'Upon CCC', legalBasis: 'STA 1985 — s.8(2); HDA 1966', tip: 'Under the STA (as amended), the developer must apply for strata titles within 6 months of obtaining CCC. Failure to do so is a criminal offence.' },
      { id: 2, phase: 'Survey', label: 'Commission Strata Survey (Juruukur Tanah Berlesen)', timeframe: 'Month 1–12', legalBasis: 'STA 1985 — s.8(4)', tip: 'A licensed surveyor conducts the strata survey to determine the area of each parcel/unit and the share units to be allocated. The share unit allocation determines each owner\'s proportion of common property and maintenance charges.' },
      { id: 3, phase: 'Application to PTG', label: 'File Strata Title Application at Land Office (PTG)', timeframe: 'Month 6–24', legalBasis: 'STA 1985 — s.8; Form 1', tip: 'Submit: (1) Form 1 application, (2) strata survey plans, (3) building plans, (4) CCC, (5) master title documents, (6) application fees. The Director of Lands & Mines processes the application.' },
      { id: 4, phase: 'Opening of Strata Register', label: 'Director of Lands Issues Individual Strata Titles', timeframe: 'Month 18–60', legalBasis: 'STA 1985 — s.12', tip: 'Upon approval, individual strata titles (GS/QS) are issued for each parcel. The developer then delivers the individual strata title to each purchaser or their bank (if charged).' }
    ]
  },
  {
    id: 'ST-04',
    title: 'Strata Management Tribunal — Complaint Procedure',
    category: 'Strata & Management Corporation',
    difficulty: 'Basic',
    duration: '1–6 months',
    summary: 'The Strata Management Tribunal (SMT) provides a fast, inexpensive dispute resolution mechanism for disputes between parcel owners and the JMB/MC (and vice versa) concerning strata management matters.',
    legislation: ['Strata Management Act 2013 (Part IV)', 'Strata Management (Tribunal) Regulations 2015'],
    steps: [
      { id: 1, phase: 'Jurisdiction Check', label: 'Confirm the Dispute Falls Within SMT\'s Jurisdiction', timeframe: 'Day 1', legalBasis: 'SMA 2013 — s.105', tip: 'SMT has jurisdiction over disputes involving maintenance charges, sinking fund, common property, by-laws, and accounts. It does NOT cover disputes about land ownership or title (those go to the High Court). Limit: RM250,000 per claim.' },
      { id: 2, phase: 'Filing', label: 'File Claim Form at SMT Registry', timeframe: 'Day 1–7', legalBasis: 'Strata Management (Tribunal) Regulations 2015', tip: 'Filing fee is RM100. Submit: (1) Completed SMT claim form, (2) Supporting documents (SPA, invoices, demand letters, photos), (3) Filing fee receipt.', documents: [{ id: 'st04-d1', title: 'Letter of Demand Before SMT Filing', type: 'letter', note: 'Pre-SMT formal demand letter to give the respondent a final opportunity to resolve the dispute.', sample: '[Complainant\'s Address / Firm Letterhead]\n\nDate: [Date]\n\nTO: [Respondent — JMB/MC Name]\n[Address]\n\nDear Sir/Madam,\n\nFORMAL DEMAND — MAINTENANCE CHARGE DISPUTE\nProperty: [Parcel No, Building Name]\n\nPursuant to the Strata Management Act 2013, we hereby formally demand that you:\n\n[State specific demand, e.g. Rectify defects in common property / Refund excess maintenance charges collected / Provide audited accounts for Year 20XX]\n\nFailing resolution within FOURTEEN (14) DAYS, we will file a complaint with the Strata Management Tribunal without further notice.\n\nYours sincerely,\n[Complainant / Solicitor]' }] },
      { id: 3, phase: 'Hearing', label: 'SMT Hearing — Parties Present Their Case', timeframe: 'Month 1–3', legalBasis: 'SMA 2013 — s.108', tip: 'Hearings are conducted informally. Legal representation is allowed but not required. The SMT president (a legally qualified officer) presides. Witnesses may be called and documents produced.' },
      { id: 4, phase: 'Award', label: 'SMT Award — Binding on Parties', timeframe: 'After hearing', legalBasis: 'SMA 2013 — s.118', tip: 'An SMT Award is binding and enforceable as a court order. Failure to comply with an award can be enforced through the Sessions Court. Appeals lie to the High Court on points of law only.' }
    ]
  },
  {
    id: 'ST-05',
    title: 'MC Enforcement of By-Laws Against Parcel Owner',
    category: 'Strata & Management Corporation',
    difficulty: 'Intermediate',
    duration: '1–6 months',
    summary: 'A Management Corporation has the legal power to enforce the by-laws (including the Statutory By-Laws under the Strata Management Act 2013 and any additional by-laws passed at AGM) against parcel owners who breach them.',
    legislation: ['Strata Management Act 2013 (s.70–s.100)', 'Strata Management (Maintenance and Management) Regulations 2015'],
    steps: [
      { id: 1, phase: 'Complaint', label: 'Parcel Owner or MC Identifies By-Law Breach', timeframe: 'Day 1', legalBasis: 'SMA 2013 — s.70', tip: 'Common by-law breaches: illegal renovations affecting structure/fire safety, unauthorized alterations to common property, pets in no-pet buildings, noise nuisance, obstructing common corridors.' },
      { id: 2, phase: 'Notice', label: 'MC Issues Written Notice of Breach to Parcel Owner', timeframe: 'Day 1–7', legalBasis: 'SMA 2013 — s.70(2)', tip: 'The MC must give written notice specifying: (1) the by-law breached, (2) the nature of the breach, (3) what must be done to rectify the breach, (4) the time within which the breach must be remedied.', documents: [{ id: 'st05-d1', title: 'Notice of By-Law Breach', type: 'letter', note: 'Formal notice from MC to parcel owner of by-law breach and required remedial action.', sample: '[Management Corporation Name]\n[Address]\n\nDate: [Date]\n\nTO: [Parcel Owner Name]\n[Unit/Parcel Address]\n\nDear Sir/Madam,\n\nNOTICE OF BY-LAW BREACH\nPursuant to Section 70 of the Strata Management Act 2013\n\nWe write on behalf of the Management Corporation of [Building Name] (hereinafter "the MC").\n\nIt has been brought to our attention that you are in breach of the following by-law:\n\nBY-LAW BREACHED: [Describe by-law, e.g. By-law 5 — No unauthorized structural alteration]\nNATURE OF BREACH: [Describe what was done, e.g. You have removed a load-bearing wall without MC consent or required government approvals.]\n\nYou are hereby required to REMEDY the said breach by:\n(a) [Specific remedial action required, e.g. restore the wall to its original condition]\nwithin FOURTEEN (14) DAYS from the date of this notice.\n\nFailure to comply may result in the MC filing a complaint with the Strata Management Tribunal and/or the local authority.\n\nYours faithfully,\n[MC Chairperson / MC Secretary]\n[Management Corporation Name]' }] },
      { id: 3, phase: 'Escalation', label: 'File SMT Complaint if Breach Continues', timeframe: 'After failed rectification', legalBasis: 'SMA 2013 — s.105', tip: 'The MC may also engage the local planning authority (MBPJ, DBKL) if the breach involves illegal structural alterations — the local authority has independent enforcement powers.' }
    ]
  },
  {
    id: 'ST-06',
    title: 'Transfer of Strata Unit to Purchaser',
    category: 'Strata & Management Corporation',
    difficulty: 'Intermediate',
    duration: '2–6 months',
    summary: 'Once individual strata titles (GS) have been issued, the developer effects the transfer of each strata unit to the purchaser by executing a Form 14A (Memorandum of Transfer — Strata). This replaces any earlier assignment or sub-sale documentation.',
    legislation: ['Strata Titles Act 1985 (s.21)', 'NLC 1965 (s.215)', 'Stamp Act 1949'],
    steps: [
      { id: 1, phase: 'Strata Title Ready', label: 'Confirm Issuance of Individual Strata Title (GS)', timeframe: 'Day 1', legalBasis: 'STA 1985 — s.12', tip: 'Search the strata title register at the Land Office to confirm the GS has been issued. Obtain the official title details for the Form 14A.' },
      { id: 2, phase: 'Redemption', label: 'Bank Releases Master Title for Strata Sub-Division (if applicable)', timeframe: 'Day 1–30', legalBasis: 'NLC; STA 1985', tip: 'If the master title was charged to a development financier, the financier must release the individual strata title for delivery to the purchaser. This is arranged between the developer\'s bank and the purchaser\'s bank.' },
      { id: 3, phase: 'Form 14A', label: 'Developer Executes Form 14A (Strata) to Purchaser', timeframe: 'Day 7–21', legalBasis: 'NLC s.215; STA 1985 s.21', tip: 'The Form 14A is executed by the developer as vendor. If the purchaser has a bank loan, the bank\'s Form 16A is simultaneously executed.', documents: [{ id: 'st06-d1', title: 'Memorandum of Transfer — Strata Title', type: 'form', note: 'Form 14A adapted for strata title transfer — the legal instrument effecting the transfer of strata unit ownership.', sample: 'MEMORANDUM OF TRANSFER (STRATA)\n(Section 215, National Land Code 1965)\n\nFORM 14A\n\nI/We, [DEVELOPER NAME] (Company Reg No: [         ])\n("the Vendor/Transferor")\n\nHEREBY TRANSFER to:\n[PURCHASER FULL NAME] (NRIC No.: [         ])\n("the Purchaser/Transferee")\n\nall my/our right and title in the land described below:\n\nSTRATA TITLE DETAILS:\nGeran Strata (GS) No.: [         ]\nNo. Lot/Petak: [         ]\nNo. Aksesori (if any): [         ]\nNo. Tingkat: [         ]\nNama Bangunan: [         ]\nTitle No. (Master): [         ]\nMukim: [         ]\nDaerah: [         ]\nNegeri: [         ]\n\nPURCHASE PRICE: RM [Amount]\n\nDated this ___ day of _____________, 20__.\n\n_________________________\nAuthorised Signatory (Developer)\n[Common Seal]\n\nATTESTATION:\nI, [SOLICITOR NAME], Advocate & Solicitor,\ncertify that the Transferor personally appeared before me and acknowledged\nexecution of this Memorandum of Transfer.\n\n_________________________\nAdvocate & Solicitor' }] },
      { id: 4, phase: 'Stamping & Registration', label: 'Stamp Form 14A & Present at Land Office', timeframe: 'Day 21–90', legalBasis: 'Stamp Act 1949; NLC s.298', tip: 'Stamp duty based on the strata unit purchase price. Once registered, the purchaser becomes the registered proprietor of the strata unit.' }
    ]
  },

  // ─── CAVEATS (Additional) ─────────────────────────────────────
  {
    id: 'CAV-04',
    title: 'Lien-Holder\'s Caveat (NLC s.330)',
    category: 'Caveats',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'A lien-holder\'s caveat is entered by a person who holds an original Issue Document of Title as security for a loan (a "lien" under s.281 NLC). This protects the lien-holder\'s interest in the IDT even though no formal charge has been registered.',
    legislation: ['NLC 1965 (s.281–s.291; s.330)', 'Form 19D'],
    steps: [
      { id: 1, phase: 'Lien Created', label: 'Deposit of Original IDT as Security (Lien) — s.281 NLC', timeframe: 'Day 1', legalBasis: 'NLC s.281', tip: 'A lien is created when the proprietor deposits their original IDT with a money-lender, private lender, or even solicitor as security for a loan or obligation. This is common in private and informal lending arrangements.' },
      { id: 2, phase: 'Lien-Holder\'s Caveat', label: 'Lodge Lien-Holder\'s Caveat (Form 19D) at Land Office', timeframe: 'Day 1', legalBasis: 'NLC s.330 (Form 19D)', tip: 'The lien-holder should promptly enter a lien-holder\'s caveat to protect the interest. Without a caveat, the proprietor could still deal with the land (register a charge or transfer) despite the lien.', documents: [{ id: 'cav04-d1', title: 'Form 19D — Entry of Lien-Holder\'s Caveat', type: 'form', note: 'Statutory form to protect the interest of a lien-holder who holds the original IDT as security.', sample: 'ENTRY OF LIEN-HOLDER\'S CAVEAT\n(Section 330 of the National Land Code, 1965)\n\nFORM 19D\n\nTO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:\n\nI/We, [LIEN-HOLDER FULL NAME] (NRIC: [No]) of [Address],\nbeing the person entitled as Lien-Holder under Section 281 of the National Land Code 1965, HEREBY APPLY for the entry of a Lien-Holder\'s Caveat against the land described below:\n\nLand:\nTitle No: [Geran/QT No], Lot [No], Mukim [Name], State [Name]\n\nBASIS OF LIEN:\nI hold the original Issue Document of Title of the above land as security for a loan of RM [Amount] made by me to [Proprietor Name] (the registered proprietor of the said land) on [Date].\n\nDATE: ____________________\n\n________________________________\nSignature of Lien-Holder' }] },
      { id: 3, phase: 'Enforcement', label: 'Enforcement — Apply to Court for Order for Sale Under Lien', timeframe: 'Upon default', legalBasis: 'NLC s.284', tip: 'A lien-holder cannot simply sell the land. Upon default, the lien-holder must apply to the High Court for an Order for Sale of the land under the lien. The procedure is similar to a chargee\'s Order for Sale application.' }
    ]
  },
  {
    id: 'CAV-05',
    title: 'Removal of Caveat by Court Order (Originating Summons)',
    category: 'Caveats',
    difficulty: 'Advanced',
    duration: '3–9 months',
    summary: 'Where a private caveat is blocking a legitimate transaction and the caveator refuses to withdraw voluntarily and does not take court action within 14 days of a s.322 notice, the registered proprietor may apply to the High Court by Originating Summons for an order removing the caveat.',
    legislation: ['NLC 1965 (s.326)', 'Rules of Court 2012 (Order 28 — Originating Summons)'],
    steps: [
      { id: 1, phase: 'Failed Section 322', label: 'Confirm S.322 Process Has Been Exhausted', timeframe: 'After 14 days of s.322 notice', legalBasis: 'NLC s.322', tip: 'Where the caveator has commenced court action within 14 days, the caveat continues and this court process is for the proprietor to defend/strike out the caveator\'s action. Where the caveator did not commence action, the caveat should have lapsed automatically.' },
      { id: 2, phase: 'Filing', label: 'File Originating Summons at High Court (s.326 Application)', timeframe: 'Day 1–7', legalBasis: 'NLC s.326; Rules of Court 2012', tip: 'Where s.322 has not been served (or where the caveat continues despite the process), the registered proprietor may directly apply to court under s.326 NLC for removal of any caveat that is wrongfully lodged.' },
      { id: 3, phase: 'Hearing', label: 'High Court Hearing — Balance of Convenience', timeframe: 'Month 1–6', legalBasis: 'NLC s.326', tip: 'The court applies the balance of convenience test. If the caveatable interest is clearly established, the court will not remove the caveat. If the caveator\'s interest is doubtful or there is no proper interest, the court removes the caveat and may award damages under s.329.' },
      { id: 4, phase: 'Order', label: 'Court Order — Removal of Caveat & Damages if Applicable', timeframe: 'After hearing', legalBasis: 'NLC s.326 & s.329', tip: 'A successful application results in an order removing the caveat. The court may also order damages against the caveator under s.329 if the caveat was lodged wrongfully and caused loss.' }
    ]
  },
  {
    id: 'CAV-06',
    title: 'Caveat by Beneficiary Under Trust or Will', 
    category: 'Caveats',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'A beneficiary under a trust, will, or resulting/constructive trust who claims a caveatable interest in specific land may enter a private caveat to protect their equitable interest, preventing the registered proprietor (or trustee) from dealing with the title.',
    legislation: ['NLC 1965 (s.323)', 'Trustee Act 1949', 'Probate & Administration Act 1959'],
    steps: [
      { id: 1, phase: 'Identify Interest', label: 'Confirm Caveatable Interest Under Trust / Will / Equity', timeframe: 'Day 1', legalBasis: 'NLC s.323; equity', tip: 'The beneficiary\'s interest under a trust or will constitutes an equitable interest in the land — a valid caveatable interest. However, a mere contractual right (e.g. right to future legacy) is insufficient.' },
      { id: 2, phase: 'Lodge Caveat', label: 'Lodge Form 19B at Land Office', timeframe: 'Day 1', legalBasis: 'NLC s.323', tip: 'The caveat should state the nature of the claimed interest specifically: e.g. "I am the sole beneficiary under the Will of [deceased] dated [date], which bequeaths the said land to me."', documents: [{ id: 'cav06-d1', title: 'Private Caveat — Beneficiary Under Trust', type: 'form', note: 'Caveat lodged by a beneficiary claiming an equitable interest in land under a trust or will.', sample: 'ENTRY OF PRIVATE CAVEAT (BENEFICIARY UNDER TRUST/WILL)\n\nFORM 19B\n\nTO THE REGISTRAR OF TITLES:\n\nI/We, [CAVEATOR FULL NAME] (NRIC: [No]) of [Address],\n\nHEREBY CLAIM an interest in the land described below as a beneficiary under:\n[   ] The Will of [Deceased Name] dated [Date]\n[   ] A Trust Agreement dated [Date]\n[   ] An Implied / Resulting / Constructive Trust arising from my financial contribution of RM [Amount] to the purchase of the said land on [Date]\n\nand apply for the entry of a Private Caveat:\n\nTitle No: [Geran/QT No], Lot [No], Mukim [Name], State [Name]\n\nI seek the protection of this caveat to prevent any dealing with the title that would defeat my beneficial interest.\n\nDATE: ____________________\n________________________________\nSignature of Caveator / Solicitor' }] }
    ]
  },

  // ─── TENANCY & LEASE (Additional) ─────────────────────────────
  {
    id: 'TEN-03',
    title: 'Commercial Lease Agreement — Shop/Office Premises',
    category: 'Tenancy & Lease',
    difficulty: 'Intermediate',
    duration: '2–4 weeks',
    summary: 'A commercial lease for shop/office premises involves more complex terms than a residential tenancy — typically longer term (3–6 years), larger deposits, more detailed obligations for renovation, and clear provisions for rental reviews.',
    legislation: ['Contracts Act 1950', 'Stamp Act 1949', 'NLC 1965 (if lease > 3 years — registration as Form 15A)', 'Distress Act 1951'],
    steps: [
      { id: 1, phase: 'Heads of Terms', label: 'Agree on Heads of Terms / Term Sheet', timeframe: 'Day 1–7', legalBasis: 'Contracts Act 1950', tip: 'Key commercial terms to agree before drafting: (1) Term (3 or 6 years), (2) Rental (plus service charge), (3) Security deposit (3 months typical), (4) Utility deposit, (5) Rent-free fitout period, (6) Rental review mechanism, (7) Diplomatic clause.' },
      { id: 2, phase: 'Drafting', label: 'Draft Commercial Lease & Negotiate Lease Covenants', timeframe: 'Day 7–14', legalBasis: 'Contracts Act 1950; common law', tip: 'Key commercial lease clauses: user clause (permitted use), alterations clause (landlord consent), repair covenants, assignment/sub-letting prohibition, break clause, option to renew, dilapidations.', documents: [{ id: 'ten03-d1', title: 'Commercial Lease Agreement', type: 'template', note: 'The principal agreement governing the commercial landlord-tenant relationship.', sample: 'COMMERCIAL LEASE AGREEMENT\n\nDate: [Date]\n\nBETWEEN:\n[LANDLORD NAME / COMPANY] ("the Landlord")\nAND\n[TENANT NAME / COMPANY] ("the Tenant")\n\nPREMISES: [Full address and description of commercial premises]\n\n1. TERM\n   A term of [3/6] years commencing on [Date] and expiring on [Date].\n\n2. RENT\n   Monthly rental of RM [Amount], payable in advance on the first day of each month.\n   Rental Review: The rental shall be reviewed at the [third] anniversary of the commencement date. The new rental shall be the then-prevailing market rental or the existing rental, whichever is higher.\n\n3. DEPOSITS\n   (a) Security Deposit: RM [Amount] (equivalent to [3] months\' rental)\n   (b) Utility Deposit: RM [Amount]\n\n4. PERMITTED USE\n   The Tenant shall use the Premises solely for [describe permitted use, e.g. restaurant operations] and for no other purpose without the Landlord\'s prior written consent.\n\n5. ALTERATIONS\n   The Tenant shall not carry out any alterations, additions, or renovation to the Premises without the prior written approval of the Landlord and the relevant authorities.\n\n6. ASSIGNMENT & SUB-LETTING\n   The Tenant shall not assign, sub-let, or part with possession of the Premises or any part thereof without the Landlord\'s prior written consent.\n\n7. OPTION TO RENEW\n   Subject to Clause 8, the Tenant shall have an option to renew this lease for a further term of [3] years on the same terms and conditions (except for rental, which shall be reviewed to market rate) by giving the Landlord not less than [3] months\' written notice before expiry.\n\n[Additional covenants — repair, insurance, quit rent/assessment, utilities, dilapidations, re-entry]' }] },
      { id: 3, phase: 'Registration (if > 3 years)', label: 'Register Lease at Land Office (Form 15A) if Term Exceeds 3 Years', timeframe: 'Day 14–60', legalBasis: 'NLC s.221 (Form 15A)', tip: 'A lease for more than 3 years is a registrable dealing and must be registered at the Land Office using Form 15A. Unregistered leases of more than 3 years operate as equitable leases only.' },
      { id: 4, phase: 'Stamping', label: 'Stamp the Lease Agreement (LHDN)', timeframe: 'Within 30 days', legalBasis: 'Stamp Act 1949', tip: 'Stamp duty on commercial leases: RM1 per RM250 of the annual rental in excess of RM2,400 per year (for leases up to 3 years). Higher rates for leases over 3 years.' }
    ]
  },
  {
    id: 'TEN-04',
    title: 'Distress Action — Writ of Distress for Rental Arrears',
    category: 'Tenancy & Lease',
    difficulty: 'Intermediate',
    duration: '1–3 months',
    summary: 'The Distress Act 1951 provides landlords with a powerful self-help remedy — the Writ of Distress — which allows a court bailiff to seize and sell a tenant\'s goods found on the rented premises to satisfy outstanding rental arrears, without commencing a full lawsuit.',
    legislation: ['Distress Act 1951', 'Rules of Court 2012', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'Arrears', label: 'Quantify Outstanding Rental Arrears (Maximum 12 Months)', timeframe: 'Day 1', legalBasis: 'Distress Act 1951 — s.7', tip: 'A Writ of Distress can only be issued for arrears of rental not exceeding 12 months. Compute the precise amount due (excluding any disputed sums).' },
      { id: 2, phase: 'Application', label: 'Apply for Writ of Distress at Magistrates\' Court / Sessions Court', timeframe: 'Day 1–7', legalBasis: 'Distress Act 1951 — s.4', tip: 'File: (1) Application (Penyaksian) in prescribed form, (2) Tenancy agreement, (3) Statement of arrears, (4) Court filing fee. The court may issue the Writ ex parte (without prior notice to the tenant).', documents: [{ id: 'ten04-d1', title: 'Application for Writ of Distress', type: 'letter', note: 'Accompanying letter and supporting documents for the Writ of Distress application.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nThe Registrar\nMagistrate\'s Court / Sessions Court\n[Court Address]\n\nDear Sir/Madam,\n\nAPPLICATION FOR WRIT OF DISTRESS\nPursuant to the Distress Act 1951\n\nLandlord: [Name, Address]\nTenant: [Name, Address]\nPremises: [Property Address]\nTenancy Agreement Date: [Date]\n\nWe act for [Landlord Name] ("the Landlord") in the above matter.\n\nThe Tenant has failed to pay the following rental:\nMonth of [__________]: RM [Amount]\nMonth of [__________]: RM [Amount]\nTOTAL OUTSTANDING: RM [Amount]\n\nWe hereby apply for a Writ of Distress to be issued to the Court Bailiff to seize and sell the Tenant\'s goods found on the said premises sufficient to satisfy the sum of RM [Amount] being [X] months\' rental arrears.\n\nEnclosed:\n1. Tenancy Agreement (CTC)\n2. Statement of Rental Arrears\n3. Court filing fee of RM [Amount]\n\nYours faithfully,\n[Solicitor]' }] },
      { id: 3, phase: 'Execution', label: 'Court Bailiff Executes the Writ — Seizes Tenant\'s Goods', timeframe: 'Day 7–14', legalBasis: 'Distress Act 1951 — s.5', tip: 'The bailiff enters the premises with the Writ and seizes the tenant\'s goods (excluding exempt items — clothes, tools of trade up to RM100). The tenant has 5 days to pay the arrears before the goods are sold.' },
      { id: 4, phase: 'Sale', label: 'Goods Sold if Arrears Not Paid Within 5 Days', timeframe: 'Day 7–21', legalBasis: 'Distress Act 1951 — s.10', tip: 'If the tenant does not pay within 5 days of seizure, the bailiff auctions the goods. Proceeds are applied to arrears + bailiff fees. Any surplus is returned to the tenant. If goods are insufficient, the landlord may sue for the balance.' }
    ]
  },
  {
    id: 'TEN-05',
    title: 'Tenancy Renewal and Options to Renew',
    category: 'Tenancy & Lease',
    difficulty: 'Basic',
    duration: '1–4 weeks',
    summary: 'When a tenancy agreement expires, the parties may renew the tenancy by executing a new agreement or exercising an option to renew (if one was included in the original agreement). Proper renewal documentation prevents the tenancy from lapsing into a "periodic tenancy" or a holding-over situation.',
    legislation: ['Contracts Act 1950', 'Stamp Act 1949', 'Common law on options'],
    steps: [
      { id: 1, phase: 'Notice', label: 'Tenant Exercises Option to Renew (if applicable) Within Prescribed Period', timeframe: '3–6 months before expiry', legalBasis: 'Tenancy Agreement — option clause; Contracts Act 1950', tip: 'An option to renew must be exercised strictly within the timeframe specified in the tenancy agreement. Late exercise of an option may be treated as a lapse of the option.' },
      { id: 2, phase: 'Rental Negotiation', label: 'Agree on New Rental Rate for Renewal Term', timeframe: 'Day 1–14', legalBasis: 'Contracts Act 1950', tip: 'If the option specifies "market rate" rental, an independent rental assessment may be needed. If the parties cannot agree on the new rental, the option to renew may not be capable of specific enforcement unless the mechanism for determining rent is also specified.' },
      { id: 3, phase: 'New Agreement', label: 'Execute New Tenancy Agreement for Renewal Term', timeframe: 'Day 7–14', legalBasis: 'Contracts Act 1950', tip: 'Even if a formal renewal agreement is not executed (parties just continue under the old terms), the tenancy continues as a periodic tenancy on the same terms. However, it is best practice to execute a formal renewal agreement to avoid disputes.', documents: [{ id: 'ten05-d1', title: 'Renewal Letter — Option to Renew Exercise', type: 'letter', note: 'Formal notice by tenant exercising the contractual option to renew the tenancy.', sample: '[Tenant Letterhead]\n\nDate: [Date]\n\nTO: [Landlord Name]\n[Address]\n\nDear Sir/Madam,\n\nEXERCISE OF OPTION TO RENEW TENANCY\nPremises: [Property Address]\nOriginal Tenancy Agreement: [Date]\nExpiry Date: [Date]\n\nPursuant to Clause [X] of the above Tenancy Agreement, we hereby give you formal notice of our intention to exercise the option to renew the tenancy of the above premises for a further term of [X] year(s) commencing [Date].\n\nWe propose the following rental for the renewal term: RM [Amount] per month, subject to your agreement.\n\nWe look forward to your confirmation and to executing the renewal tenancy agreement in due course.\n\nYours sincerely,\n[Tenant\'s Name / Authorised Signatory]' }] },
      { id: 4, phase: 'Stamping', label: 'Stamp the Renewal Agreement', timeframe: 'Within 30 days', legalBasis: 'Stamp Act 1949', tip: 'The renewal agreement is a new instrument and must be stamped separately. No exemption is available on the ground that the original tenancy was already stamped.' }
    ]
  },
  {
    id: 'TEN-06',
    title: 'Recovery of Possession — Summary Procedure (Section 7(2) SRA)',
    category: 'Tenancy & Lease',
    difficulty: 'Intermediate',
    duration: '1–4 months',
    summary: 'Where a tenancy has expired or been validly terminated and the tenant refuses to vacate, the landlord may apply to the Sessions Court for immediate possession under s.7(2) of the Specific Relief Act 1950 — a faster route than filing a full writ action.',
    legislation: ['Specific Relief Act 1950 (s.7(2))', 'Rules of Court 2012 (Order 89)', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'Notice to Quit', label: 'Serve Notice to Quit on Tenant / Trespasser', timeframe: 'Day 1', legalBasis: 'Common law; tenancy agreement', tip: 'For periodic tenancies, a notice to quit of appropriate length must be served (monthly tenancy = 1 month notice; annual tenancy = 6 months notice). For a fixed term that has expired, no notice to quit is legally required but it is good practice.', documents: [{ id: 'ten06-d1', title: 'Notice to Quit', type: 'letter', note: 'Formal notice to the tenant/occupier to vacate the premises.', sample: '[Landlord / Firm Letterhead]\n\nDate: [Date]\n\nTO: [Tenant / Occupier Name]\n[Property Address]\n\nDear Sir/Madam,\n\nNOTICE TO QUIT\n\nWe act for [Landlord Name], the owner of the above premises ("the Premises").\n\nYOU ARE HEREBY GIVEN NOTICE to vacate and yield up possession of the Premises by [Date] (being [X] days/months from the date of this notice).\n\nUpon the said date, your right (if any) to occupy the Premises shall cease and determine, and you are required to deliver up vacant possession of the Premises to our client in good repair and condition (fair wear and tear excepted).\n\nFailing which, our client shall, without further notice, commence legal proceedings for possession and damages.\n\nYours faithfully,\n[Solicitor / Landlord]' }] },
      { id: 2, phase: 'Application', label: 'File Originating Summons Under s.7(2) SRA at Sessions Court', timeframe: 'Day 14+', legalBasis: 'SRA 1950 s.7(2); Rules of Court 2012 Order 89', tip: 'File: (1) Originating Summons, (2) Affidavit in Support (with title search, tenancy agreement, notice to quit), (3) Court fees. The application can be heard relatively quickly compared to a full trial.' },
      { id: 3, phase: 'Hearing', label: 'Sessions Court Hearing — Order for Possession', timeframe: 'Month 1–3', legalBasis: 'SRA 1950 s.7(2)', tip: 'The court may grant immediate possession order if the landlord establishes: (1) expiry or valid termination of tenancy, (2) demand for possession, (3) tenant\'s refusal to vacate. A stay may be granted by the court if the tenant raises a genuine dispute about the termination.' },
      { id: 4, phase: 'Writ of Possession', label: 'Enforce Possession via Writ of Possession (Court Bailiff)', timeframe: 'After order', legalBasis: 'Rules of Court 2012', tip: 'If the tenant still refuses to vacate after the court order, a Writ of Possession is issued to the Court Bailiff to physically enforce possession. Any goods left behind must be handled carefully to avoid conversion claims.' }
    ]
  },

  // ─── FORECLOSURE & AUCTION (Additional) ──────────────────────
  {
    id: 'FC-03',
    title: 'Setting Aside Order for Sale — Chargor\'s Defences',
    category: 'Foreclosure & Auction',
    difficulty: 'Advanced',
    duration: '6–18 months',
    summary: 'A chargor who has suffered an Order for Sale may apply to set it aside on limited grounds — primarily where there is clear evidence the chargor was not in default (mistake in account), the bank failed to give proper notice, or there were procedural irregularities in the application.',
    legislation: ['Rules of Court 2012 (Order 83 r.5; Order 42 r.6)', 'NLC 1965 (s.256)', 'Contracts Act 1950'],
    steps: [
      { id: 1, phase: 'Grounds Review', label: 'Assess Grounds for Setting Aside Order for Sale', timeframe: 'Immediately upon knowledge of Order', legalBasis: 'Rules of Court 2012 — Order 83; Order 42 r.6', tip: 'Limited grounds to set aside: (1) no default (bank error in account), (2) bank failed to give proper demand notice, (3) procedural irregularity (no proper service), (4) Order obtained by fraud/misrepresentation, (5) chargor has paid off arrears since the Order. Financial hardship alone is NOT a ground.' },
      { id: 2, phase: 'Application', label: 'File Summons to Set Aside Order for Sale', timeframe: 'Urgently — before auction date', legalBasis: 'Rules of Court 2012 — Order 42 r.6', tip: 'Apply for a STAY of the auction simultaneously with the application to set aside. The court may grant a stay to preserve the status quo pending the hearing.' },
      { id: 3, phase: 'Hearing', label: 'High Court Hearing on Application to Set Aside', timeframe: 'Month 1–6', legalBasis: 'Rules of Court 2012 — Order 83 r.5', tip: 'The burden is on the chargor to show grounds. The court is very reluctant to set aside if there is clear default.' },
      { id: 4, phase: 'Conditional Order', label: 'Conditional Stay — Chargor to Remedy Default Within Time', timeframe: 'Upon court order', legalBasis: 'Courts inherent jurisdiction', tip: 'Courts may grant a conditional stay (e.g. if the chargor pays all arrears plus costs within 30 days, the Order for Sale is set aside; otherwise, the auction proceeds). This is the most common outcome where there is some genuine basis for the application.' }
    ]
  },
  {
    id: 'FC-04',
    title: 'Auction Sale — Procedures and Bidder\'s Checklist',
    category: 'Foreclosure & Auction',
    difficulty: 'Intermediate',
    duration: '1 day (plus preparation)',
    summary: 'A comprehensive guide for potential bidders at a court-ordered property auction, covering pre-auction due diligence, auction procedures, and immediate post-auction obligations.',
    legislation: ['Rules of Court 2012 — Order 83', 'Proclamation of Sale conditions', 'NLC 1965 (s.258)'],
    steps: [
      { id: 1, phase: 'Pre-Auction Research', label: 'Conduct Comprehensive Pre-Auction Due Diligence', timeframe: 'Before auction date', legalBasis: 'Proclamation of Sale — "As Is Where Is"', tip: 'CRITICAL: Properties are sold "as is where is" — no warranties. Due diligence: (1) Official title search (outstanding charges, caveats), (2) Valuation / site visit, (3) Outstanding quit rent and assessment (unpaid amounts may encumber the new owner), (4) Outstanding maintenance charges (strata), (5) Existing tenancy or occupation, (6) Reserve price vs market value analysis.' },
      { id: 2, phase: 'Auction Registration', label: 'Register as Bidder & Deposit 10% of Reserve Price', timeframe: 'Auction day — before bidding', legalBasis: 'Proclamation of Sale', tip: 'The 10% deposit is typically by banker\'s cheque or cashier\'s order made in favour of the court. Without a registered deposit, you cannot bid. Unsuccessful bidders receive their deposit back immediately after the auction.' },
      { id: 3, phase: 'Bidding', label: 'Participate in Auction — Highest Bidder Takes the Property', timeframe: 'Auction day', legalBasis: 'Proclamation of Sale; Rules of Court 2012', tip: 'Know your maximum bid before attending. Have a clear exit price — auctions can be emotional. Bidding above the true market value is a common mistake at property auctions.' },
      { id: 4, phase: 'Post-Auction', label: 'Pay Additional 15% (to Reach 25%) Immediately After Winning', timeframe: 'Immediately after auction', legalBasis: 'Proclamation of Sale', tip: 'Most Proclamations of Sale require the successful bidder to top up from 10% to 25% of the purchase price on the same day as the auction. The remaining 75% must be paid within 120 days (extendable with court permission).' }
    ]
  },

  // ─── SPECIAL & COMMERCIAL TRANSACTIONS (Additional) ──────────
  {
    id: 'SP-04',
    title: 'Compulsory Acquisition — Objection and Compensation Appeal',
    category: 'Special & Commercial Transactions',
    difficulty: 'Advanced',
    duration: '6–36 months',
    summary: 'A landowner whose land is compulsorily acquired under the Land Acquisition Act 1960 has the right to object to the acquisition and/or to appeal against the compensation awarded by the Collector, if the compensation is inadequate.',
    legislation: ['Land Acquisition Act 1960 (s.8–s.29)', 'Rules of Court 2012'],
    steps: [
      { id: 1, phase: 'Notice of Acquisition', label: 'Receive Notice Under s.4 LA Act & s.8 (Declaration)', timeframe: 'Day 1', legalBasis: 'LA Act 1960 — s.4 & s.8', tip: 'Once the s.8 Declaration is gazetted, the acquisition is legally final. Challenge the public purpose if there is genuine doubt. File a written objection to the Collector within the period specified in the Notice.' },
      { id: 2, phase: 'Inquiry', label: 'Attend the Collector\'s Inquiry on Compensation (s.12 LA Act)', timeframe: 'Upon Collector\'s notice', legalBasis: 'LA Act 1960 — s.12', tip: 'The Collector holds a formal inquiry to determine the amount of compensation. The landowner (and any other interested parties) may appear, give evidence, and call valuation witnesses. Engage a professional valuer to provide expert evidence on market value.' },
      { id: 3, phase: 'Collector\'s Award', label: 'Collector Issues Award — Landowner Evaluates Adequacy', timeframe: 'After inquiry', legalBasis: 'LA Act 1960 — s.14', tip: 'If the landowner accepts the Award, payment is received and the matter is closed. If inadequate, the landowner may appeal to the High Court within 6 weeks of the Award.' },
      { id: 4, phase: 'High Court Appeal', label: 'Appeal to High Court for Enhanced Compensation', timeframe: 'Within 6 weeks of Award', legalBasis: 'LA Act 1960 — s.37', tip: 'The appeal is heard by the High Court sitting as the Land Reference Court. Expert valuation evidence is critical. The court can increase (but also decrease) the Collector\'s Award. The government may cross-appeal if the award is too high.' }
    ]
  },
  {
    id: 'SP-05',
    title: 'Amalgamation of Land Lots',
    category: 'Special & Commercial Transactions',
    difficulty: 'Advanced',
    duration: '12–36 months',
    summary: 'Amalgamation is the combining of two or more adjacent lots (held by the same proprietor) into a single lot with a single title. This is the reverse of subdivision and is typically done to facilitate development of a larger unified site.',
    legislation: ['NLC 1965 (s.148–s.153)', 'Town and Country Planning Act 1976', 'Street, Drainage and Building Act 1974'],
    steps: [
      { id: 1, phase: 'Eligibility Check', label: 'Confirm Lots Are Adjacent, Same Proprietor & Same Category', timeframe: 'Day 1', legalBasis: 'NLC s.148', tip: 'Conditions for amalgamation: (1) lots must be adjacent/contiguous, (2) same registered proprietor for all lots, (3) same category of land use, (4) same or compatible express conditions. Lots with different charges or caveats complicate the process.' },
      { id: 2, phase: 'Survey', label: 'Commission Cadastral Survey for Amalgamated Lot', timeframe: 'Month 3–12', legalBasis: 'NLC s.149', tip: 'A licensed surveyor prepares the survey plan for the new amalgamated lot. The survey must be approved by the Director of Survey and Mapping Malaysia (JUPEM).' },
      { id: 3, phase: 'Application', label: 'File Application for Amalgamation at PTG/PTD', timeframe: 'After survey approval', legalBasis: 'NLC s.148 (Form Application)', tip: 'Submit: (1) Application letter, (2) Approved survey plans, (3) All existing titles (IDTs), (4) Consent of all chargees and caveators, (5) Application fees.' },
      { id: 4, phase: 'New Title', label: 'Surrender of Old Titles & Issuance of New Combined Title', timeframe: 'Month 12–36', legalBasis: 'NLC s.151 & s.153', tip: 'The old individual titles are cancelled and a single new title is issued for the amalgamated lot. All existing charges and caveats on the individual lots must be dealt with (discharged or transferred to the new title) before amalgamation can be completed.' }
    ]
  },
  {
    id: 'SP-06',
    title: 'RPGT — Real Property Gains Tax Compliance in Property Sales',
    category: 'Special & Commercial Transactions',
    difficulty: 'Intermediate',
    duration: '1–6 months',
    summary: 'Real Property Gains Tax (RPGT) is a tax on profits from the disposal of real property or shares in a real property company. Every property sale must be assessed for RPGT liability. The vendor and purchaser both have obligations under the RPGT Act.',
    legislation: ['Real Property Gains Tax Act 1976 (RPGTA)', 'Finance Acts (amendments — RPGT rates)', 'LHDN (Inland Revenue Board) regulations'],
    steps: [
      { id: 1, phase: 'Determine Rate', label: 'Calculate RPGT Liability Based on Holding Period & Vendor Status', timeframe: 'Before SPA or upon entering SPA', legalBasis: 'RPGTA 1976 — Schedule 5', tip: 'RPGT rates (as of 2024): Citizens/PRs: 0% if held >5 years; 5% if held in year 6+. Companies/foreigners: 10% if held >5 years; higher for shorter periods. Exemptions: Principal place of residence exemption (once in lifetime), gifts between spouses/parents/children (exempt).' },
      { id: 2, phase: 'Retention', label: 'Purchaser Retains 3% of Purchase Price as RPGT Withholding', timeframe: 'At completion', legalBasis: 'RPGTA 1976 — s.21B', tip: 'The purchaser MUST retain 3% of the purchase price from the balance payment and remit it to LHDN on behalf of the vendor within 60 days of the disposal. Failure by the purchaser to retain makes the purchaser jointly and severally liable for the RPGT.' },
      { id: 3, phase: 'RPGT Declaration', label: 'Vendor Files RPGT Declaration Form (CKHT 1A) Within 60 Days', timeframe: 'Within 60 days of disposal', legalBasis: 'RPGTA 1976 — s.13', tip: 'The vendor files CKHT 1A (disposal declaration). The purchaser also files CKHT 2A (acquisition declaration). Both must be filed with LHDN within 60 days of the disposal date.', documents: [{ id: 'sp06-d1', title: 'Retention Remittance Letter to LHDN', type: 'letter', note: 'Letter accompanying the 3% RPGT withholding remittance by the purchaser to LHDN.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nKetua Pengarah Hasil Dalam Negeri\nLembaga Hasil Dalam Negeri Malaysia\n[Address]\n\nDear Sir/Madam,\n\nREMITTANCE OF REAL PROPERTY GAINS TAX WITHHOLDING\nPursuant to Section 21B of the Real Property Gains Tax Act 1976\n\nProperty: [Address, Title No]\nVendor: [Name, NRIC]\nPurchaser: [Name, NRIC]\nDisposal Date: [Date]\nPurchase Price: RM [Amount]\n3% Withholding Amount: RM [Amount]\n\nWe act for [Purchaser Name] in the above property transaction. Pursuant to s.21B RPGTA 1976, we hereby remit to LHDN the sum of RM [Amount] being 3% of the purchase price of RM [Amount], being the withholding amount retained from the balance purchase price payable to the Vendor.\n\nEnclosed: Banker\'s Cheque No [      ] for RM [Amount] payable to "Ketua Pengarah Hasil Dalam Negeri."\n\nYours faithfully,\n[Solicitor]' }] },
      { id: 4, phase: 'LHDN Assessment', label: 'LHDN Assesses RPGT — Vendor Pays or Receives Refund', timeframe: 'Month 3–12', legalBasis: 'RPGTA 1976', tip: 'If the vendor is exempt or the actual RPGT is less than 3%, LHDN issues a refund of the excess withheld. If the actual RPGT exceeds 3%, the vendor pays the shortfall. Keep all documents (original SPA, receipts, improvement costs) to support deductions.' }
    ]
  },
  {
    id: 'SP-07',
    title: 'Transfer Between Spouses — Stamp Duty Exemption',
    category: 'Special & Commercial Transactions',
    difficulty: 'Basic',
    duration: '2–4 months',
    summary: 'A transfer of property between husband and wife (or pursuant to a court order upon divorce) may qualify for a full stamp duty exemption on the Form 14A. This provides a cost-effective mechanism for restructuring matrimonial property ownership.',
    legislation: ['Stamp Act 1949 (Exemption Order — husband/wife transfers)', 'Law Reform (Marriage and Divorce) Act 1976', 'NLC 1965 (s.215)', 'RPGTA 1976 (exemption for inter-spouse gifts)'],
    steps: [
      { id: 1, phase: 'Eligibility', label: 'Confirm Eligibility for Stamp Duty Exemption — Valid Marriage', timeframe: 'Day 1', legalBasis: 'Stamp Act 1949 Exemption; Stamp Duty (Exemption) Order', tip: 'Full exemption applies to transfers between spouses pursuant to a love and affection arrangement (gift) or court order in divorce. A marriage certificate is required. The exemption covers the Memorandum of Transfer but NOT the loan agreement stamp duty if a loan is involved.' },
      { id: 2, phase: 'Consent of Chargee', label: 'Obtain Bank\'s Consent to Transfer if Property is Charged', timeframe: 'Day 7–30', legalBasis: 'NLC; Loan Agreement', tip: 'If the property is charged to a bank, the bank\'s consent is required before the transfer can be registered. The transferee spouse must assume the loan or the bank may require full redemption.' },
      { id: 3, phase: 'Form 14A', label: 'Execute Form 14A — "Natural Love and Affection" Consideration', timeframe: 'Day 7–21', legalBasis: 'NLC s.215; Contracts Act 1950 s.26(b)', tip: 'State the consideration as "natural love and affection" — this is a valid consideration under s.26(b) Contracts Act for transfers between spouses.' },
      { id: 4, phase: 'Stamp & Register', label: 'Present for Stamp Duty Adjudication — Attach Marriage Certificate', timeframe: 'Day 21–60', legalBasis: 'Stamp Act 1949', tip: 'Submit the Form 14A to LHDN for stamp duty adjudication with the marriage certificate and a declaration that the transfer is between spouses by way of love and affection. LHDN will confirm the exemption and the Form 14A is stamped at nil or nominal duty.' }
    ]
  },

  // ─── LAND OFFICE ADMINISTRATIVE (Additional) ──────────────────
  {
    id: 'LO-05',
    title: 'Conversion of Qualified Title to Final Title',
    category: 'Land Office Administrative',
    difficulty: 'Advanced',
    duration: '2–10 years',
    summary: 'Qualified Titles (QTs) are issued as interim titles pending completion of a full cadastral survey. Once the survey is completed and approved, the QT is converted to a Final Title (Geran Tetap or Geran Mukim). Many older Malaysian titles are still in QT form.',
    legislation: ['NLC 1965 (s.175–s.183)', 'Survey and Mapping Malaysia (JUPEM) regulations'],
    steps: [
      { id: 1, phase: 'Survey', label: 'Commission Licensed Surveyor for Cadastral Survey', timeframe: 'Month 1–12', legalBasis: 'NLC s.176', tip: 'A licensed surveyor (Juruukur Tanah Berlesen) conducts the boundary survey. The survey must confirm the boundaries of the lot as described in the QT. Boundary disputes with neighbours can significantly delay this process.' },
      { id: 2, phase: 'JUPEM Approval', label: 'Submit Survey Plan to JUPEM for Approval', timeframe: 'Month 6–24', legalBasis: 'Survey Act; JUPEM regulations', tip: 'JUPEM (Director of Survey and Mapping Malaysia) must approve the cadastral survey plan. Corrections may be required if the survey does not agree with adjoining surveys.' },
      { id: 3, phase: 'Land Office Application', label: 'Apply for Conversion of QT to Final Title at PTD/PTG', timeframe: 'After JUPEM approval', legalBasis: 'NLC s.179', tip: 'Submit: (1) Application, (2) JUPEM-approved survey plan, (3) Existing QT (IDT), (4) Any consent from chargees or caveators. Application fees are payable.' },
      { id: 4, phase: 'Final Title Issued', label: 'Final Title (Geran) Issued — IDT Exchanged', timeframe: 'Month 24–120', legalBasis: 'NLC s.179 & s.183', tip: 'The QT is cancelled and a new Final Title (Geran) is issued. The land boundaries are now fixed on the cadastral map. Any subsequent subdivision or dealing is more straightforward with a Final Title.' }
    ]
  },
  {
    id: 'LO-06',
    title: 'Land Title Rectification — Correction of Errors',
    category: 'Land Office Administrative',
    difficulty: 'Intermediate',
    duration: '3–12 months',
    summary: 'Errors in a land title (e.g. wrong name, wrong area, wrong lot number, incorrect express conditions) can be corrected through the Land Registrar\'s administrative power of rectification under the NLC, without court proceedings, provided the error is a genuine mistake.',
    legislation: ['NLC 1965 (s.380–s.396)', 'Statutory Declarations Act 1960'],
    steps: [
      { id: 1, phase: 'Identify Error', label: 'Identify the Error in the Title — Obtain Documentary Proof', timeframe: 'Day 1', legalBasis: 'NLC s.380', tip: 'Common errors: misspelling of proprietor\'s name (compare with NRIC), wrong description of area (compare with survey plan), incorrect express conditions, wrong encumbrance details. Gather documents proving the correct particulars.' },
      { id: 2, phase: 'Statutory Declaration', label: 'Proprietor Executes Statutory Declaration Explaining Error', timeframe: 'Day 1–7', legalBasis: 'Statutory Declarations Act 1960; NLC s.380', tip: 'The SD should describe the error clearly, exhibit documentary evidence of the correct information, and confirm the error was not made deliberately.' },
      { id: 3, phase: 'Application', label: 'File Application for Rectification at Land Office', timeframe: 'Day 7–14', legalBasis: 'NLC s.380 & s.381', tip: 'Submit: (1) Application letter, (2) Statutory Declaration, (3) Documentary proof (NRIC for name corrections, survey plan for area corrections), (4) Original IDT, (5) Application fee.', documents: [{ id: 'lo06-d1', title: 'Application for Rectification of Title Error', type: 'letter', note: 'Formal application to the Land Registrar requesting correction of a specified error in the title.', sample: '[Firm Letterhead]\n\nDate: [Date]\n\nPendaftar Hakmilik / Pentadbir Tanah\n[Land Office, State]\n\nDear Sir/Madam,\n\nPERMOHONAN PEMBETULAN KESILAPAN DALAM DOKUMEN HAKMILIK TANAH\nDi Bawah Seksyen 380 Kanun Tanah Negara 1965\n\nTitle No: [Geran/QT No], Lot [No], Mukim [Name], Daerah [Name], [State]\nProprieter: [Name]\n\nWe act for [Proprietor Name] ("the Applicant") in the above matter.\n\nThere is a [typographical / clerical] error in the above title as follows:\n\nERROR: [Describe error, e.g. Proprietor\'s name is recorded as "AHMAD BIN HUSSIN" but the correct name as per NRIC No [    ] is "AHMAD BIN HUSSAIN"]\n\nCORRECT PARTICULARS: [State correct information]\n\nWe attach in support:\n1. Statutory Declaration by the Applicant\n2. [Supporting document, e.g. certified copy of NRIC]\n3. Original Issue Document of Title\n\nWe respectfully request that the Land Registrar exercise the power under s.380 NLC to rectify the said error in the title register and issue a corrected IDT.\n\nYours faithfully,\n[Solicitor]' }] },
      { id: 4, phase: 'Rectification', label: 'Registrar Rectifies Title Register — Corrected IDT Issued', timeframe: 'Month 1–6', legalBasis: 'NLC s.380–s.382', tip: 'If the Registrar is satisfied the error is a genuine mistake, rectification is made in the register. A new (corrected) IDT is issued. If the error is disputed, a court order may be required under s.384 NLC.' }
    ]
  }
];
