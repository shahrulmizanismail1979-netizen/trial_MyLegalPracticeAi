export interface FormDoc {
  id: string;
  formNumber: string;
  name: string;
  nameMs: string;
  category: string;
  legalBasis: string;
  purpose: string;
  whoUses: string;
  keyFields: string[];
  stampDuty: string;
  timeline: string;
  importantNotes: string[];
  sample: string;
}

export const FORM_CATEGORIES = [
  'Agreements & Deeds',
  'NLC Land Dealings',
  'Caveats',
  'HDA / Developer',
  'RPGT / LHDN',
  'Financing',
  'Letters & Undertakings',
];

export const FORMS_LIBRARY: FormDoc[] = [
  {
    id: 'form-14a',
    formNumber: 'Form 14A',
    name: 'Memorandum of Transfer',
    nameMs: 'Memorandum Pindahmilik',
    category: 'NLC Land Dealings',
    legalBasis: 'Section 215, National Land Code 1965',
    purpose: 'The principal instrument used to effect a transfer of ownership (title) from one person (the Transferor/Vendor) to another (the Transferee/Purchaser). It is the equivalent of a deed of conveyance in old-system title countries.',
    whoUses: 'Conveyancing solicitor on behalf of the Purchaser (Transferee). The form is executed by the Vendor (Transferor) and attested by an Advocate & Solicitor.',
    keyFields: ['Full name and NRIC/Passport of Transferor and Transferee', 'Title Number (Geran/QT No.), Lot No., Mukim, District, State', 'Land area (in square metres or hectares)', 'Consideration (purchase price in figures and words)', 'Date of execution', 'Attestation by licensed Advocate & Solicitor', 'Solicitor\'s Bar Council roll number'],
    stampDuty: 'Ad valorem stamp duty based on purchase price: 1% on first RM100,000; 2% on next RM400,000; 3% on next RM500,000; 4% on amount exceeding RM1,000,000. First home exemptions may apply.',
    timeline: 'Must be presented to the Land Registry within 3 months of the date of the SPA (for practical purposes); ideally presented on the day of or within days of completion.',
    importantNotes: [
      'Must be printed on A3 paper (double-sided) per PTG/JTG circular in most states.',
      'Attestation CANNOT be done by a Commissioner for Oaths alone — must be an Advocate & Solicitor.',
      'A priority search MUST be conducted on the day of presentment before lodgement.',
      'If land has a restriction in interest, state consent must be obtained BEFORE the form is executed.',
      'For strata properties, confirm the parcel number matches the strata plan exactly.',
      'RPGT clearance (or CKHT exemption) must be obtained from LHDN before registration will proceed in many states.',
    ],
    sample: `MEMORANDUM OF TRANSFER
(Pursuant to Section 215, National Land Code 1965)

FORM 14A

TO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:
Pejabat Tanah dan Galian [State]

I/We, [VENDOR FULL NAME AS IN IC]
NRIC No.: [         ]
Address:  [         ]

being the registered proprietor of the land described below,

HEREBY TRANSFER to:

[PURCHASER FULL NAME AS IN IC]
NRIC No.: [         ]
Address:  [         ]

ALL the land known as:

Title No.:    [GERAN / QUALIFIED TITLE NO.]
Lot No.:      [         ]
Mukim/Pekan:  [         ]
Daerah:       [         ]
Negeri/State: [         ]
Land Area:    [         ] square metres / hectares

Category of Land Use:   [Agricultural / Building / Industry]
Express Condition:      [If any]
Restriction in Interest:[If any]

For the consideration of RINGGIT MALAYSIA [AMOUNT IN WORDS]
(RM [AMOUNT IN FIGURES]) only.

Subject to the conditions endorsed on the title and any restriction
in interest noted thereon.

Dated this ___ day of _____________ , 20____.

_________________________________
Signature of Transferor (Vendor)
[Full Name in Capital Letters]

ATTESTATION:
I, [SOLICITOR FULL NAME], an Advocate & Solicitor of the
High Court of Malaya (Bar Council Roll No: [         ]),
HEREBY CERTIFY that on the ___ day of ____________, 20____,
the above-named Transferor personally appeared before me and
acknowledged the execution of this instrument.

_________________________________
Advocate & Solicitor
[Firm Name, Address & Telephone]

[FOR LAND REGISTRY USE ONLY]
Received for registration at _____ on [Date]
Presentation No.: _________________
Registrar of Titles / Administrator of Lands`,
  },
  {
    id: 'form-16a',
    formNumber: 'Form 16A',
    name: 'Memorandum of Charge',
    nameMs: 'Memorandum Cagaran',
    category: 'NLC Land Dealings',
    legalBasis: 'Section 241, National Land Code 1965',
    purpose: 'Creates a legal charge (similar to a mortgage in common law jurisdictions) over alienated land in favour of a bank or other lender to secure the repayment of a loan. The Chargor remains the registered proprietor but the Chargee (bank) holds the security interest.',
    whoUses: 'Conveyancing solicitor acting for the bank (Chargee). Executed by the Chargor (borrower/owner) and attested by a solicitor.',
    keyFields: ['Name and NRIC of Chargor (borrower)', 'Name and registration number of Chargee (bank)', 'Title details (same as Form 14A)', 'Loan/principal sum secured', 'Interest rate and loan tenure', 'Terms of charge (cross-reference to Loan Agreement)', 'Date of execution', 'Solicitor\'s attestation'],
    stampDuty: 'Ad valorem stamp duty: 0.5% of the loan amount (charged on the Loan Agreement, of which the charge is an accessory). Form 16A itself: RM10 flat (in practice, duty is computed on the Loan Agreement).',
    timeline: 'Presented to the Land Office simultaneously with Form 14A (MOT) on completion, or shortly thereafter.',
    importantNotes: [
      'A charge is only effective upon registration — an unregistered charge does not give the bank priority.',
      'The bank holds the original IDT as custodian while the charge is registered.',
      'A second charge (Form 16A for second loan) requires the first chargee\'s consent in some cases.',
      'Islamic financing creates a charge in the same form — the underlying contract is Islamic but the NLC security instrument is the same.',
      'If the Chargor does not have legal capacity (minor, bankrupt), the charge is void.',
    ],
    sample: `MEMORANDUM OF CHARGE
(Pursuant to Section 241, National Land Code 1965)

FORM 16A

I/We, [CHARGOR FULL NAME]
NRIC No.:  [         ]
Address:   [         ]
("the Chargor")

HEREBY CHARGE the land described below to:

[BANK / LENDER NAME]
(Company Registration No.: [         ])
[Bank Address]
("the Chargee")

as security for the repayment of the principal sum of
RINGGIT MALAYSIA [LOAN AMOUNT IN WORDS] (RM [FIGURES])
together with interest thereon at the rate of [RATE]% per annum
(or as varied from time to time) in the manner provided in the
Loan Agreement / Letter of Offer dated [DATE].

LAND CHARGED:
Title No.:    [GERAN / QT NO.]
Lot No.:      [         ]
Mukim/Pekan:  [         ]
Daerah:       [         ]
Negeri/State: [         ]

CONDITIONS OF CHARGE:
(1) Principal Sum:     RM [Amount]
(2) Interest Rate:     [Rate]% per annum ([fixed/variable])
(3) Loan Tenure:       [X] years from date of first drawdown
(4) Monthly Payment:   RM [Amount] per month
(5) Default Interest:  [Rate]% per annum above base rate

Dated this ___ day of _____________, 20____.

_________________________________
Signature of Chargor

ATTESTATION:
I, [SOLICITOR NAME], Advocate & Solicitor (Roll No: [   ]),
certify that the Chargor personally appeared and acknowledged
execution of this Memorandum of Charge.

_________________________________
Advocate & Solicitor
[Firm Details]`,
  },
  {
    id: 'form-16n',
    formNumber: 'Form 16N',
    name: 'Discharge of Charge',
    nameMs: 'Pelepasan Cagaran',
    category: 'NLC Land Dealings',
    legalBasis: 'Section 278, National Land Code 1965',
    purpose: 'Executed by the Chargee (bank) to release and discharge a registered charge once the secured loan has been fully repaid. Upon registration, the charge notation is removed from the title and the proprietor holds a clean, unencumbered title.',
    whoUses: 'Executed by the bank (Chargee) upon full repayment of the loan. Submitted to the Land Office by the Chargor\'s or Chargee\'s solicitor.',
    keyFields: ['Name of Chargee (bank) executing the discharge', 'Title details of the charged land', 'Reference to the original charge (presentation number or date)', 'Confirmation that the loan is fully repaid', 'Bank\'s authorised signatory and seal'],
    stampDuty: 'Fixed duty: RM10.',
    timeline: 'Should be executed and submitted within 1–3 months of full repayment. Banks typically take 2–6 weeks to process the discharge documents.',
    importantNotes: [
      'Both the Form 16N and the original IDT must be returned by the bank before registration.',
      'If the bank has been wound up or amalgamated, a corporate resolution or succession documentation is needed.',
      'A partial discharge (for one of several charged properties) uses the same Form 16N but must identify the specific parcel being released.',
      'The Chargee\'s solicitor must conduct an official search before lodgement to confirm the priority of the discharge.',
    ],
    sample: `DISCHARGE OF CHARGE
(Pursuant to Section 278, National Land Code 1965)

FORM 16N

I/We, [BANK NAME]
(Company Registration No.: [         ])
[Bank Address]
("the Chargee")

HEREBY DISCHARGE the Charge registered against the land
described below from all further liability under the
said Charge:

LAND:
Title No.:    [GERAN / QT NO.]
Lot No.:      [         ]
Mukim/Pekan:  [         ]
Daerah:       [         ]
Negeri/State: [         ]

ORIGINAL CHARGE:
Registered on:   [Date of registration]
Presentation No: [No.]
In favour of:    [Bank Name]
Amount secured:  RM [Loan Amount]

We confirm that the above Chargor has fully repaid all
principal, interest, and charges secured by the said Charge
and we hereby consent to the removal of the said Charge
from the title register.

Dated this ___ day of _____________, 20____.

For and on behalf of [BANK NAME]:

_________________________________
Authorised Signatory
[Name & Designation]
[Bank Stamp / Common Seal]`,
  },
  {
    id: 'form-19b',
    formNumber: 'Form 19B',
    name: 'Entry of Private Caveat',
    nameMs: 'Penyertaan Caveat Persendirian',
    category: 'Caveats',
    legalBasis: 'Section 323, National Land Code 1965',
    purpose: 'Entered by a person claiming an interest in land (e.g. purchaser under SPA, beneficiary, lender) to protect that interest by preventing the registered proprietor from completing any further dealing with the land without notice to the caveator.',
    whoUses: 'Any person claiming a caveatable interest in land. In practice, most often lodged by the purchaser\'s solicitor immediately after the SPA is signed to prevent the vendor from double-selling.',
    keyFields: ['Full name and NRIC of Caveator', 'Title details of land affected', 'Nature of interest claimed (must be specific)', 'Grounds of claim (e.g. purchaser under SPA dated...)', 'Signature of Caveator or authorised solicitor', 'Address for service of notices'],
    stampDuty: 'No stamp duty payable.',
    timeline: 'Lodged immediately upon execution of the SPA (or even upon signing of OTP if a caveatable interest exists at that stage).',
    importantNotes: [
      'A caveat lodged without a valid, existing caveatable interest is wrongful and the caveator may be sued for damages.',
      'The caveat remains effective for 6 years from the date of entry, unless earlier withdrawn or removed.',
      'A s.322 Notice can be served by the registered proprietor to force the caveator to commence court action within 14 days or the caveat lapses.',
      'A private caveat does NOT give the caveator ownership — it merely freezes the dealing on the title.',
      'Cannot be lodged against a Registered Proprietor who already has a registered interest — only against dealings yet to be registered.',
    ],
    sample: `ENTRY OF PRIVATE CAVEAT
(Pursuant to Section 323, National Land Code 1965)

FORM 19B

TO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:
[State Land Registry]

I/We, [CAVEATOR FULL NAME]
NRIC No.:  [         ]
Address:   [         ]
("the Caveator")

HEREBY CLAIM an interest in the land described below and
apply for the entry of a Private Caveat to protect that interest.

LAND AFFECTED:
Title No.:   [GERAN / QT NO.]
Lot No.:     [         ]
Mukim:       [         ]
Daerah:      [         ]
Negeri:      [         ]

NATURE OF INTEREST CLAIMED:
I am the Purchaser of the above land under a Sale and Purchase
Agreement dated [DATE] entered into between myself (as Purchaser)
and [VENDOR NAME] (as Vendor) for the purchase price of
RM [AMOUNT]. A deposit of RM [DEPOSIT] has been paid.

My interest as registered purchaser has not yet been registered
on the land register, and I seek the protection of this caveat
to prevent any dealing with the title adverse to my interest.

I undertake to withdraw this caveat when my interest is fully
protected by registration or when directed to do so by the
court or registrar.

Address for service of notices relating to this caveat:
[Caveator's / Solicitor's address]

Dated this ___ day of _____________, 20____.

_________________________________
Signature of Caveator / Authorised Solicitor
[Solicitor's Name & Firm (if applicable)]`,
  },
  {
    id: 'form-19g',
    formNumber: 'Form 19G',
    name: 'Withdrawal of Private Caveat',
    nameMs: 'Penarikan Balik Caveat Persendirian',
    category: 'Caveats',
    legalBasis: 'Section 327, National Land Code 1965',
    purpose: 'Voluntarily removes a private caveat from the title register by the caveator themselves, typically upon completion of the transaction that gave rise to the caveatable interest.',
    whoUses: 'The original caveator or their solicitor. Only the caveator can voluntarily withdraw a caveat — any other party seeking removal must apply to court.',
    keyFields: ['Full name and NRIC of Caveator', 'Title details', 'Date and reference of original caveat entry', 'Reason for withdrawal', 'Signature of Caveator'],
    stampDuty: 'No stamp duty.',
    timeline: 'Lodged immediately upon registration of the transfer or upon completion of the transaction giving rise to the caveat.',
    importantNotes: [
      'Once a caveat is withdrawn, it cannot be re-entered in respect of the same interest.',
      'If you need to maintain protection pending final registration, do NOT withdraw until the transfer is actually registered.',
      'Failure to withdraw a wrongful caveat may expose the caveator to a damages claim by the proprietor.',
    ],
    sample: `WITHDRAWAL OF PRIVATE CAVEAT
(Pursuant to Section 327, National Land Code 1965)

FORM 19G

TO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:

I/We, [CAVEATOR FULL NAME]
NRIC No.: [         ]
Address:  [         ]

being the person(s) on whose application the Private Caveat
entered on the land described below was registered, HEREBY
WITHDRAW the said Private Caveat:

LAND:
Title No.:   [GERAN / QT NO.]
Lot No.:     [         ]
Mukim:       [         ]
Daerah:      [         ]
Negeri:      [         ]

CAVEAT DETAILS:
Date of Entry: [         ]
Caveat Entry No. (if known): [         ]

REASON FOR WITHDRAWAL:
[e.g. "The Memorandum of Transfer (Form 14A) in favour
of the Caveator has been registered on [Date]. The
Caveator's interest is now fully protected by registration
and this caveat is no longer required."]

Dated this ___ day of _____________, 20____.

_________________________________
Signature of Caveator / Authorised Solicitor`,
  },
  {
    id: 'form-14b',
    formNumber: 'Form 14B',
    name: 'Transmission by Personal Representative',
    nameMs: 'Pindahmilik oleh Wakil Diri',
    category: 'NLC Land Dealings',
    legalBasis: 'Section 346, National Land Code 1965',
    purpose: 'Enables an executor (if there is a will) or administrator (if there is no will) to have the deceased\'s land registered in their name as personal representative, so they can subsequently deal with the land on behalf of the estate.',
    whoUses: 'Executor (testate) or Administrator (intestate), supported by a solicitor handling the estate administration.',
    keyFields: ['Name and NRIC of the Personal Representative (Executor/Administrator)', 'Name of Deceased and NRIC', 'Date of death of Deceased', 'Reference to Grant of Probate or Letters of Administration (court case number)', 'Title details of the land', 'List of documents attached'],
    stampDuty: 'Fixed duty: RM10.',
    timeline: 'Filed after the Grant of Probate or Letters of Administration has been obtained from the High Court.',
    importantNotes: [
      'Does not transfer beneficial ownership to the PR — the PR holds the land on trust for the beneficiaries.',
      'The PR can subsequently transfer the land to the beneficiaries by executing Form 14A (an assent).',
      'If the deceased was a joint tenant, Form 14D (survivorship) is used instead.',
      'For small estates (estate below RM2 million), the Small Estates Distribution Act 1955 may offer a faster route through the Land Administrator.',
    ],
    sample: `TRANSMISSION BY PERSONAL REPRESENTATIVE
(Pursuant to Section 346, National Land Code 1965)

FORM 14B

TO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:

I/We, [EXECUTOR/ADMINISTRATOR FULL NAME]
NRIC No.: [         ]
Address:  [         ]
("the Personal Representative")

being the Executor/Administrator of the estate of:

[DECEASED FULL NAME]
NRIC No.: [         ]
(Deceased)

who died on [DATE OF DEATH],

APPLY for the registration of the Transmission of all
right, title and interest of the Deceased in the land
described below in my/our favour as Personal Representative:

LAND:
Title No.:   [GERAN / QT NO.]
Lot No.:     [         ]
Mukim:       [         ]
Daerah:      [         ]
Negeri:      [         ]

AUTHORITY:
Grant of Probate / Letters of Administration granted by the
High Court of [State] in Probate Case No: [         ]
dated [DATE].

Documents attached:
1. Certified copy of Grant of Probate / Letters of Administration
2. Certified copy of Death Certificate
3. Statutory Declaration by Personal Representative
4. Certified copy of NRIC of Personal Representative

Dated this ___ day of _____________, 20____.

_________________________________
Signature of Personal Representative`,
  },
  {
    id: 'form-14d',
    formNumber: 'Form 14D',
    name: 'Transmission by Survivor (Joint Tenancy)',
    nameMs: 'Pindahmilik oleh Penghidupan (Pemegang Bersama)',
    category: 'NLC Land Dealings',
    legalBasis: 'Section 348, National Land Code 1965',
    purpose: 'Removes the name of a deceased joint tenant from the title register, vesting the land automatically in the surviving joint tenant(s) by the doctrine of the Right of Survivorship (jus accrescendi).',
    whoUses: 'Surviving joint tenant(s). No court proceedings are required — this is a relatively simple application to the Land Office.',
    keyFields: ['Name and NRIC of Surviving Joint Tenant(s)', 'Name and NRIC of Deceased Joint Tenant', 'Date of death', 'Title details', 'Death Certificate (attached)'],
    stampDuty: 'Fixed duty: RM10.',
    timeline: 'Can be filed as soon as the death certificate is available. Relatively fast (weeks, not months) compared to probate proceedings.',
    importantNotes: [
      'Only applies to JOINT TENANCY — NOT tenancy in common. Verify the tenancy type on the title before proceeding.',
      'If the title says "Pemegang Bersama" (Joint Tenants) — use Form 14D.',
      'If the title says shares (e.g. "1/2 bahagian" for each co-proprietor), it is likely a tenancy in common — the estate of the deceased must go through probate.',
      'A Registrar\'s Caveat may be entered on the deceased\'s share to prevent dealings before the survivorship is registered.',
    ],
    sample: `TRANSMISSION BY SURVIVOR
(Pursuant to Section 348, National Land Code 1965)

FORM 14D

TO THE REGISTRAR OF TITLES / ADMINISTRATOR OF LANDS:

I/We, [SURVIVOR FULL NAME]
NRIC No.: [         ]
Address:  [         ]
("the Surviving Joint Tenant")

APPLY for the registration of my/our right of survivorship
following the death of [DECEASED JOINT TENANT FULL NAME]
(NRIC: [         ]) on [DATE OF DEATH]:

LAND:
Title No.:   [GERAN / QT NO.]
Lot No.:     [         ]
Mukim:       [         ]
Daerah:      [         ]
Negeri:      [         ]

Both the Deceased and I/We were registered as joint tenants
of the abovementioned land pursuant to the title register.

By virtue of the Right of Survivorship (jus accrescendi),
I/We as the surviving joint tenant(s) are entitled to be
registered as the sole proprietor(s) / remaining joint tenants
of the said land.

Documents attached:
1. Certified copy of Death Certificate of Deceased
2. Statutory Declaration by Surviving Joint Tenant(s)
3. Certified copy of Surviving Joint Tenant's NRIC

Dated this ___ day of _____________, 20____.

_________________________________
Signature of Surviving Joint Tenant`,
  },
  {
    id: 'ckht-1a',
    formNumber: 'CKHT 1A',
    name: 'Disposer\'s Return (RPGT)',
    nameMs: 'Penyata Pelupusan Harta Tanah (CGPT)',
    category: 'RPGT / LHDN',
    legalBasis: 'Section 13, Real Property Gains Tax Act 1976',
    purpose: 'Filed by the vendor (disposer) to declare the disposal of real property to the LHDN (Inland Revenue Board), compute the chargeable gain, and pay any Real Property Gains Tax (RPGT) due.',
    whoUses: 'Vendor (Disposer) / Seller. Filed by the vendor\'s solicitor on the vendor\'s behalf.',
    keyFields: ['Disposer\'s particulars (name, NRIC, address, tax reference)', 'Property details (address, title number)', 'Date of disposal (SPA date)', 'Disposal price (purchase price in SPA)', 'Acquisition date and price', 'Allowable expenses (legal fees, renovation costs with receipts)', 'Chargeable gain = disposal price minus acquisition cost and allowable expenses', 'Applicable RPGT rate based on holding period and citizenship'],
    stampDuty: 'Not applicable — this is a tax return, not a stampable instrument.',
    timeline: 'MUST be filed within 60 days from the date of the SPA (disposal date). Penalties for late filing: minimum RM200.',
    importantNotes: [
      'Malaysian citizens disposing after 5 years: RPGT rate is 0% (Nil) since 2022.',
      'Disposals within the first 2 years: 30% for Malaysians and permanent residents; 30% for non-citizens/companies.',
      'If a loss is made on disposal, file the return but no tax is payable. The loss is not deductible against other income.',
      'Allowable deductions include: legal fees, stamp duty paid on original acquisition, renovation costs (with receipts), commission paid to real estate agent.',
      'Once-in-a-lifetime exemption: Malaysian individual may elect exemption on ONE residential property. This exemption is irrevocable once elected.',
      'The 3% retention sum (CKHT 502) must be remitted to LHDN by the purchaser simultaneously.',
    ],
    sample: `BORANG CKHT 1A
PENYATA PELUPUSAN HARTA TANAH
(Pursuant to Section 13, Real Property Gains Tax Act 1976)

Kepada:
Ketua Pengarah Hasil Dalam Negeri
Lembaga Hasil Dalam Negeri Malaysia

BAHAGIAN A: MAKLUMAT PELUPUS (DISPOSER)
Nama Penuh:         [         ]
No. K/P / Pasport:  [         ]
No. Fail Cukai:     [         ]
Alamat:             [         ]

BAHAGIAN B: BUTIRAN HARTA TANAH
Alamat Harta:       [         ]
No. Lot / PT:       [         ]
No. Hakmilik:       [         ]
Mukim / Daerah:     [         ]
Negeri:             [         ]

BAHAGIAN C: BUTIRAN PELUPUSAN
Tarikh SPA (Pelupusan):     [         ]
Harga Pelupusan (RM):       [         ]

BAHAGIAN D: BUTIRAN PEROLEHAN
Tarikh Perolehan Asal:      [         ]
Harga Perolehan Asal (RM):  [         ]

BAHAGIAN E: PERBELANJAAN DIBENARKAN
Yuran Guaman (Perolehan):   [         ]
Duti Setem (Perolehan):     [         ]
Kos Ubahsuai (dengan resit):[         ]
Komisyen Ejen Hartanah:     [         ]
JUMLAH:                     [         ]

BAHAGIAN F: PENGIRAAN CUKAI
Keuntungan Boleh Cukai = B - (D + E) = RM [         ]
Kadar CGPT berkenaan: [X]%
Cukai Dianggar: RM [         ]

Saya mengakui bahawa maklumat yang dinyatakan adalah benar.

_________________________________
Tandatangan Pelupus / Ejen Cukai
Tarikh: [         ]`,
  },
  {
    id: 'ckht-2a',
    formNumber: 'CKHT 2A',
    name: 'Acquirer\'s Return (RPGT)',
    nameMs: 'Penyata Perolehan Harta Tanah (CGPT)',
    category: 'RPGT / LHDN',
    legalBasis: 'Section 14, Real Property Gains Tax Act 1976',
    purpose: 'Filed by the purchaser (acquirer) to declare their acquisition of real property. The acquirer is also responsible for withholding 3% of the purchase price and remitting it to LHDN as a retention sum on account of the vendor\'s potential RPGT liability.',
    whoUses: 'Purchaser (Acquirer). Filed by the purchaser\'s solicitor simultaneously with the CKHT 1A.',
    keyFields: ['Acquirer\'s particulars', 'Property details', 'Date of acquisition (SPA date)', 'Acquisition price', 'Retention sum: 3% of purchase price (Form CKHT 502 accompanies this)', 'Exemption claimed (if applicable)'],
    stampDuty: 'Not applicable.',
    timeline: 'Filed within 60 days of the SPA date, simultaneously with the vendor\'s CKHT 1A.',
    importantNotes: [
      'The 3% retention MUST be remitted to LHDN within 60 days of the SPA date even if the transaction has not yet completed.',
      'If the purchaser fails to retain and remit 3%, the purchaser becomes personally liable for the vendor\'s RPGT.',
      'If the vendor\'s RPGT liability is less than the 3% retained, LHDN will refund the excess to the vendor.',
      'Exemption from retention applies if the vendor has a LHDN Exemption Letter under Schedule 4 RPGT Act (e.g. once-in-lifetime exemption).',
    ],
    sample: `BORANG CKHT 2A
PENYATA PEROLEHAN HARTA TANAH
(Pursuant to Section 14, Real Property Gains Tax Act 1976)

Kepada:
Ketua Pengarah Hasil Dalam Negeri

BAHAGIAN A: MAKLUMAT PEMEROLEH (ACQUIRER)
Nama Penuh:         [         ]
No. K/P / Pasport:  [         ]
No. Fail Cukai:     [         ]
Alamat:             [         ]

BAHAGIAN B: BUTIRAN HARTA TANAH
Alamat Harta:       [         ]
No. Hakmilik:       [         ]
Mukim / Daerah / Negeri: [         ]

BAHAGIAN C: BUTIRAN PEROLEHAN
Tarikh SPA (Perolehan):     [         ]
Harga Perolehan (RM):       [         ]

BAHAGIAN D: SUM DITAHAN (3%)
Jumlah Ditahan = 3% x RM [Harga] = RM [         ]

[ ] Jumlah ditahan telah diserahkan kepada LHDN
    melalui Borang CKHT 502 pada tarikh: [         ]
[ ] Penjual telah mengemukakan Surat Pelepasan LHDN
    (Exemption Letter). Tidak perlu tahan 3%.

PENGISYTIHARAN:
Saya mengakui bahawa maklumat di atas adalah benar dan betul.

_________________________________
Tandatangan Pemeroleh / Ejen Cukai
Tarikh: [         ]`,
  },
  {
    id: 'ckht-502',
    formNumber: 'CKHT 502',
    name: 'Remittance of Retention Sum (3%)',
    nameMs: 'Penyerahan Wang Ditahan (3%)',
    category: 'RPGT / LHDN',
    legalBasis: 'Section 21B, Real Property Gains Tax Act 1976',
    purpose: 'The form used by the purchaser (acquirer) to remit the 3% retention sum (withheld from the purchase price) to LHDN on account of the vendor\'s RPGT liability.',
    whoUses: 'Purchaser or purchaser\'s solicitor.',
    keyFields: ['Acquirer and disposer particulars', 'Property details', 'SPA date', 'Purchase price', '3% retention amount', 'Payment reference/receipt number'],
    stampDuty: 'Not applicable.',
    timeline: 'Remitted to LHDN within 60 days of the SPA date.',
    importantNotes: [
      'Even if completion has not yet occurred (e.g. transfer not yet registered), the 3% must still be remitted within 60 days of the SPA date.',
      'Payment can be made online via LHDN\'s MyTax portal or at any LHDN branch.',
      'Keep the payment receipt — it is required as an exhibit in the CKHT submission.',
    ],
    sample: `BORANG CKHT 502
PENYERAHAN WANG DITAHAN
(Pursuant to Section 21B, Real Property Gains Tax Act 1976)

Kepada:
Ketua Pengarah Hasil Dalam Negeri

BAHAGIAN A: MAKLUMAT PEMEROLEH (PURCHASER)
Nama: [         ]    No. K/P: [         ]

BAHAGIAN B: MAKLUMAT PELUPUS (VENDOR)
Nama: [         ]    No. K/P: [         ]

BAHAGIAN C: BUTIRAN HARTA TANAH
Alamat:      [         ]
No. Hakmilik:[         ]
Tarikh SPA:  [         ]
Harga Jualan:RM [         ]

BAHAGIAN D: PENGIRAAN WANG DITAHAN
Wang Ditahan = 3% x RM [Amount] = RM [         ]

BAHAGIAN E: PEMBAYARAN
Kaedah Pembayaran: [ ] Tunai  [ ] Cek  [ ] FPX/Online
No. Rujukan Pembayaran: [         ]
Tarikh Pembayaran:      [         ]

_________________________________
Tandatangan Pemeroleh / Peguamcara
Tarikh: [         ]`,
  },
  {
    id: 'pds1',
    formNumber: 'PDS 1 / e-Stamp',
    name: 'Stamp Duty Form — Transfer / SPA',
    nameMs: 'Borang Setem — Pindahmilik / SPA',
    category: 'RPGT / LHDN',
    legalBasis: 'Stamp Act 1949 — First Schedule; Section 47A',
    purpose: 'Used to pay and compute the ad valorem stamp duty payable on the principal instrument of transfer (SPA or Form 14A). The stamped document is evidence that stamp duty has been paid and is required for registration at the Land Office.',
    whoUses: 'Purchaser\'s solicitor. In practice, almost all stamping is now done online through LHDN\'s MyStamp portal.',
    keyFields: ['Instrument type (SPA / Form 14A)', 'Parties\' details', 'Property details', 'Consideration (purchase price)', 'Stamp duty computation (by tier)', 'Any exemption applied (first home, family transfer, etc.)', 'LHDN assessment reference number'],
    stampDuty: 'Ad valorem (see computation in sample below). Plus RM10 per duplicate copy of the SPA.',
    timeline: 'Must be stamped within 30 days of execution to avoid penalties. Late stamping penalty: up to 5x the original duty.',
    importantNotes: [
      'Since 2015, stamp duty is computed and paid online via the MyStamp e-stamping system. Physical PDS forms are largely obsolete.',
      'First home buyer exemption (Malaysian citizen): Full exemption on first RM500,000; 50% discount on next RM500,000 (total exemption up to RM1 million).',
      'Gift between spouses: 100% stamp duty exemption on the instrument of transfer.',
      'Gift from parent to child or child to parent: 50% stamp duty exemption.',
      'The exemption claim must be made at the time of stamping and supported by documentary evidence.',
    ],
    sample: `STAMP DUTY COMPUTATION — MEMORANDUM OF TRANSFER / SPA
(Pursuant to First Schedule, Stamp Act 1949)

Instrument: [Sale and Purchase Agreement / Form 14A (MOT)]
Date:        [Date of Instrument]
Parties:     [Vendor Name] and [Purchaser Name]
Property:    [Address, Title No, Mukim, District, State]
Consideration (Purchase Price): RM [Amount]

COMPUTATION OF AD VALOREM STAMP DUTY:

First RM100,000      @ 1.0%   = RM     1,000.00
Next  RM400,000      @ 2.0%   = RM     8,000.00
  (RM100,001 – RM500,000)
Next  RM500,000      @ 3.0%   = RM    15,000.00
  (RM500,001 – RM1,000,000)
Balance RM[X]        @ 4.0%   = RM [Amount]
  (RM1,000,001 and above)

TOTAL STAMP DUTY:              RM [Amount]

[IF FIRST HOME EXEMPTION APPLIES:]
Exemption on first RM500,000: (RM  9,000.00)
50% Exemption on next RM500,000: (RM  7,500.00)
NET STAMP DUTY PAYABLE:       RM [Reduced Amount]

LHDN Assessment No.: [         ]
Date of Stamping:     [         ]
Stamp Certificate:    [e-Stamp Reference No.]`,
  },
  {
    id: 'pds15',
    formNumber: 'PDS 15',
    name: 'Stamp Duty Form — Tenancy Agreement',
    nameMs: 'Borang Setem — Perjanjian Sewa',
    category: 'RPGT / LHDN',
    legalBasis: 'Item 22, First Schedule, Stamp Act 1949',
    purpose: 'Computes and pays the stamp duty on a tenancy or lease agreement. The stamp duty rate depends on the annual rental and the duration of the tenancy.',
    whoUses: 'Tenant or landlord (by agreement — typically tenant pays). Processed online via MyStamp.',
    keyFields: ['Tenancy period and duration', 'Monthly rental', 'Annual rental', 'Stamp duty computation', 'Property details'],
    stampDuty: 'For tenancy > 1 year: RM1 for every RM250 or part thereof of the annual rental above RM2,400. For tenancy ≤ 1 year: RM1 for every RM250 of total rental.',
    timeline: 'Within 30 days of execution to avoid penalties.',
    importantNotes: [
      'Original and counterpart copies must both be stamped (each at a separate rate).',
      'Tenancy agreements exceeding 3 years must be registered at the Land Office as a lease (Form 15A).',
    ],
    sample: `STAMP DUTY COMPUTATION — TENANCY AGREEMENT
(Pursuant to Item 22, First Schedule, Stamp Act 1949)

Instrument:    Tenancy Agreement
Date:          [Date]
Landlord:      [Name]
Tenant:        [Name]
Premises:      [Address]
Monthly Rental: RM [Amount]
Annual Rental:  RM [Amount x 12]
Tenancy Period: [X] year(s)

COMPUTATION:
Annual Rent above RM2,400 = RM [Annual Rent] - RM2,400 = RM [Excess]
Stamp Duty = RM1 per RM250 = RM [Excess] / 250 = RM [Amount]
(Rounded up to next RM250)

TOTAL STAMP DUTY (Principal Copy): RM [Amount]
TOTAL STAMP DUTY (Duplicate Copy): RM 10.00

LHDN Assessment No.: [         ]
Date of Stamping:     [         ]`,
  },
  {
    id: 'hda-schedule-g',
    formNumber: 'HDA Schedule G',
    name: 'SPA for Landed Residential Property (Developer)',
    nameMs: 'Perjanjian Jual Beli Harta Kediaman Bertanah (Pemaju)',
    category: 'HDA / Developer',
    legalBasis: 'Housing Development (Control and Licensing) Regulations 1989 — Third Schedule (Schedule G)',
    purpose: 'The prescribed statutory SPA form for the sale of landed residential properties (terrace house, semi-detached, bungalow) by licensed housing developers. Its terms cannot be varied to the purchaser\'s detriment. Any attempt to vary Schedule G clauses adversely against the purchaser is void.',
    whoUses: 'Licensed housing developers selling landed residential properties under the Housing Development Act 1966.',
    keyFields: ['Developer\'s Housing Development Licence No.', 'Developer\'s Advertisement Permit No.', 'Purchaser\'s details', 'Property description (lot, mukim, house type)', 'Purchase price and progressive payment schedule (13-stage billing)', 'VP date and LAD rate (10% p.a.)', 'Defect Liability Period (24 months)', 'Title transfer obligation (within 36 months of VP)', 'Sinking fund / maintenance provisions'],
    stampDuty: 'Ad valorem stamp duty on the SPA (per Stamp Act 1949 — same rates as sub-sale SPA). Plus RM10 for duplicate copies.',
    timeline: 'The SPA must be presented to the purchaser within 21 days of the developer\'s receipt of the purchaser\'s signed SPA.',
    importantNotes: [
      'The booking fee is capped at RM500. Any excess must be refunded or credited towards the deposit.',
      'The 10% deposit (less booking fee) is payable upon signing of the SPA.',
      'Progressive payment follows the 13-stage Architect\'s Certificate system prescribed in Schedule G.',
      'LAD accrues at 10% per annum (calculated daily) from the contractual VP date until actual VP date.',
      'The developer cannot collect more than the prescribed maximum amount at each billing stage.',
      'Any clause in the SPA that purports to exclude or limit the developer\'s liability beyond what is permitted by the HDA/Regulations is void.',
    ],
    sample: `SALE AND PURCHASE AGREEMENT
(Schedule G — Housing Development (Control and Licensing) Regulations 1989)

Date: [Date of Agreement]

BETWEEN:
[DEVELOPER COMPANY NAME] (Company No.: [No.])
(Housing Developer's Licence No.: [No.])
(Advertisement Permit No.: [No.])
[Developer's Address]
("the Vendor" / "the Developer")

AND

[PURCHASER FULL NAME] (NRIC: [No.])
[Purchaser's Address]
("the Purchaser")

SALE AND PURCHASE:
The Vendor agrees to sell and the Purchaser agrees to purchase
a housing accommodation to be erected on the land known as:

[PROPERTY DESCRIPTION / HOUSE TYPE & LOT NO.]
at [ADDRESS OF HOUSING PROJECT]

for the purchase price of RINGGIT MALAYSIA [AMOUNT]
(RM [AMOUNT]) only.

PAYMENT:
10% on signing of this Agreement: RM [Amount]
Progressive billings per Architect's Certificate (Stages 2–12)
Final 5% on VP: RM [Amount]

VACANT POSSESSION:
[24 / 36] months from the date of this Agreement.

LIQUIDATED ASCERTAINED DAMAGES (LAD):
In the event of failure to deliver VP by the Completion Date,
the Vendor shall pay LAD at the rate of 10% per annum on the
purchase price calculated on a daily basis for each day of delay.

DEFECT LIABILITY PERIOD:
24 months from the date of VP.

[All other terms as prescribed in the Third Schedule of the
Housing Development (Control and Licensing) Regulations 1989]`,
  },
  {
    id: 'hda-schedule-h',
    formNumber: 'HDA Schedule H',
    name: 'SPA for Strata Residential Property (Developer)',
    nameMs: 'Perjanjian Jual Beli Harta Strata Kediaman (Pemaju)',
    category: 'HDA / Developer',
    legalBasis: 'Housing Development (Control and Licensing) Regulations 1989 — Fourth Schedule (Schedule H)',
    purpose: 'The prescribed statutory SPA form for the sale of units in subdivided buildings (condominiums, apartments, flat units) by licensed housing developers. Similar to Schedule G but specifically deals with strata properties including the strata title application obligation.',
    whoUses: 'Licensed housing developers selling strata residential units.',
    keyFields: ['All fields from Schedule G, plus:', 'Strata title application obligation clause (developer must apply within agreed period after CCC)', 'Common property and maintenance provisions', 'JMB/MC formation obligations', 'Unit parcel number and share value (unit entitlement)'],
    stampDuty: 'Same as Schedule G — ad valorem stamp duty on the SPA.',
    timeline: 'Same as Schedule G — 21-day delivery requirement.',
    importantNotes: [
      'The developer must apply for the strata title within the period stated in the SPA (typically 24 months after CCC).',
      'Failure to apply for strata title triggers separate LAD under the Strata Titles Act.',
      'Management charges commence from the VP date.',
      'The JMB must be formed within 12 months of the first VP of any unit in the development.',
      'Schedule H is for residential strata only. Commercial strata uses Schedule I; SOHO/SOFO/SOVO uses Schedule J.',
    ],
    sample: `SALE AND PURCHASE AGREEMENT
(Schedule H — Housing Development (Control and Licensing) Regulations 1989)

Date: [Date]

BETWEEN:
[DEVELOPER COMPANY NAME] (Company No.: [No.])
(Developer's Licence: [No.]) (Ad Permit: [No.])
("the Vendor")

AND:
[PURCHASER NAME] (NRIC: [No.])
("the Purchaser")

PROPERTY:
Unit No.:           [         ]
Floor:              [         ]
Block / Tower:      [         ]
Project Name:       [         ]
Address:            [         ]
Share Unit/Value:   [         ]

PURCHASE PRICE: RM [Amount]

PROGRESSIVE PAYMENT:
Stage 1 (SPA signing, 10%):  RM [Amount]
Stage 2 (Foundation):        RM [Amount]
Stage 3 (Ground floor slab): RM [Amount]
[Stages 4–12 per Architect's Certificates]
Stage 13 (VP, 5%):           RM [Amount]

VACANT POSSESSION:
Delivered within [36] months from the date of this Agreement.

LAD: 10% per annum on purchase price for each day of delay.

STRATA TITLE APPLICATION:
The Vendor shall apply for the issue of the strata title for the
parcel within [24] months from the date of CCC.

DEFECT LIABILITY: 24 months from VP.

[All other terms as per Schedule H of the Regulations]`,
  },
  {
    id: 'undertaking-to-discharge',
    formNumber: 'Undertaking to Discharge',
    name: 'Bank\'s Undertaking to Discharge Existing Charge',
    nameMs: 'Surat Akujanji Bank untuk Melepaskan Cagaran',
    category: 'Letters & Undertakings',
    legalBasis: 'Common law; Bar Council practice; NLC s.278',
    purpose: 'A commitment by the vendor\'s bank (Chargee) to execute and present the Form 16N (Discharge of Charge) to the Land Registry within a specified period upon receiving the redemption sum from the purchaser\'s bank. This is the central mechanism enabling concurrent completion of the sale and discharge of the vendor\'s loan.',
    whoUses: 'Issued by the vendor\'s financier (bank) to the purchaser\'s solicitor or the purchaser\'s bank.',
    keyFields: ['Property details and title number', 'Chargor\'s name and loan account number', 'Redemption sum (amount, validity period)', 'Undertaking timeline (number of working days to present Form 16N)', 'Conditions (cleared funds, original IDT release)', 'Bank\'s authorised signatory'],
    stampDuty: 'Not stampable.',
    timeline: 'Obtained before or at the time of completion. The undertaking is typically valid for 3 months from the date of issue.',
    importantNotes: [
      'This is a professional solicitor-to-solicitor/bank-to-bank undertaking — breach gives rise to professional misconduct and damages.',
      'The purchaser\'s bank will only release the loan proceeds upon receiving this undertaking from the vendor\'s bank.',
      'The redemption statement must be obtained before the undertaking can be issued.',
      'Ensure the redemption sum is valid on the date of completion — request an updated statement if completion is delayed.',
    ],
    sample: `[VENDOR'S BANK LETTERHEAD]

Date: [Date]

TO: [Purchaser's Bank / Purchaser's Solicitor]

Dear Sir/Madam,

UNDERTAKING TO DISCHARGE CHARGE

PROPERTY:   [Full Address]
TITLE NO:   [Geran / QT No.], Lot [No.], Mukim [Name]
CHARGOR:    [Vendor Full Name] (NRIC: [No.])
OUR ACCOUNT:[Loan Account Number]

We refer to the above and confirm that our Chargor has a
loan secured by a Charge registered over the abovementioned
property in our favour.

The current REDEMPTION SUM as at [Date] is:
   Outstanding Principal:  RM [Amount]
   Accrued Interest:       RM [Amount]
   TOTAL:                  RM [Amount]
   (Valid until: [Redemption Expiry Date])

Upon receipt of the above redemption sum in CLEARED FUNDS:

WE HEREBY UNDERTAKE to:
1. Execute the Form 16N (Discharge of Charge) within [14]
   working days of receipt of the redemption sum; and
2. Present the executed Form 16N together with the original
   Issue Document of Title (IDT) to the Land Registry for
   registration of the discharge within the said period.

This undertaking is given subject to the following conditions:
(a) The redemption sum is received in cleared funds by [Date];
(b) No legal proceedings are pending against our Chargor that
    would prevent our compliance.

Yours faithfully,
For and on behalf of [BANK NAME]:

_________________________________
Authorised Signatory
[Name, Designation]
[Bank Stamp]`,
  },
  {
    id: 'solicitor-undertaking',
    formNumber: 'Solicitor\'s Undertaking',
    name: 'Solicitor\'s Undertaking to Financier',
    nameMs: 'Akujanji Peguamcara kepada Pembiaya',
    category: 'Letters & Undertakings',
    legalBasis: 'Bar Council practice; Solicitors professional obligations; Contracts Act 1950',
    purpose: 'A personal professional undertaking given by a solicitor to a bank, typically guaranteeing the completion of the transaction and/or the delivery of title documents within a specified period. Breach is a serious professional misconduct matter.',
    whoUses: 'Conveyancing solicitors acting for the purchaser, given to the purchaser\'s financier.',
    keyFields: ['Solicitor\'s name and firm details', 'Client\'s name and loan reference', 'Specific obligations undertaken (e.g. to present Form 14A and Form 16A within X days)', 'Timeline', 'Conditions'],
    stampDuty: 'Not stampable.',
    timeline: 'Issued at or before drawdown of the loan.',
    importantNotes: [
      'A solicitor\'s undertaking is the personal obligation of the solicitor — not just the firm.',
      'Breach of an undertaking is a disciplinary matter before the Bar Council and may result in suspension or disbarment.',
      'Do NOT give an undertaking you cannot fulfil. If circumstances change, inform the bank immediately.',
    ],
    sample: `[FIRM LETTERHEAD]

Date: [Date]

To: [Bank Name — Loan Department]
    [Bank Address]

Dear Sir/Madam,

SOLICITOR'S UNDERTAKING
RE: [Purchaser Name]
    Loan Account No: [         ]
    Property: [Address, Title No]

We act as solicitors for [Purchaser Name] in connection with
the above loan facility.

We hereby UNDERTAKE as follows:
1. To present the duly executed and stamped Form 14A
   (Memorandum of Transfer) for registration at the
   Land Registry within [3] months of the date of drawdown
   of the loan.

2. To present the duly executed and stamped Form 16A
   (Memorandum of Charge) for registration at the Land
   Registry simultaneously with or immediately after the
   registration of the Form 14A.

3. To forward to you the original Issue Document of Title
   (IDT) with the registered Charge (Form 16A) notation
   thereon within [14] working days of receipt from the
   Land Registry.

This undertaking is given in our personal professional
capacity as Advocates & Solicitors of the High Court of
Malaya.

Yours faithfully,
[PARTNER'S FULL NAME]
Partner
[Firm Name & Address]
[Bar Council Roll No.]`,
  },
  {
    id: 'spa-subsale',
    formNumber: 'SPA (Sub-Sale)',
    name: 'Sale and Purchase Agreement (Sub-Sale / Secondary Market)',
    nameMs: 'Perjanjian Jual Beli (Pasaran Kedua)',
    category: 'Agreements & Deeds',
    legalBasis: 'Contracts Act 1950; National Land Code 1965 (transfer by registered proprietor); not governed by HDA 1966 (which applies only to licensed-developer first sales).',
    purpose: 'The principal private contract governing a resale of completed property between two individuals/companies (vendor and purchaser). Unlike a developer SPA, the terms are freely negotiated. It sets the price, deposit, completion period, and the apportionment of outgoings and risk.',
    whoUses: 'Drafted by the purchaser\u2019s or vendor\u2019s solicitor (whoever holds the stakeholder deposit). Each party should be separately advised; the same firm may act for both only with informed written consent.',
    keyFields: ['Parties\u2019 full names, NRIC/company nos. and addresses', 'Full title description (Geran/HSD, Lot/PT, Mukim, Daerah, Negeri)', 'Purchase price; earnest/booking deposit (commonly 3%) and balance deposit to make up 10%', 'Completion period (commonly 3 months + 1 month extension with interest)', 'Manner of payment / redemption of vendor\u2019s existing charge', 'Stakeholder for the deposit', 'Apportionment of quit rent, assessment and maintenance', 'Vacant possession date and condition'],
    stampDuty: 'The SPA itself attracts nominal stamp duty of RM10 per copy. The ad valorem duty is borne by the Memorandum of Transfer (Form 14A) / Deed of Assignment on the purchase price.',
    timeline: 'Typically executed after the earnest deposit and signed letter of offer. Completion usually 3 months from the date the SPA is unconditional (or from the date of the last regulatory consent), with a 1-month extension on late-payment interest.',
    importantNotes: [
      'Confirm whether the title is individual/strata (use Form 14A transfer) or master-title (use a Deed of Assignment) \u2014 this changes the whole completion mechanic.',
      'Conduct a private land search and bankruptcy/winding-up search on the vendor BEFORE the SPA is signed.',
      'If there is an existing charge, the redemption sum and the chargee\u2019s undertaking to discharge must be built into the payment schedule.',
      'State consent / levy may be required where there is a restriction in interest or a foreign / non-bumi dealing.',
      'Include a default clause (forfeiture of deposit / specific performance) and an interest-on-late-completion clause.',
      'The 3% RPGT retention (s.21B RPGT Act 1976) should be expressly addressed in the payment schedule.',
    ],
    sample: `SALE AND PURCHASE AGREEMENT
(Sub-Sale of Completed Property)

THIS AGREEMENT is made on the [____] day of [__________], 20[__]

BETWEEN

[VENDOR FULL NAME], (NRIC No. [__________]) of
[address] (hereinafter called "the Vendor") of the one part;

AND

[PURCHASER FULL NAME], (NRIC No. [__________]) of
[address] (hereinafter called "the Purchaser") of the other part.

WHEREAS:
(a) The Vendor is the registered proprietor / beneficial owner of
    all that property held under [Title No. / HSD ____], Lot/PT No.
    [____], Mukim/Pekan of [____], District of [____], State of
    [____], together with the building erected thereon known as
    [property address] ("the Property").
(b) The Vendor has agreed to sell and the Purchaser has agreed to
    purchase the Property free from encumbrances (save as stated)
    upon the terms below.

NOW IT IS HEREBY AGREED as follows:

1.  PURCHASE PRICE
    The purchase price is RINGGIT MALAYSIA [amount in words]
    (RM[________]) ("the Purchase Price").

2.  PAYMENT
    2.1  Earnest deposit (3%) of RM[____] paid upon the letter of
         offer (receipt acknowledged).
    2.2  Balance deposit to make up 10% of RM[____] paid on the
         execution of this Agreement to [STAKEHOLDER] as
         stakeholder.
    2.3  Balance Purchase Price (90%) of RM[____] payable within
         THREE (3) months from the date this Agreement becomes
         unconditional ("the Completion Date"), with a one (1)
         month extension subject to interest at [8]% p.a. on the
         outstanding sum.

3.  REDEMPTION
    Where the Property is charged, the Vendor shall procure the
    chargee\u2019s redemption statement and undertaking to discharge,
    and the redemption sum shall be paid out of the balance
    Purchase Price directly to the chargee.

4.  VACANT POSSESSION
    The Vendor shall deliver vacant possession of the Property to
    the Purchaser on the Completion Date, in its present condition,
    with all fixtures, free from tenancy and occupiers.

5.  OUTGOINGS
    Quit rent, assessment and maintenance/service charges shall be
    apportioned as at the date of delivery of vacant possession.

6.  RPGT RETENTION
    The Purchaser shall retain three per centum (3%) of the
    Purchase Price and remit the same to the Director General of
    Inland Revenue under section 21B of the Real Property Gains Tax
    Act 1976 within sixty (60) days.

7.  DEFAULT
    7.1  If the Purchaser defaults, the deposit (10%) may be
         forfeited as agreed liquidated damages.
    7.2  If the Vendor defaults, the Vendor shall refund all sums
         paid and pay an equivalent of the deposit as agreed
         liquidated damages, without prejudice to specific
         performance.

8.  COSTS
    Each party shall bear its own solicitors\u2019 costs. The Purchaser
    shall bear the stamp duty and registration fees on the transfer.

IN WITNESS WHEREOF the parties have hereunto set their hands the
day and year first above written.

Signed by the Vendor          )  ____________________
in the presence of:           )  [VENDOR]

Signed by the Purchaser       )  ____________________
in the presence of:           )  [PURCHASER]

Witness: _______________________
Name / NRIC / Designation`,
  },
  {
    id: 'deed-of-assignment',
    formNumber: 'Deed of Assignment',
    name: 'Deed of Assignment (Master Title / No Individual Title)',
    nameMs: 'Surat Ikatan Penyerahan Hak',
    category: 'Agreements & Deeds',
    legalBasis: 'Assignment of contractual and beneficial rights at common law / equity; used where no separate document of title (individual or strata) has issued and registration of a Form 14A transfer is not yet possible.',
    purpose: 'Transfers the vendor\u2019s rights, title and interest under the principal SPA (with the developer/proprietor) to the purchaser, because the property is still held under a master title and cannot yet be transferred by registered instrument. It is the substitute conveyance pending issuance of strata/individual title.',
    whoUses: 'Conveyancing solicitor in a sub-sale of a property without individual/strata title (very common for apartments and condominiums in the years before strata titles issue).',
    keyFields: ['Assignor (vendor) and Assignee (purchaser) particulars', 'Identification of the principal SPA (date and parties) being assigned', 'Description of the parcel / unit and the master title', 'Consideration', 'Developer\u2019s/proprietor\u2019s consent reference', 'Date and attestation'],
    stampDuty: 'Ad valorem stamp duty (same scale as a transfer) is chargeable on the Deed of Assignment in the absence of a registrable Form 14A. Adjudication via the Stamp Office is required.',
    timeline: 'Executed at completion of the sub-sale, together with the developer/proprietor\u2019s consent to assign and (where financed) an Assignment by way of security to the bank.',
    importantNotes: [
      'Two assignments are usually executed: (1) the absolute assignment vendor\u2014>purchaser, and (2) the assignment by way of security purchaser\u2014>bank. The latter is later re-assigned on full settlement.',
      'The developer\u2019s/proprietor\u2019s written consent to the assignment is almost always a contractual pre-condition \u2014 obtain it early.',
      'A Power of Attorney from the assignor to the assignee is commonly granted to deal with the title once it issues.',
      'When strata/individual title later issues, a Form 14A transfer and a perfection of charge (Form 16A) must be done \u2014 budget for this future cost.',
      'Conduct a developer search / confirm no caveat or blacklisting before completion.',
    ],
    sample: `DEED OF ASSIGNMENT

THIS DEED OF ASSIGNMENT is made on the [____] day of
[__________], 20[__]

BETWEEN

[ASSIGNOR / VENDOR NAME] (NRIC No. [________]) of [address]
("the Assignor") of the one part;

AND

[ASSIGNEE / PURCHASER NAME] (NRIC No. [________]) of [address]
("the Assignee") of the other part.

WHEREAS:
(a) By a Sale and Purchase Agreement dated [____] ("the Principal
    Agreement") made between [DEVELOPER/PROPRIETOR] and the
    Assignor, the Assignor purchased all that parcel known as
    Unit No. [____], [project / building name], erected on land
    held under master title [____], Mukim/Daerah of [____],
    State of [____] ("the Property").
(b) No separate document of title (strata/individual) has yet
    issued for the Property and the same cannot presently be
    transferred by way of a registrable memorandum of transfer.
(c) The Assignor has agreed to assign and the Assignee has agreed
    to accept an assignment of all the Assignor\u2019s rights, title,
    interest and benefit in the Property and under the Principal
    Agreement.

NOW THIS DEED WITNESSES as follows:

1.  In consideration of RINGGIT MALAYSIA [amount in words]
    (RM[________]) paid by the Assignee to the Assignor (receipt
    acknowledged), the Assignor as beneficial owner HEREBY ASSIGNS
    unto the Assignee ALL the rights, title, interest and benefit
    of the Assignor in and to the Property and under the Principal
    Agreement, TO HOLD the same unto the Assignee absolutely.

2.  The Assignor covenants that it has good right to assign, that
    the Property is free from encumbrances (save as disclosed), and
    that it will at the Assignee\u2019s cost do all acts necessary to
    perfect this assignment, including execution of a transfer
    (Form 14A) when the title issues.

3.  This assignment is made with the consent of [DEVELOPER/
    PROPRIETOR] given by letter dated [____].

IN WITNESS WHEREOF the parties have executed this Deed the day and
year first above written.

Signed, Sealed and Delivered )  ____________________
by the Assignor              )  [ASSIGNOR]
in the presence of:          )

Signed, Sealed and Delivered )  ____________________
by the Assignee              )  [ASSIGNEE]
in the presence of:          )

Before me,
_______________________________
Advocate & Solicitor / Commissioner for Oaths`,
  },
  {
    id: 'tenancy-agreement',
    formNumber: 'Tenancy Agreement',
    name: 'Tenancy Agreement (Residential / Term \u2264 3 Years)',
    nameMs: 'Perjanjian Penyewaan',
    category: 'Agreements & Deeds',
    legalBasis: 'Contracts Act 1950; National Land Code 1965 s.213 (a tenancy not exceeding three years is exempt from registration and need not be effected by a registered lease). Distinguish from a lease (> 3 years) under s.221.',
    purpose: 'Creates a contractual right of exclusive possession for a term not exceeding three years in return for rent. Because it is a tenancy exempt from registration, it cannot be registered but may be protected by endorsement of a tenancy exempt from registration under s.213(3).',
    whoUses: 'Solicitor or agent acting for the landlord or tenant. Widely used for residential lettings and short commercial occupations.',
    keyFields: ['Landlord and Tenant particulars', 'Premises address and inventory', 'Term (\u2264 3 years) and commencement date', 'Monthly rent and payment date', 'Security deposit (commonly 2 months) and utility deposit (commonly \u00bd month)', 'Permitted use', 'Repair / maintenance responsibilities', 'Renewal and termination clauses'],
    stampDuty: 'Ad valorem stamp duty on the annual rent: rough scale RM1 per RM250 of annual rent above RM2,400, varying with term (1 / 1\u20133 / >3 years). The PDS 15 form is used to assess tenancy stamp duty.',
    timeline: 'Stamp within 30 days of execution to avoid penalty. Deposits are usually paid on signing; the term commences on the stated date.',
    importantNotes: [
      'A term exceeding three years is a LEASE (s.221) and should be registered as Form 15A \u2014 do not mislabel it as a tenancy.',
      'There is no statutory rent-control regime; remedies for non-payment are by way of distress (Distress Act 1951) or civil action.',
      'Specify clearly which deposit is refundable and the deductions permitted; itemise an inventory for furnished premises.',
      'Include a clause on the landlord\u2019s right of re-entry and the tenant\u2019s repairing obligations (fair wear and tear excepted).',
      'Stamp duty must be paid for the tenancy to be admissible in evidence.',
    ],
    sample: `TENANCY AGREEMENT

THIS TENANCY AGREEMENT is made on the [____] day of
[__________], 20[__]

BETWEEN
[LANDLORD NAME] (NRIC No. [________]) of [address]
("the Landlord");

AND
[TENANT NAME] (NRIC No. [________]) of [address]
("the Tenant").

1.  PREMISES
    The Landlord lets and the Tenant takes ALL that premises known
    as [full address] ("the Premises"), together with the fittings
    listed in the Inventory annexed.

2.  TERM
    For a term of [____] ([one/two]) year(s) commencing on [____]
    and expiring on [____].

3.  RENT
    Monthly rent of RM[____] payable in advance on or before the
    [____] day of each calendar month.

4.  DEPOSITS
    4.1  Security deposit of RM[____] (equal to [2] months\u2019 rent),
         refundable on expiry less lawful deductions.
    4.2  Utility deposit of RM[____] (equal to [\u00bd] month\u2019s rent).

5.  TENANT\u2019S COVENANTS
    (a) To pay the rent and utilities punctually;
    (b) To use the Premises for [residential] purposes only;
    (c) To keep the interior in good and tenantable repair, fair
        wear and tear excepted;
    (d) Not to assign or sublet without the Landlord\u2019s written
        consent.

6.  LANDLORD\u2019S COVENANTS
    (a) To allow the Tenant quiet enjoyment;
    (b) To keep the structure and roof in repair;
    (c) To pay the quit rent and assessment.

7.  TERMINATION
    Either party may terminate by giving [two] months\u2019 written
    notice. The Landlord may re-enter if the rent is in arrears for
    [14] days or any covenant is breached.

IN WITNESS WHEREOF the parties have set their hands the day and
year first above written.

Signed by the Landlord  )  ____________________
                        )  [LANDLORD]
Signed by the Tenant    )  ____________________
                        )  [TENANT]
Witness: ____________________`,
  },
  {
    id: 'facility-agreement',
    formNumber: 'Facility Agreement',
    name: 'Loan / Facility Agreement (Term Loan secured by Charge)',
    nameMs: 'Perjanjian Kemudahan',
    category: 'Financing',
    legalBasis: 'Contracts Act 1950; secured by a charge under ss.241\u2013243 National Land Code 1965 (Form 16A) for titled property, or by an assignment by way of security where no title has issued.',
    purpose: 'Sets out the terms on which a financier grants a term loan to a borrower to part-finance the purchase \u2014 amount, tenure, interest/profit rate, repayment, events of default \u2014 and creates or references the security (charge or assignment).',
    whoUses: 'Solicitor on the bank\u2019s panel preparing the security documentation, in tandem with the purchaser\u2019s SPA. Conventional (interest) and Islamic (profit-based, e.g. Tawarruq) variants exist.',
    keyFields: ['Borrower and Financier particulars', 'Facility amount and margin of finance', 'Tenure and instalment', 'Interest/profit rate (BR/SBR + spread)', 'Security (Form 16A charge / Deed of Assignment)', 'Conditions precedent to drawdown', 'Events of default', 'Disbursement instructions'],
    stampDuty: 'Ad valorem stamp duty at 0.5% on the facility/loan amount (Stamp Act 1949, First Schedule). The principal instrument is stamped ad valorem; subsidiary security instruments are stamped at RM10.',
    timeline: 'Executed after the SPA, before drawdown. Drawdown is conditional on registration of the charge / perfection of security and the solicitor\u2019s undertaking.',
    importantNotes: [
      'Only ONE instrument in a set is charged ad valorem (the principal); the others (e.g. the charge annexure) attract RM10 \u2014 mark them as subsidiary to avoid double duty.',
      'For untitled property the security is an Assignment (absolute, by way of security) plus a Power of Attorney; perfect into a Form 16A charge once title issues.',
      'Confirm the margin of finance, lock-in period and early-settlement (prepayment) terms against the bank\u2019s letter of offer.',
      'Islamic facilities (Murabahah/Tawarruq) use a Property Purchase/Sale Agreement structure \u2014 do not mix conventional interest language into them.',
      'The redemption of any existing charge must be coordinated through the bank\u2019s undertaking to discharge.',
    ],
    sample: `FACILITY AGREEMENT

THIS FACILITY AGREEMENT is made on the [____] day of
[__________], 20[__]

BETWEEN
[FINANCIER / BANK NAME] (Company No. [________]), a licensed bank
of [address] ("the Bank");

AND
[BORROWER NAME] (NRIC No. [________]) of [address]
("the Borrower").

1.  THE FACILITY
    The Bank agrees to grant and the Borrower agrees to accept a
    term loan facility of RINGGIT MALAYSIA [amount in words]
    (RM[________]) ("the Facility") to part-finance the purchase of
    the property described in the Schedule ("the Property").

2.  TENURE & REPAYMENT
    The Facility is repayable over [____] months by [____] monthly
    instalments of RM[____] each, the first instalment commencing
    one month after full release.

3.  INTEREST
    Interest is charged at the Bank\u2019s Standardised Base Rate (SBR)
    of [____]% plus a spread of [____]% per annum, on a daily rest
    basis, subject to variation in accordance with the SBR.

4.  SECURITY
    As security the Borrower shall execute a first-party first-
    legal charge (Form 16A) over the Property under the National
    Land Code 1965 [OR an Assignment by way of security pending
    issue of title], together with all ancillary documents the Bank
    may require.

5.  CONDITIONS PRECEDENT
    Drawdown is conditional on, inter alia: (a) execution and
    stamping of this Agreement and the security; (b) registration
    of the charge / perfection of the assignment; (c) the
    solicitors\u2019 undertaking; and (d) valuation acceptable to the
    Bank.

6.  EVENTS OF DEFAULT
    On default in payment or breach of covenant, the Bank may
    declare the Facility immediately due and enforce the security,
    including by an application for an order for sale.

IN WITNESS WHEREOF the parties have executed this Agreement the
day and year first above written.

For and on behalf of the Bank )  ____________________
                              )  Authorised Signatory
Signed by the Borrower        )  ____________________
                              )  [BORROWER]
Witness: ____________________

THE SCHEDULE
[Full title / parcel description of the Property]`,
  },
  {
    id: 'letter-of-offer-purchase',
    formNumber: 'Letter of Offer',
    name: 'Letter of Offer to Purchase / Booking Form',
    nameMs: 'Surat Tawaran Pembelian',
    category: 'Letters & Undertakings',
    legalBasis: 'Contracts Act 1950 \u2014 offer and acceptance. May itself be a binding contract if the essential terms are present and there is no "subject to contract" qualification; draft with care.',
    purpose: 'Records the purchaser\u2019s offer, the earnest deposit (commonly 1\u20133%), and the headline terms before the formal SPA. It bridges the gap between handshake and SPA and fixes the price, deposit and SPA-execution deadline.',
    whoUses: 'Estate agent or solicitor for the purchaser. Frequently the document that crystallises a deal \u2014 hence it must be unambiguous about whether it binds.',
    keyFields: ['Purchaser and Vendor (or agent) particulars', 'Property description', 'Offer price', 'Earnest deposit and to whom paid (stakeholder)', 'Deadline to execute the SPA', 'Conditions (e.g. subject to loan / state consent)', 'Treatment of deposit on default'],
    stampDuty: 'Nominal (RM10) if treated as a standalone document; the ad valorem duty falls on the SPA/transfer. If it is in substance the operative agreement, the Stamp Office may assess it ad valorem.',
    timeline: 'Signed on the spot at booking; the SPA is typically to be executed within 14\u201330 days, by which time the balance deposit (to make 10%) is paid.',
    importantNotes: [
      'State expressly whether the offer is "subject to contract" \u2014 if omitted, the letter may already bind the parties.',
      'Identify the stakeholder for the earnest deposit and the consequences of default (forfeiture vs refund).',
      'If the purchase is conditional on financing or state consent, make that an express condition precedent.',
      'A booking fee collected by an agent must comply with the estate-agency rules; the agent cannot hold more than the regulated amount.',
      'Cross-refer the headline terms to the SPA so there is no inconsistency later.',
    ],
    sample: `LETTER OF OFFER TO PURCHASE

Date: [____]
To: [VENDOR / VENDOR\u2019S AGENT NAME & ADDRESS]

Dear Sir/Madam,

RE: OFFER TO PURCHASE \u2014 [PROPERTY ADDRESS]
    Held under [Title No. / Master Title], Unit/Lot [____]

I/We, [PURCHASER NAME] (NRIC No. [____]) of [address], hereby
offer to purchase the above property on the following terms:

1.  PURCHASE PRICE: RM[________] (Ringgit Malaysia [words]).

2.  EARNEST DEPOSIT: RM[____] (being [2]% of the Purchase Price),
    paid herewith to [STAKEHOLDER NAME] as stakeholder, receipt of
    which is to be acknowledged.

3.  BALANCE DEPOSIT: A further RM[____] to make up ten per cent
    (10%) shall be paid upon execution of the Sale and Purchase
    Agreement.

4.  SPA: The formal Sale and Purchase Agreement shall be executed
    within [14] days from the date of acceptance of this offer.

5.  COMPLETION: Within three (3) months from the date the SPA
    becomes unconditional, with a one (1) month extension on
    interest.

6.  CONDITIONS: This offer is [subject to / not subject to] the
    Purchaser obtaining a loan of RM[____] and to any requisite
    state authority consent.

7.  DEFAULT: Should the Purchaser fail to execute the SPA within
    the said period (otherwise than due to the Vendor\u2019s default or
    a failed condition), the earnest deposit shall be forfeited.
    Should the Vendor decline to proceed, the earnest deposit shall
    be refunded in full.

This offer is open for acceptance until [____].

Yours faithfully,
____________________
[PURCHASER]

ACCEPTED by the Vendor:
____________________      Date: [____]
[VENDOR]`,
  },
  {
    id: 'statutory-declaration',
    formNumber: 'Statutory Declaration',
    name: 'Statutory Declaration (Akuan Berkanun)',
    nameMs: 'Akuan Berkanun',
    category: 'Letters & Undertakings',
    legalBasis: 'Statutory Declarations Act 1960; made before a Commissioner for Oaths, Magistrate, Justice of the Peace or notary.',
    purpose: 'A formal written statement of fact solemnly declared to be true. In conveyancing it is used to declare matters such as identity, one-and-the-same person, loss of title, beneficial ownership, marital status, or non-bankruptcy.',
    whoUses: 'Any party required to depose to facts \u2014 commonly the vendor, purchaser, or personal representative \u2014 affirmed before a Commissioner for Oaths.',
    keyFields: ['Declarant\u2019s full name, NRIC and address', 'The facts declared (numbered paragraphs)', 'Date and place of declaration', 'Attestation by Commissioner for Oaths / Magistrate'],
    stampDuty: 'Nominal stamp duty of RM10. A Commissioner for Oaths fee (a few Ringgit per declaration) is also payable.',
    timeline: 'Executed as and when required during the transaction (e.g. before registration, or to support a replacement title application).',
    importantNotes: [
      'A false declaration is an offence under the Statutory Declarations Act 1960 and may amount to perjury \u2014 advise the declarant accordingly.',
      'The declaration must be made before an authorised person; a solicitor for the same matter should not also take the declaration in some circumstances.',
      'For a "one and the same person" declaration, attach certified copies of the documents showing the name variants.',
      'For a lost title, the declaration supports the application for a replacement issue document of title under the NLC.',
    ],
    sample: `STATUTORY DECLARATION
(Akuan Berkanun)

I, [DECLARANT FULL NAME], (NRIC No. [________]) of [address],
do solemnly and sincerely declare as follows:

1.  I am the [registered proprietor / purchaser / executor] of all
    that property held under [Title No. ____], Lot/PT [____],
    Mukim/Daerah of [____], State of [____] ("the Property").

2.  [State the fact(s) being declared, e.g.:
    "The person named as \u2018[NAME A]\u2019 in the said title and the person
    named as \u2018[NAME B]\u2019 in my National Registration Identity Card
    refer to one and the same person, namely myself."]

3.  [Further facts, if any, in numbered paragraphs.]

AND I make this solemn declaration conscientiously believing the
same to be true and by virtue of the provisions of the Statutory
Declarations Act 1960.

Subscribed and solemnly      )
declared by the abovenamed   )   ____________________
[DECLARANT] at [____]        )   [DECLARANT]
this [__] day of [____], 20[__] )

Before me,

____________________________________
Commissioner for Oaths / Magistrate`,
  },
  {
    id: 'notice-of-assignment',
    formNumber: 'Notice of Assignment',
    name: 'Notice of Assignment to Developer / Proprietor',
    nameMs: 'Notis Penyerahan Hak',
    category: 'Letters & Undertakings',
    legalBasis: 'Notice perfecting an assignment of contractual rights; commonly required by the principal SPA and to bind the developer/proprietor (analogous to notice under a legal assignment).',
    purpose: 'Notifies the developer or master-title proprietor that the purchaser\u2019s rights under the principal SPA have been assigned (to the new purchaser and/or to the financier as security), so that the developer registers the new party and addresses future correspondence and the title to it.',
    whoUses: 'Solicitor completing a sub-sale or a financing of an untitled (master-title) property, served on the developer/proprietor and acknowledged by it.',
    keyFields: ['Developer/proprietor name and address', 'Identification of the principal SPA and the unit', 'Particulars of the assignment (parties, date)', 'Request for acknowledgement / consent', 'Address for future notices and delivery of title'],
    stampDuty: 'Nominal (RM10) where required; the ad valorem duty sits on the Deed of Assignment.',
    timeline: 'Served at completion of the sub-sale/financing, with the developer\u2019s acknowledgement obtained as a completion deliverable.',
    importantNotes: [
      'Most developer SPAs require the developer\u2019s prior written consent to assign \u2014 obtain consent before serving the notice.',
      'Where there is both an absolute assignment (to the purchaser) and a security assignment (to the bank), notice of BOTH should be given.',
      'Keep the developer\u2019s acknowledged copy on file \u2014 it is needed when the strata/individual title later issues and the transfer is registered.',
      'Update the address for service so that the issue document of title is delivered to the correct (usually the bank\u2019s) solicitors.',
    ],
    sample: `NOTICE OF ASSIGNMENT

Date: [____]
To: [DEVELOPER / PROPRIETOR NAME]
    [Address]

Dear Sirs,

RE: NOTICE OF ASSIGNMENT \u2014 UNIT [____], [PROJECT NAME]
    Principal SPA dated [____] between yourselves and
    [ORIGINAL PURCHASER / ASSIGNOR]

We act for [ASSIGNEE / PURCHASER] ("our client").

TAKE NOTICE that by a Deed of Assignment dated [____],
[ASSIGNOR] has assigned absolutely unto our client all rights,
title, interest and benefit in and to the abovementioned unit and
under the Principal Agreement.

[Where financed:] TAKE FURTHER NOTICE that by an Assignment dated
[____], our client has assigned the same by way of security to
[BANK NAME].

We hereby request that you:
(a) record our client [and the said Bank] as the party entitled
    under the Principal Agreement;
(b) address all future notices, statements and correspondence to
    our client care of this firm; and
(c) deliver the strata/individual title, when issued, to
    [BANK\u2019S / OUR firm] for registration of the transfer and
    charge.

Kindly acknowledge receipt and confirm your consent by signing and
returning the enclosed copy.

Yours faithfully,
____________________
[Firm Name]

We acknowledge receipt and consent to the above:
For [DEVELOPER/PROPRIETOR]: ____________________  Date: [____]`,
  },
  {
    id: 'notice-vacant-possession',
    formNumber: 'Notice of VP',
    name: 'Notice to Deliver / Take Vacant Possession',
    nameMs: 'Notis Penyerahan Milikan Kosong',
    category: 'Letters & Undertakings',
    legalBasis: 'Contractual notice under the SPA; for developer sales, vacant possession and the running of LAD are governed by Schedules G/H, Housing Development (Control and Licensing) Act 1966.',
    purpose: 'Calls upon the vendor (or developer) to deliver vacant possession on completion, or notifies the purchaser that vacant possession is ready to be taken. It fixes the date for handover, apportionment of outgoings and the start of the defect liability period.',
    whoUses: 'Solicitor for either party at completion; for developer purchases, issued by the developer with the keys and the certificate of completion and compliance (CCC).',
    keyFields: ['Parties and property', 'Date for delivery/taking of vacant possession', 'Confirmation of payment / readiness', 'Handover of keys and access cards', 'Apportionment of outgoings', 'Defect liability period (developer)'],
    stampDuty: 'Nil (a notice/letter).',
    timeline: 'Served on or shortly before the completion date / VP date. For developer sales, VP must be delivered within the Schedule G/H statutory period, failing which LAD accrues.',
    importantNotes: [
      'For developer sales, vacant possession is only valid if accompanied by water and electricity supply ready for connection and the CCC \u2014 otherwise VP may be defective and LAD continues to run.',
      'Record the meter readings and conduct a joint inspection on handover; note defects for the defect liability period.',
      'Tie the delivery of VP to receipt of the balance purchase price / redemption, as the SPA provides.',
      'Keep evidence of the date of actual delivery \u2014 it triggers the defect liability period and outgoings apportionment.',
    ],
    sample: `NOTICE TO DELIVER VACANT POSSESSION

Date: [____]
To: [PURCHASER / PURCHASER\u2019S SOLICITORS]

Dear Sirs,

RE: VACANT POSSESSION \u2014 [PROPERTY ADDRESS]
    SPA dated [____] between [VENDOR] and [PURCHASER]

We act for [VENDOR / DEVELOPER].

We are pleased to give notice that vacant possession of the above
property is ready to be delivered to your client on [____]
("the VP Date"), the balance purchase price / redemption having
been [received / arranged].

On the VP Date:
(a) the keys, access cards and [____] sets of as-built/strata
    documents will be handed over;
(b) a joint inspection and meter reading will be conducted;
(c) quit rent, assessment and maintenance charges will be
    apportioned as at the VP Date;
(d) [for developer sales] the Certificate of Completion and
    Compliance (CCC) is enclosed and the defect liability period
    of [24] months commences from the VP Date.

Kindly attend at the property on the VP Date at [____] a.m./p.m.
to take delivery.

Yours faithfully,
____________________
[Firm Name]`,
  },
];
