import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Scale, AlertCircle, ChevronDown, ChevronUp, Gavel, FileText, Home, Building, ShieldCheck, Users, Landmark, Globe, Monitor, Scroll, TreePine, HardHat, Receipt, Handshake, Ban } from 'lucide-react';
import { AudioButton } from '@/components/AudioButton';

interface TopicSection {
  heading: string;
  content: string;
}

interface LawTopic {
  id: string;
  title: string;
  legislation: string;
  icon: React.ReactNode;
  color: string;
  intro: string;
  sections: TopicSection[];
  keyPrinciples: string[];
  keyCases: { name: string; citation: string; principle: string }[];
}

const TOPICS: LawTopic[] = [
  {
    id: 'torrens',
    title: 'The Torrens System & NLC Framework',
    legislation: 'National Land Code 1965 (Act 56)',
    icon: <Scale className="w-5 h-5" />,
    color: 'amber',
    intro: 'The National Land Code 1965 (NLC) is the primary statute governing land law in Peninsular Malaysia and the Federal Territory of Labuan. It codifies and applies the Torrens System — a system of title registration by which the State itself guarantees the title of the registered proprietor.',
    sections: [
      {
        heading: 'Origins & Philosophy',
        content: `The Torrens System was devised by Sir Robert Richard Torrens in South Australia in 1858 and adopted throughout much of the Commonwealth. Its fundamental philosophy is captured in three principles:

1. The Mirror Principle: The register is a perfect mirror of the title. Whatever is on the register is the truth about the land.
2. The Curtain Principle: A buyer need not look behind the register. The registered title is conclusive — past equities are cut off.
3. The Insurance Principle: If an error in the register causes loss, the State compensates the injured party from an assurance fund.

In Malaysia, the NLC came into force on 1 January 1966, replacing the fragmented land laws of the various Malay States. Sabah and Sarawak have their own land codes (Sabah Land Ordinance, Sarawak Land Code).`
      },
      {
        heading: 'The Land Register vs the Issue Document of Title (IDT)',
        content: `The NLC distinguishes between two physical records:

• The Register of Title (Daftar Hakmilik): The primary official record maintained by the State's Land Registry (Pejabat Tanah dan Galian — PTG or the District Land Office — PTD). This is the "true" record of ownership.

• The Issue Document of Title (IDT / Dokumen Hakmilik Keluaran): A copy of the title issued to the registered proprietor (and often held by the bank as security under a charge). The IDT is physical evidence of the proprietor's registration but is NOT the actual register.

Important: Registration on the register — not mere possession of the IDT — confers legal ownership. This is why a lost IDT can be replaced by application under s.160 NLC without affecting the underlying title.`
      },
      {
        heading: 'Categories of Land Use (s.52–55 NLC)',
        content: `All alienated land in Malaysia must carry one of three categories of land use:

1. Agriculture (Pertanian): Use restricted to agricultural activities (farming, orchards, etc.). Any use inconsistent with agriculture requires a change of category.

2. Building (Bangunan): Land intended for construction of residential, commercial, or industrial buildings. Most urban land falls in this category.

3. Industry (Perindustrian): Reserved for industrial activities (manufacturing, processing, warehousing).

Express Conditions (Syarat Nyata) imposed by the State Authority may further restrict use within these categories (e.g. "for residential purposes only" within the Building category). Breach of express conditions can lead to forfeiture of the land by the State under s.127 NLC.`
      },
      {
        heading: 'Types of Land Tenure in Malaysia',
        content: `Malaysian land is held under one of two tenures:

1. Freehold (Milik Selama-lamanya / Pajakan Kekal):
   • The highest form of land holding — ownership is perpetual.
   • Not subject to renewal. The proprietor holds forever, subject to State's rights.
   • More valuable and more freely transferable.

2. Leasehold (Pajakan):
   • The State grants the land for a fixed term, most commonly 99 years, 60 years, or 30 years.
   • Upon expiry, the land reverts to the State unless renewed.
   • Leasehold land with less than 60 years remaining may be difficult to finance.
   • Application to renew must be made to the State Authority before expiry.

Note: There is no common law perpetual freehold "fee simple" in Malaysia. All freehold under the NLC is actually a form of alienation by the State that can be forfeited for breach of conditions.`
      },
      {
        heading: 'Title Types: Qualified vs Final',
        content: `• Qualified Title (Hakmilik Sementara): Issued before the cadastral survey of the land has been completed and gazetted. The title is valid but may be amended upon completion of the survey (boundary adjustments possible). Most new housing estates initially have qualified titles.

• Final Title (Hakmilik Tetap / Geran): Issued after the survey has been finalised and gazetted. Permanent and not subject to further cadastral amendment. The most common form for established urban properties.

• Strata Title (Hakmilik Strata): An individual title issued for a parcel (unit) within a subdivided building under the Strata Titles Act 1985. The land beneath the building is still held by a master title. Each strata parcel is assigned a "share unit" or "unit entitlement" reflecting its proportional interest in the common property.`
      },
    ],
    keyPrinciples: [
      'Registration confers title — not the execution of a transfer deed or payment of purchase price.',
      'An unregistered instrument is merely a contract, not a dealing in land.',
      'The register is the "mirror" of title — what you see is what you get.',
      'Immediate indefeasibility (where applicable) protects bona fide purchasers for value without notice even against fraud by an earlier party.',
      'The Torrens system does not recognise equitable interests per se — it substitutes registration for equitable doctrines.',
    ],
    keyCases: [
      { name: 'Adorna Properties Sdn Bhd v Boonsom Boonyanit', citation: '[2001] 1 MLJ 241 (Federal Court)', principle: 'Held (erroneously) that an immediate purchaser for value in good faith obtained indefeasible title even where the transfer was by forgery — a controversial decision later corrected by Tan Ying Hong.' },
      { name: 'Tan Ying Hong v Tan Sian San & Ors', citation: '[2010] 2 MLJ 1 (Federal Court)', principle: 'Overruled Adorna Properties. Confirmed Malaysia adopts DEFERRED indefeasibility — the immediate purchaser through a forged instrument does NOT get indefeasibility; only a subsequent bona fide purchaser from that person does.' },
      { name: 'Murugasu v Balasubramaniam', citation: '[1957] MLJ 115', principle: 'Established the principle that where a vendor is unable to convey good title, the purchaser is entitled to rescind the contract and recover all monies paid plus interest.' },
    ],
  },
  {
    id: 'indefeasibility',
    title: 'Indefeasibility of Title — Section 340 NLC',
    legislation: 'National Land Code 1965 — Section 340',
    icon: <Gavel className="w-5 h-5" />,
    color: 'blue',
    intro: 'Section 340 of the NLC is the most pivotal provision in Malaysian land law. It confers indefeasibility of title and interest upon registration, while carving out exceptions for fraud, forgery, misrepresentation, and certain other vitiating factors.',
    sections: [
      {
        heading: 'The Statutory Text (Section 340)',
        content: `Section 340(1): The title or interest of any person or body as proprietor of any land, or as holder of any lease, charge or easement, shall, subject to the following provisions of this section, be indefeasible.

Section 340(2): The title or interest of any such person or body shall not be indefeasible in any of the following circumstances, that is to say:
(a) where the title or interest was acquired by the proprietor or holder in question, or by any previous proprietor or holder through whom he claims, by means of an instrument that is void or obtained by fraud, misrepresentation or other dishonest dealing;
(b) where the title or interest was acquired without lawful authority; or
(c) where the instrument was forged.

Section 340(3): Where the title or interest of any person or body is defeasible by reason of any of the circumstances specified in sub-section (2):
(a) it shall be liable to be set aside in the hands of any person or body to whom it may be transferred...
(b) save for as aforesaid, it shall not be liable to be set aside in the hands of any purchaser in good faith for valuable consideration or in the hands of any person or body claiming through or under such a purchaser.`
      },
      {
        heading: 'The Debate: Immediate vs Deferred Indefeasibility',
        content: `This is one of the most debated areas of Malaysian land law:

DEFERRED INDEFEASIBILITY (now confirmed):
Under the deferred theory, the IMMEDIATE purchaser of a defeasible title (e.g. through a forged transfer) does NOT get indefeasibility. Only a SUBSEQUENT bona fide purchaser for value from that immediate purchaser gets indefeasibility.

Chain of title example:
• O = Original Owner
• F = Forger
• B1 = Immediate purchaser from F (B1 does NOT get indefeasible title)
• B2 = Purchaser from B1 in good faith for value (B2 DOES get indefeasible title)

IMMEDIATE INDEFEASIBILITY (overruled):
The Adorna Properties [2001] case had incorrectly held that even B1 (the immediate purchaser from the forger) obtained indefeasible title. This was overruled by Tan Ying Hong [2010].`
      },
      {
        heading: 'Exceptions to Indefeasibility (s.340(2))',
        content: `A registered title can be set aside in the hands of the original acquirer if:

1. FRAUD: The registered proprietor was personally guilty of fraudulent conduct in obtaining registration. Fraud must be actual fraud — not merely constructive or equitable fraud. See Waimiha Sawmilling v Waione Timber (Privy Council) — notice of prior equity is NOT fraud.

2. FORGERY: The instrument used to obtain registration was a forgery (i.e. the Transferor's signature was fabricated). The title obtained through a forged instrument is defeasible in the hands of the IMMEDIATE purchaser.

3. MISREPRESENTATION or OTHER DISHONEST DEALING: e.g. where the transfer was obtained by coercion, undue influence, or deliberate deception of the proprietor.

4. LACK OF LAWFUL AUTHORITY: Where registration was effected without the authority required by law (e.g. a corporation acting ultra vires).

Note: NOTICE (equitable notice / constructive notice) of a prior equitable interest is NOT an exception to indefeasibility under s.340. A purchaser is not required to investigate equities behind the register.`
      },
      {
        heading: 'Overriding Interests',
        content: `Certain interests bind the registered proprietor even without registration. These include:
• Rights of any person in actual occupation of the land (if the registered proprietor had notice)
• Public rights of way and prescriptive easements (in limited circumstances)
• State's statutory rights (e.g. public roads, drainage reserves)
• Rights under the Aboriginal Peoples Act 1954 (orang asal customary land rights — an evolving area of law)

These interests are sometimes compared to "overriding interests" in English land law, though the NLC does not use that terminology.`
      },
    ],
    keyPrinciples: [
      'Registration confers indefeasibility — once registered, title is protected from most challenges.',
      'Malaysia follows DEFERRED indefeasibility (post-Tan Ying Hong) — the immediate acquirer through fraud/forgery is NOT protected.',
      'Only a SUBSEQUENT bona fide purchaser for value from a defeasible proprietor obtains indefeasible title.',
      'Fraud must be ACTUAL fraud on the part of the registered proprietor — not merely notice of prior equity.',
      'Section 340(2) exceptions are EXHAUSTIVE — only the listed circumstances can defeat a registered title.',
    ],
    keyCases: [
      { name: 'Tan Ying Hong v Tan Sian San', citation: '[2010] 2 MLJ 1 (Federal Court)', principle: 'Landmark case that overruled Adorna Properties and firmly adopted deferred indefeasibility for Malaysia. A person who acquires title through a forged instrument is NOT protected.' },
      { name: 'Adorna Properties Sdn Bhd v Boonsom Boonyanit', citation: '[2001] 1 MLJ 241 (Federal Court)', principle: 'Now overruled. Had incorrectly applied immediate indefeasibility, protecting the immediate purchaser through a forged transfer. Caused 9 years of legal uncertainty until Tan Ying Hong.' },
      { name: 'Pemungut Hasil Tanah, Kota Tinggi v Tiong Nyuk Chin', citation: '[1981] 2 MLJ 283', principle: 'Clarified that for fraud to vitiate registered title, the fraud must be that of the registered proprietor himself — not a third party\'s fraud.' },
    ],
  },
  {
    id: 'dealings',
    title: 'Land Dealings: Transfer, Charge, Lease & Easement',
    legislation: 'NLC 1965 — Part Fourteen (ss. 206–294)',
    icon: <FileText className="w-5 h-5" />,
    color: 'green',
    intro: 'A "dealing" in land under the NLC refers to any registered transaction affecting a title — including transfers, charges, leases, and easements. All dealings must be in the prescribed statutory forms and are only effective upon registration.',
    sections: [
      {
        heading: 'Transfer (Pindahmilik) — Form 14A',
        content: `Transfer is the mechanism by which ownership of land passes from one party to another. Key rules:

• Effected by Form 14A (Memorandum of Transfer) under s.215 NLC.
• The transfer is NOT effective until it is REGISTERED. The execution of Form 14A creates only a contractual right, not a registered interest.
• Considerations for transfer: The transfer must be for valuable consideration (purchase price) or in the case of gifts, for natural love and affection (s.26(b) Contracts Act).
• The Transferor must be the registered proprietor. A person who has only a contract to buy (not yet registered) cannot execute a valid Form 14A.
• Attestation requirement: The Transferor must personally appear before an Advocate & Solicitor who must certify the execution.

Sub-Sale: Where A buys from developer and sells to B before title is issued, B's interest is protected by a Deed of Assignment (not a Form 14A) pending title issuance.`
      },
      {
        heading: 'Charge (Cagaran) — Form 16A',
        content: `A charge is the Malaysian equivalent of a mortgage. It is created under s.241 NLC by the proprietor (Chargor) in favour of a financier (Chargee — usually a bank).

Key features of a NLC Charge:
• A charge does NOT transfer ownership. The Chargor remains the registered proprietor.
• The Chargee gets the power of sale (via court order) in the event of default.
• There is no "equity of redemption" separate from the NLC provisions — the right to redeem is statutory (s.265 NLC).
• A charge is effective only upon registration.
• On full repayment, the Chargee must execute Form 16N (Discharge of Charge) — s.278 NLC.

Order for Sale (Foreclosure):
Upon default, the Chargee may apply to the High Court for an Order for Sale under Order 83 Rules of Court or directly to the Land Administrator under s.256 NLC (land office foreclosure — faster but less commonly used for housing).`
      },
      {
        heading: 'Lease (Pajakan) — Form 15A',
        content: `A lease under the NLC is a registered dealing by which the registered proprietor grants to another the right to exclusive possession of land for a specified term.

Key NLC provisions on leases:
• Must be in Form 15A (Registered Lease) and registered to be effective.
• A lease for 3 years or less is NOT required to be registered and can take effect as a mere contractual tenancy.
• Leases of more than 3 years MUST be registered as a dealing.
• Upon registration, the lessee obtains a registered interest in the land — this interest is itself indefeasible.
• The NLC does not apply to the lease of units within a subdivided building (strata parcels) — those are governed by the Strata Titles Act.

Tenancy Agreements (unregistered leases ≤ 3 years):
Most residential tenancies are for 1–2 years and are governed by the Contracts Act 1950 and the Distress Act 1951. They need not be registered but must be stamped.`
      },
      {
        heading: 'Easement (Hak Esemen) — Form 16B',
        content: `An easement is a right over another's land for a specific limited purpose, such as a right of way, right of drainage, or right of support.

Under the NLC:
• Easements must be in Form 16B (Easement Instrument) to be registered.
• Registered easements are binding on all subsequent proprietors of the servient land (the land burdened by the easement).
• The NLC recognises only the specific categories of easements listed in s.283 — equitable or implied easements have limited recognition.
• Easements of necessity (e.g. a landlocked parcel needing access) may be implied by law.

Key distinction: An easement is appurtenant to land — it benefits the dominant tenement and burdens the servient tenement. It is not a personal right.`
      },
    ],
    keyPrinciples: [
      'All dealings are only effective upon REGISTRATION — no dealing passes title before it is registered.',
      'A transfer (Form 14A) creates only a contractual right until registered.',
      'A charge (Form 16A) does not transfer ownership — the Chargor remains proprietor.',
      'A lease exceeding 3 years MUST be registered to be effective as a dealing.',
      'Priority of competing dealings is determined by the order of REGISTRATION, not the order of execution.',
    ],
    keyCases: [
      { name: 'CIMB Bank Bhd v Maybank Trustees Bhd & Ors', citation: '[2014] 3 MLJ 169', principle: 'On the priority of competing registered charges — first registered charge takes priority over subsequent charges in cases of conflict.' },
      { name: 'Kim Teh Sdn Bhd v Majlis Perbandaran Seremban', citation: '[2011] 7 MLJ 537', principle: 'On the interpretation of express conditions — conditions in titles must be strictly complied with and any breach may result in forfeiture of the land.' },
    ],
  },
  {
    id: 'contracts',
    title: 'Contract Law in Conveyancing — Contracts Act 1950',
    legislation: 'Contracts Act 1950 (Act 136); Specific Relief Act 1950 (Act 137)',
    icon: <Scale className="w-5 h-5" />,
    color: 'purple',
    intro: 'Every property sale begins with a contract. The Contracts Act 1950 (based on the Indian Contract Act 1872) governs the formation, validity, performance, and breach of contracts in Malaysia, including Sale and Purchase Agreements (SPA) for property.',
    sections: [
      {
        heading: 'Formation of a Valid Contract — s.10 Contracts Act',
        content: `A legally binding contract requires:
1. Offer and Acceptance: A definite offer by one party and an unequivocal acceptance by the other.
2. Consideration: Something of value given by each party (s.26 CA). For property: the purchase price is the consideration from the Purchaser; conveyance of the property is the consideration from the Vendor.
   Exception: Gifts between immediate family members are supported by "natural love and affection" (s.26(b) CA).
3. Capacity: Both parties must have the legal capacity to contract (not a minor, not of unsound mind, not bankrupt for certain contracts).
4. Free Consent: The agreement must not be induced by coercion (s.15), undue influence (s.16), fraud (s.17), misrepresentation (s.18), or mistake (s.21–s.23).
5. Lawful object: The purpose of the contract must be legal (s.24).

In property law, the Letter of Offer to Purchase (OTP) constitutes an offer; the Vendor's signature of acceptance makes it a binding agreement. The SPA is the principal contract formalising all terms.`
      },
      {
        heading: 'Breach and Remedies',
        content: `When a party breaches a property SPA, the innocent party has the following remedies:

1. Rescission: The contract is treated as void. All monies are refunded (s.65 CA). Applicable where the breach is fundamental or the contract was induced by misrepresentation.

2. Damages: Compensation for actual loss suffered as a result of the breach. For property, this is often the difference between the contract price and the market value.

3. Specific Performance (s.11 Specific Relief Act 1950): A court order compelling the party in breach to perform their contractual obligation (e.g. complete the sale and execute the Form 14A). Courts readily grant specific performance in land contracts because land is unique and damages may be inadequate. See: Macon Works & Trading v Phang Hon Yin [1976] 2 MLJ 177.

4. Injunction: An order restraining the party in breach from doing something (e.g. selling the land to a third party). Commonly obtained ex parte (urgently without notice) where a vendor threatens to resell.`
      },
      {
        heading: 'Liquidated Damages (LAD) in Property Contracts',
        content: `A SPA or HDA Schedule G/H agreement often includes a Liquidated Ascertained Damages (LAD) clause, specifying a pre-agreed sum for breach (typically late delivery of vacant possession).

Under s.75 Contracts Act:
The party claiming LAD must prove reasonable compensation for the breach. Courts have interpreted s.75 to require that the LAD clause be a "genuine pre-estimate of loss" — if it is a penalty clause, it will not be enforced in its full amount.

However, in property contracts (especially HDA contracts):
• The 10% p.a. LAD on the purchase price in Schedule G/H has been upheld by courts as a genuine pre-estimate.
• LAD accrues automatically — the purchaser does not need to prove actual financial loss.
• LAD is calculated on the purchase price for each day of delay, not just on the unpaid amounts.`
      },
      {
        heading: 'Minors & Capacity in Land Contracts',
        content: `Section 11 Contracts Act: "Every person is competent to contract who is of the age of majority according to the law to which he is subject, and who is of sound mind, and is not disqualified from contracting by any law to which he is subject."

Age of Majority Act 1971: The age of majority in Malaysia is 18 years.

Effect of minority: A contract entered into by a minor is VOID from the beginning (ab initio) — not merely voidable. The minor cannot ratify the contract upon reaching majority. This applies to a minor attempting to execute a SPA or Form 14A.

Key case: Tan Hee Juan v Teh Boon Keat [1934] 1 MLJ 96 — land transfers executed by a minor were held void and ordered to be set aside.`
      },
    ],
    keyPrinciples: [
      'A SPA is a contract — all elements of a valid contract must be present (offer, acceptance, consideration, capacity, free consent).',
      'Land is unique — courts readily grant specific performance for land contracts.',
      'LAD clauses in HDA contracts (10% p.a.) are enforceable without proof of actual loss.',
      'A contract with a minor is VOID ab initio — not merely voidable.',
      'Time is of the essence in property contracts — failure to pay on time can lead to rescission and forfeiture of deposit.',
    ],
    keyCases: [
      { name: 'Macon Works & Trading Sdn Bhd v Phang Hon Yin', citation: '[1976] 2 MLJ 177', principle: 'Landmark case — specific performance granted when vendor refused to complete sale after SPA was signed. Established that land is unique and specific performance is the primary remedy for breach of a land SPA.' },
      { name: 'Tan Hee Juan v Teh Boon Keat', citation: '[1934] 1 MLJ 96', principle: 'Land transfers by a minor are void ab initio under the Contracts Act — cannot be ratified upon majority.' },
      { name: 'Lim Hang Seoh v Cheah Heng Keat', citation: '[1978] 2 MLJ 38', principle: 'Where a vendor misrepresented the property\'s boundaries and area, the purchaser was entitled to rescission and full refund of deposit.' },
    ],
  },
  {
    id: 'hda',
    title: 'Housing Development Act 1966 (HDA)',
    legislation: 'Housing Development (Control and Licensing) Act 1966 (Act 118); HD (Control & Licensing) Regulations 1989',
    icon: <Building className="w-5 h-5" />,
    color: 'orange',
    intro: 'The Housing Development (Control and Licensing) Act 1966 is the cornerstone legislation protecting purchasers of residential properties from licensed housing developers in Peninsular Malaysia and Labuan. It imposes strict licensing requirements on developers and mandates the use of prescribed statutory SPA formats (Schedules G, H, I, J) that cannot be varied to the purchaser\'s detriment.',
    sections: [
      {
        heading: 'Scope & Application of the HDA',
        content: `The HDA applies to:
• Housing developers selling 4 or more residential units in a housing accommodation.
• Sales of residential property units (not commercial) in Peninsular Malaysia and the Federal Territory of Labuan.
• Note: Sabah and Sarawak have their own separate housing development legislation.
• The HDA does NOT apply to: subsale transactions between private parties; commercial property sales; or sales of less than 4 units.

Key Definitions (s.3 HDA):
• "Housing developer" means any person, body of persons, company, firm or society who constructs or causes to be constructed a housing accommodation for sale.
• "Housing accommodation" means any building, flat, apartment or a part thereof designed or adapted for human habitation and intended to be disposed of in lots.`
      },
      {
        heading: 'Licensing Requirements — Sections 5 & 6 HDA',
        content: `A developer must obtain TWO separate approvals before selling:

1. Housing Developer's Licence: Granted by the Controller of Housing (Ministry of Housing & Local Government). Renewed annually. Breach: criminal offence.

2. Advertisement Permit & Developer's Licence (APDL): Issued for each specific housing project. The APDL number must appear on all advertisements and on the SPA (Schedule G/H). A developer selling without an APDL cannot legally collect any monies from purchasers.

Under s.7 HDA: The developer must use the prescribed SPA forms (Schedule G for landed; Schedule H for strata; Schedule I for commercial; Schedule J for SOHO/SOFO). Any attempt to exclude statutory rights of the purchaser is void.

Under s.7A HDA: The Tribunal for Homebuyer Claims was established to resolve disputes between developers and purchasers in a cost-effective manner, with jurisdiction up to RM50,000.`
      },
      {
        heading: 'Progressive Payment Schedule & Architect\'s Certificates',
        content: `Under Schedule G & H, payment of the purchase price is by progressive billing tied to the completion of specific stages of construction, certified by an Architect:

Stage 1: 10% — Upon SPA (net of booking fee)
Stage 2: [%] — Completion of foundation
Stage 3: [%] — Completion of reinforced concrete framework of each storey
Stage 4: [%] — Completion of brick walls
Stage 5: [%] — Completion of roofing / roof slab
Stage 6: [%] — Completion of internal plastering & wiring
Stage 7: [%] — Completion of roads, drainage, water & sewerage
Stage 8: [%] — Completion of water supply to each unit
Stage 9: [%] — Completion of sewerage system
Stage 10: [%] — Completion of external plastering
Stage 11: [%] — Completion of electrical wiring, fitting & fixtures
Stage 12: [%] — Completion of internal fittings & fixtures
Stage 13: 5% — Delivery of Vacant Possession

Each billing must be accompanied by a written certificate from the architect confirming completion of that stage. Do NOT pay without the certificate.`
      },
      {
        heading: 'Defect Liability Period (DLP) — Clause 23 Schedule G/H',
        content: `The DLP is 24 months from the date of delivery of Vacant Possession (VP). During the DLP:
• The developer is responsible for repairing all defects in workmanship, materials, and structural integrity at no cost to the purchaser.
• The purchaser must give written notice of defects to the developer.
• The developer must rectify notified defects within 30 days of notice.

Failure to rectify:
• The purchaser may have the defects rectified by independent contractors and claim the cost from the developer.
• The purchaser can claim from the statutory deposit (2.5% of purchase price) which the developer is required to maintain throughout the DLP.
• After the DLP, the developer's liability for defects ceases (subject to common law latent defect liability and implied terms of fitness for purpose).`
      },
    ],
    keyPrinciples: [
      'A developer must have both an APDL and a Housing Developer\'s Licence before selling any unit.',
      'The HDA Schedules G, H, I, J prescribe mandatory SPA terms — any deviation adverse to the purchaser is void.',
      'Progressive payment must be tied to Architect\'s Certificates — no certificate, no payment obligation.',
      'LAD for late VP accrues at 10% p.a. on the purchase price (daily basis) automatically.',
      'The Defect Liability Period is 24 months from VP. Developer must repair all defects within 30 days of written notice.',
    ],
    keyCases: [
      { name: 'Stephen Phoa Cheng Loon & Ors v Highland Properties Sdn Bhd', citation: '[2000] 4 MLJ 200', principle: 'Developers owe a duty of care to purchasers in the construction of housing accommodation. Defective construction causing physical injury to persons or property gives rise to tortious liability.' },
      { name: 'Hock Huat Rubber Factory Sdn Bhd v Sungai Way Freeway Sdn Bhd', citation: '[1997] 1 MLJ 507', principle: 'LAD clauses in property contracts are enforceable as genuine pre-estimates of loss and do not require proof of actual loss.' },
    ],
  },
  {
    id: 'strata',
    title: 'Strata Titles Act 1985 & Strata Management Act 2013',
    legislation: 'Strata Titles Act 1985 (Act 318); Strata Management Act 2013 (Act 757)',
    icon: <Building className="w-5 h-5" />,
    color: 'cyan',
    intro: 'The Strata Titles Act 1985 (STA) and the Strata Management Act 2013 (SMA) together regulate the ownership, management, and maintenance of subdivided buildings (condominiums, apartments, serviced apartments, office suites, and retail lots) in Malaysia.',
    sections: [
      {
        heading: 'Subdivision of Building — Strata Title Process (STA 1985)',
        content: `Before individual strata titles can be issued for units in a building, the building must be "subdivided" under the STA:

1. The developer applies to the Director of Lands & Mines (JKPTG) for approval to subdivide the building.
2. A licensed surveyor surveys the individual parcels (units) and common property.
3. A Strata Plan is prepared showing each parcel's boundaries, floor area, and share unit allocation.
4. Upon approval and opening of the Strata Register Book, individual strata titles are issued for each parcel.

Upon issuance of strata titles:
• Each parcel owner holds an individual Strata Title (Hakmilik Strata) — this is a registered title under the STA.
• The land beneath the building remains under a Master Title in the Developer's/MC's name.
• The Management Corporation is automatically constituted (s.39 STA).`
      },
      {
        heading: 'Share Units & Unit Entitlement',
        content: `Each parcel (unit) is allocated a "share unit" (or unit entitlement) based on its floor area relative to all other parcels. Share units determine:

1. Voting rights at MC meetings (one vote per share unit)
2. Liability for maintenance charges (charged proportionally to share units)
3. Proportion of common property owned by each proprietor

Example: A project has 100 units. Unit A (1,200 sq ft) has 12 share units; Unit B (800 sq ft) has 8 share units. If annual maintenance budget is RM1,200,000, Unit A pays RM12,000/year; Unit B pays RM8,000/year.

The share unit allocation CANNOT be changed by the MC — it is fixed at the time of subdivision and is part of the Strata Plan.`
      },
      {
        heading: 'Management Corporation (MC) — SMA 2013',
        content: `The Management Corporation (MC) is a statutory body constituted automatically upon the opening of the strata register book (s.39 STA). All parcel owners are automatically members.

Powers & Duties of the MC (s.36 SMA):
• Manage, maintain, and repair common property
• Collect maintenance charges and sinking fund contributions
• Enforce by-laws
• Enter into service contracts (security, cleaning, lifts, etc.)
• Sue and be sued in its own name

Two-Stage Governance:
1. Joint Management Body (JMB): Formed upon VP (before strata titles issued). Transitional body comprising developer and purchasers.
2. Management Corporation (MC): Takes over upon issuance of strata titles. JMB is dissolved.

By-Laws:
The MC's by-laws are binding on all parcel owners. Default by-laws are prescribed in the Strata Management (Maintenance and Management) Regulations 2015. Additional or amended by-laws require a special resolution (75% vote).`
      },
      {
        heading: 'Strata Management Tribunal',
        content: `The Strata Management Tribunal (SMT) was established under s.107 SMA 2013 to provide a fast, cheap, and accessible forum to resolve disputes between:
• Parcel owners and the MC/JMB
• Between parcel owners inter se
• Between the developer and purchasers on strata management matters

Jurisdiction:
• Claims for outstanding maintenance charges, sinking fund contributions
• Claims for repairs and rectification of defects in common property
• Disputes over by-law enforcement
• Maximum claim: RM250,000

Advantages over courts: No lawyers required (parties can represent themselves); decisions in weeks (not years); lower cost; enforceable as court orders.`
      },
    ],
    keyPrinciples: [
      'A strata title confers INDIVIDUAL ownership of a specific parcel (unit) within a subdivided building.',
      'All parcel owners are automatic members of the Management Corporation — membership is inseparable from strata ownership.',
      'Share units determine voting rights and liability for maintenance charges.',
      'The MC\'s primary obligation is the management and maintenance of COMMON PROPERTY — not individual parcels.',
      'By-laws bind all parcel owners (current and future) and can only be changed by special resolution.',
    ],
    keyCases: [
      { name: 'Perbadanan Pengurusan Bukit Damansara v Yong Weng Fatt', citation: '[2017] MLJU 553', principle: 'The MC has the power to sue parcel owners for outstanding maintenance charges. Non-payment is a continuing breach justifying court action.' },
    ],
  },
  {
    id: 'rpgt',
    title: 'Real Property Gains Tax (RPGT) Act 1976',
    legislation: 'Real Property Gains Tax Act 1976 (Act 169); RPGT (Exemption) Orders',
    icon: <FileText className="w-5 h-5" />,
    color: 'red',
    intro: 'RPGT is a tax on the capital gain realised on the disposal (sale or gift) of real property in Malaysia or on the disposal of shares in a "real property company" (RPC). It applies to both the vendor (disposer) and, in limited circumstances, the purchaser (acquirer in terms of withholding obligations).',
    sections: [
      {
        heading: 'Chargeable Gain & Tax Computation',
        content: `RPGT Formula:
Chargeable Gain = Disposal Price − (Acquisition Price + Allowable Expenditure)

Disposal Price: The price in the SPA, or the market value if disposal is for inadequate consideration.
Acquisition Price: Original purchase price paid for the property.
Allowable Expenditure (s.7 RPGT Act):
• Legal fees and stamp duty paid on original acquisition
• Real estate agent's commission on disposal
• Cost of improvements/renovations (with receipts)
• Any enhancement expenditure

Example:
  Disposal Price (current sale):  RM800,000
  Acquisition Price (original):   RM500,000
  Allowable Expenditure:          RM30,000
  CHARGEABLE GAIN:               RM270,000`
      },
      {
        heading: 'RPGT Rates — Effective 2022',
        content: `RPGT rates (Malaysian citizens and permanent residents):
• Year of disposal 1 (within 1 year of acquisition): 30%
• Year 2: 30%
• Year 3: 30%
• Year 4: 20%
• Year 5: 15%
• Year 6 and beyond: NIL (0%) — for citizens & PRs

RPGT rates (Non-citizens / Companies):
• Years 1–5: 30%
• Year 6 and beyond: 10% for companies; 10% for non-citizens

Note: "Year of disposal" is calculated from the acquisition date to the disposal (SPA) date.`
      },
      {
        heading: 'RPGT Exemptions',
        content: `Statutory Exemptions (Schedule 4, RPGT Act):
1. Once-in-Lifetime Exemption: A Malaysian citizen individual may elect to be exempt from RPGT on the disposal of ONE private residential property in their lifetime. This is irrevocable once elected.
2. Gifts to Spouse, Parent or Child: Disposal by way of gift to an immediate family member is exempt (provided no money changes hands).
3. Compulsory Acquisition: Disposal of property compulsorily acquired by a government authority is exempt.
4. Principal Residence Exemption (historical): Abolished from 1 January 2010 onwards.

Retention Sum (s.21B RPGT Act):
The PURCHASER must withhold 3% of the purchase price and remit it to LHDN within 60 days of the SPA date as a retention on account of the VENDOR's potential RPGT liability. If the vendor's actual RPGT is less, LHDN refunds the excess.`
      },
    ],
    keyPrinciples: [
      'RPGT is charged on the GAIN (profit) from disposal — not on the full disposal price.',
      'For Malaysian citizens, disposal after 5 years of ownership attracts NIL RPGT.',
      'The once-in-lifetime exemption is available to each Malaysian individual for one residential property.',
      'The 3% retention (CKHT 502) is the PURCHASER\'s obligation — failure to withhold makes the purchaser personally liable.',
      'CKHT 1A (vendor) and CKHT 2A (purchaser) must be filed within 60 days of the SPA date.',
    ],
    keyCases: [
      { name: 'Ketua Pengarah Hasil Dalam Negeri v MBf Holdings Bhd', citation: '[2007] 3 MLJ 737', principle: 'On computation of RPGT where the disposal price is not arm\'s length — LHDN can substitute market value for the contractual price.' },
    ],
  },
  {
    id: 'caveats',
    title: 'Caveats Under the NLC',
    legislation: 'National Land Code 1965 — Part Nineteen (ss. 319–333)',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'yellow',
    intro: 'A caveat is a statutory device under the NLC that "freezes" the title register — preventing any further dealings on the title from being registered without notice to the caveator. It is an important protective tool for persons with unregistered interests in land.',
    sections: [
      {
        heading: 'Types of Caveats',
        content: `The NLC recognises three types of caveats:

1. REGISTRAR'S CAVEAT (s.319–s.321):
   • Entered by the Land Registrar (not a private party) on the Registrar's own initiative.
   • Purpose: To protect the interests of persons under disability (minors, persons of unsound mind) or in pursuance of court orders.
   • Effect: Prevents any dealing from being registered while in force.
   • Cannot be withdrawn voluntarily by a private party — removed by the Registrar when no longer necessary.

2. PRIVATE CAVEAT (s.322–s.330) — Form 19B:
   • Entered by ANY person claiming a caveatable interest in land.
   • Most common type — used by purchasers, lenders, beneficiaries, and other interested parties.
   • Effect: Prevents registration of any dealing with the caveated land (except dealings entered before the caveat).
   • Duration: 6 years (unless earlier withdrawn or removed by court order).
   • Can be terminated by: (a) Voluntary withdrawal by caveator (Form 19G); (b) Court order; (c) s.322 notice by proprietor.

3. LIEN-HOLDER'S CAVEAT (s.330) — Form 19H:
   • Entered by a person who holds a lien over land (i.e. the IDT has been deposited as security without a formal charge).
   • Protects the lien-holder's position against subsequent dealings.`
      },
      {
        heading: 'Caveatable Interest — What Qualifies?',
        content: `Not every claim entitles a person to enter a private caveat. The claim must constitute a "caveatable interest" — a legally recognisable equitable or beneficial interest in the specific land:

Valid Caveatable Interests:
• Rights as purchaser under a signed SPA (even before completion)
• Beneficiary's interest under a trust over land
• Rights under a contractual option to purchase
• Equitable mortgagee's interest (deposit of IDT as lien)
• A prior unregistered interest that has not yet been lodged for registration

NOT caveatable:
• A mere contractual right not relating to a specific piece of land
• A judgment debt (use a writ of seizure and sale instead)
• A personal claim (use other legal mechanisms)

Wrongful Caveat: If a caveat is lodged without a genuine caveatable interest, the caveator may be sued for damages by the proprietor for loss caused by the freezing of the title — see s.329 NLC.`
      },
      {
        heading: 'Section 322 NLC — Removal of Caveat Procedure',
        content: `Where a private caveat is blocking a transaction, the registered proprietor may invoke s.322 NLC to force the caveator to justify the caveat:

Procedure:
1. The registered proprietor (or any person with an interest) serves a s.322 Notice on the caveator.
2. The Land Registrar also serves a copy of the notice on the caveator.
3. The caveator has 14 days from service of the notice to:
   (a) Commence legal proceedings to establish their claim; AND
   (b) Lodge a copy of the originating process with the Registrar within the 14-day period.
4. If the caveator fails to comply within 14 days, the caveat LAPSES and the Registrar will remove it from the register.

Important: A court may, in appropriate cases, grant an interim injunction to the caveator preserving the caveat pending trial, even if court proceedings are not yet commenced.`
      },
    ],
    keyPrinciples: [
      'A caveat does NOT give the caveator ownership — it merely prevents registration of further dealings.',
      'A caveatable interest must be a legal or equitable interest in the specific land — not merely a personal claim.',
      'Lodging a caveat without a genuine interest is wrongful and attracts damages.',
      'A s.322 notice gives the caveator 14 days to commence court proceedings or the caveat lapses.',
      'A caveat does not affect dealings registered BEFORE the caveat was entered.',
    ],
    keyCases: [
      { name: 'Luggage Distributors (M) Sdn Bhd v Tan Hor Teng & Anor', citation: '[1995] 1 MLJ 783', principle: 'Clarified that a caveatable interest must be a definite and tangible interest in the specific land — a mere contractual right is insufficient.' },
      { name: 'Teh Bee v K Maruthamuthu', citation: '[1977] 2 MLJ 7', principle: 'The court confirmed a purchaser under a SPA has a caveatable interest — the right as purchaser under a specifically enforceable contract.' },
    ],
  },
  {
    id: 'stamp',
    title: 'Stamp Duty & Solicitors\' Remuneration',
    legislation: 'Stamp Act 1949 (Act 378); Solicitors Remuneration Order 2023',
    icon: <FileText className="w-5 h-5" />,
    color: 'slate',
    intro: 'Stamp duty and legal fees are two unavoidable costs in every conveyancing transaction. The Stamp Act 1949 governs the duty payable on instruments, while the Solicitors Remuneration Order 2023 prescribes the minimum scale of legal fees for conveyancing matters.',
    sections: [
      {
        heading: 'Stamp Duty — General Principles',
        content: `Stamp duty is a form of transaction tax payable on certain legal instruments. Under the Stamp Act 1949:

• Ad valorem duty: Calculated as a percentage of the transaction value (e.g. on SPAs, MOTs, loan agreements).
• Fixed duty: A flat sum regardless of value (e.g. RM10 for Form 16N discharge of charge; RM10 for each duplicate SPA).
• Instruments must be stamped within 30 days of execution. Late stamping attracts a penalty of up to 5x the original duty.
• Unstamped instruments are inadmissible as evidence in Malaysian courts.

Ad Valorem Scale for Transfer (MOT):
• First RM100,000: 1%
• RM100,001 – RM500,000: 2%
• RM500,001 – RM1,000,000: 3%
• Above RM1,000,000: 4%

Stamp Duty on Loan Agreement: 0.5% on the loan amount (charged once on the principal loan agreement).`
      },
      {
        heading: 'First Home Buyer Stamp Duty Exemptions',
        content: `Malaysian citizen first-home buyers enjoy substantial stamp duty exemptions:
• Full exemption on the first RM500,000 of the property price.
• 50% exemption on the next RM500,000 (RM500,001 – RM1,000,000).
• No exemption on amounts exceeding RM1,000,000.

This means:
• Property price RM500,000 — ZERO stamp duty.
• Property price RM700,000 — 50% discount on duty for the RM200k in the RM500k–1M tier.
• Property price RM1,000,000 — 50% discount on duty for the RM500k–1M tier.
• Property price RM1,500,000 — no exemption; full ad valorem on the entire price.

Conditions: Must be a Malaysian citizen; must not have previously owned any residential property.`
      },
      {
        heading: 'Solicitors\' Remuneration Order 2023',
        content: `The Solicitors Remuneration Order (SRO) 2023 replaced the 2005 Order and prescribes the MINIMUM scale fee for conveyancing matters:

Scale Fees for SPA / Transfer — Jadual Pertama, Susunan A (on the consideration or adjudicated value):
• First RM500,000: 1.25%
• Next RM7,000,000 (RM500,001 – RM7,500,000): 1.0%
• Above RM7,500,000: Negotiable on the excess, but not exceeding 1%
• Minimum fee: RM500

The same Scale A applies to loan / charge documentation under Jadual Ketiga (on the amount secured or financed). Under Rule 6 of the SRO 2023, a solicitor MAY give a discount of up to 25% on the Susunan A fees (Jadual Pertama and Jadual Ketiga), but NO discount is allowed on Susunan B, Jadual Kedua, Jadual Keempat, Jadual Kelima or Jadual Keenam. Charging below the permitted floor (or waiving fees entirely to tout for work) is a disciplinary offence under the Legal Profession Act 1976.

Housing Development Act sales (purchase from a licensed developer) use the reduced Susunan B scale: RM500 flat (≤RM50k); 75% of Scale A (RM50k–250k); 70% (RM250k–500k); 65% (RM500k–1m); 50% (above RM1m).

Note: The SRO 2023 replaced the 2005 Order and consolidated the sale/transfer scale into two bands (1.25% then 1%).`
      },
    ],
    keyPrinciples: [
      'All instruments that attract stamp duty must be stamped within 30 days of execution — penalties for late stamping are severe.',
      'Unstamped instruments are INADMISSIBLE as evidence in court.',
      'Malaysian first-home buyers enjoy full exemption on the first RM500,000 and 50% exemption on the next RM500,000.',
      'Solicitors\' fees for conveyancing are governed by the SRO 2023 — a discount of up to 25% is permitted on Susunan A (Jadual Pertama & Ketiga), but not on Susunan B.',
      'Stamp duty on a loan agreement: 0.5% on the loan amount (charged on the principal loan agreement only).',
    ],
    keyCases: [
      { name: 'Abdul Aziz bin Mohd Yusoff v Pendaftar Mahkamah Tinggi', citation: '[2019] MLJU 482', principle: 'An unstamped SPA is inadmissible as evidence in court proceedings even if the parties rely on it to establish their rights — stamp the document or face exclusion.' },
    ],
  },
  {
    id: 'compulsory',
    title: 'Compulsory Acquisition — Land Acquisition Act 1960',
    legislation: 'Land Acquisition Act 1960 (Act 486)',
    icon: <Landmark className="w-5 h-5" />,
    color: 'red',
    intro: 'The Land Acquisition Act 1960 (LAA) empowers the Federal and State Governments to compulsorily acquire private land for public purposes. This power is grounded in Article 13 of the Federal Constitution, which guarantees that no person shall be deprived of property except in accordance with law and with adequate compensation.',
    sections: [
      {
        heading: 'Constitutional Basis & Public Purpose',
        content: `Article 13 of the Federal Constitution provides:
(1) No person shall be deprived of property save in accordance with law.
(2) No law shall provide for the compulsory acquisition or use of property without adequate compensation.

Under the LAA 1960, land may be acquired for:
1. A "public purpose" — infrastructure, schools, hospitals, public housing, etc.
2. The benefit of any person or corporation for a purpose deemed beneficial to the economic development of Malaysia.
3. Mining, residential, agricultural, commercial, or industrial purposes.

The definition of "public purpose" is broadly interpreted by Malaysian courts. However, the acquisition must genuinely serve the stated purpose — colourable or mala fide acquisitions can be challenged.`
      },
      {
        heading: 'Acquisition Process',
        content: `The LAA prescribes a detailed process:

1. Section 4 Publication — The State Authority publishes a notification in the Gazette that the land is likely needed for acquisition. This authorises officers to enter and survey the land.

2. Section 8 Declaration — The State Authority formally declares the land is needed. This is the critical date for determining market value for compensation.

3. Section 10 Notice — Individual notices are served on the registered proprietor and all interested parties, specifying a date for the inquiry.

4. Section 12 Inquiry — The Collector conducts an inquiry, hearing submissions from affected parties on the amount of compensation.

5. Section 14 Award — The Collector makes a written Award of compensation, specifying the amount payable.

6. Section 22 Taking Possession — After the Award and payment/deposit of compensation, the State takes possession.

7. Section 37 Appeal — Dissatisfied landowners may appeal to the High Court within 6 weeks of the Award.`
      },
      {
        heading: 'Assessment of Compensation',
        content: `Compensation is assessed based on:

1. Market Value of the Land (s.14(1)(a)) — The price a willing seller would obtain from a willing buyer in the open market at the date of the s.8 declaration. This is the primary component.

2. Damage for Severance (s.14(1)(b)) — If only part of the land is acquired, compensation for the diminution in value of the remaining land.

3. Injurious Affection (s.14(1)(c)) — Compensation if the acquisition or the proposed use will adversely affect other property of the affected person.

4. Disturbance (s.14(1)(d)) — Reasonable expenses incidental to the compulsory change of residence or place of business.

Matters NOT to be considered (s.14(2)):
• Any increase in value due to the improvement made after the s.4 publication
• The urgency of the acquisition
• Any disinclination of the owner to part with the land`
      },
    ],
    keyPrinciples: [
      'The s.8 declaration date fixes the valuation date for compensation — not the date of the Award or taking possession.',
      'Market value must reflect what a willing buyer would pay a willing seller — not government valuations.',
      'Partial acquisition may entitle the owner to severance and injurious affection compensation.',
      'Appeal to the High Court must be filed within 6 weeks of the Award.',
      'The landowner has no right to refuse acquisition — only to challenge the adequacy of compensation.',
    ],
    keyCases: [
      { name: 'Collector of Land Revenue v Alagappa Chettiar', citation: '[1971] 1 MLJ 43', principle: 'Established that compensation must reflect the true market value of the land including its development potential, not merely its existing use value.' },
      { name: 'Pemungut Hasil Tanah, Daerah Barat Daya v Ong Gaik Kee', citation: '[1983] 2 MLJ 35', principle: 'Held that expert valuation evidence is critical in land acquisition cases. The court should prefer independent expert valuations over government-assessed values when determining adequate compensation.' },
    ],
  },
  {
    id: 'islamic',
    title: 'Islamic Home Financing in Conveyancing',
    legislation: 'Islamic Financial Services Act 2013 (Act 759)',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: 'green',
    intro: 'Malaysia is a global leader in Islamic finance. Islamic home financing products comply with Shariah principles — avoiding riba (interest), gharar (uncertainty), and maysir (gambling). These products use distinct contractual structures that have significant implications for conveyancing practitioners.',
    sections: [
      {
        heading: 'Shariah Principles in Property Financing',
        content: `Islamic financing is governed by several fundamental prohibitions:

1. Riba (Interest/Usury) — Any predetermined return on money lent is prohibited. Islamic banks use sale-based or partnership-based structures instead.

2. Gharar (Excessive Uncertainty) — Contracts must have clear terms, known subject matter, and defined obligations.

3. Maysir (Gambling/Speculation) — Speculative transactions are prohibited.

Instead of lending money at interest (as in conventional financing), Islamic banks use sale or partnership structures:
• The bank purchases the property and sells it to the customer at a profit (BBA/Murabahah)
• The bank and customer jointly own the property and the customer gradually buys out the bank's share (Musharakah Mutanaqisah)
• The bank purchases the property and leases it to the customer with an option to purchase (Ijarah/AITAB)`
      },
      {
        heading: 'Musharakah Mutanaqisah (Diminishing Partnership)',
        content: `The most popular Islamic home financing structure in Malaysia today:

1. Joint Purchase — Bank and customer jointly purchase the property. The bank funds 90% (or the financed portion); the customer pays 10% (or the down payment).

2. Rental Payment — The customer pays monthly "rent" to the bank for the use of the bank's share of the property. This rent is the bank's profit.

3. Gradual Buy-Out — A portion of each monthly payment is used to purchase additional units of the bank's share. Over time, the customer's ownership percentage increases while the bank's decreases.

4. Full Ownership — At the end of the financing tenure, the customer has purchased 100% of the bank's share and becomes sole owner.

Conveyancing Implications:
• The charge (Form 16A) documentation is similar to conventional charges
• The property sale price stated in the MM facility agreement is the total of all payments (principal + profit) — NOT the market value
• Stamp duty on the charge is typically assessed on the financing amount (principal), not the total sale price`
      },
      {
        heading: 'Bay\' Bithaman Ajil (BBA) & Commodity Murabahah',
        content: `Bay' Bithaman Ajil (Deferred Payment Sale):
The bank buys the property at market price, then sells it to the customer at a higher price (cost + profit margin), payable in instalments over the agreed tenure. The difference between the purchase and sale prices is the bank's profit.

Key issue for conveyancing: The sale price in the BBA agreement may be significantly higher than the property's market value (e.g. bank buys at RM400,000, sells to customer at RM800,000 payable over 25 years). This creates complications for stamp duty assessment and ibra' (rebate on early settlement).

Commodity Murabahah (Tawarruq):
A more recent structure involving the sale and purchase of commodities (usually crude palm oil):
1. Customer "sells" commodities to the bank at a spot price
2. Bank sells back to the customer at a deferred (higher) price
3. The deferred price is paid in instalments — effectively creating a financing arrangement

This structure avoids the BBA pricing issue and is increasingly common for personal and home financing.`
      },
      {
        heading: 'Takaful — Islamic Insurance for Home Financing',
        content: `Takaful replaces conventional insurance (MRTA/MLTA) for Islamic financing:

• Home Financing Protection Takaful (HFPT): Covers the outstanding financing amount upon death or Total Permanent Disability (TPD).

• Takaful operates on the principle of mutual cooperation (ta'awun) — participants contribute to a shared fund from which claims are paid.

• Surplus in the fund is distributed to participants (unlike conventional insurance where surplus belongs to the insurer).

For conveyancing: Takaful certificates serve the same function as MRTA/MLTA policies. The bank requires Takaful coverage as a condition of financing, and the certificate must be assigned to the bank as security.

Practitioners should verify whether the Takaful policy adequately covers the financing amount and whether the assignment has been properly executed and registered.`
      },
    ],
    keyPrinciples: [
      'Islamic financing uses sale or partnership structures — never interest-bearing loans.',
      'The charge documentation (Form 16A) for Islamic and conventional financing is substantially similar.',
      'In BBA, the "sale price" may far exceed market value — practitioners must understand this does not reflect the property value.',
      'Musharakah Mutanaqisah involves joint ownership that gradually transfers to the customer.',
      'Ibra\' (rebate) applies on early settlement of Islamic financing — reducing the total payable amount.',
      'Takaful replaces MRTA/MLTA — ensure proper assignment to the financing bank.',
    ],
    keyCases: [
      { name: 'Bank Islam Malaysia Bhd v Lim Kok Hoe', citation: '[2009] 6 MLJ 839 (Federal Court)', principle: 'The Federal Court examined the legality of BBA financing structures and held that Islamic banking transactions must comply with both Shariah principles and civil law. The BBA sale price must not be unconscionable.' },
      { name: 'Arab Malaysian Finance Bhd v Taman Ihsan Jaya Sdn Bhd', citation: '[2008] 5 MLJ 631', principle: 'Held that the ibra\' (rebate) principle applies on early settlement of Islamic financing — the customer should not pay the full deferred sale price if settling early, as the bank has not "earned" the profit for the unexpired period.' },
    ],
  },
  {
    id: 'foreign',
    title: 'Foreign Purchasers & Malay Reserve Land',
    legislation: 'National Land Code 1965; Malay Reservations Enactment 1913; EAC Guidelines',
    icon: <Globe className="w-5 h-5" />,
    color: 'purple',
    intro: 'Malaysian land law imposes significant restrictions on land ownership by foreign nationals and non-Bumiputera purchasers. Understanding these restrictions is critical for practitioners handling transactions involving foreign buyers, Malay Reserve Land, and Bumiputera lots.',
    sections: [
      {
        heading: 'Foreign Purchasers — State Authority Consent',
        content: `Non-citizens and foreign companies must obtain State Authority consent before acquiring land in Malaysia. Key requirements:

1. Minimum Purchase Price — Each state sets a minimum threshold (typically RM1,000,000 for residential property in most states; higher in prime areas like Kuala Lumpur).

2. State Authority Approval — Application must be made to the State Authority (Pihak Berkuasa Negeri) through the Economic Planning Unit (EPU) or the state land office.

3. Property Type Restrictions — Foreign purchasers are generally prohibited from buying:
   • Malay Reserve Land
   • Properties priced below the state minimum
   • Low and medium-cost residential properties
   • Properties allocated as Bumiputera lots
   • Agricultural land (in most states)

4. Levy — Some states impose an additional levy (1-3% of the purchase price) on foreign acquisitions.

SPA Drafting: The SPA must include a condition precedent requiring State Authority consent. If consent is refused, the SPA should provide for rescission and refund of deposits.`
      },
      {
        heading: 'Malay Reserve Land (MRL)',
        content: `Malay Reserve Land is land gazetted under the Malay Reservations Enactment 1913 (in Peninsular Malaysia) or equivalent state legislation:

1. Ownership Restriction — MRL can only be owned, transferred, charged, or leased to Malay persons. This is a constitutional protection under Article 89 of the Federal Constitution.

2. Definition of "Malay" — Under Article 160, a "Malay" is a person who professes the Muslim religion, habitually speaks the Malay language, and conforms to Malay custom. This is a legal definition, not merely an ethnic one.

3. Charge to Non-Malay — A charge over MRL can only be created in favour of a Malay person or a state government-approved institution. Some banks may not finance MRL if they cannot hold a valid charge.

4. De-gazetting — MRL can only be de-gazetted (removed from reserve status) by the State Authority with the approval of the Ruler-in-Council. This is politically sensitive and rarely done.

5. Title Endorsement — MRL status is endorsed on the title. Practitioners must check for this endorsement during title searches.`
      },
      {
        heading: 'Bumiputera Lots & Release Mechanisms',
        content: `Many housing developments in Malaysia allocate a percentage of units (typically 30-50%) as Bumiputera lots:

1. Bumiputera Discount — Bumiputera purchasers typically receive a 5-15% discount on the purchase price.

2. Restriction on Title — Bumiputera lots carry a restriction in interest: they cannot be transferred to non-Bumiputera persons without State Authority consent.

3. Release Application — A Bumiputera lot owner may apply to the State Authority for release of the Bumiputera status. This involves:
   • Proof that the property has been marketed to Bumiputera buyers for a minimum period (typically 6-12 months)
   • Obtaining a certificate from the developer or estate agent confirming no Bumiputera buyer has come forward
   • Payment of a release premium (varies by state)

4. Practical Issues — Bumiputera lots are often more difficult to sell due to the smaller buyer pool. Financing may also be affected if the bank is concerned about resale value.

Practitioners must advise purchasers about the implications of buying a Bumiputera lot, especially regarding future resale.`
      },
      {
        heading: 'Malaysia My Second Home (MM2H) Programme',
        content: `The MM2H programme allows foreign nationals to acquire residential property in Malaysia subject to conditions:

1. Minimum Purchase Price — Varies by state (RM600,000 to RM2,000,000 depending on the state and property type).

2. Property Limit — MM2H participants may purchase up to 2 residential properties.

3. Prohibited Properties — Cannot purchase:
   • Properties below the state minimum price
   • Properties on Malay Reserve Land
   • Properties allocated for Bumiputera
   • Agricultural land

4. Visa Requirement — MM2H participants must maintain a valid MM2H visa. Property ownership does not automatically confer residency rights.

5. Fixed Deposit Requirement — MM2H participants must maintain a fixed deposit in a Malaysian bank (RM150,000 for applicants below 50; RM100,000 for those above 50).

Conveyancing practitioners should verify the client's MM2H status and ensure compliance with state-specific restrictions.`
      },
    ],
    keyPrinciples: [
      'Foreign purchasers must obtain State Authority consent — without it, the transfer is unregistrable.',
      'Malay Reserve Land can only be owned by Malay persons — this is a constitutional restriction.',
      'Bumiputera lots carry a restriction in interest that limits the buyer pool and may affect resale value.',
      'Each state has its own minimum purchase price for foreign buyers — no single national threshold exists.',
      'MM2H participants are subject to additional restrictions beyond general foreign purchaser rules.',
    ],
    keyCases: [
      { name: 'Haji Abdul Rahman bin Haji Mohd Dahan v Jabatan Ketua Pengarah Tanah dan Galian', citation: '[1997] 3 MLJ 337', principle: 'Confirmed that Malay Reserve Land restrictions are constitutionally mandated and cannot be waived by the State Authority except through proper de-gazetting procedures.' },
      { name: 'Superintendent of Lands & Surveys v Aik Hoe & Co Ltd', citation: '[1966] 2 MLJ 60', principle: 'Held that a transfer of land to a non-qualified person in breach of land restrictions is void and the Registrar must refuse registration.' },
    ],
  },
  {
    id: 'ethics',
    title: 'Professional Ethics & Anti-Money Laundering',
    legislation: 'Legal Profession Act 1976 (Act 166); AMLA 2001 (Act 613)',
    icon: <Users className="w-5 h-5" />,
    color: 'cyan',
    intro: 'Conveyancing practitioners in Malaysia are bound by the Legal Profession Act 1976, the Bar Council Rulings, and the Solicitors Accounts Rules. Additionally, the Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 (AMLA) imposes significant compliance obligations on lawyers handling property transactions.',
    sections: [
      {
        heading: 'Professional Conduct in Conveyancing',
        content: `Key ethical obligations for conveyancing practitioners:

1. Conflict of Interest — A solicitor must not act for both vendor and purchaser in the same transaction unless:
   • Both parties give informed written consent
   • There is no actual or potential conflict
   • The transaction is straightforward (e.g. a related-party transfer)

2. Client's Money — All client money must be deposited into the firm's Client Account within 1 working day of receipt. Solicitors must never mix client money with office money.

3. Undertakings — A solicitor's undertaking is a binding professional promise. Failure to honour an undertaking is a serious disciplinary offence that can result in striking off.

4. Due Diligence on Clients — Solicitors must verify the identity of clients (KYC — Know Your Client) and be alert to suspicious transactions.

5. Confidentiality — All client communications are privileged and confidential, except where disclosure is required by law (e.g. suspicious transaction reporting under AMLA).

6. Fiduciary Duty — The solicitor owes a fiduciary duty to act in the client's best interest. Personal interests must never conflict with the client's interest.`
      },
      {
        heading: 'Solicitors\' Accounts Rules',
        content: `The Solicitors' Accounts Rules 1990 (as amended) govern how solicitors handle client money:

1. Client Account — Every law firm must maintain a separate Client Account in an approved bank. All money received on behalf of clients must be deposited here.

2. Office Account — The firm's own money (fees, profit) is kept in the Office Account. Only earned fees (after billing) may be transferred from Client Account to Office Account.

3. Reconciliation — Client Accounts must be reconciled monthly. The firm must maintain proper accounting records showing each client's balance.

4. Interest — Interest earned on Client Account money belongs to the client, not the firm (unless the amount is de minimis).

5. Audit — Every firm's accounts must be audited annually by an approved auditor, and the audit report filed with the Bar Council.

6. Penalties — Breach of the Accounts Rules is a serious disciplinary offence. Misappropriation of client money typically results in striking off the Roll and criminal prosecution.`
      },
      {
        heading: 'Anti-Money Laundering (AML) Obligations',
        content: `Under the AMLA 2001 and its subsidiary legislation, conveyancing lawyers are "reporting institutions" with specific obligations:

1. Customer Due Diligence (CDD):
   • Verify client identity using reliable documents (MyKad, passport)
   • Verify beneficial ownership — who truly owns/controls the property?
   • Ongoing monitoring of the business relationship

2. Enhanced Due Diligence (EDD) — Required for:
   • Politically Exposed Persons (PEPs)
   • High-value cash transactions
   • Transactions involving sanctioned countries
   • Complex or unusually large transactions

3. Suspicious Transaction Reporting (STR):
   • If a transaction appears suspicious (e.g. structured cash payments, no economic rationale, nominee arrangements to hide beneficial ownership), the solicitor must file an STR with Bank Negara Malaysia.
   • Tipping off — It is a criminal offence to inform the client that an STR has been filed.

4. Record Keeping — All CDD records and transaction documents must be retained for at least 6 years after the end of the business relationship.

Red flags in conveyancing:
• Payment by large amounts of cash
• Multiple purchases in quick succession without clear purpose
• Property purchased significantly above or below market value
• Use of nominees or corporate structures without clear rationale
• Client reluctance to provide identification or source of funds`
      },
      {
        heading: 'Common Disciplinary Issues in Conveyancing',
        content: `The most common disciplinary complaints against conveyancing practitioners:

1. Delay in Registration — Failure to present instruments for registration within a reasonable time after completion. This is one of the most frequent complaints.

2. Failure to Account — Not providing clients with completion accounts or statements showing how their money was applied.

3. Breach of Undertaking — Failing to honour undertakings given to banks or other solicitors, which can collapse entire transactions.

4. Overcharging — Charging fees above the SRO scale without agreement, or charging for work not done.

5. Misappropriation — Using client money for personal purposes. This results in immediate suspension and criminal prosecution.

6. Negligence — Failing to conduct proper searches, missing encumbrances, or not advising clients of risks.

The Disciplinary Board of the Bar Council can impose:
• Reprimand
• Fine (up to RM50,000)
• Suspension from practice (up to 5 years)
• Striking off the Roll (permanent disbarment)`
      },
    ],
    keyPrinciples: [
      'Never act for both parties in a conflict-of-interest situation without proper informed consent.',
      'Client money must be deposited into the Client Account within 1 working day.',
      'A solicitor\'s undertaking is sacrosanct — breach can result in striking off.',
      'AMLA obligations require CDD, EDD for high-risk clients, and STR filing for suspicious transactions.',
      'Tipping off a client about an STR is a criminal offence.',
      'Delay in registration is the most common disciplinary complaint in conveyancing.',
    ],
    keyCases: [
      { name: 'Bar Malaysia v Dato\' Ambiga Sreenevasan', citation: '[2005] 3 MLJ 1', principle: 'Affirmed that the legal profession is governed by the highest ethical standards and that the Bar Council has the duty and power to enforce professional conduct rules for the protection of the public.' },
      { name: 'Re Leong Mee Lian', citation: '[2004] 4 MLJ 238', principle: 'A solicitor who misappropriated client money was struck off the Roll. The court held that misappropriation of client funds is the most serious offence a solicitor can commit and warrants the ultimate penalty.' },
    ],
  },
  {
    id: 'etanah',
    title: 'Electronic Conveyancing (e-Tanah & eTSAS)',
    legislation: 'National Land Code 1965 (Computerised Land Registration); e-Tanah System',
    icon: <Monitor className="w-5 h-5" />,
    color: 'indigo',
    intro: 'Malaysia has progressively digitised land administration through the e-Tanah system, eTSAS (electronic Title Strata Attachment System), and online land search platforms. These systems aim to reduce fraud, accelerate registration, and improve transparency in land dealings.',
    sections: [
      {
        heading: 'e-Tanah System',
        content: `e-Tanah is the nationwide computerised land registration system developed by the Malaysian Government (under KPTG — Jabatan Ketua Pengarah Tanah dan Galian):

1. Purpose — Replace the manual, paper-based land registry with a centralised digital database. All states in Peninsular Malaysia are progressively being migrated to e-Tanah.

2. Key Features:
   • Online Land Search — Practitioners can conduct land searches electronically without visiting the Land Office.
   • Digital Title Records — Land titles are maintained as digital records with enhanced security features.
   • e-Consent — Applications for state consent (e.g. leasehold transfers, foreign purchases) can be submitted electronically.
   • Transaction Tracking — Real-time tracking of instrument presentation and registration status.

3. Legal Framework — The NLC was amended (s.5A, s.89A) to provide for computerised land registration and the legal validity of electronic records and digital signatures.

4. States Implemented — Selangor, Johor, Pahang, Perak, Pulau Pinang, Negeri Sembilan, Melaka, Kedah, and others have progressively adopted e-Tanah. Sabah and Sarawak operate separate systems.

5. Impact on Practice:
   • Reduces turnaround time for registration from months to weeks.
   • Eliminates physical queuing at Land Offices for searches.
   • Requires practitioners to register for e-Tanah access credentials.`
      },
      {
        heading: 'eTSAS — Electronic Title Strata Attachment System',
        content: `eTSAS is the electronic system for strata title management:

1. Purpose — Digitise the issuance and management of strata titles under the Strata Titles Act 1985.

2. Key Features:
   • Electronic strata title creation and registration
   • Digital management of share unit calculations
   • Integration with e-Tanah for seamless land administration
   • Automated generation of Individual Strata Titles (IST)

3. Benefits for Practitioners:
   • Faster strata title issuance
   • Reduced errors in share unit calculations
   • Simplified transfer and charge registration for strata parcels`
      },
      {
        heading: 'Online Land Search (e-Carian)',
        content: `e-Carian is the electronic land search service:

1. Types of Searches Available Online:
   • Official Search (Carian Rasmi) — Certified search showing current registered proprietor, encumbrances, caveats, and restrictions. Valid as evidence in court.
   • Private Search (Carian Persendirian) — Informal search for preliminary due diligence. Not certified.
   • Bankruptcy Search (via Jabatan Insolvensi) — Check if a party has been adjudicated bankrupt.
   • Company Search (via SSM) — Verify company details and winding-up status.

2. Information Revealed:
   • Registered proprietor's name and IC/Reg No.
   • Title reference (Geran/HSD/HS(D)/PN)
   • Lot number, area, and location
   • Category of land use and express conditions
   • Registered charges (mortgages) with chargee details
   • Caveats (private, registrar's, lien-holder's)
   • Restrictions in interest (s.344A NLC)
   • Endorsements and memorials

3. Practical Tips:
   • Always conduct an official search within 14 days of completion.
   • Compare the search result with the IDT for discrepancies.
   • Check for pending caveats that may prevent registration of transfer.`
      },
    ],
    keyPrinciples: [
      'e-Tanah provides a centralised, digital land registry with legal recognition under the NLC.',
      'Online land searches (e-Carian) are now standard practice and should be conducted at every stage of a transaction.',
      'eTSAS streamlines strata title issuance and management.',
      'Electronic records under e-Tanah have the same legal validity as paper records.',
      'Practitioners must register for e-Tanah access to conduct electronic dealings.',
    ],
    keyCases: [
      { name: 'Mayban Finance (M) Bhd v Lim Ngee & Ors', citation: '[2010] 4 MLJ 149', principle: 'The court recognised the validity of computerised land records under the amended NLC provisions and held that electronic entries in the register carry the same legal weight as manual entries.' },
    ],
  },
  {
    id: 'succession',
    title: 'Wills, Probate & Land Succession',
    legislation: 'Probate and Administration Act 1959; Distribution Act 1958; NLC ss.327–331',
    icon: <Scroll className="w-5 h-5" />,
    color: 'emerald',
    intro: 'The transmission of land upon death — whether testate (with a will) or intestate (without a will) — is governed by a complex interplay of the Probate and Administration Act 1959, the Distribution Act 1958, Islamic inheritance law (for Muslims), and the NLC provisions on transmission. Conveyancing practitioners frequently encounter inheritance-related transfers.',
    sections: [
      {
        heading: 'Testate Succession — Land Under a Will',
        content: `When the deceased left a valid will disposing of land:

1. Grant of Probate — The executor named in the will applies to the High Court (or the Magistrate's Court for small estates under RM2 million) for a Grant of Probate. This authorises the executor to administer the estate.

2. Transmission to Executor — Upon obtaining the Grant of Probate, the executor applies to register as proprietor of the land under s.327 NLC (Form 14B — Application for Registration as Proprietor by Personal Representative).

3. Transfer to Beneficiary — The executor then transfers the land to the beneficiary named in the will using Form 14A. This is a transmission, not a sale, and is exempt from stamp duty (but subject to RPGT if there is a gain).

4. Key Requirements:
   • Original Grant of Probate (or certified copy)
   • Death certificate
   • Original IDT
   • Form 14B (executor registration)
   • Form 14A (transfer to beneficiary)
   • Consent of all beneficiaries if the will is being varied`
      },
      {
        heading: 'Intestate Succession — No Will',
        content: `When the deceased died without a valid will:

Non-Muslim Estates:
1. Letters of Administration — The next-of-kin applies for a Grant of Letters of Administration (LA) from the High Court (estate > RM2 million) or the District Land Administrator / Amanah Raya (small estates).

2. Distribution Act 1958 — The estate is distributed according to the statutory formula:
   • Spouse + Issue: Spouse gets 1/3, children share 2/3 equally
   • Spouse + Parents (no children): Spouse 1/2, parents 1/2
   • Spouse only (no children, no parents): Spouse takes all
   • Children only: Children share equally
   • Parents only: Parents take all

3. Joint Tenancy vs Tenancy in Common — If the land was held as "joint tenants" (berkelompok), the surviving joint tenant automatically becomes sole proprietor by right of survivorship. No distribution is needed.

Muslim Estates:
1. Faraid — Muslim estates are distributed according to Islamic inheritance law (faraid) as determined by the Syariah Court. The shares are fixed by the Quran and Sunnah.
2. Wasiyyah — A Muslim may dispose of up to 1/3 of the estate by will (wasiyyah). The remaining 2/3 must be distributed by faraid.
3. Joint ownership rules may differ — some states restrict joint tenancy for Muslim-held land.`
      },
      {
        heading: 'Small Estates (under RM2 Million)',
        content: `Estates valued under RM2 million are administered through a simplified process:

1. Small Estates (Distribution) Act 1955 — The District Land Administrator (Pentadbir Tanah Daerah) has jurisdiction.

2. Process:
   • Application to the District Land Office
   • Hearing — all beneficiaries are summoned
   • Order of Distribution — the Land Administrator issues an order distributing the assets
   • Registration — the order is presented to the Land Registry for registration

3. Advantages:
   • Faster than High Court probate proceedings
   • Lower cost (no need for a solicitor, though one is advisable)
   • The Land Administrator acts as a quasi-judicial officer

4. Limitation — Only applies to estates with total value not exceeding RM2 million. If the estate includes immovable property, the value is based on the land office valuation.`
      },
    ],
    keyPrinciples: [
      'Transmission upon death is by operation of law — the land vests in the executor/administrator upon the grant.',
      'The NLC provides for registration of personal representatives (Form 14B) and subsequent transfer (Form 14A).',
      'Non-Muslim intestate estates are distributed under the Distribution Act 1958.',
      'Muslim estates follow faraid, with wasiyyah limited to 1/3 of the estate.',
      'Joint tenancy with right of survivorship bypasses the need for probate — the surviving joint tenant becomes sole proprietor.',
      'Small estates (< RM2 million) are administered by the District Land Administrator, not the courts.',
    ],
    keyCases: [
      { name: 'Latifah bte Mat Zin v Rosmawati bte Sharibun', citation: '[2007] 5 MLJ 101 (FC)', principle: 'The Federal Court held that joint tenancy in Malaysian land law carries the right of survivorship — upon the death of one joint tenant, the surviving joint tenant automatically becomes the sole proprietor without the need for a court order or letters of administration.' },
      { name: 'Re Tan Soh Sim', citation: '[1951] MLJ 21', principle: 'Established the priority of the Distribution Act 1958 in determining the shares of beneficiaries in an intestate estate, and that land held by the deceased forms part of the estate for distribution.' },
    ],
  },
  {
    id: 'acquisition',
    title: 'Compulsory Land Acquisition',
    legislation: 'Land Acquisition Act 1960 (Act 486)',
    icon: <Ban className="w-5 h-5" />,
    color: 'rose',
    intro: 'The Land Acquisition Act 1960 (LAA) empowers the State Authority to compulsorily acquire any land needed for a public purpose, or for economic development deemed beneficial to the nation. This power represents the most significant limitation on private land ownership under the NLC, as even an indefeasible title cannot withstand a lawful compulsory acquisition.',
    sections: [
      {
        heading: 'Grounds for Acquisition',
        content: `The State Authority may acquire land on three grounds under s.3 LAA:

1. Public Purpose (s.3(a)) — Land needed for any public purpose. Examples include roads, hospitals, schools, government buildings, railways, and public utilities.

2. Economic Development (s.3(b)) — Land required for an entity or corporation engaged in economic development beneficial to the country. This was controversial and frequently challenged in court.

3. Mining (s.3(c)) — Land needed for mining of minerals or building materials. Less commonly invoked.

Key Principle — The power of eminent domain is a sovereign prerogative. The State need not obtain the consent of the landowner, but must follow the statutory procedure and pay adequate compensation.`
      },
      {
        heading: 'Acquisition Procedure',
        content: `The LAA prescribes a detailed procedure:

1. Section 4 — Preliminary Investigation:
   • The State Authority publishes a notification in the Gazette that the land is needed.
   • Authorised officers may enter the land for survey and investigation.
   • This does not constitute acquisition — it is merely an indication of intent.

2. Section 8 — Declaration of Intended Acquisition:
   • A formal declaration is published in the Gazette.
   • Once published, the land is marked for acquisition and cannot be dealt with.
   • The landowner is served with a notice.

3. Section 10 — Inquiry by Land Administrator:
   • The Land Administrator conducts a formal inquiry.
   • All interested parties (owner, chargee, caveator, tenant) are heard.
   • The Land Administrator determines the compensation payable.

4. Section 14 — Award of Compensation:
   • The Land Administrator makes a written award specifying the compensation amount.
   • The award covers the market value of the land plus 10-20% solatium for compulsory nature.

5. Section 16 — Taking Possession:
   • After the award, the State takes possession.
   • The title vests in the State upon the award becoming final.

6. Section 37 — Objection to High Court:
   • Any party dissatisfied with the compensation may refer the matter to the High Court.
   • The court has full jurisdiction to reassess the compensation.`
      },
      {
        heading: 'Compensation Principles',
        content: `The LAA establishes how compensation is determined:

1. Market Value — The primary basis is the market value of the land at the date of the s.8 declaration. Comparable sales in the locality are the most persuasive evidence.

2. Solatium — An additional payment of 10% (residential land) to 20% (non-residential land) is added to the market value as compensation for the compulsory nature of the acquisition.

3. Matters to Consider (Schedule 1):
   • Market value at the date of s.8 notification
   • Damage to other land of the claimant
   • Expenses of changing residence or place of business
   • Diminution in value of remaining land (severance)

4. Matters NOT to Consider (Schedule 1):
   • Urgency of the acquisition
   • The landowner's unwillingness to part with the land
   • Any increase in value attributable to the proposed use
   • Improvements made after the s.4 notice

5. Interest — Interest runs from the date of taking possession until the date of payment.`
      },
    ],
    keyPrinciples: [
      'The State has an inherent right to acquire any land for a public purpose — this overrides even indefeasible title.',
      'Compensation must be "adequate" and is based on market value plus solatium.',
      'The s.8 declaration freezes the land — no further dealings are allowed.',
      'Any party dissatisfied with the compensation may refer the matter to the High Court under s.37 LAA.',
      'The 2016 amendments improved transparency and required more detailed valuation reports.',
    ],
    keyCases: [
      { name: 'Semenyih Jaya Sdn Bhd v Pentadbir Tanah Daerah Hulu Langat', citation: '[2017] 3 MLJ 561 (FC)', principle: 'The Federal Court declared s.40D LAA (restricting court from exceeding the Land Administrator\'s award) unconstitutional. The High Court has full jurisdiction to determine compensation, including awarding more than the Land Administrator.' },
      { name: 'Pemungut Hasil Tanah Kota Tinggi v United Planting Co Sdn Bhd', citation: '[1984] 1 MLJ 50', principle: 'Established the principle that the best evidence of market value is comparable sales of similar land in the same locality at or around the date of acquisition.' },
    ],
  },
  {
    id: 'environment',
    title: 'Environmental Law & Land Development',
    legislation: 'Environmental Quality Act 1974 (Act 127); Town and Country Planning Act 1976 (Act 172)',
    icon: <TreePine className="w-5 h-5" />,
    color: 'teal',
    intro: 'Land development in Malaysia is subject to extensive environmental regulation under the Environmental Quality Act 1974 (EQA), the Town and Country Planning Act 1976 (TCPA), and various state planning laws. Conveyancing practitioners must be aware of these requirements, particularly for greenfield developments, hillside projects, and environmentally sensitive areas.',
    sections: [
      {
        heading: 'Environmental Impact Assessment (EIA)',
        content: `The EIA requirement is the centrepiece of environmental regulation in land development:

1. Prescribed Activities — Under the Environmental Quality (Prescribed Activities) (Environmental Impact Assessment) Order 2015, certain categories of development require an EIA:
   • Housing developments of 50+ hectares (or 500+ units)
   • Industrial estates of 20+ hectares
   • Logging of 500+ hectares
   • Mining operations
   • Highway construction of 15+ km
   • Dam construction
   • Resort/hotel developments in hill areas above 150m

2. Detailed EIA (DEIA) — For "high impact" projects (e.g. chemical plants, nuclear power, major dams), a more comprehensive Detailed EIA is required, with public review and comment.

3. Process:
   • The developer appoints a registered EIA consultant.
   • The EIA report is submitted to the Department of Environment (DOE).
   • DOE reviews and either approves, approves with conditions, or rejects.
   • Conditions may include mitigation measures, monitoring requirements, and environmental bonds.

4. Impact on Conveyancing:
   • Purchasers of land in prescribed projects should verify EIA approval status.
   • Due diligence should include checking for DOE conditions attached to the development order.
   • Breach of EIA conditions can lead to stop-work orders and criminal penalties.`
      },
      {
        heading: 'Planning Permission & Development Orders',
        content: `The Town and Country Planning Act 1976 (TCPA) governs planning control:

1. Development Plan — Every local authority must prepare a Local Plan (Rancangan Tempatan) and Structure Plan (Rancangan Struktur) that zones land for specific uses.

2. Planning Permission — No development may be carried out without planning permission from the Local Planning Authority (Pihak Berkuasa Perancangan Tempatan — PBPT):
   • Application under s.21(1) TCPA
   • Development must conform to the local plan
   • Processing timeline: typically 3-6 months

3. Development Order — A Development Order (Kebenaran Merancang) is issued after planning approval and building plan approval. It authorises commencement of construction.

4. Certificate of Completion and Compliance (CCC):
   • Replaced the old Certificate of Fitness for Occupation (CFO) in 2007
   • Issued by the Principal Submitting Person (architect or engineer)
   • Self-certification system — the professional certifies that the building complies with approved plans and building by-laws
   • Essential for: vacant possession, utility connections, and purchaser occupation

5. Conversion Premium — If the proposed development requires a change of land use category (e.g. Agriculture → Building), the proprietor must apply for conversion and pay a conversion premium to the state.`
      },
      {
        heading: 'Hillside & Environmentally Sensitive Area (ESA) Development',
        content: `Special restrictions apply to development in sensitive areas:

1. Hillside Development Guidelines:
   • Class I (> 35° slope): No development permitted
   • Class II (25-35°): Very restricted development with strict engineering requirements
   • Class III (15-25°): Development with enhanced erosion and sediment control
   • After the Highland Towers tragedy (1993), states imposed stricter hillside guidelines.

2. Environmentally Sensitive Areas (ESA):
   • Categorised as Rank 1 (no development), Rank 2 (restricted), Rank 3 (controlled)
   • Includes forests, wetlands, wildlife corridors, and water catchment areas

3. Earthworks — The Street, Drainage and Building Act 1974 (Act 133) requires earthwork plans and approval before any land clearing. Developers must implement Erosion and Sediment Control Plans (ESCP).

4. Practitioner's Note — Due diligence for undeveloped or rural land should always check:
   • Whether the land falls within an ESA
   • Slope classification
   • Flood risk (especially after Kelantan 2014 and Selangor 2021 floods)
   • Whether EIA approval has been obtained`
      },
    ],
    keyPrinciples: [
      'All prescribed developments require an Environmental Impact Assessment (EIA) before commencement.',
      'Planning permission from the Local Planning Authority is mandatory before development.',
      'CCC (Certificate of Completion and Compliance) replaced CFO in 2007 as a self-certification system.',
      'Hillside development above 35° gradient is absolutely prohibited.',
      'Environmental compliance is a material matter for conveyancing due diligence.',
    ],
    keyCases: [
      { name: 'Kajing Tubek & Ors v Ekran Bhd & Ors', citation: '[1996] 2 MLJ 388', principle: 'The court considered the rights of native communities affected by a dam development project that required EIA approval. Highlighted the tension between development and environmental/indigenous rights.' },
      { name: 'Highland Towers collapse (1993)', citation: 'Reported in multiple judgments', principle: 'The Highland Towers tragedy led to nationwide reform of hillside development policies, stricter EIA requirements, and enhanced building control regulations. A watershed moment for environmental regulation in Malaysian land development.' },
    ],
  },
  {
    id: 'developer',
    title: 'Developer Licensing & Housing Compliance',
    legislation: 'Housing Development (Control & Licensing) Act 1966 (Act 118); Housing Development (Control & Licensing) Regulations 1989',
    icon: <HardHat className="w-5 h-5" />,
    color: 'violet',
    intro: 'The Housing Development (Control and Licensing) Act 1966 (HDA) is a protective statute that regulates housing developers in Malaysia. It mandates licensing, prescribes the use of statutory Sale and Purchase Agreements, governs the Housing Development Account, and provides remedies for purchasers against errant developers.',
    sections: [
      {
        heading: 'Developer Licensing',
        content: `No person may carry on or undertake the business of housing development without a licence:

1. Application — Developers must apply to the Controller of Housing (Pengawal Perumahan) under the Ministry of Local Government Development (KPKT) for a Housing Developer Licence and Advertisement Permit.

2. Requirements:
   • Minimum paid-up capital of RM250,000 (landed) or RM500,000 (high-rise)
   • Deposit of 3% of estimated total selling price with the Controller
   • Appointment of an architect, engineer, and solicitor
   • Approved building plans and development order
   • Valid licence must be obtained BEFORE any sale or advertisement

3. Penalties — Developing without a licence is a criminal offence punishable by fine (up to RM250,000), imprisonment (up to 3 years), or both.

4. Exemptions — Statutory bodies (e.g. PKNS, UDA), state economic development corporations, and cooperatives may be exempt from licensing requirements.`
      },
      {
        heading: 'Statutory SPA — Schedule G & Schedule H',
        content: `The HDA mandates the use of prescribed sale and purchase agreements:

1. Schedule G — For landed properties (terrace houses, semi-detached, bungalows):
   • Vacant possession within 24 months from date of SPA
   • LAD at 10% p.a. on purchase price for late delivery
   • Defect liability period: 24 months from VP

2. Schedule H — For buildings with common property (condominiums, apartments, flats):
   • Vacant possession within 36 months from date of SPA
   • LAD at 10% p.a. on purchase price for late delivery
   • Defect liability period: 24 months from VP

3. Mandatory Terms — The statutory SPA terms CANNOT be contracted out of or modified to the disadvantage of the purchaser. Any term that is less favourable to the purchaser than the statutory term is void.

4. Progressive Payment — The payment schedule follows construction stages (10% booking + 90% progressive), not arbitrary milestones. The developer can only draw from the HDA upon the architect's certification of each stage.

5. 2015 Amendments — Schedule G and H were substantially revised in 2015 to enhance purchaser protection, including mandatory project monitoring, clearer defect reporting procedures, and enhanced LAD provisions.`
      },
      {
        heading: 'Housing Development Account (HDA Account)',
        content: `The HDA Account is a critical purchaser protection mechanism:

1. Requirement — Every licensed developer must open a Housing Development Account at an approved bank for EACH housing development project.

2. Purpose — All purchase price instalments paid by purchasers must be deposited into the HDA. The developer may only withdraw funds from the HDA upon:
   • Architect's certification of construction stage completion
   • Controller's approval for withdrawals
   • Compliance with the prescribed payment schedule

3. Prohibition — The developer is PROHIBITED from using HDA funds for:
   • Other projects
   • Overhead expenses not related to the specific project
   • Personal expenses
   • Loan repayments for other developments

4. Audit — The HDA is subject to audit by the Controller of Housing. Misuse of HDA funds is a criminal offence.

5. Purchaser Protection — If the developer is wound up or abandons the project, the remaining funds in the HDA may be used to rehabilitate the project or refund purchasers.`
      },
      {
        heading: 'Tribunal for Homebuyer Claims',
        content: `The Tribunal for Homebuyer Claims (Tribunal Tuntutan Pembeli Rumah) provides a faster, cheaper dispute resolution mechanism:

1. Jurisdiction — Claims by homebuyers against developers not exceeding RM50,000.

2. No Legal Representation — Parties appear in person without lawyers.

3. Filing Fee — RM10 only.

4. Timeline — Cases must be heard and decided within 60 days.

5. Scope — Covers claims for defects, LAD, refund of deposits, and other breaches of the SPA.

6. Enforcement — Tribunal awards are enforceable as a Magistrate's Court order.`
      },
    ],
    keyPrinciples: [
      'No housing development may be carried out without a licence from the Controller of Housing.',
      'The statutory SPA (Schedule G/H) is mandatory and cannot be modified to the disadvantage of the purchaser.',
      'All purchase instalments must be deposited into the Housing Development Account (HDA).',
      'LAD of 10% p.a. is payable for late delivery of vacant possession.',
      'The Tribunal for Homebuyer Claims provides a low-cost, fast-track dispute resolution mechanism.',
    ],
    keyCases: [
      { name: 'SEA Housing Corporation Sdn Bhd v Lee Poh Choo', citation: '[1982] 2 MLJ 31 (FC)', principle: 'The Federal Court held that the HDA is a social legislation enacted for the protection of purchasers. Its provisions must be interpreted liberally in favour of the purchaser. Any deviation from the statutory SPA that disadvantages the purchaser is void.' },
      { name: 'Ang Ming Lee & Ors v Menteri Kesejahteraan Bandar, Perumahan dan Kerajaan Tempatan', citation: '[2020] 1 MLJ 281 (FC)', principle: 'The Federal Court held that the extension of time (EOT) provisions under Regulation 11(3) are ultra vires the HDA. The Controller has no power to grant developers extensions that effectively deprive purchasers of their statutory right to LAD.' },
    ],
  },
  {
    id: 'legalfees',
    title: 'Legal Fees, Disbursements & SRO',
    legislation: 'Solicitors Remuneration Order 2023 (SRO 2023); Legal Profession Act 1976',
    icon: <Receipt className="w-5 h-5" />,
    color: 'lime',
    intro: 'Legal fees in conveyancing are regulated by the Solicitors Remuneration Order 2023 (SRO 2023), issued under s.113 of the Legal Profession Act 1976. The SRO prescribes the scale of fees that solicitors may charge for conveyancing work, and any deviation requires the prior written agreement of the client or court approval.',
    sections: [
      {
        heading: 'Scale of Fees (SRO 2023)',
        content: `The current fee scale for sale and purchase / transfer / charge matters:

1. Professional Fees on Consideration/Loan Amount (Susunan A):
   • First RM500,000:                    1.25%
   • Next RM7,000,000 (to RM7,500,000):  1.0%
   • Above RM7,500,000:                  Negotiable on the excess (max 1%)

2. Minimum Fee — RM500 (excluding disbursements).

3. Separate Fees — The purchaser pays legal fees on:
   • The SPA (based on purchase price)
   • The loan agreement (based on loan amount)
   • The transfer instrument (Form 14A — may be included in SPA fees)

4. Vendor's Solicitor — The vendor also pays separate legal fees for acting in the sale. Where the vendor's solicitor prepares the SPA, the vendor pays their own solicitor's fees.

5. Sub-sale vs Developer Sale — Fees are the same, but the number of instruments differs. In a sub-sale, both the SPA and MOT fees apply. In a developer sale, the SPA is the primary instrument.`
      },
      {
        heading: 'Standard Disbursements',
        content: `In addition to professional fees, the following disbursements are typically charged:

1. Land Search Fees:
   • Official Search (e-Carian): RM30–50 per title
   • Private Search: RM10–30 per title

2. Bankruptcy Search: RM4 per person (Jabatan Insolvensi)

3. Company Search (SSM): RM10–30 per company

4. Stamp Duty:
   • MOT stamp duty: Ad valorem (1–4% on purchase price)
   • Loan stamp duty: 0.5% on loan amount
   • SPA stamp duty: RM10 (nominal)
   • Adjudication fee: RM10

5. Registration Fees:
   • Presentation fee: RM100–300 per instrument
   • Land Office registration fee: Based on state regulations
   • Late presentation penalty: RM100–500

6. Miscellaneous:
   • Travel and transport: At cost (if applicable)
   • Photocopying and scanning: RM0.50–1.00 per page
   • Courier charges: At cost
   • Real Property Gains Tax (CKHT) submission: RM300–500

7. Service Tax — 8% service tax (SST) is chargeable on professional fees (not on disbursements). This is payable by the client.`
      },
      {
        heading: 'Fee Agreements & Overcharging',
        content: `The SRO regulates how fees may be agreed and disputed:

1. Written Agreement — A solicitor may agree to charge less than the SRO scale, but this must be in writing and signed by the client before commencement of work.

2. Overcharging — Charging above the SRO scale without agreement is a disciplinary offence. The client may:
   • Complain to the Bar Council
   • Apply to the court for taxation of the bill
   • File a disciplinary complaint

3. Taxation of Bills — Under s.120 of the Legal Profession Act, a client may apply to court within 12 months of payment to have the solicitor's bill reviewed and taxed by a taxing officer.

4. Touting — Solicitors are prohibited from "touting" (soliciting work through agents, referral fees, or kickbacks). Paying commissions to estate agents or bank officers for referrals is a disciplinary offence.

5. Contingency Fees — Contingency fee arrangements (where fees depend on the outcome) are generally prohibited for conveyancing work.`
      },
    ],
    keyPrinciples: [
      'Legal fees in conveyancing are regulated by the SRO 2023 and cannot be exceeded without written agreement.',
      'The minimum professional fee is RM500 (excluding disbursements).',
      'Service tax (SST) at 8% is charged on professional fees, not on disbursements.',
      'Overcharging or touting is a disciplinary offence under the Legal Profession Act.',
      'Clients have the right to apply for taxation of bills within 12 months of payment.',
    ],
    keyCases: [
      { name: 'Tetuan Goh Kim Leng & Rakan-Rakan v Ketua Pendaftar Mahkamah Persekutuan', citation: '[2015] 4 MLJ 318', principle: 'Confirmed the mandatory nature of the SRO scale and that solicitors cannot unilaterally charge above the prescribed rates without proper written agreement from the client.' },
    ],
  },
  {
    id: 'negotiation',
    title: 'Negotiation & Dispute Resolution in Conveyancing',
    legislation: 'Mediation Act 2012 (Act 749); Arbitration Act 2005 (Act 646); Courts of Judicature Act 1964',
    icon: <Handshake className="w-5 h-5" />,
    color: 'fuchsia',
    intro: 'Disputes in conveyancing transactions — whether over SPA terms, title defects, boundary issues, or compensation — can be resolved through various mechanisms including negotiation, mediation, arbitration, and litigation. A competent conveyancing practitioner must understand these options and advise clients accordingly.',
    sections: [
      {
        heading: 'Common Conveyancing Disputes',
        content: `The most frequent disputes in Malaysian conveyancing:

1. Defective Title — Encumbrances, caveats, or restrictions discovered after the SPA is signed. The purchaser may seek to rescind or claim damages.

2. Late Delivery (LAD) — Developer fails to deliver vacant possession within the statutory timeline (24 months for Schedule G, 36 months for Schedule H).

3. Defect Claims — Property defects discovered during the defect liability period (24 months from VP). The purchaser may claim repair costs or LAD.

4. Boundary Disputes — Discrepancies between the survey plan and actual boundaries. Common in rural and semi-urban areas.

5. Double Selling — A vendor sells the same property to two different purchasers. The first in time to register prevails under the Torrens system.

6. Forfeiture of Deposit — Disputes over whether the purchaser's default justifies forfeiture of the 10% deposit or whether the "1/4 of the deposit" limit under s.75 of the Contracts Act applies.

7. State Consent Issues — Delays or refusal of state consent for leasehold transfers, foreign purchasers, or Malay Reserve Land transactions.`
      },
      {
        heading: 'Mediation',
        content: `The Mediation Act 2012 provides a framework for alternative dispute resolution:

1. Voluntary Process — Both parties must agree to mediate. Mediation is not compulsory but is encouraged by the courts.

2. Confidentiality — All communications during mediation are confidential and cannot be used as evidence in subsequent court proceedings.

3. Enforceability — A mediated settlement agreement can be recorded as a court consent judgment and enforced accordingly.

4. Court-Annexed Mediation — The courts actively promote mediation through the Malaysian Mediation Centre (MMC) under the Bar Council, and the Court-Annexed Mediation Service.

5. Advantages:
   • Faster than litigation (weeks vs years)
   • Lower cost
   • Preserves business relationships
   • Confidential (unlike court proceedings)
   • Flexible solutions (courts can only award damages or specific performance)`
      },
      {
        heading: 'Arbitration',
        content: `Arbitration under the Arbitration Act 2005 is used for complex property disputes:

1. Arbitration Clause — If the SPA contains an arbitration clause, disputes must be referred to arbitration instead of the courts.

2. AIAC — The Asian International Arbitration Centre (AIAC), formerly the Kuala Lumpur Regional Centre for Arbitration (KLRCA), is the primary arbitral institution in Malaysia.

3. Advantages:
   • Privacy — arbitration proceedings are private
   • Specialist arbitrators with expertise in property law
   • Flexibility in procedure and evidence rules
   • Final and binding (limited rights of appeal)

4. Statutory Arbitration — Certain land disputes (e.g. compulsory acquisition compensation under the LAA) have statutory arbitration mechanisms.`
      },
      {
        heading: 'Litigation & Court Proceedings',
        content: `When negotiation, mediation, and arbitration fail, litigation is the last resort:

1. Jurisdiction:
   • Magistrate's Court: Claims up to RM100,000
   • Sessions Court: Claims up to RM1,000,000
   • High Court: Claims exceeding RM1,000,000 or involving title issues

2. Common Remedies:
   • Specific Performance — Court orders the defaulting party to complete the transaction
   • Damages — Monetary compensation for loss suffered
   • Injunction — Restraining order to prevent a party from dealing with the property
   • Rescission — Unwinding the transaction and restoring parties to their pre-contract position
   • Declaration — Court declares the rights of the parties

3. Limitation Period — Under the Limitation Act 1953, actions for breach of contract must be commenced within 6 years. Actions for recovery of land must be commenced within 12 years.

4. Lis Pendens — A person who files a court action involving land should lodge a lis pendens caveat to prevent the defendant from transferring or dealing with the land during the proceedings.`
      },
    ],
    keyPrinciples: [
      'Mediation is the preferred first step for resolving conveyancing disputes — faster, cheaper, and confidential.',
      'Arbitration is binding if the SPA contains an arbitration clause.',
      'Specific performance is the primary remedy for breach of an SPA for land.',
      'The limitation period for contract claims is 6 years; for land recovery, 12 years.',
      'A lis pendens caveat should be lodged when filing court proceedings involving land.',
    ],
    keyCases: [
      { name: 'Macon Works & Trading Sdn Bhd v Phang Hon Yin', citation: '[1976] 2 MLJ 177', principle: 'Established that specific performance is the primary remedy for breach of an SPA for land — because land is unique and damages are ordinarily inadequate.' },
      { name: 'Lee Soh Ling v Saw Eng Hwa', citation: '[1981] 1 MLJ 137', principle: 'Addressed the forfeiture of deposit issue and held that the court has discretion to relieve against forfeiture where the forfeited amount is unconscionable relative to the actual loss suffered.' },
    ],
  },
  {
    id: 'eastmalaysia',
    title: 'East Malaysia: Sabah & Sarawak Land Law',
    legislation: 'Sabah Land Ordinance (Cap. 68); Sarawak Land Code (Cap. 81)',
    icon: <Globe className="w-5 h-5" />,
    color: 'pink',
    intro: 'Sabah and Sarawak operate separate land law systems from Peninsular Malaysia. While the NLC does not apply in East Malaysia, the fundamental principles of the Torrens system are largely replicated. However, there are critical differences in native customary rights, land tenure, and administrative procedures that practitioners must understand.',
    sections: [
      {
        heading: 'Sabah Land Ordinance',
        content: `The Sabah Land Ordinance (Cap. 68) governs land in Sabah:

1. Registration System — Sabah uses the Torrens system with Country Leases (equivalent to grants) and Town Leases.

2. Native Title (NT) — A unique form of title recognising native customary rights. NT land can only be held by natives of Sabah (as defined in the Constitution).

3. Country Lease (CL) — The equivalent of freehold in Peninsular Malaysia. Issued for rural or agricultural land.

4. Town Lease (TL) — Leasehold title for urban land, typically for 99 years or 999 years.

5. Key Differences from NLC:
   • Native title restrictions are stricter than Malay Reserve Land restrictions
   • Different form numbers for transfers, charges, and leases
   • The Lands and Surveys Department (JTU) handles registration
   • Different stamp duty rates may apply (state matter)
   • Consent requirements differ for certain transactions`
      },
      {
        heading: 'Sarawak Land Code',
        content: `The Sarawak Land Code (Cap. 81) governs land in Sarawak:

1. Categories of Land:
   • Mixed Zone Land — Can be held by any person
   • Native Area Land — Can only be held by natives of Sarawak
   • Native Customary Land — Land over which native customary rights exist (the most contentious category)
   • Reserved Land — Government reserves, forest reserves, etc.
   • Interior Area Land — Largely undeveloped land in the interior

2. Native Customary Rights (NCR):
   • The most litigated area of Sarawak land law
   • NCR can be established by clearing and cultivating virgin jungle before 1 January 1958
   • The legal status and extent of NCR has been the subject of numerous Federal Court decisions
   • NCR holders can apply for formal title under s.18 of the Land Code

3. Key Differences from NLC:
   • Different land categories and tenure types
   • Different registration procedures and forms
   • NCR is unique to Sarawak (and has no direct equivalent in Peninsular Malaysia)
   • The Superintendent of Lands and Surveys handles registration
   • Community titles and communal ownership are recognised`
      },
      {
        heading: 'Native Customary Rights — Landmark Decisions',
        content: `NCR has been the subject of landmark Malaysian court decisions:

1. The NCR Doctrine — Under Sarawak native customary law, the community has rights to land they have occupied, cultivated, or used for generations. These rights exist independently of formal title under the Torrens system.

2. Proof of NCR — To establish NCR, the claimant must show:
   • Occupation and cultivation of the land before 1 January 1958
   • Continuous use and occupation (not necessarily exclusive)
   • Recognition by the community of the rights
   • The land was virgin jungle that was cleared by the claimant or their ancestors

3. NCR vs Development — The tension between NCR and commercial development (logging, palm oil plantations) has generated significant litigation and public debate.

4. Compensation — When NCR land is acquired by the State for development, the NCR holders are entitled to compensation, which must take into account the full extent of their customary rights (not merely nominal amounts).

5. International Perspective — Malaysian NCR jurisprudence draws on international indigenous rights norms, including the UN Declaration on the Rights of Indigenous Peoples (UNDRIP).`
      },
    ],
    keyPrinciples: [
      'The NLC does not apply in Sabah and Sarawak — they have their own land legislation.',
      'Native customary rights (NCR) in Sarawak are recognised by law and can be formalised into titles.',
      'Sabah Native Title (NT) is restricted to natives of Sabah.',
      'Transfer procedures and forms differ between East and West Malaysia.',
      'Practitioners handling East Malaysian land must familiarise themselves with the relevant state land ordinance/code.',
    ],
    keyCases: [
      { name: 'Nor Anak Nyawai v Borneo Pulp Plantation Sdn Bhd', citation: '[2001] 6 MLJ 241', principle: 'The High Court recognised that native customary rights over land in Sarawak existed before and survived the Brooke and Crown Colony eras. These rights cannot be extinguished by the State without proper compensation.' },
      { name: 'Superintendent of Lands & Surveys, Sarawak v Madeli bin Salleh', citation: '[2008] 2 MLJ 677 (FC)', principle: 'The Federal Court confirmed that native customary rights over land are proprietary rights recognised by the common law and the Federal Constitution. The State must compensate NCR holders when their land is acquired.' },
    ],
  },
];

function TopicCard({ topic, isActive, onClick }: { topic: LawTopic; isActive: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    amber: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    blue: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
    green: 'border-green-500/30 text-green-400 bg-green-500/10',
    purple: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
    orange: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
    cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    red: 'border-red-500/30 text-red-400 bg-red-500/10',
    yellow: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
    slate: 'border-slate-500/30 text-slate-300 bg-slate-500/10',
    pink: 'border-pink-500/30 text-pink-400 bg-pink-500/10',
    indigo: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10',
    emerald: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    teal: 'border-teal-500/30 text-teal-400 bg-teal-500/10',
    violet: 'border-violet-500/30 text-violet-400 bg-violet-500/10',
    rose: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    lime: 'border-lime-500/30 text-lime-400 bg-lime-500/10',
    fuchsia: 'border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10',
  };
  const active = colors[topic.color] || colors.amber;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${isActive ? active + ' shadow-lg' : 'border-gold-800 bg-gold-900 hover:border-gold-700 text-slate-400'}`}
    >
      <div className={`flex items-center gap-2 font-bold text-sm ${isActive ? '' : 'text-slate-300'}`}>
        <span className={isActive ? '' : 'text-slate-500'}>{topic.icon}</span>
        <span>{topic.title}</span>
      </div>
      <p className="text-xs mt-1 text-slate-500 truncate">{topic.legislation}</p>
    </button>
  );
}

function SectionBlock({ s, index }: { s: TopicSection; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="border border-gold-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between p-4 bg-gold-900 hover:bg-gold-800/70 transition-colors text-left">
        <h3 className="font-serif font-bold text-slate-100 text-base">{s.heading}</h3>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-5 bg-gold-950/50 border-t border-gold-800">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">{s.content}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TheorySection() {
  const [activeTopic, setActiveTopic] = useState(TOPICS[0].id);
  const topic = TOPICS.find(t => t.id === activeTopic)!;

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-100">Part 1: Substantive Law</h1>
            <p className="text-slate-400 text-sm">{TOPICS.length} law topics — National Land Code, Contracts, HDA, Strata, RPGT, Stamp Duty & more</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-72 shrink-0">
          <div className="sticky top-4 space-y-2">
            {TOPICS.map(t => (
              <TopicCard key={t.id} topic={t} isActive={activeTopic === t.id} onClick={() => setActiveTopic(t.id)} />
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={activeTopic} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {/* Topic Header */}
              <div className="bg-gold-900 border border-gold-800 rounded-2xl p-6 mb-6">
                <p className="text-xs font-mono text-amber-500/70 mb-2">{topic.legislation}</p>
                <h2 className="text-2xl font-serif font-bold text-slate-100 mb-3">{topic.title}</h2>
                <p className="text-slate-300 leading-relaxed text-sm mb-4">{topic.intro}</p>
                <AudioButton
                  text={`${topic.title}. ${topic.intro}`}
                  label="Listen to overview"
                />
              </div>

              {/* Sections */}
              <div className="space-y-3 mb-6">
                {topic.sections.map((s, i) => <SectionBlock key={s.heading} s={s} index={i} />)}
              </div>

              {/* Key Principles */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-6">
                <h3 className="font-serif font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Key Principles
                </h3>
                <ul className="space-y-2">
                  {topic.keyPrinciples.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Cases */}
              {topic.keyCases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-serif font-bold text-slate-200 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-amber-500" /> Leading Cases
                  </h3>
                  {topic.keyCases.map((c, i) => (
                    <div key={i} className="bg-gold-900 border border-gold-800 rounded-xl p-4">
                      <div className="flex flex-wrap items-start gap-2 mb-2">
                        <span className="font-serif font-bold text-slate-100 text-sm">{c.name}</span>
                        <span className="text-xs font-mono text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">{c.citation}</span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{c.principle}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
