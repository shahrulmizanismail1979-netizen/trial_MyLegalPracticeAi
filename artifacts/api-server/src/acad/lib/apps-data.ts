import type { InsertApp } from "@workspace/db/acad";

/**
 * The product family covered by the sales-readiness exam:
 *
 * 1) Seven AI Web Books for Malaysian Legal Practice (mylegalpracticeai.life
 *    family — MyLitAI, MySyalitAI, MyCorpAI, MyConveyAI, MyCrimAI,
 *    MyCCBLitAI, MyAccidentAI). Each book is a structured legal reference
 *    (substantive law, case law, cause papers, workflows, sample documents,
 *    costs & fees, glossary) wrapped in AI tools.
 *
 * 2) Four additional product lines salespeople pitch alongside the books:
 *    - ThinkTraceAI (thinktraceai.life) — AI-traceability / academic
 *      integrity tool for assignments.
 *    - Bentara (bentara.life) — Malaysian civil-service meeting & document
 *      AI assistant in formal Bahasa Melayu.
 *    - SaudagarDash (saudagardash.com) — SME business operations workspace
 *      (sales, stock, profit, AI assistant) in Bahasa Melayu.
 *    - MyMinit (usemyminit.com) — consumer/SME AI meeting-minutes generator
 *      in Bahasa Melayu (with English & Mandarin transcription); produces
 *      standard Malaysia minit format, 3-step Upload → Jana → Export flow.
 *
 * Descriptions and feature lists are sourced from each product's live web
 * bundle and are intentionally specific so the AI question generator
 * anchors every question to real product features.
 */
export const APPS_SEED: InsertApp[] = [
  {
    slug: "mylitai",
    name: "MyLitAI",
    domain: "mylitai.life",
    tagline: "AI-powered Civil Litigation reference web book for litigators",
    description:
      "MyLitAI is the Malaysian civil litigation reference web book. It covers substantive law, the Rules of Court 2012, 65 official court forms and cause papers (writs, statements of claim, summary judgment, striking out, interlocutory injunctions, discovery, foreclosure and Order for Sale, execution and enforcement, winding up), 100+ landmark cases, procedural workflows, sample documents with an AI Drafter, party-and-party and solicitor-client costs calculators, and a glossary of 98 essential legal terms. AI Senior Counsel answers procedural and substantive questions on every page.",
    accentColor: "#7C3AED",
    category: "Litigation",
    features: [
      "Substantive civil law: causes of action, limitation, jurisdiction (subordinate vs High Court)",
      "Rules of Court 2012 procedure: Order 14 summary judgment, Order 18 r.19 striking out, Order 24 discovery, Order 29 injunctions",
      "65 official court forms and cause papers (Form 1 writ, Form 2 SOC, Form 5 statement of defence, etc.) with AI Drafter",
      "Originating process: writ vs originating summons, service in/out of jurisdiction",
      "Interlocutory applications: Mareva, Anton Piller, Erinford, security for costs",
      "Foreclosure & Order for Sale under Order 83 ROC 2012 for charged land",
      "Execution and enforcement: writ of seizure and sale, garnishee, judgment debtor summons",
      "Winding up petitions under Companies Act 2016 ss.465–466",
      "Costs calculators: party-party costs scales, solicitor-client costs, court filing fees",
      "98-term glossary of Malaysian litigation terminology and Latin maxims",
      "AI Senior Counsel for case strategy, pleadings review, and procedural guidance",
    ],
  },
  {
    slug: "mysyalitai",
    name: "MySyalitAI",
    domain: "mysyalitai.life",
    tagline:
      "AI-powered Syariah Litigation reference web book for syarie lawyers",
    description:
      "MySyalitAI is the Malaysian Syariah litigation reference web book for peguam syarie. It covers Syariah Court procedure, Islamic family law (fasakh, hadhanah, nafkah, harta sepencarian, mut'ah), faraid distribution, gazetted fatwas, kitab references, and Quranic verses with AI Tafsir. Tools include a Faraid Calculator, Document Generator (Permohonan Fasakh, Tuntutan Mut'ah, etc.), Compliance Check, AI Counsel, and bilingual Malay/English drafting.",
    accentColor: "#059669",
    category: "Syariah",
    features: [
      "Syariah Court procedure: Mahkamah Rendah, Tinggi, and Rayuan Syariah",
      "Fasakh grounds and procedure (Alasan Fasakh) under state Islamic Family Law enactments",
      "Hak Hadhanah (custody) — entitlement, disqualification, and welfare principle",
      "Nafkah calculation (nafkah isteri, nafkah anak, nafkah eddah) with AI Calculator",
      "Harta Sepencarian (matrimonial assets) claims and apportionment",
      "Mut'ah claim drafting (Tuntutan Mut'ah) with template cause papers",
      "Faraid Calculator for Islamic inheritance distribution",
      "Gazetted Fatwas reference and Kitab (classical Islamic jurisprudence) lookup",
      "Quranic Verses with AI Tafsir for substantive legal authority",
      "Document Generator: Permohonan Fasakh, Hadhanah, Mut'ah, Pembahagian Faraid",
      "Bilingual Malay-English legal drafting and AI Counsel for syarie practitioners",
    ],
  },
  {
    slug: "mycorpai",
    name: "MyCorpAI",
    domain: "mycorpai.life",
    tagline:
      "AI-powered Corporate Secretary reference web book for corporate secretaries and corporate lawyers",
    description:
      "MyCorpAI is the Malaysian corporate law and corporate secretarial reference web book. It covers the Companies Act 2016 end-to-end: incorporation and types of companies, share capital and dividends, directors' duties (fiduciary, statutory and common law), shareholders' rights and minority oppression remedies, MCCG corporate governance, M&A frameworks (share sale, asset sale, schemes of arrangement), corporate restructuring, SSM filings and deadlines, s.17A MACC corporate liability, stamp duty, IPO readiness, cross-border issues, employment law, and Islamic finance. Includes 90+ AI practice tools — Legal Opinion Writer, DD Report Generator, SHA Clause Builder, Contract Review & Markup, Resolution Generator, and dispute simulators (negotiation, mediation, arbitration).",
    accentColor: "#2563EB",
    category: "Corporate",
    features: [
      "Companies Act 2016: incorporation, types of companies, conversion, deregistration",
      "Share capital, classes of shares, dividends, capital reduction",
      "Directors' duties — fiduciary, statutory (s.213, s.217 CA 2016) and common law",
      "Shareholders' rights, minority oppression and remedies (s.346 CA 2016)",
      "Corporate governance, board procedures and the Malaysian Code on Corporate Governance (MCCG)",
      "M&A framework — share sales, asset sales and schemes of arrangement (s.366)",
      "Corporate restructuring — schemes, corporate voluntary arrangements, capital reduction",
      "SSM Filing Navigator with statutory deadlines and forms",
      "Section 17A MACC Act corporate liability compliance toolkit",
      "Stamp Duty Calculator and SC/Bursa filing fee references",
      "AI Tools: Legal Opinion Writer, DD Report Generator, SHA Clause Builder, Contract Review",
      "Dispute simulators for negotiation, mediation and arbitration practice",
      "Cross-border advisory, IPO readiness assessment, employment and Islamic finance modules",
    ],
  },
  {
    slug: "myconveyai",
    name: "MyConveyAI",
    domain: "myconveyai.life",
    tagline: "AI-powered Conveyancing reference web book for conveyancers",
    description:
      "MyConveyAI is the Malaysian conveyancing reference web book. It covers the National Land Code 1965 (categories of land use s.52–55, types of tenure, qualified vs final titles, indefeasibility under s.340 with the immediate vs deferred debate and overriding interests), 100 conveyancing workflows, statutory forms (Transfer Form 14A, Charge Form 16A, Lease Form 15A, Easement Form 16B), Sale & Purchase Agreements, Housing Development Act schedules G, H, I, J, loan and financing documents, caveats (Caveat Masuk, Caveat Gadaian), tenancy and lease documents, stamp duty and LHDN forms, strata titles, estate, probate and transmission. Includes 35 AI tools — AI Drafter, Risk Scanner, SPA/Contract Review, Clause Comparator, Land Title Interpreter, Fee Quotation, AI Deadlines.",
    accentColor: "#0EA5E9",
    category: "Conveyancing",
    features: [
      "National Land Code 1965: land use categories (s.52–55), tenure types, qualified vs final titles",
      "Indefeasibility of title (s.340 NLC) — immediate vs deferred indefeasibility debate, exceptions, overriding interests",
      "Statutory dealings: Transfer (Form 14A), Charge (Form 16A), Lease (Form 15A), Easement (Form 16B)",
      "Sale & Purchase Agreement core clauses: deposit, completion, vacant possession, LAD",
      "Housing Development (Control & Licensing) Act 1966 — Schedules G, H, I, J for developer transactions",
      "Loan & financing documentation, facility agreement, deed of assignment",
      "Caveats: Caveat Masuk, Caveat Gadaian — entry, removal, wrongful caveat",
      "Tenancy and lease documents, stamp duty implications and LHDN forms",
      "Strata Titles Act 1985 and Management Corporation matters",
      "Estate, probate and transmission of land on death",
      "AI tools: AI Drafter, Risk Scanner, SPA Review, Clause Comparator, Land Title Interpreter, Fee Quotation",
    ],
  },
  {
    slug: "mycrimai",
    name: "MyCrimAI",
    domain: "mycrimai.life",
    tagline:
      "AI-powered Criminal Law reference web book for criminal law practitioners",
    description:
      "MyCrimAI is the Malaysian criminal law and procedure reference web book. It covers the Penal Code, Criminal Procedure Code, Evidence Act 1950, Dangerous Drugs Act 1952, MACC Act 2009, and special statutes; the full criminal trial process from arrest, remand, charge, bail, prosecution, defence, mitigation, sentencing, appeal and revision. Includes cause papers (Bail Application, Written Submission, Mitigation Plea, Notice of Appeal, Representation to AG, Criminal Motion, Stay of Execution, Revision Application), 100+ leading cases, procedural workflows, sample documents, costs & fees, and a glossary. AI tools cover witness handling (cooperative, hostile, evasive, nervous, expert), cross-examination prep, and case strategy.",
    accentColor: "#DC2626",
    category: "Criminal",
    features: [
      "Penal Code offences, general exceptions, abetment, criminal conspiracy",
      "Criminal Procedure Code: arrest, remand (s.117), charge, plea, trial procedure",
      "Evidence Act 1950: relevancy, admissibility, presumptions, expert evidence",
      "Bail Application — bailable, non-bailable, unbailable offences and conditions",
      "Dangerous Drugs Act 1952 presumptions (s.37) and statutory defences",
      "MACC Act 2009 corruption offences and prosecutorial framework",
      "Cause Papers: Written Submission, Mitigation Plea, Notice of Appeal, Criminal Motion, Stay of Execution, Revision Application",
      "Representation to the Attorney General and prosecutorial discretion",
      "Sentencing principles, mitigating and aggravating factors, sentencing tariffs",
      "Witness handling: cooperative, hostile, evasive, nervous, and expert witnesses",
      "Appeals to High Court, Court of Appeal, and Federal Court — procedure and grounds",
      "Costs & fees in subordinate and superior criminal courts",
    ],
  },
  {
    slug: "myccblitai",
    name: "MyCCBLitAI",
    domain: "myccblitai.life",
    tagline:
      "AI-powered Corporate, Commercial & Banking Litigation reference web book",
    description:
      "MyCCBLitAI is the Malaysian Corporate, Commercial & Banking Litigation reference web book. It anchors disputes to the Companies Act 2016, Contracts Act 1950, Capital Markets and Services Act 2007, National Land Code 1965, and Civil Law Act 1956. It covers shareholder disputes, minority oppression, derivative actions, breach of contract, banking enforcement (foreclosure, debt recovery, guarantor claims), CMSA actions, and complex commercial fraud. Tools include Automated Drafting, Intelligent Case Research, Risk Assessment, Case Profile builder, Strategy Generator, and a Case Workspace.",
    accentColor: "#EA580C",
    category: "Corp/Comm/Banking",
    features: [
      "Corporate litigation: minority oppression (s.346 CA 2016), derivative actions (s.347), winding up on just and equitable grounds",
      "Commercial litigation: breach of contract under Contracts Act 1950, misrepresentation, restitution",
      "Banking litigation: foreclosure, Order for Sale, debt recovery, guarantor claims, set-off and netting",
      "Capital Markets and Services Act 2007 enforcement and securities disputes",
      "National Land Code 1965 — charges, caveats, indefeasibility issues in banking disputes",
      "Civil Law Act 1956 application of common law and damages",
      "Automated Drafting of pleadings, affidavits, and submissions",
      "Intelligent Case Research with citation-linked Malaysian authorities",
      "Risk Assessment and litigation strategy generator",
      "Case Profile builder: facts, evidence, opposing position, objectives",
      "Workspace for multi-document corporate and banking dispute management",
    ],
  },
  {
    slug: "myaccidentai",
    name: "MyAccidentAI",
    domain: "myaccidentai.life",
    tagline:
      "AI-powered Accident, Personal Injury & Running Down Litigation reference web book",
    description:
      "MyAccidentAI is the Malaysian Accident, Personal Injury and Running Down Litigation reference web book. It covers 25 theory topics (negligence, contributory negligence, vicarious liability, res ipsa loquitur), 120 case laws, 75 cause papers, 20 workflows, 50 sample documents, costs & fees, and a 110-term glossary. Specialises in motor vehicle accidents, workplace injuries, slip & fall, medical negligence, and product liability. Includes a full AI Damages Calculator covering general damages (pain & suffering, loss of amenities, scarring, loss of expectation of life), special damages (medical expenses, transport, pre-trial loss of earnings, vehicle repair), future losses (future medical, nursing care, loss of earning capacity using multiplicand × multiplier), dependency claims and bereavement damages under Civil Law Act 1956 s.7(3A).",
    accentColor: "#F59E0B",
    category: "Accident & PI",
    features: [
      "Negligence framework: duty, breach, causation, remoteness, damage",
      "Contributory negligence in motor vehicle accidents (apportionment)",
      "Section 96 Road Transport Act 1987 Notice of Demand procedure",
      "Res ipsa loquitur, vicarious liability, joint tortfeasors",
      "Workplace injuries, slip & fall, medical negligence, product liability claims",
      "Cause papers: Statement of Claim (MVA), affidavits, interlocutory applications, judgment in default",
      "AI Damages Calculator — General: pain & suffering, loss of amenities of life, scarring & disfigurement, loss of expectation of life",
      "AI Damages Calculator — Special: medical expenses, transport, pre-trial loss of earnings, vehicle repair/write-off, nursing care, aids & appliances",
      "Future losses: future medical costs, future nursing care, loss of earning capacity (multiplicand × multiplier with EPF and tax deductions)",
      "Fatal claims: dependency claim (Civil Law Act 1956 s.7), bereavement damages under s.7(3A), estate claim under s.8",
      "Cause Paper Analyzer, AI Document Drafter, AI Workflow Guide, Getting Up Costs (Subordinate Courts)",
    ],
  },
  {
    slug: "thinktraceai",
    name: "ThinkTraceAI",
    domain: "thinktraceai.life",
    tagline:
      "AI-traceability and academic-integrity platform for assignments",
    description:
      "ThinkTraceAI lets teachers set a clear AI Use Policy for each assignment and lets students declare and evidence their AI usage transparently. Each submission produces an Agency Evidence Map showing which parts are the student's original work, which are AI-assisted, and the process evidence (Draft Evolution, Claims Checked) behind every AI-assisted part. Teachers configure the allowed AI use level per assignment, and reports can be reviewed, exported, and printed for moderation.",
    accentColor: "#0EA5E9",
    category: "Academic Integrity / EdTech",
    features: [
      "Assignment setup: Assignment Title, Assignment Question, and per-assignment Allowed AI Use Policy",
      "Four AI Use Policy levels: AI allowed for brainstorming only; AI allowed for drafting with declaration; AI allowed for full assistance with process evidence; Custom policy",
      "AI Declaration: students declare which parts of their submission used AI and how",
      "AI-Assisted Parts highlighting on the submitted work",
      "Agency Evidence Map showing student original work vs AI-assisted contributions",
      "Draft Evolution: traces how the work changed across drafts as process evidence",
      "Claims Checked: verification step for factual claims in the submission",
      "Collect Evidence workflow for students to attach process evidence (notes, drafts, reflections)",
      "AI Analysis report for teachers, with student name optional (Allow student name only if needed)",
      "Access code workflow for joining an assignment / class",
      "Report management: review, delete, and export/print reports for moderation",
      "Designed for schools and universities to enforce institutional AI honesty policy without banning AI use",
    ],
  },
  {
    slug: "bentara",
    name: "Bentara",
    domain: "bentara.life",
    tagline:
      "Pembantu Mesyuarat — AI meeting assistant purpose-built for the Malaysian civil service",
    description:
      "Bentara is a Bahasa Melayu Rasmi meeting and document AI assistant built for Malaysian government agencies (Kementerian, Jabatan, badan berkanun, INTAN, JPA, MAMPU, Setiausaha Kerajaan Negeri). It records and transcribes meetings, generates Minit Mesyuarat Rasmi in standard SPA format, normalises Bahasa Rojak to Bahasa Melayu Baku DBP, and provides Pandangan (insights), Pematuhan (compliance) and Carian Memori Institusi (institutional memory search) across the agency's archive. Subscriptions are sold as 3-year full access (Akses penuh kepada Bentara selama 3 tahun).",
    accentColor: "#0F766E",
    category: "GovTech / Civil Service",
    features: [
      "Mod Mesyuarat: record audio (mp3/wav/m4a/webm) and transcribe in Bahasa Melayu",
      "Hasilkan Minit Rasmi: generate Minit Mesyuarat Rasmi in standard SPA format",
      "Penghasilan format Minit Mesyuarat standard SPA (Surat Pekeliling Am)",
      "Menyokong Pelbagai Laras Bahasa: Bahasa Melayu Baku DBP, Bahasa Melayu Rasmi, Bahasa Rojak input",
      "Menukar bahasa rojak kepada Bahasa Melayu Baku automatically",
      "Penyerlah Istilah DBP — highlights and standardises DBP terminology",
      "Ringkasan: AI-generated summary of each meeting",
      "Analisis dinamik mesyuarat (dynamic meeting analysis)",
      "Carian Memori Institusi — semantic search across the agency's meeting archive",
      "Eksport Dokumen Rasmi: export formal documents (Minit, Memorandum Pelaksanaan, etc.)",
      "Pematuhan (compliance) checks against official guidelines",
      "Pandangan (insights) panel for follow-up actions and decisions",
      "Multi-tenant by agency: Kementerian, Jabatan saiz sederhana, Agensi & badan berkanun, Angkatan Tentera Malaysia, INTAN, JPA, SUK",
      "Subscription: Akses penuh kepada Bentara selama 3 tahun (3-year full access)",
    ],
  },
  {
    slug: "saudagardash",
    name: "SaudagarDash",
    domain: "saudagardash.com",
    tagline: "Business Operations Workspace — Sales, Stock, Invoices, Profit, AI Tools",
    description:
      "SaudagarDash is a Bahasa Melayu business operations workspace for Malaysian SMEs and small traders (saudagar). It bundles sales (Buka Jualan), stock (Buka Stok), profit & loss (Buka Untung Rugi), invoices, suppliers, customers, expenses, and an AI Business Assistant into one secure workspace. Products support ingredient formulas (recipe-based costing), and the AI Poster module generates professional banners powered by GPT-4o mini. Sold on Lite and Premium plans (AI Premium unlocks all premium gates).",
    accentColor: "#1D4ED8",
    category: "SME Business Operations",
    features: [
      "Buka Jualan (Open Sales) — record sales, generate invoices, track customers (Alamat Pelanggan)",
      "Buka Stok (Open Stock) — manage products, suppliers, stock movements, stock adjustments",
      "Buka Untung Rugi (Open Profit & Loss) — sales vs cost vs expenses, Account Breakdown",
      "Add Formula / Add ingredient — ingredient formulas for recipe-based product costing",
      "Add New Supplier and supplier management",
      "Add Expense — expense tracking against the business",
      "Adjust Stock and Build Stock workflows",
      "Amaran stok (low-stock alert) and Amaran Tarikh Luput (expiry-date warning)",
      "Analisis pergerakan stok 30 hari (30-day stock movement analysis)",
      "AI Business Assistant — ask natural-language questions about sales, stock, untung rugi",
      "AI Poster — Banner profesional dikuasakan GPT-4o mini (professional banner generator)",
      "Basic business management reports for Lite plan; AI Premium unlocks all premium gates",
      "Lite plan: All Lite plan features included; Premium adds AI Assistant + AI Poster + premium reports",
      "Bahasa Melayu first UI with Business Information setup (Business Name, Logo, Type)",
      "Designed for solo merchants and small businesses to run sales, stock and profit in one workspace",
    ],
  },
  {
    slug: "myminit",
    name: "MyMinit",
    domain: "usemyminit.com",
    tagline: "Setiausaha AI untuk organisasi anda — Jana Minit Mesyuarat Automatik",
    description:
      "MyMinit is an AI meeting-minutes generator for Malaysian individuals, SMEs and teams. Users upload an audio/video recording (or record straight from the browser) and MyMinit transcribes it and generates professional minit mesyuarat in standard Malaysia format (Kehadiran, Pembukaan, Perkara Berbangkit, Keputusan & Tindakan, Penutup) within 30–60 seconds. Transcription supports Bahasa Melayu, English and Mandarin. Output minutes are fully editable in-app, can be regenerated section-by-section, and exported to PDF or Word — ready to use without manual cleanup.",
    accentColor: "#1A6B4A",
    category: "Meeting AI / Productivity",
    features: [
      "Three-step flow: 1) Upload atau Rakam Audio  2) AI Jana Minit Automatik  3) Edit & Muat Turun PDF atau Word",
      "Upload audio/video files or record live from the browser — supports mp3, m4a, wav, ogg, webm, mp4 (max 25MB per file)",
      "Multilingual transcription: Bahasa Melayu, English, and Mandarin",
      "Standard Malaysia minit format with 5 sections: 1. Kehadiran, 2. Pembukaan, 3. Perkara Berbangkit, 4. Keputusan & Tindakan, 5. Penutup",
      "Meeting metadata form: Tajuk Mesyuarat, Tarikh, Tempat, Nama Peserta, Bahasa Minit (output language)",
      "Minutes generated in 30–60 seconds depending on audio length",
      "In-app Edit button to fix the generated minutes directly",
      "Jana Semula Bahagian — regenerate any specific section (Kehadiran, Keputusan, etc.) without re-running the whole transcript",
      "Export to PDF or Word, ready to use without manual reformatting",
      "Three plans: Percuma (Free trial — 1 minit/month), Asas at RM120/month (600 minutes of audio per month, PDF & Word export), Premium (Penjanaan & audio tanpa had — unlimited generation and audio, full feature access)",
      "Usage tracking dashboard: Minit Digunakan, Minit Baki, Minit Dijana, Hari Lagi, with an Amaran Penggunaan warning bar",
      "Naik Taraf Sekarang upgrade flow when the usage limit is reached",
      "Akaun Saya, Renew Plan Asas, and Admin panel for account and team management",
      "Designed for SME & Team use cases as well as individual setiausaha (secretaries)",
      "Bahasa Melayu first UI with Dasar Privasi and Terma Penggunaan; AI transcription is described as highly accurate but minit should be reviewed before official use",
    ],
  },
];
