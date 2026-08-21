import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Loader2, PenTool, Copy, Bot, Sparkles,
  ShieldAlert, ListChecks, Clock, AlertTriangle, CheckSquare, Calendar,
  FileSearch, GitCompare, MapPin, Receipt,
  Mail, ClipboardCheck, Scale, FileQuestion, Calculator, BookOpen, X,
  Stamp, TrendingDown, Home, Gavel, AlertOctagon, Search,
  HardHat, UserX, Globe, FileCheck, Landmark, Building2,
  Brain, PlayCircle, Library, FileText, Timer, GraduationCap, Microscope,
  FileSignature, Handshake, ShieldCheck, Building,
  Download, FileDown, Lock,
} from 'lucide-react';
import { MatterPicker } from '@/components/MatterPicker';
import { type Matter, useMatter } from '@/lib/matters';
import { useLocation } from 'wouter';
import { downloadDocx, downloadAndOpenInGoogleDocs } from '@/lib/exportDocx';
import { exportTxt, exportMarkdown, exportPdf } from '@workspace/draft-export';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { SaveToMatterPanel } from '@/components/SaveToMatterPanel';
import { hasTier, EXPORT_MIN_TIER, TIER_LABELS } from '@/lib/tier';
import {
  useSendChatMessage,
  useGenerateDraft,
  useScanTransactionRisk,
  useGenerateChecklist,
  useCalculateDeadlines,
  useReviewSpaClause,
  useCompareClauses,
  useInterpretLandTitle,
  useGenerateFeeQuotation,
  useGenerateAdviceLetter,
  useGenerateDueDiligence,
  useGenerateLegalOpinion,
  useGenerateRequisition,
  useGenerateCompletionStatement,
  useResearchCaseLaw,
  useCalculateStampDuty,
  useAnalyzeRPGT,
  useDraftTenancy,
  useDraftPowerOfAttorney,
  useAdviseCaveat,
  useAnalyzeLandSearch,
  useAdviseDeveloperClaim,
  useAdviseBankruptcySearch,
  useAdviseForeignPurchase,
  useReviewLoanDoc,
  useAdviseTaxCompliance,
  useAdviseStrata,
  useGenerateQuiz,
  useSimulateTransaction,
  useSearchClauseLibrary,
  useAnalyzeDocument,
  useCheckCompliance,
  useGenerateTimeline,
  useGenerateMockExam,
  useAnalyzeCase,
  useDraftCorpResolution,
  useGenerateCorpPropertyDD,
  useDraftJVAgreement,
  useDraftGuarantee,
} from '@workspace/api-client-react';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// ─── Clause templates for the drafter ───────────────────────────────────────
const CLAUSE_CATEGORIES = [
  {
    label: "1. Sale & Purchase Agreement — Core Clauses",
    options: [
      "Recitals (Parties & Background)",
      "Definition of Purchase Price & Payment Schedule",
      "Payment of Earnest Deposit & Booking Fee",
      "Delivery of Vacant Possession",
      "Liquidated Ascertained Damages (LAD) — Vendor Breach",
      "Liquidated Ascertained Damages (LAD) — Purchaser Breach",
      "Condition Precedent (State Authority / Restriction in Interest Consent)",
      "Condition Precedent (Developer's Consent)",
      "Apportionment of Outgoings (Quit Rent, Assessment, Utilities)",
      "Risk & Property Passes to Purchaser",
      "Completion & Closing Conditions",
      "Rescission & Refund of Deposit",
      "Forfeiture of Deposit by Purchaser",
      "Breach by Vendor — Right to Specific Performance",
      "Breach by Purchaser — Right to Rescind",
      "Interest on Late Payment (8% p.a.)",
      "Extension of Time for Completion",
      "As Is Where Is Basis Clause",
      "Fittings & Fixtures Schedule Clause",
      "Encumbrances & Existing Charges Clause",
      "Easements, Rights & Covenants Passing with Land",
      "Representations & Warranties by Vendor",
      "Solicitors as Stakeholders Clause",
      "Costs & Stamp Duty — Allocation Between Parties",
      "Governing Law & Jurisdiction (Malaysian Courts)"
    ]
  },
  {
    label: "2. Developer Transactions (HDA Schedules G, H, I, J)",
    options: [
      "HDA Schedule G — SPA for Landed Property (Individual Title)",
      "HDA Schedule H — SPA for Strata Property (Subdivided Building)",
      "HDA Schedule I — SPA for Commercial Property",
      "HDA Schedule J — SPA for SOHO/SOFO/SOVO Units",
      "Progressive Payment Clause (Architect's Certificate)",
      "Certificate of Completion and Compliance (CCC) Clause",
      "Defect Liability Period (24 Months Standard)",
      "Common Facilities & Maintenance Corporation Clause",
      "Strata Title Application Obligation by Developer",
      "Handover of Strata Title to Purchaser",
      "Sinking Fund & Maintenance Fund Provisions",
      "Developer's Absolute Discretion Clause (Amendment)",
      "Nominee Clause — Purchase in Nominee's Name",
      "Bumiputera Lot Restriction & Release Clause",
      "Housing Developer Licence & Advertisement Permit Clause"
    ]
  },
  {
    label: "3. Loan & Financing Documentation",
    options: [
      "Letter of Offer — Housing Loan Acceptance",
      "Loan Agreement Cum Assignment (LACA) — Individual Title",
      "Deed of Assignment — No Title Issued",
      "Charge Under Section 243 NLC — First Charge",
      "Memorandum of Charge (Form 16A)",
      "Deed of Subordination (Second Charge)",
      "Third-Party Charge — Charged by Third Party",
      "Collateral Deed of Assignment",
      "Charge of Leasehold Land",
      "Discharge of Charge (Form 16N)",
      "Partial Discharge of Charge",
      "Redemption Statement Request Letter",
      "Undertaking to Discharge — By Vendor's Bank",
      "Undertaking to Pay — Purchaser's Bank to Vendor's Bank",
      "Escrow Letter Between Solicitors",
      "Letter of Undertaking — Law Firm to Financier",
      "Request for Deed of Receipt & Reassignment",
      "Islamic Financing — Al-Bay Bithaman Ajil (BBA) Documentation Clause",
      "Islamic Financing — Musharakah Mutanaqisah Clause",
      "Fixed Rate vs. Variable Rate Loan Clause"
    ]
  },
  {
    label: "4. Land Office & PTG Correspondences",
    options: [
      "Cover Letter — Presentation of Form 14A (MOT)",
      "Cover Letter — Registration of Charge (Form 16A)",
      "Cover Letter — Discharge of Charge (Form 16N)",
      "Cover Letter — Entry of Private Caveat (Form 19B)",
      "Cover Letter — Withdrawal of Private Caveat (Form 19G)",
      "Cover Letter — Application for Land Search",
      "Cover Letter — Requisition for Issue Document of Title (IDT)",
      "Cover Letter — Replacement of Lost IDT",
      "Letter of Requisition — Correction of Strata Title",
      "Objection Letter to Registrar — Wrongful Registration",
      "Cover Letter — Application for Subdivision of Land",
      "Cover Letter — Application for Partition of Land",
      "Cover Letter — Application for Amalgamation",
      "Letter — Consent to Transfer (State Authority)",
      "Letter — Application to Convert Leasehold to Freehold",
      "Letter — Surrender and Re-alienation Application",
      "Letter — Change of Land Use / Category",
      "Letter — Application for Express Condition Variation"
    ]
  },
  {
    label: "5. Caveats (Caveat Masuk & Caveat Gadaian)",
    options: [
      "Private Caveat — Form 19B Covering Letter & Notes",
      "Registrar's Caveat — Explanation & Application Note",
      "Lien-Holder's Caveat — Section 330 NLC",
      "Withdrawal of Private Caveat (Form 19G)",
      "Section 322 NLC — Notice to Withdraw Caveat",
      "Application to Court — Removal of Caveat",
      "Caveat to Protect Purchaser under Unregistered Instrument",
      "Caveat to Protect Beneficiary under Will",
      "Charge Caveat / Financing Caveat Clause",
      "Priority Search & Caveat Strategy Advice Letter"
    ]
  },
  {
    label: "6. Tenancy & Lease Documents",
    options: [
      "Standard Tenancy Agreement — Residential",
      "Standard Tenancy Agreement — Commercial Shop Lot",
      "Tenancy Agreement — Service Apartment",
      "Option to Renew — Tenancy Clause",
      "Quiet Enjoyment Warranty Clause",
      "Repair & Maintenance Obligations — Landlord vs Tenant",
      "Security Deposit & Utility Deposit Clause",
      "Stamp Duty on Tenancy Agreement — Clause",
      "Early Termination Clause — Diplomatic Clause",
      "Subletting Prohibition Clause",
      "Notice to Vacate (s.7(2) Specific Relief Act)",
      "Lease Agreement — Long-Term (More Than 3 Years)",
      "Lease Renewal Letter",
      "Notice of Rental Arrears & Demand to Pay",
      "Tenancy Handover Checklist Clause"
    ]
  },
  {
    label: "7. Letters, Notices & Demands",
    options: [
      "Letter of Demand — Completion of SPA",
      "Notice to Rescind — Vendor to Purchaser",
      "Notice to Rescind — Purchaser to Vendor",
      "Notice of Vacant Possession — Developer to Purchaser",
      "Requisition on Title — Purchaser's Solicitor to Vendor",
      "Reply to Requisitions on Title",
      "Letter to Release Deposit from Stakeholder",
      "Undertaking Letter — Delivery of Documents",
      "Letter of Authorisation — Acting for Both Parties",
      "Conflict of Interest Declaration",
      "Letter Reporting to Client — Post Completion",
      "Letter of Advice — Risks of Transaction",
      "Warning Letter — Default in Payment",
      "Final Notice Before Legal Action",
      "Solicitor's Report to Financier on Title"
    ]
  },
  {
    label: "8. Stamp Duty & LHDN Forms",
    options: [
      "Adjudication Request — Stamp Duty Assessment Letter",
      "Stamp Duty Exemption Application — First Home Buyer",
      "Stamp Duty Remission — Malaysian Citizen Clause",
      "CKHT 1A Form Explanation — Disposal by Seller",
      "CKHT 2A Form Explanation — Acquisition by Buyer",
      "CKHT 502 Retention Sum Clause (3% of Purchase Price)",
      "Real Property Gains Tax (RPGT) Exemption — 5 Years",
      "RPGT Exemption — Once in Lifetime (Individual)",
      "RPGT Nil Rate — Malaysian Citizen After 5 Years",
      "PDS 1 Form — Stamping of SPA",
      "PDS 15 Form — Stamping of Tenancy Agreement",
      "Ad Valorem Stamp Duty Computation — Transfer",
      "MSC Status / Pioneer Status Exemption Clause",
      "Stamp Duty on Loan Agreement — RM5 per RM1,000"
    ]
  },
  {
    label: "9. Strata Titles & Management Corporation",
    options: [
      "Strata Titles Act 1985 — Parcel Owner Rights Clause",
      "Management Corporation (MC) Constitution Clause",
      "Annual General Meeting — MC Notice",
      "Special Resolution — MC By-Laws Amendment",
      "Maintenance Charges & Sinking Fund Demand",
      "By-Law Enforcement Notice — MC to Parcel Owner",
      "Application for Strata Management Tribunal",
      "Objection to Strata Roll Amendment",
      "Developer's Obligation to Form MC — s.39 STA",
      "Joint Management Body (JMB) Formation Clause",
      "Sub-Sale of Parcel — Consent of MC Clause",
      "Renovation Approval Clause — MC By-Laws"
    ]
  },
  {
    label: "10. Estate, Probate & Transmission",
    options: [
      "Transmission by Personal Representative (Form 14B)",
      "Transmission by Beneficiary (Form 14C)",
      "Transmission by Survivor (Joint Tenancy — Form 14D)",
      "Survivorship Application — Removal of Deceased Proprietor",
      "Grant of Probate — Executor's Right to Deal with Land",
      "Letters of Administration — Administrator's Authority",
      "Small Estate Distribution Order — Land Clause",
      "Beneficiary's Consent to Sell — Estate Land",
      "Assent by Personal Representative to Beneficiary",
      "Letter to EPF — Withdrawal for Deceased Member's Nominee"
    ]
  },
  {
    label: "11. Foreclosure, Auction & Court Orders",
    options: [
      "Order for Sale — Application by Chargee (O.83 RHC)",
      "Notice to Defaulting Chargor — Demand Letter",
      "Public Auction Notice — Land Office",
      "Section 254 NLC — Notice Before Forfeiture",
      "Proclamation of Sale — High Court",
      "Conditions of Sale — Auction Property",
      "Purchaser's Letter of Offer — Auction Property",
      "Letter Seeking Extension for Balance Payment — Auction",
      "Vesting Order — Court Order to Register Title",
      "Objection to Order for Sale Proceedings"
    ]
  },
  {
    label: "12. Special Transactions & Structures",
    options: [
      "Deed of Gift — Transfer Between Family Members",
      "Deed of Revocation of Gift",
      "Trustee's Deed — Express Trust over Land",
      "Declaration of Trust — Beneficial Interest",
      "Bare Trustee Agreement",
      "Power of Attorney — General (Land Dealings)",
      "Power of Attorney — Specific (Signing SPA)",
      "Revocation of Power of Attorney",
      "Joint Venture Agreement — Property Development",
      "Joint Development Agreement (JDA) — Land Owner & Developer",
      "Profit-Sharing Agreement — Property Development",
      "Option Agreement — Right to Purchase Land",
      "Right of First Refusal Clause",
      "Build-Then-Sell (BTS) Model Clause",
      "Sell-Then-Build (STB) Model Clause"
    ]
  },
  {
    label: "13. Foreign Purchasers & MM2H",
    options: [
      "Foreign Purchaser — State Authority Consent Clause",
      "Minimum Purchase Price Declaration (Foreign Buyer)",
      "MM2H Programme — Property Purchase Eligibility Clause",
      "Restriction on Foreign Ownership — Type of Property",
      "Consent to Transfer — Foreign to Local (FIRB Equivalent)",
      "Repatriation of Funds Clause — Foreign Purchaser",
      "Special Conditions — Purchase by Foreign Company"
    ]
  },
  {
    label: "14. Miscellaneous & Boilerplate Clauses",
    options: [
      "Force Majeure Clause — Property Contract",
      "Entire Agreement Clause",
      "Severability Clause",
      "Waiver Clause",
      "Time is of the Essence Clause",
      "Notices Clause — Delivery & Deemed Receipt",
      "Assignment of Contract — Prohibited Unless Consent",
      "Confidentiality Clause",
      "Anti-Money Laundering Declaration (AMLA)",
      "Personal Data Protection Act (PDPA) Consent Clause",
      "Mediation & Arbitration Clause — Property Disputes",
      "Schedule of Conditions — Sale by Public Tender"
    ]
  },
  {
    label: "15. Corporate-Conveyancing Crossover Documents",
    options: [
      "Directors' Circular Resolution — Approve Property Acquisition",
      "Directors' Circular Resolution — Approve Property Disposal",
      "Directors' Circular Resolution — Approve Charge / Loan Facility",
      "Members' Special Resolution — Substantial Property Transaction (s.223 CA 2016)",
      "Written Resolution of Sole Member — Property Transaction",
      "Common Seal Affixation Resolution & Authority (s.61 CA 2016)",
      "Power of Attorney by Company — Authority to Sign SPA & Transfer",
      "Authority to Solicitors Letter — Corporate Client",
      "Director's Statutory Declaration — Solvency for Property Disposal",
      "Director's Statutory Declaration — No Substantial Property Transaction Concern",
      "Inter-Company Loan Agreement — Property Acquisition Funding",
      "Subordination Agreement — Inter-Company Lending",
      "Letter of Comfort — Holding Co. to Subsidiary's Lender",
      "Deed of Cross-Guarantee Between Group Companies",
      "Shareholder's Undertaking — Property JV",
      "Acknowledgement & Indemnity — Director's Personal Guarantee",
      "Capital Reduction Documentation — Land in Specie Distribution",
      "Members' Voluntary Liquidation — Property Distribution Resolution",
      "Variation of Shareholders' Agreement — Property Asset Carve-Out",
      "Trust Deed — Land Held by Director on Trust for Company"
    ]
  },
  {
    label: "16. Corporate Property Transactions — Specialised",
    options: [
      "Joint Venture Agreement (JVA) — Landowner & Developer (Entitlement Model)",
      "Joint Venture Agreement (JVA) — JVCo / SPV Model",
      "Joint Development Agreement (JDA) — Mixed-Use Project",
      "Memorandum of Understanding (MOU) — Pre-JVA Heads of Terms",
      "Sale & Purchase of Shares of a Real Property Company (RPC)",
      "Sale of Business Including Land — Asset Purchase Agreement",
      "Land Swap Agreement Between Companies",
      "Sale & Leaseback Agreement",
      "Build-Operate-Transfer (BOT) Concession Agreement",
      "Project Management Agreement — Property Development",
      "Marketing & Sales Agency Agreement — Developer & Real Estate Agency",
      "Turnkey Construction Contract",
      "Lease Agreement — Commercial / Industrial / Warehouse",
      "Anchor Tenant Agreement — Shopping Mall",
      "Sub-Lease & Consent to Sub-Let",
      "Licence to Occupy — Pop-Up / Kiosk",
      "Naming Rights & Signage Agreement",
      "REIT Asset Acquisition Agreement",
      "Personal Guarantee — Directors for Company's Property Loan",
      "Corporate Guarantee — Holding Co. for Subsidiary's Property Loan"
    ]
  }
];

// ─── Transaction types for Checklist & Deadlines ────────────────────────────
const TRANSACTION_TYPES = [
  "Sub-sale Purchase (Individual Title, No Charge)",
  "Sub-sale Purchase (Individual Title, With Existing Charge to Redeem)",
  "Sub-sale Purchase (Strata Title, With Charge)",
  "Sub-sale Purchase (No Individual Title — Deed of Assignment)",
  "Developer Purchase — Primary Market (HDA Schedule G)",
  "Developer Purchase — Strata (HDA Schedule H)",
  "Developer Purchase — Commercial (HDA Schedule I)",
  "Developer Purchase — SOHO/SOFO/SOVO (HDA Schedule J)",
  "Pure Financing / Housing Loan (First Charge)",
  "Refinancing (Discharge of Existing Charge + New Charge)",
  "Second Charge / Top-Up Loan",
  "Islamic Financing — Musharakah Mutanaqisah",
  "Islamic Financing — Bay' Bithaman Ajil (BBA)",
  "Transfer / Transmission — Death of Proprietor (Probate)",
  "Transfer — Small Estate Distribution Order",
  "Transfer — Gift Between Family Members (Deed of Gift)",
  "Transfer — By Court Order / Vesting Order",
  "Private Caveat — Entry (Protection of Interest)",
  "Discharge of Caveat (Voluntary Withdrawal)",
  "Foreclosure / Order for Sale (Chargee's Application)",
  "Auction Purchase — High Court / Land Office",
  "Tenancy Agreement — Residential",
  "Tenancy Agreement — Commercial",
  "Strata Title Application (by Developer)",
  "Compulsory Acquisition — Land Office / PTG Proceedings",
  "Joint Venture / JDA — Developer & Landowner",
  "Power of Attorney Execution & Registration",
  "Subdivision / Partition / Amalgamation of Land",
  "Conversion of Leasehold to Freehold",
  "Foreign Purchaser — State Authority Consent Transaction",
];

// ─── Shared Output Block ─────────────────────────────────────────────────────
function OutputBlock({
  title,
  content,
  onCopy,
  docType = 'land-office',
  parties,
}: {
  title: string;
  content: string;
  onCopy: () => void;
  docType?: 'land-office' | 'firm' | 'court' | 'agreement';
  parties?: string;
}) {
  const [downloading, setDownloading] = useState<null | 'word' | 'gdocs'>(null);
  const { toast } = useToast();
  const { currentUser } = useApp();
  const [, navigate] = useLocation();
  const canExport =
    !!currentUser?.grandfathered || hasTier(currentUser?.tier, EXPORT_MIN_TIER);

  const handleDownload = async (target: 'word' | 'gdocs') => {
    setDownloading(target);
    try {
      if (target === 'word') {
        await downloadDocx({ title, content, docType, parties, filename: title });
        toast({ title: 'Word document downloaded', description: `${title}.docx — Land Office formatted` });
      } else {
        await downloadAndOpenInGoogleDocs({ title, content, docType, parties, filename: title });
        toast({
          title: 'Opening Google Docs…',
          description: 'In the Docs tab: File → Open → Upload → drag the just-downloaded .docx file.',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast({ title: 'Export failed', description: msg, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 border-t border-gold-800 pt-5"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="font-serif font-semibold text-amber-400 text-sm">{title}</h4>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-gold-800 hover:bg-gold-700 px-3 py-1.5 rounded-lg transition-colors"
            title="Copy plain text"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          {canExport ? (
            <>
              <button
                onClick={() => exportTxt({ title, text: content })}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-gold-800 hover:bg-gold-700 px-3 py-1.5 rounded-lg transition-colors"
                title="Download as plain text"
                data-testid="button-export-txt"
              >
                <Download className="w-3.5 h-3.5" /> TXT
              </button>
              <button
                onClick={() => exportMarkdown({ title, text: content })}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-gold-800 hover:bg-gold-700 px-3 py-1.5 rounded-lg transition-colors"
                title="Download as Markdown"
                data-testid="button-export-md"
              >
                <Download className="w-3.5 h-3.5" /> MD
              </button>
              <button
                onClick={() => exportPdf({ title, text: content })}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-gold-800 hover:bg-gold-700 px-3 py-1.5 rounded-lg transition-colors"
                title="Print or save as PDF"
                data-testid="button-export-pdf"
              >
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={() => handleDownload('word')}
                disabled={downloading !== null}
                className="flex items-center gap-1.5 text-xs text-amber-100 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors font-semibold shadow"
                title="Download as MS Word — Malaysian Land Office format"
              >
                {downloading === 'word' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                Word
              </button>
              <button
                onClick={() => handleDownload('gdocs')}
                disabled={downloading !== null}
                className="flex items-center gap-1.5 text-xs text-amber-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors font-semibold shadow"
                title="Download .docx and open Google Docs to upload"
              >
                {downloading === 'gdocs' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Google Docs
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/pricing')}
              title={`Document export requires the ${TIER_LABELS[EXPORT_MIN_TIER]} plan`}
              className="flex items-center gap-1.5 text-xs text-amber-300 bg-gold-800 hover:bg-gold-700 px-3 py-1.5 rounded-lg transition-colors font-semibold border border-amber-500/30"
            >
              <Lock className="w-3.5 h-3.5" /> Unlock downloads
            </button>
          )}
        </div>
      </div>
      <div className="bg-gold-950 border border-gold-700 rounded-xl p-4 shadow-inner max-h-[420px] overflow-y-auto custom-scrollbar">
        <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">
          {content}
        </pre>
      </div>
      <p className="text-[10px] text-slate-500 mt-2 italic">
        Word export uses Malaysian Land Office layout (A4, Times New Roman 12pt, MALAYSIA / Pejabat Tanah header, ref-no, signature & witness blocks). Verify before official use.
      </p>
    </motion.div>
  );
}

// ─── Panel header info per mode ───────────────────────────────────────────────
const MODE_META: Record<string, { icon: React.ComponentType<{className?: string}>; title: string; subtitle: string }> = {
  tutor:         { icon: Bot,            title: 'AI Legal Tutor',         subtitle: 'Ask any conveyancing question' },
  drafter:       { icon: PenTool,        title: 'AI Drafter',             subtitle: 'Generate legal clauses & letters' },
  risk:          { icon: ShieldAlert,    title: 'AI Risk Scanner',        subtitle: 'Identify red flags & legal risks' },
  checklist:     { icon: ListChecks,     title: 'AI Checklist',           subtitle: 'Step-by-step practitioner checklist' },
  deadlines:     { icon: Clock,          title: 'AI Deadlines',           subtitle: 'Calculate statutory deadlines' },
  reviewer:      { icon: FileSearch,     title: 'SPA / Contract Review',  subtitle: 'Clause-by-clause legal review' },
  comparator:    { icon: GitCompare,     title: 'Clause Comparator',      subtitle: 'Compare two clause versions' },
  title:         { icon: MapPin,         title: 'Land Title Interpreter', subtitle: 'Decode land search results' },
  quotation:     { icon: Receipt,        title: 'Fee Quotation',          subtitle: 'Generate professional fee quotes' },
  advice:        { icon: Mail,           title: 'Client Advice Letter',   subtitle: 'Draft formal advice to clients' },
  duediligence:  { icon: ClipboardCheck, title: 'Due Diligence Report',   subtitle: 'Property due diligence analysis' },
  opinion:       { icon: Scale,          title: 'Legal Opinion',          subtitle: 'Draft formal legal opinions' },
  requisition:   { icon: FileQuestion,   title: 'Requisition Letter',     subtitle: 'Requisitions on title to vendor' },
  completion:    { icon: Calculator,     title: 'Completion Statement',   subtitle: 'Transaction completion accounts' },
  caseresearch:  { icon: BookOpen,       title: 'Case Law Research',      subtitle: 'Research Malaysian case law' },
  stampduty:     { icon: Stamp,          title: 'Stamp Duty Calculator',  subtitle: 'Calculate stamp duty with exemptions' },
  rpgt:          { icon: TrendingDown,   title: 'RPGT Advisor',           subtitle: 'Real Property Gains Tax analysis' },
  tenancy:       { icon: Home,           title: 'Tenancy Agreement',      subtitle: 'Draft tenancy agreements' },
  poa:           { icon: Gavel,          title: 'Power of Attorney',      subtitle: 'Draft POA documents' },
  caveat:        { icon: AlertOctagon,   title: 'Caveat Advisor',         subtitle: 'Advise on caveats entry/removal' },
  landsearch:    { icon: Search,         title: 'Land Search Analyzer',   subtitle: 'Analyze official land searches' },
  devclaim:      { icon: HardHat,        title: 'Developer Claim',        subtitle: 'LAD/defect claims under HDA' },
  bankruptcy:    { icon: UserX,          title: 'Bankruptcy Search',      subtitle: 'Interpret bankruptcy searches' },
  foreignpurchase: { icon: Globe,        title: 'Foreign Purchase',       subtitle: 'EPU/state consent requirements' },
  loandoc:       { icon: FileCheck,      title: 'Loan Doc Reviewer',      subtitle: 'Review facility agreements' },
  taxcompliance: { icon: Landmark,       title: 'Tax Compliance',         subtitle: 'LHDN tax compliance advice' },
  strata:        { icon: Building2,      title: 'Strata Management',      subtitle: 'MC/JMB/SMA legal advice' },
  quiz:          { icon: Brain,          title: 'Quiz Generator',         subtitle: 'Generate MCQ quizzes on any topic' },
  simulator:     { icon: PlayCircle,     title: 'Transaction Simulator',  subtitle: 'Walk through a full transaction' },
  clauselib:     { icon: Library,        title: 'Clause Library',         subtitle: 'Browse & draft standard clauses' },
  docanalyzer:   { icon: FileText,       title: 'Document Analyzer',      subtitle: 'Analyze any legal document' },
  compliance:    { icon: CheckSquare,    title: 'Compliance Checker',     subtitle: 'AML/CFT & regulatory compliance' },
  timeline:      { icon: Timer,          title: 'Timeline Generator',     subtitle: 'Transaction milestones & deadlines' },
  mockexam:      { icon: GraduationCap,  title: 'Mock Exam Generator',    subtitle: 'Full exam papers with answers' },
  caseanalyzer:  { icon: Microscope,     title: 'Case Law Analyzer',      subtitle: 'Deep-dive case analysis' },
  corpresolution:{ icon: FileSignature,  title: 'Corporate Resolution',   subtitle: 'Board / member resolutions for property deals' },
  corpdd:        { icon: Building,       title: 'Corporate Property DD',  subtitle: 'Combined corporate + property due diligence' },
  jvagreement:   { icon: Handshake,      title: 'JV / JDA Drafter',       subtitle: 'Joint venture & development agreements' },
  guarantee:     { icon: ShieldCheck,    title: 'Guarantee Drafter',      subtitle: 'Personal & corporate guarantees' },
};

// ════════════════════════════════════════════════════════════════════════════
export function AIPanel() {
  const { aiMode, isAiPanelOpen, setIsAiPanelOpen, drafterInitialType, setDrafterInitialType, pendingMatterId, setPendingMatterId } = useApp();
  const { toast } = useToast();

  // ── Tutor ──────────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', content: 'Hello! I am MyConveyLitAI, your expert Malaysian Conveyancing Tutor. Ask me anything about the National Land Code, HDA, or conveyancing practice.' }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = useSendChatMessage();

  // ── Drafter ────────────────────────────────────────────────────────────────
  const [draftType, setDraftType] = useState(drafterInitialType || '');
  const [draftVars, setDraftVars] = useState('');
  const [draftActingFor, setDraftActingFor] = useState('');
  const [draftTone, setDraftTone] = useState('');
  const [draftLength, setDraftLength] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState('');
  const draftMutation = useGenerateDraft();

  // ── Risk Scanner ───────────────────────────────────────────────────────────
  const [riskTxType, setRiskTxType] = useState('');
  const [riskScenario, setRiskScenario] = useState('');
  const [riskResult, setRiskResult] = useState('');
  const riskMutation = useScanTransactionRisk();

  // ── Checklist ──────────────────────────────────────────────────────────────
  const [checklistTxType, setChecklistTxType] = useState('');
  const [checklistDetails, setChecklistDetails] = useState('');
  const [checklistResult, setChecklistResult] = useState('');
  const checklistMutation = useGenerateChecklist();

  // ── Deadlines ──────────────────────────────────────────────────────────────
  const [deadlinesTxType, setDeadlinesTxType] = useState('');
  const [deadlinesKeyDate, setDeadlinesKeyDate] = useState('');
  const [deadlinesExtra, setDeadlinesExtra] = useState('');
  const [deadlinesResult, setDeadlinesResult] = useState('');
  const deadlinesMutation = useCalculateDeadlines();

  // ── SPA Reviewer ──────────────────────────────────────────────────────────
  const [reviewClause, setReviewClause] = useState('');
  const [reviewActingFor, setReviewActingFor] = useState('Purchaser');
  const [reviewContext, setReviewContext] = useState('');
  const [reviewResult, setReviewResult] = useState('');
  const reviewMutation = useReviewSpaClause();

  // ── Clause Comparator ─────────────────────────────────────────────────────
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [compareContext, setCompareContext] = useState('');
  const [compareResult, setCompareResult] = useState('');
  const compareMutation = useCompareClauses();

  // ── Land Title Interpreter ────────────────────────────────────────────────
  const [titleDetails, setTitleDetails] = useState('');
  const [titleType, setTitleType] = useState('');
  const [titleResult, setTitleResult] = useState('');
  const titleMutation = useInterpretLandTitle();

  // ── Fee Quotation ─────────────────────────────────────────────────────────
  const [quoteTxType, setQuoteTxType] = useState('');
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteClient, setQuoteClient] = useState('');
  const [quoteExtra, setQuoteExtra] = useState('');
  const [quoteResult, setQuoteResult] = useState('');
  const quoteMutation = useGenerateFeeQuotation();

  // ── Client Advice Letter ────────────────────────────────────────────────
  const [adviceClient, setAdviceClient] = useState('');
  const [adviceTxType, setAdviceTxType] = useState('');
  const [adviceFacts, setAdviceFacts] = useState('');
  const [adviceArea, setAdviceArea] = useState('');
  const [adviceResult, setAdviceResult] = useState('');
  const adviceMutation = useGenerateAdviceLetter();

  // ── Due Diligence ───────────────────────────────────────────────────────
  const [ddProperty, setDdProperty] = useState('');
  const [ddTxType, setDdTxType] = useState('');
  const [ddConcerns, setDdConcerns] = useState('');
  const [ddResult, setDdResult] = useState('');
  const ddMutation = useGenerateDueDiligence();

  // ── Legal Opinion ───────────────────────────────────────────────────────
  const [opinionIssue, setOpinionIssue] = useState('');
  const [opinionFacts, setOpinionFacts] = useState('');
  const [opinionPosition, setOpinionPosition] = useState('');
  const [opinionResult, setOpinionResult] = useState('');
  const opinionMutation = useGenerateLegalOpinion();

  // ── Requisition Letter ──────────────────────────────────────────────────
  const [reqTitle, setReqTitle] = useState('');
  const [reqIssues, setReqIssues] = useState('');
  const [reqVendor, setReqVendor] = useState('');
  const [reqResult, setReqResult] = useState('');
  const reqMutation = useGenerateRequisition();

  // ── Completion Statement ────────────────────────────────────────────────
  const [compPrice, setCompPrice] = useState('');
  const [compTxType, setCompTxType] = useState('');
  const [compAdjust, setCompAdjust] = useState('');
  const [compDate, setCompDate] = useState('');
  const [compResult, setCompResult] = useState('');
  const compMutation = useGenerateCompletionStatement();

  // ── Case Law Research ───────────────────────────────────────────────────
  const [caseTopic, setCaseTopic] = useState('');
  const [caseJurisdiction, setCaseJurisdiction] = useState('');
  const [caseIssue, setCaseIssue] = useState('');
  const [caseResult, setCaseResult] = useState('');
  const caseMutation = useResearchCaseLaw();

  // ── Stamp Duty Calculator ────────────────────────────────────────────────
  const [sdPrice, setSdPrice] = useState('');
  const [sdPropertyType, setSdPropertyType] = useState('');
  const [sdBuyer, setSdBuyer] = useState('');
  const [sdFirstHome, setSdFirstHome] = useState('');
  const [sdResult, setSdResult] = useState('');
  const sdMutation = useCalculateStampDuty();

  // ── RPGT Advisor ─────────────────────────────────────────────────────────
  const [rpgtAcqDate, setRpgtAcqDate] = useState('');
  const [rpgtDispDate, setRpgtDispDate] = useState('');
  const [rpgtAcqPrice, setRpgtAcqPrice] = useState('');
  const [rpgtDispPrice, setRpgtDispPrice] = useState('');
  const [rpgtSeller, setRpgtSeller] = useState('');
  const [rpgtExpenses, setRpgtExpenses] = useState('');
  const [rpgtResult, setRpgtResult] = useState('');
  const rpgtMutation = useAnalyzeRPGT();

  // ── Tenancy Agreement Drafter ────────────────────────────────────────────
  const [tenPropDetails, setTenPropDetails] = useState('');
  const [tenTerms, setTenTerms] = useState('');
  const [tenSpecial, setTenSpecial] = useState('');
  const [tenResult, setTenResult] = useState('');
  const tenMutation = useDraftTenancy();

  // ── Power of Attorney Drafter ────────────────────────────────────────────
  const [poaDonor, setPoaDonor] = useState('');
  const [poaDonee, setPoaDonee] = useState('');
  const [poaPowers, setPoaPowers] = useState('');
  const [poaPurpose, setPoaPurpose] = useState('');
  const [poaResult, setPoaResult] = useState('');
  const poaMutation = useDraftPowerOfAttorney();

  // ── Caveat Advisor ───────────────────────────────────────────────────────
  const [cavSituation, setCavSituation] = useState('');
  const [cavType, setCavType] = useState('');
  const [cavProperty, setCavProperty] = useState('');
  const [cavResult, setCavResult] = useState('');
  const cavMutation = useAdviseCaveat();

  // ── Land Search Analyzer ─────────────────────────────────────────────────
  const [lsResults, setLsResults] = useState('');
  const [lsPurpose, setLsPurpose] = useState('');
  const [lsResult, setLsResult] = useState('');
  const lsMutation = useAnalyzeLandSearch();

  // ── Developer Claim Advisor ──────────────────────────────────────────────
  const [dcType, setDcType] = useState('');
  const [dcDetails, setDcDetails] = useState('');
  const [dcProject, setDcProject] = useState('');
  const [dcResult, setDcResult] = useState('');
  const dcMutation = useAdviseDeveloperClaim();

  // ── Bankruptcy Search Advisor ────────────────────────────────────────────
  const [bsResults, setBsResults] = useState('');
  const [bsContext, setBsContext] = useState('');
  const [bsResult, setBsResult] = useState('');
  const bsMutation = useAdviseBankruptcySearch();

  // ── Foreign Purchase Advisor ─────────────────────────────────────────────
  const [fpNationality, setFpNationality] = useState('');
  const [fpPropType, setFpPropType] = useState('');
  const [fpState, setFpState] = useState('');
  const [fpPrice, setFpPrice] = useState('');
  const [fpResult, setFpResult] = useState('');
  const fpMutation = useAdviseForeignPurchase();

  // ── Loan Doc Reviewer ────────────────────────────────────────────────────
  const [ldText, setLdText] = useState('');
  const [ldType, setLdType] = useState('');
  const [ldRole, setLdRole] = useState('');
  const [ldResult, setLdResult] = useState('');
  const ldMutation = useReviewLoanDoc();

  // ── Tax Compliance ───────────────────────────────────────────────────────
  const [tcDetails, setTcDetails] = useState('');
  const [tcType, setTcType] = useState('');
  const [tcParties, setTcParties] = useState('');
  const [tcResult, setTcResult] = useState('');
  const tcMutation = useAdviseTaxCompliance();

  // ── Strata Management Advisor ────────────────────────────────────────────
  const [strIssue, setStrIssue] = useState('');
  const [strBuilding, setStrBuilding] = useState('');
  const [strMgmt, setStrMgmt] = useState('');
  const [strResult, setStrResult] = useState('');
  const strMutation = useAdviseStrata();

  // ── Quiz Generator ────────────────────────────────────────────
  const [quizTopic, setQuizTopic] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('');
  const [quizNum, setQuizNum] = useState('10');
  const [quizResult, setQuizResult] = useState('');
  const quizMutation = useGenerateQuiz();

  // ── Transaction Simulator ────────────────────────────────────────────
  const [simScenario, setSimScenario] = useState('');
  const [simPropType, setSimPropType] = useState('');
  const [simTxnType, setSimTxnType] = useState('');
  const [simResult, setSimResult] = useState('');
  const simMutation = useSimulateTransaction();

  // ── Clause Library ────────────────────────────────────────────
  const [clauseType, setClauseType] = useState('');
  const [clauseContext, setClauseContext] = useState('');
  const [clauseResult, setClauseResult] = useState('');
  const clauseMutation = useSearchClauseLibrary();

  // ── Document Analyzer ────────────────────────────────────────────
  const [docText, setDocText] = useState('');
  const [docType, setDocType] = useState('');
  const [docResult, setDocResult] = useState('');
  const docMutation = useAnalyzeDocument();

  // ── Compliance Checker ────────────────────────────────────────────
  const [compChkTxn, setCompChkTxn] = useState('');
  const [compChkType, setCompChkType] = useState('');
  const [compChkResult, setCompChkResult] = useState('');
  const compChkMutation = useCheckCompliance();

  // ── Timeline Generator ────────────────────────────────────────────
  const [tlType, setTlType] = useState('');
  const [tlStart, setTlStart] = useState('');
  const [tlConditions, setTlConditions] = useState('');
  const [tlResult, setTlResult] = useState('');
  const tlMutation = useGenerateTimeline();

  // ── Mock Exam Generator ────────────────────────────────────────────
  const [examSubject, setExamSubject] = useState('');
  const [examType, setExamType] = useState('');
  const [examNum, setExamNum] = useState('5');
  const [examResult, setExamResult] = useState('');
  const examMutation = useGenerateMockExam();

  // ── Case Law Analyzer ────────────────────────────────────────────
  const [caName, setCaName] = useState('');
  const [caDetails, setCaDetails] = useState('');
  const [caIssue, setCaIssue] = useState('');
  const [caResult, setCaResult] = useState('');
  const caMutation = useAnalyzeCase();

  // ── Corporate Resolution ─────────────────────────────────────────
  const [crCompany, setCrCompany] = useState('');
  const [crCompanyNo, setCrCompanyNo] = useState('');
  const [crResType, setCrResType] = useState('');
  const [crTxDetails, setCrTxDetails] = useState('');
  const [crSignatories, setCrSignatories] = useState('');
  const [crResult, setCrResult] = useState('');
  const crMutation = useDraftCorpResolution();

  // ── Corporate Property DD ────────────────────────────────────────
  const [cddCompany, setCddCompany] = useState('');
  const [cddProperty, setCddProperty] = useState('');
  const [cddTxType, setCddTxType] = useState('');
  const [cddConcerns, setCddConcerns] = useState('');
  const [cddResult, setCddResult] = useState('');
  const cddMutation = useGenerateCorpPropertyDD();

  // ── JV / JDA Drafter ─────────────────────────────────────────────
  const [jvParties, setJvParties] = useState('');
  const [jvProperty, setJvProperty] = useState('');
  const [jvStructure, setJvStructure] = useState('');
  const [jvTerms, setJvTerms] = useState('');
  const [jvDuration, setJvDuration] = useState('');
  const [jvResult, setJvResult] = useState('');
  const jvMutation = useDraftJVAgreement();

  // ── Guarantee Drafter ────────────────────────────────────────────
  const [grnType, setGrnType] = useState('');
  const [grnGuarantor, setGrnGuarantor] = useState('');
  const [grnDebtor, setGrnDebtor] = useState('');
  const [grnLender, setGrnLender] = useState('');
  const [grnAmount, setGrnAmount] = useState('');
  const [grnSecurity, setGrnSecurity] = useState('');
  const [grnResult, setGrnResult] = useState('');
  const grnMutation = useDraftGuarantee();

  // ── Matter picker ──────────────────────────────────────────────────────────
  const [pickedMatter, setPickedMatter] = useState<Matter | null>(null);

  // Auto-load pending matter from context (set by Dashboard on ?matter=<id> navigation)
  const { data: pendingMatterData } = useMatter(pendingMatterId);
  useEffect(() => {
    if (!pendingMatterData || pickedMatter) return;
    setPickedMatter(pendingMatterData);
    setPendingMatterId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatterData]);

  // When a matter is picked (or the tool changes), pre-fill the active tool's fields.
  useEffect(() => {
    if (!pickedMatter) return;
    const m = pickedMatter;
    const client = m.clientName ?? '';
    const counterpartyVal = m.counterparty ?? '';
    const parties = [client, counterpartyVal].filter(Boolean).join(' / ');
    const matterDesc = [m.title, m.matterType].filter(Boolean).join(' — ');
    const ref = m.reference ?? '';

    switch (aiMode) {
      case 'risk':
        if (!riskScenario) setRiskScenario(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'checklist':
        if (!checklistDetails) setChecklistDetails(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'deadlines':
        if (!deadlinesExtra) setDeadlinesExtra(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'reviewer':
        if (!reviewContext) setReviewContext(
          `${matterDesc}${parties ? ` — Parties: ${parties}` : ''}${ref ? ` [${ref}]` : ''}`
        );
        break;
      case 'comparator':
        if (!compareContext) setCompareContext(
          `${matterDesc}${parties ? ` — Parties: ${parties}` : ''}${ref ? ` [${ref}]` : ''}`
        );
        break;
      case 'advice':
        if (!adviceClient) setAdviceClient(client);
        if (!adviceFacts) setAdviceFacts(
          `Matter: ${matterDesc}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'duediligence':
        if (!ddProperty) setDdProperty(
          `${matterDesc}${counterpartyVal ? `\nVendor/Counterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'opinion':
        if (!opinionFacts) setOpinionFacts(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'requisition':
        if (!reqVendor) setReqVendor(counterpartyVal);
        break;
      case 'quotation':
        if (!quoteClient) setQuoteClient(client);
        break;
      case 'taxcompliance':
        if (!tcDetails) setTcDetails(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        if (!tcParties) setTcParties(parties);
        break;
      case 'completion':
        if (!compAdjust) setCompAdjust(
          `Matter: ${matterDesc}${parties ? `\nParties: ${parties}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'compliance':
        if (!compChkTxn) setCompChkTxn(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'corpresolution':
        if (!crCompany) setCrCompany(client);
        if (!crTxDetails) setCrTxDetails(
          `Matter: ${matterDesc}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'corpdd':
        if (!cddCompany) setCddCompany(client);
        if (!cddConcerns) setCddConcerns(
          `${matterDesc}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'jvagreement':
        if (!jvParties) setJvParties(parties || client);
        if (!jvProperty) setJvProperty(matterDesc);
        break;
      case 'guarantee':
        if (!grnDebtor) setGrnDebtor(client);
        break;
      case 'tenancy':
        if (!tenPropDetails) setTenPropDetails(matterDesc);
        if (!tenTerms) setTenTerms(
          `Landlord/Tenant parties: ${parties}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'poa':
        if (!poaDonor) setPoaDonor(client);
        break;
      case 'caveat':
        if (!cavSituation) setCavSituation(
          `Matter: ${matterDesc}\nClient: ${client}${counterpartyVal ? `\nCounterparty: ${counterpartyVal}` : ''}${ref ? `\nRef: ${ref}` : ''}`
        );
        break;
      case 'simulator':
        if (!simScenario) setSimScenario(matterDesc);
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedMatter, aiMode]);

  // ── Sync initial drafter type ──────────────────────────────────────────────
  useEffect(() => {
    if (drafterInitialType) {
      setDraftType(drafterInitialType);
      setDrafterInitialType('');
    }
  }, [drafterInitialType, setDrafterInitialType]);

  // ── Auto-scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatMutation.isPending]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied to clipboard" }))
      .catch(() => toast({ variant: "destructive", title: "Copy failed" }));
  };

  const sharedSelect = (value: string, onChange: (v: string) => void, placeholder = "Select transaction type...") => (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none"
      >
        <option value="" disabled>{placeholder}</option>
        {TRANSACTION_TYPES.map(t => (
          <option key={t} value={t} className="text-slate-200 bg-gold-900">{t}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );

  const submitBtn = (pending: boolean, label: string, Icon: React.ComponentType<{className?: string}>, disabled: boolean) => (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full py-3.5 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
    >
      {pending
        ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
        : <><Icon className="w-5 h-5" /> {label}</>
      }
    </button>
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatMutation.isPending) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    try {
      const result = await chatMutation.mutateAsync({ data: { history: chatHistory, message: msg } });
      setChatHistory(prev => [...prev, { role: 'model', content: result.response }]);
    } catch {
      toast({ variant: "destructive", title: "Communication Error", description: "Failed to connect to AI Tutor." });
    }
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftType) { toast({ title: "Select a clause type first." }); return; }
    try {
      const result = await draftMutation.mutateAsync({
        data: {
          clauseType: draftType,
          variables: draftVars,
          actingFor: draftActingFor || undefined,
          tone: draftTone || undefined,
          length: draftLength || undefined,
        }
      });
      setGeneratedDraft(result.draft);
    } catch {
      toast({ variant: "destructive", title: "Generation Failed" });
    }
  };

  const handleCorpResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crCompany.trim() || !crResType.trim() || !crTxDetails.trim()) {
      toast({ title: "Fill in company name, resolution type and transaction details." }); return;
    }
    try {
      const r = await crMutation.mutateAsync({ data: {
        companyName: crCompany.trim(), companyNo: crCompanyNo.trim() || undefined,
        resolutionType: crResType.trim(), transactionDetails: crTxDetails.trim(),
        signatories: crSignatories.trim() || undefined,
      }});
      setCrResult(r.resolution);
    } catch { toast({ variant: "destructive", title: "Failed to draft resolution" }); }
  };

  const handleCorpDD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cddCompany.trim() || !cddProperty.trim()) { toast({ title: "Provide company and property details." }); return; }
    try {
      const r = await cddMutation.mutateAsync({ data: {
        companyDetails: cddCompany.trim(), propertyDetails: cddProperty.trim(),
        transactionType: cddTxType.trim() || undefined, concerns: cddConcerns.trim() || undefined,
      }});
      setCddResult(r.report);
    } catch { toast({ variant: "destructive", title: "Failed to produce DD report" }); }
  };

  const handleJVAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jvParties.trim() || !jvProperty.trim() || !jvStructure.trim()) {
      toast({ title: "Provide parties, property and JV structure." }); return;
    }
    try {
      const r = await jvMutation.mutateAsync({ data: {
        parties: jvParties.trim(), propertyDetails: jvProperty.trim(),
        structureType: jvStructure.trim(),
        commercialTerms: jvTerms.trim() || undefined,
        duration: jvDuration.trim() || undefined,
      }});
      setJvResult(r.agreement);
    } catch { toast({ variant: "destructive", title: "Failed to draft JV / JDA" }); }
  };

  const handleGuarantee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnType.trim() || !grnGuarantor.trim() || !grnDebtor.trim() || !grnLender.trim() || !grnAmount.trim()) {
      toast({ title: "Fill in all required fields." }); return;
    }
    try {
      const r = await grnMutation.mutateAsync({ data: {
        guarantorType: grnType.trim(), guarantorDetails: grnGuarantor.trim(),
        principalDebtor: grnDebtor.trim(), lender: grnLender.trim(),
        facilityAmount: grnAmount.trim(),
        propertySecurity: grnSecurity.trim() || undefined,
      }});
      setGrnResult(r.draft);
    } catch { toast({ variant: "destructive", title: "Failed to draft guarantee" }); }
  };

  const handleRiskScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskScenario.trim()) { toast({ title: "Describe the transaction scenario." }); return; }
    try {
      const result = await riskMutation.mutateAsync({ data: { scenario: riskScenario, transactionType: riskTxType } });
      setRiskResult(result.analysis);
    } catch {
      toast({ variant: "destructive", title: "Risk Scan Failed" });
    }
  };

  const handleChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistTxType) { toast({ title: "Select a transaction type." }); return; }
    try {
      const result = await checklistMutation.mutateAsync({ data: { transactionType: checklistTxType, details: checklistDetails } });
      setChecklistResult(result.checklist);
    } catch {
      toast({ variant: "destructive", title: "Checklist Generation Failed" });
    }
  };

  const handleDeadlines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlinesTxType || !deadlinesKeyDate) { toast({ title: "Select transaction type and enter the key date." }); return; }
    try {
      const result = await deadlinesMutation.mutateAsync({
        data: { transactionType: deadlinesTxType, keyDate: deadlinesKeyDate, additionalDates: deadlinesExtra }
      });
      setDeadlinesResult(result.deadlines);
    } catch {
      toast({ variant: "destructive", title: "Deadline Calculation Failed" });
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewClause.trim()) { toast({ title: "Paste the clause text to review." }); return; }
    try {
      const result = await reviewMutation.mutateAsync({
        data: { clauseText: reviewClause, actingFor: reviewActingFor, context: reviewContext }
      });
      setReviewResult(result.review);
    } catch {
      toast({ variant: "destructive", title: "Review Failed" });
    }
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compareA.trim() || !compareB.trim()) { toast({ title: "Paste both clause versions." }); return; }
    try {
      const result = await compareMutation.mutateAsync({
        data: { clauseA: compareA, clauseB: compareB, context: compareContext }
      });
      setCompareResult(result.comparison);
    } catch {
      toast({ variant: "destructive", title: "Comparison Failed" });
    }
  };

  const handleTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleDetails.trim()) { toast({ title: "Paste the land search / title details." }); return; }
    try {
      const result = await titleMutation.mutateAsync({
        data: { titleDetails, titleType }
      });
      setTitleResult(result.interpretation);
    } catch {
      toast({ variant: "destructive", title: "Title Interpretation Failed" });
    }
  };

  const handleQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteTxType || !quotePrice) { toast({ title: "Select transaction type and enter the price." }); return; }
    try {
      const result = await quoteMutation.mutateAsync({
        data: { transactionType: quoteTxType, purchasePrice: quotePrice, clientName: quoteClient, additionalInfo: quoteExtra }
      });
      setQuoteResult(result.quotation);
    } catch {
      toast({ variant: "destructive", title: "Fee Quotation Failed" });
    }
  };

  const handleAdviceLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adviceClient.trim() || !adviceFacts.trim()) { toast({ title: "Enter client name and key facts." }); return; }
    try {
      const result = await adviceMutation.mutateAsync({
        data: { clientName: adviceClient, transactionType: adviceTxType || 'General conveyancing', keyFacts: adviceFacts, adviceArea: adviceArea }
      });
      setAdviceResult(result.letter);
    } catch {
      toast({ variant: "destructive", title: "Advice Letter Failed" });
    }
  };

  const handleDueDiligence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ddProperty.trim()) { toast({ title: "Enter property details." }); return; }
    try {
      const result = await ddMutation.mutateAsync({
        data: { propertyDetails: ddProperty, transactionType: ddTxType, concerns: ddConcerns }
      });
      setDdResult(result.report);
    } catch {
      toast({ variant: "destructive", title: "Due Diligence Failed" });
    }
  };

  const handleLegalOpinion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opinionIssue.trim() || !opinionFacts.trim()) { toast({ title: "Enter the legal issue and facts." }); return; }
    try {
      const result = await opinionMutation.mutateAsync({
        data: { issue: opinionIssue, facts: opinionFacts, clientPosition: opinionPosition }
      });
      setOpinionResult(result.opinion);
    } catch {
      toast({ variant: "destructive", title: "Legal Opinion Failed" });
    }
  };

  const handleRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || !reqIssues.trim()) { toast({ title: "Enter title details and issues." }); return; }
    try {
      const result = await reqMutation.mutateAsync({
        data: { titleDetails: reqTitle, issues: reqIssues, vendorSolicitor: reqVendor }
      });
      setReqResult(result.requisition);
    } catch {
      toast({ variant: "destructive", title: "Requisition Failed" });
    }
  };

  const handleCompletionStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compPrice.trim() || !compTxType) { toast({ title: "Enter purchase price and transaction type." }); return; }
    try {
      const result = await compMutation.mutateAsync({
        data: { purchasePrice: compPrice, transactionType: compTxType, adjustments: compAdjust, completionDate: compDate }
      });
      setCompResult(result.statement);
    } catch {
      toast({ variant: "destructive", title: "Completion Statement Failed" });
    }
  };

  const handleCaseResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseTopic.trim()) { toast({ title: "Enter a research topic." }); return; }
    try {
      const result = await caseMutation.mutateAsync({
        data: { topic: caseTopic, jurisdiction: caseJurisdiction, specificIssue: caseIssue }
      });
      setCaseResult(result.research);
    } catch {
      toast({ variant: "destructive", title: "Case Research Failed" });
    }
  };

  const handleStampDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdPrice.trim()) { toast({ title: "Enter the property price." }); return; }
    try {
      const result = await sdMutation.mutateAsync({ data: { propertyPrice: sdPrice, propertyType: sdPropertyType, buyerProfile: sdBuyer, isFirstHome: sdFirstHome } });
      setSdResult(result.calculation);
    } catch { toast({ variant: "destructive", title: "Stamp Duty Calculation Failed" }); }
  };

  const handleRPGT = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rpgtAcqPrice.trim() || !rpgtDispPrice.trim()) { toast({ title: "Enter acquisition and disposal prices." }); return; }
    try {
      const result = await rpgtMutation.mutateAsync({ data: { acquisitionDate: rpgtAcqDate, disposalDate: rpgtDispDate, acquisitionPrice: rpgtAcqPrice, disposalPrice: rpgtDispPrice, sellerProfile: rpgtSeller, expenses: rpgtExpenses } });
      setRpgtResult(result.analysis);
    } catch { toast({ variant: "destructive", title: "RPGT Analysis Failed" }); }
  };

  const handleTenancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenPropDetails.trim() || !tenTerms.trim()) { toast({ title: "Enter property details and tenancy terms." }); return; }
    try {
      const result = await tenMutation.mutateAsync({ data: { propertyDetails: tenPropDetails, tenancyTerms: tenTerms, specialConditions: tenSpecial } });
      setTenResult(result.draft);
    } catch { toast({ variant: "destructive", title: "Tenancy Draft Failed" }); }
  };

  const handlePOA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poaDonor.trim() || !poaDonee.trim() || !poaPowers.trim()) { toast({ title: "Enter donor, donee, and powers." }); return; }
    try {
      const result = await poaMutation.mutateAsync({ data: { donorDetails: poaDonor, doneeDetails: poaDonee, powers: poaPowers, purpose: poaPurpose } });
      setPoaResult(result.draft);
    } catch { toast({ variant: "destructive", title: "POA Draft Failed" }); }
  };

  const handleCaveat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cavSituation.trim()) { toast({ title: "Describe the caveat situation." }); return; }
    try {
      const result = await cavMutation.mutateAsync({ data: { situation: cavSituation, caveatType: cavType, propertyDetails: cavProperty } });
      setCavResult(result.advice);
    } catch { toast({ variant: "destructive", title: "Caveat Advice Failed" }); }
  };

  const handleLandSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lsResults.trim()) { toast({ title: "Paste the land search results." }); return; }
    try {
      const result = await lsMutation.mutateAsync({ data: { searchResults: lsResults, purpose: lsPurpose } });
      setLsResult(result.analysis);
    } catch { toast({ variant: "destructive", title: "Land Search Analysis Failed" }); }
  };

  const handleDevClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dcType.trim() || !dcDetails.trim()) { toast({ title: "Enter claim type and details." }); return; }
    try {
      const result = await dcMutation.mutateAsync({ data: { claimType: dcType, details: dcDetails, projectDetails: dcProject } });
      setDcResult(result.advice);
    } catch { toast({ variant: "destructive", title: "Developer Claim Advice Failed" }); }
  };

  const handleBankruptcy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bsResults.trim()) { toast({ title: "Paste the bankruptcy search results." }); return; }
    try {
      const result = await bsMutation.mutateAsync({ data: { searchResults: bsResults, transactionContext: bsContext } });
      setBsResult(result.advice);
    } catch { toast({ variant: "destructive", title: "Bankruptcy Search Advice Failed" }); }
  };

  const handleForeignPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpNationality.trim() || !fpPropType.trim() || !fpState.trim()) { toast({ title: "Enter nationality, property type, and state." }); return; }
    try {
      const result = await fpMutation.mutateAsync({ data: { buyerNationality: fpNationality, propertyType: fpPropType, propertyState: fpState, purchasePrice: fpPrice } });
      setFpResult(result.advice);
    } catch { toast({ variant: "destructive", title: "Foreign Purchase Advice Failed" }); }
  };

  const handleLoanDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ldText.trim()) { toast({ title: "Paste the loan document text." }); return; }
    try {
      const result = await ldMutation.mutateAsync({ data: { documentText: ldText, loanType: ldType, clientRole: ldRole } });
      setLdResult(result.review);
    } catch { toast({ variant: "destructive", title: "Loan Doc Review Failed" }); }
  };

  const handleTaxCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tcDetails.trim()) { toast({ title: "Enter transaction details." }); return; }
    try {
      const result = await tcMutation.mutateAsync({ data: { transactionDetails: tcDetails, transactionType: tcType, parties: tcParties } });
      setTcResult(result.advice);
    } catch { toast({ variant: "destructive", title: "Tax Compliance Advice Failed" }); }
  };

  const handleStrata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strIssue.trim()) { toast({ title: "Describe the strata management issue." }); return; }
    try {
      const result = await strMutation.mutateAsync({ data: { issue: strIssue, buildingType: strBuilding, managementBody: strMgmt } });
      setStrResult(result.advice);
    } catch { toast({ variant: "destructive", title: "Strata Advice Failed" }); }
  };

  const handleQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic.trim()) { toast({ title: "Enter a topic for the quiz." }); return; }
    try {
      const result = await quizMutation.mutateAsync({ data: { topic: quizTopic, difficulty: quizDifficulty || undefined, numQuestions: parseInt(quizNum) || 10 } });
      setQuizResult(result.quiz);
    } catch { toast({ variant: "destructive", title: "Quiz Generation Failed" }); }
  };

  const handleSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simScenario.trim()) { toast({ title: "Describe the transaction scenario." }); return; }
    try {
      const result = await simMutation.mutateAsync({ data: { scenario: simScenario, propertyType: simPropType || undefined, transactionType: simTxnType || undefined } });
      setSimResult(result.simulation);
    } catch { toast({ variant: "destructive", title: "Simulation Failed" }); }
  };

  const handleClauseLib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clauseType.trim()) { toast({ title: "Enter a clause type." }); return; }
    try {
      const result = await clauseMutation.mutateAsync({ data: { clauseType, context: clauseContext || undefined } });
      setClauseResult(result.clauses);
    } catch { toast({ variant: "destructive", title: "Clause Library Failed" }); }
  };

  const handleDocAnalyzer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docText.trim()) { toast({ title: "Paste the document text." }); return; }
    try {
      const result = await docMutation.mutateAsync({ data: { documentText: docText, documentType: docType || undefined } });
      setDocResult(result.analysis);
    } catch { toast({ variant: "destructive", title: "Document Analysis Failed" }); }
  };

  const handleCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compChkTxn.trim()) { toast({ title: "Describe the transaction." }); return; }
    try {
      const result = await compChkMutation.mutateAsync({ data: { transaction: compChkTxn, checkType: compChkType || undefined } });
      setCompChkResult(result.result);
    } catch { toast({ variant: "destructive", title: "Compliance Check Failed" }); }
  };

  const handleTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tlType.trim()) { toast({ title: "Enter the transaction type." }); return; }
    try {
      const result = await tlMutation.mutateAsync({ data: { transactionType: tlType, startDate: tlStart || undefined, specialConditions: tlConditions || undefined } });
      setTlResult(result.timeline);
    } catch { toast({ variant: "destructive", title: "Timeline Generation Failed" }); }
  };

  const handleMockExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examSubject.trim()) { toast({ title: "Enter the exam subject." }); return; }
    try {
      const result = await examMutation.mutateAsync({ data: { subject: examSubject, examType: examType || undefined, numQuestions: parseInt(examNum) || 5 } });
      setExamResult(result.exam);
    } catch { toast({ variant: "destructive", title: "Mock Exam Generation Failed" }); }
  };

  const handleCaseAnalyzer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caName.trim()) { toast({ title: "Enter the case name." }); return; }
    try {
      const result = await caMutation.mutateAsync({ data: { caseName: caName, caseDetails: caDetails || undefined, legalIssue: caIssue || undefined } });
      setCaResult(result.analysis);
    } catch { toast({ variant: "destructive", title: "Case Analysis Failed" }); }
  };

  if (!isAiPanelOpen) return null;

  const meta = MODE_META[aiMode] ?? MODE_META.tutor;
  const MetaIcon = meta.icon;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[22rem] md:static md:w-[22rem] flex flex-col bg-gold-900 border-l border-gold-800 shadow-2xl z-40 h-full shrink-0">
      {/* Panel Header */}
      <div className="p-4 border-b border-gold-800 bg-gold-900/50 backdrop-blur-sm flex items-center shrink-0">
        <div className="p-2 bg-amber-500/10 rounded-lg mr-3 shrink-0">
          <MetaIcon className="w-5 h-5 text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif font-bold text-slate-100 truncate">{meta.title}</h3>
          <p className="text-xs text-slate-400 truncate">{meta.subtitle}</p>
        </div>
        <button
          onClick={() => setIsAiPanelOpen(false)}
          className="md:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-gold-800 rounded-lg transition-colors shrink-0"
          data-testid="button-close-ai-panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={aiMode}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-hidden relative flex flex-col"
        >

          {/* ── TUTOR ── */}
          {aiMode === 'tutor' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatHistory.map((msg, idx) => (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-slate-900 rounded-br-sm'
                        : 'bg-gold-800 text-slate-200 rounded-bl-sm border border-gold-700'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-gold-800 text-slate-400 rounded-2xl rounded-bl-sm p-3.5 border border-gold-700 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span className="text-sm">Consulting database...</span>
                    </div>
                  </div>
                )}
                {!chatMutation.isPending && chatHistory.filter(m => m.role === 'model').length > 1 && (
                  <SaveToMatterPanel
                    title="AI Consultation Note"
                    kind="chat"
                    content={chatHistory
                      .filter(m => m.role === 'model' || m.role === 'user')
                      .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
                      .join('\n\n')}
                    defaultMatterId={pickedMatter?.id}
                  />
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-gold-900 border-t border-gold-800 shrink-0">
                <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Ask a legal question..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl py-3 pl-4 pr-12 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none min-h-[52px] max-h-[120px]"
                    rows={1}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                  />
                  <button type="submit" disabled={!chatInput.trim() || chatMutation.isPending}
                    className="absolute right-2 bottom-2 p-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── DRAFTER ── */}
          {aiMode === 'drafter' && (() => {
            const allOptions = CLAUSE_CATEGORIES.flatMap(c => c.options);
            const isCustom = draftType && !allOptions.includes(draftType);
            const search = draftSearch.trim().toLowerCase();
            const filteredCategories = search
              ? CLAUSE_CATEGORIES
                  .map(cat => ({
                    ...cat,
                    options: cat.options.filter(o => o.toLowerCase().includes(search))
                  }))
                  .filter(cat => cat.options.length > 0)
              : CLAUSE_CATEGORIES;
            const totalMatches = filteredCategories.reduce((n, c) => n + c.options.length, 0);
            return (
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
                <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">Pick a clause or document, then refine it for the party you're acting for, the tone you want and the length. Drafts include statutory citations and a Drafter's Notes block.</p>
                </div>
                <form onSubmit={handleGenerateDraft} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Templates</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={draftSearch}
                        onChange={e => setDraftSearch(e.target.value)}
                        placeholder="e.g. caveat, JV, guarantee, redemption..."
                        className="w-full bg-gold-950 border border-gold-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                      />
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {search && (
                      <p className="text-xs text-slate-500">{totalMatches} template{totalMatches === 1 ? '' : 's'} match.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document / Clause Type</label>
                    <div className="relative">
                      <select value={draftType} onChange={e => setDraftType(e.target.value)}
                        className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                        <option value="" disabled>Select a template...</option>
                        {filteredCategories.map(cat => (
                          <optgroup key={cat.label} label={cat.label} className="bg-gold-900 text-slate-400 font-semibold">
                            {cat.options.map(opt => (
                              <option key={opt} value={opt} className="text-slate-200 font-normal">{opt}</option>
                            ))}
                          </optgroup>
                        ))}
                        {isCustom && (
                          <option value={draftType}>{draftType} (Custom)</option>
                        )}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Or type a custom clause/document type below.</p>
                    <input
                      type="text"
                      value={draftType}
                      onChange={e => setDraftType(e.target.value)}
                      placeholder="Custom: e.g. Letter of Indemnity for Lost Original Title"
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acting For</label>
                      <div className="relative">
                        <select value={draftActingFor} onChange={e => setDraftActingFor(e.target.value)}
                          className="w-full bg-gold-950 border border-gold-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                          <option value="">Neutral / Both Parties</option>
                          <option value="Purchaser / Buyer">Purchaser / Buyer</option>
                          <option value="Vendor / Seller">Vendor / Seller</option>
                          <option value="Borrower / Chargor">Borrower / Chargor</option>
                          <option value="Lender / Chargee">Lender / Chargee</option>
                          <option value="Landlord">Landlord</option>
                          <option value="Tenant">Tenant</option>
                          <option value="Developer">Developer</option>
                          <option value="Landowner">Landowner</option>
                          <option value="Guarantor">Guarantor</option>
                          <option value="Beneficiary / Donee">Beneficiary / Donee</option>
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tone / Position</label>
                      <div className="relative">
                        <select value={draftTone} onChange={e => setDraftTone(e.target.value)}
                          className="w-full bg-gold-950 border border-gold-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                          <option value="">Standard market position</option>
                          <option value="Aggressive — strongly favour my client">Aggressive — strongly favour my client</option>
                          <option value="Protective — emphasise risk allocation & protections">Protective — emphasise risk allocation</option>
                          <option value="Conciliatory — balanced, deal-friendly">Conciliatory — balanced, deal-friendly</option>
                          <option value="Strict — formal, traditional Malaysian conveyancing style">Strict — formal traditional style</option>
                          <option value="Plain English — accessible to lay client">Plain English — accessible to lay client</option>
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Length</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Concise', 'Standard', 'Comprehensive'] as const).map(opt => (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setDraftLength(draftLength === opt ? '' : opt)}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            draftLength === opt || (!draftLength && opt === 'Standard')
                              ? 'bg-amber-500 text-slate-900 border-amber-500'
                              : 'bg-gold-950 text-slate-300 border-gold-700 hover:border-amber-500/50'
                          }`}
                        >{opt}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Specific Variables (Optional)</label>
                    <textarea value={draftVars} onChange={e => setDraftVars(e.target.value)}
                      placeholder="Names, NRIC/Co. nos, title nos, prices, rates, dates, special concerns. e.g. Purchaser: Ahmad bin Ali (NRIC 850101-14-1234), Vendor: Tan Sdn Bhd (Co. 200201234567), Property: Geran 12345 Lot 567 Mukim Petaling, Price RM 1,200,000, 8% interest, completion 90 days"
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                      rows={4} />
                  </div>
                  {submitBtn(draftMutation.isPending, 'Generate Draft', Sparkles, !draftType)}
                </form>
                {generatedDraft && (
                  <>
                    <OutputBlock title="Generated Draft" content={generatedDraft} onCopy={() => copyText(generatedDraft)} />
                    <SaveToMatterPanel title={draftType || 'Generated Draft'} kind="draft" content={generatedDraft} defaultMatterId={pickedMatter?.id} />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── RISK SCANNER ── */}
          {aiMode === 'risk' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Describe the transaction in detail. The AI will identify red flags, legal risks, and protective actions under Malaysian law.</p>
              </div>
              <form onSubmit={handleRiskScan} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type (Optional)</label>
                  {sharedSelect(riskTxType, setRiskTxType, "Select type (optional)...")}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Scenario</label>
                  <textarea value={riskScenario} onChange={e => setRiskScenario(e.target.value)}
                    placeholder="e.g. Purchasing leasehold land with 23 years left on title, vendor has an existing charge with Bank X, purchaser is a foreign national, no individual title yet, developer consent still pending..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={6} />
                </div>
                {submitBtn(riskMutation.isPending, 'Scan for Risks', ShieldAlert, !riskScenario.trim())}
              </form>
              {riskResult && (
                <>
                  <OutputBlock title="Risk Analysis" content={riskResult} onCopy={() => copyText(riskResult)} />
                  <SaveToMatterPanel title={riskTxType ? `Risk Analysis — ${riskTxType}` : 'Risk Analysis'} kind="analysis" content={riskResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CHECKLIST ── */}
          {aiMode === 'checklist' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Select the transaction type to generate a comprehensive step-by-step practitioner checklist with statutory references.</p>
              </div>
              <form onSubmit={handleChecklist} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                  {sharedSelect(checklistTxType, setChecklistTxType)}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Additional Details (Optional)</label>
                  <textarea value={checklistDetails} onChange={e => setChecklistDetails(e.target.value)}
                    placeholder="e.g. Strata title already issued, purchase price RM650,000, foreign purchaser, existing tenancy to deal with..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={4} />
                </div>
                {submitBtn(checklistMutation.isPending, 'Generate Checklist', ListChecks, !checklistTxType)}
              </form>
              {checklistResult && (
                <>
                  <OutputBlock title="Practitioner Checklist" content={checklistResult} onCopy={() => copyText(checklistResult)} />
                  <SaveToMatterPanel title={checklistTxType ? `Checklist — ${checklistTxType}` : 'Practitioner Checklist'} kind="checklist" content={checklistResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── DEADLINES ── */}
          {aiMode === 'deadlines' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Enter the transaction type and key date (e.g. SPA signing date). The AI will calculate every applicable statutory deadline.</p>
              </div>
              <form onSubmit={handleDeadlines} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                  {sharedSelect(deadlinesTxType, setDeadlinesTxType)}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Date</label>
                  <input
                    type="date"
                    value={deadlinesKeyDate}
                    onChange={e => setDeadlinesKeyDate(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-xs text-slate-500">E.g. SPA signing date, completion date, notice date</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Additional Dates / Notes (Optional)</label>
                  <textarea value={deadlinesExtra} onChange={e => setDeadlinesExtra(e.target.value)}
                    placeholder="e.g. Loan approval date: 15 Jan 2025, VP expected: 3 years from SPA, 24-month defect period..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={3} />
                </div>
                {submitBtn(deadlinesMutation.isPending, 'Calculate Deadlines', Clock, !deadlinesTxType || !deadlinesKeyDate)}
              </form>
              {deadlinesResult && (
                <>
                  <OutputBlock title="Deadline Schedule" content={deadlinesResult} onCopy={() => copyText(deadlinesResult)} />
                  <SaveToMatterPanel title={deadlinesTxType ? `Deadline Schedule — ${deadlinesTxType}` : 'Deadline Schedule'} kind="deadlines" content={deadlinesResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── SPA / CONTRACT REVIEWER ── */}
          {aiMode === 'reviewer' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <FileSearch className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Paste any SPA clause or contract provision for a detailed clause-by-clause legal review with red flags, compliance notes, and recommended amendments.</p>
              </div>
              <form onSubmit={handleReview} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acting For</label>
                  <div className="relative">
                    <select
                      value={reviewActingFor}
                      onChange={e => setReviewActingFor(e.target.value)}
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none"
                      data-testid="select-review-acting-for"
                    >
                      <option value="Purchaser">Purchaser</option>
                      <option value="Vendor">Vendor</option>
                      <option value="Financier / Chargee">Financier / Chargee</option>
                      <option value="Developer">Developer</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clause / Contract Text</label>
                  <textarea value={reviewClause} onChange={e => setReviewClause(e.target.value)}
                    placeholder="Paste the SPA clause, contract provision, or entire section here for review..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={8}
                    data-testid="input-review-clause"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Context (Optional)</label>
                  <input value={reviewContext} onChange={e => setReviewContext(e.target.value)}
                    placeholder="e.g. Sub-sale of leasehold property, purchaser is a foreign national..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-review-context"
                  />
                </div>
                {submitBtn(reviewMutation.isPending, 'Review Clause', FileSearch, !reviewClause.trim())}
              </form>
              {reviewResult && (
                <>
                <OutputBlock title="Clause Review" content={reviewResult} onCopy={() => copyText(reviewResult)} />
                <SaveToMatterPanel title="Clause Review" kind="analysis" content={reviewResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CLAUSE COMPARATOR ── */}
          {aiMode === 'comparator' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <GitCompare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Compare two versions of a legal clause side-by-side. The AI will analyse differences, party impacts, and recommend a merged version.</p>
              </div>
              <form onSubmit={handleCompare} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Version A</label>
                  <textarea value={compareA} onChange={e => setCompareA(e.target.value)}
                    placeholder="Paste the first version of the clause..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={6}
                    data-testid="input-compare-a"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Version B</label>
                  <textarea value={compareB} onChange={e => setCompareB(e.target.value)}
                    placeholder="Paste the second version of the clause..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={6}
                    data-testid="input-compare-b"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Context (Optional)</label>
                  <input value={compareContext} onChange={e => setCompareContext(e.target.value)}
                    placeholder="e.g. Payment clause in a sub-sale SPA..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-compare-context"
                  />
                </div>
                {submitBtn(compareMutation.isPending, 'Compare Clauses', GitCompare, !compareA.trim() || !compareB.trim())}
              </form>
              {compareResult && (
                <>
                  <OutputBlock title="Clause Comparison" content={compareResult} onCopy={() => copyText(compareResult)} />
                  <SaveToMatterPanel title="Clause Comparison" kind="analysis" content={compareResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── LAND TITLE INTERPRETER ── */}
          {aiMode === 'title' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Paste the land search result or title details. The AI will decode the title type, restrictions, charges, caveats, and provide practical advice.</p>
              </div>
              <form onSubmit={handleTitle} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title Type (Optional)</label>
                  <div className="relative">
                    <select
                      value={titleType}
                      onChange={e => setTitleType(e.target.value)}
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none"
                      data-testid="select-title-type"
                    >
                      <option value="">Auto-detect from text</option>
                      <option value="Geran (Freehold)">Geran (Freehold)</option>
                      <option value="Pajakan Negeri (Leasehold)">Pajakan Negeri (Leasehold)</option>
                      <option value="Geran Mukim">Geran Mukim</option>
                      <option value="Hakmilik Sementara (Qualified Title)">Hakmilik Sementara (Qualified Title)</option>
                      <option value="Strata Title (Hakmilik Strata)">Strata Title (Hakmilik Strata)</option>
                      <option value="Master Title">Master Title</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Land Search / Title Details</label>
                  <textarea value={titleDetails} onChange={e => setTitleDetails(e.target.value)}
                    placeholder="Paste the land search result, title details, memorials, endorsements, or any information from the issue document of title..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={10}
                    data-testid="input-title-details"
                  />
                </div>
                {submitBtn(titleMutation.isPending, 'Interpret Title', MapPin, !titleDetails.trim())}
              </form>
              {titleResult && (
                <>
                  <OutputBlock title="Title Interpretation" content={titleResult} onCopy={() => copyText(titleResult)} />
                  <SaveToMatterPanel title="Title Interpretation" kind="analysis" content={titleResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── FEE QUOTATION ── */}
          {aiMode === 'quotation' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Receipt className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate a complete professional fee quotation letter based on the Solicitors' Remuneration Order 2005, including stamp duty calculations and all disbursements.</p>
              </div>
              <form onSubmit={handleQuotation} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                  {sharedSelect(quoteTxType, setQuoteTxType)}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Price / Loan Amount (RM)</label>
                  <input
                    type="text"
                    value={quotePrice}
                    onChange={e => setQuotePrice(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-quote-price"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Name (Optional)</label>
                  <input
                    type="text"
                    value={quoteClient}
                    onChange={e => setQuoteClient(e.target.value)}
                    placeholder="e.g. Ahmad bin Abdullah"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-quote-client"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Additional Info (Optional)</label>
                  <textarea value={quoteExtra} onChange={e => setQuoteExtra(e.target.value)}
                    placeholder="e.g. Foreign purchaser, first-time homebuyer exemption applies, strata property..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={3}
                    data-testid="input-quote-extra"
                  />
                </div>
                {submitBtn(quoteMutation.isPending, 'Generate Quotation', Receipt, !quoteTxType || !quotePrice)}
              </form>
              {quoteResult && (
                <>
                  <OutputBlock title="Fee Quotation Letter" content={quoteResult} onCopy={() => copyText(quoteResult)} />
                  <SaveToMatterPanel title="Fee Quotation Letter" kind="letter" content={quoteResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CLIENT ADVICE LETTER ── */}
          {aiMode === 'advice' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Mail className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate a formal client advice letter with legal analysis, risk assessment, and practical recommendations under Malaysian conveyancing law.</p>
              </div>
              <form onSubmit={handleAdviceLetter} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Name</label>
                  <input type="text" value={adviceClient} onChange={e => setAdviceClient(e.target.value)}
                    placeholder="e.g. Encik Ahmad bin Abdullah"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-advice-client" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                  {sharedSelect(adviceTxType, setAdviceTxType, "Select type (optional)...")}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Facts</label>
                  <textarea value={adviceFacts} onChange={e => setAdviceFacts(e.target.value)}
                    placeholder="Describe the key facts: property details, transaction background, issues discovered, client's concerns..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={6} data-testid="input-advice-facts" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Area of Advice (Optional)</label>
                  <input type="text" value={adviceArea} onChange={e => setAdviceArea(e.target.value)}
                    placeholder="e.g. Whether to proceed with purchase, RPGT implications..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-advice-area" />
                </div>
                {submitBtn(adviceMutation.isPending, 'Generate Advice Letter', Mail, !adviceClient.trim() || !adviceFacts.trim())}
              </form>
              {adviceResult && (
                <>
                  <OutputBlock title="Client Advice Letter" content={adviceResult} onCopy={() => copyText(adviceResult)} />
                  <SaveToMatterPanel title="Client Advice Letter" kind="letter" content={adviceResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── DUE DILIGENCE REPORT ── */}
          {aiMode === 'duediligence' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <ClipboardCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate a comprehensive property due diligence report covering title, planning, physical, legal, and financial aspects with NLC references.</p>
              </div>
              <form onSubmit={handleDueDiligence} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Details</label>
                  <textarea value={ddProperty} onChange={e => setDdProperty(e.target.value)}
                    placeholder="Enter property details: title reference, lot number, mukim, district, state, property type, size, tenure..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={6} data-testid="input-dd-property" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type (Optional)</label>
                  {sharedSelect(ddTxType, setDdTxType, "Select type (optional)...")}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Specific Concerns (Optional)</label>
                  <textarea value={ddConcerns} onChange={e => setDdConcerns(e.target.value)}
                    placeholder="e.g. Suspected encroachment, questionable title chain, environmental contamination concerns..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={3} data-testid="input-dd-concerns" />
                </div>
                {submitBtn(ddMutation.isPending, 'Generate DD Report', ClipboardCheck, !ddProperty.trim())}
              </form>
              {ddResult && (
                <>
                  <OutputBlock title="Due Diligence Report" content={ddResult} onCopy={() => copyText(ddResult)} />
                  <SaveToMatterPanel title="Due Diligence Report" kind="report" content={ddResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── LEGAL OPINION ── */}
          {aiMode === 'opinion' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Scale className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Draft a formal legal opinion with statutory analysis, case law citations, risk assessment, and practical recommendations.</p>
              </div>
              <form onSubmit={handleLegalOpinion} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legal Issue</label>
                  <textarea value={opinionIssue} onChange={e => setOpinionIssue(e.target.value)}
                    placeholder="State the legal question: e.g. Whether the restriction in interest under s.120 NLC can be discharged without state authority consent..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={4} data-testid="input-opinion-issue" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Relevant Facts</label>
                  <textarea value={opinionFacts} onChange={e => setOpinionFacts(e.target.value)}
                    placeholder="Describe the relevant facts of the matter in detail..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={5} data-testid="input-opinion-facts" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client's Position (Optional)</label>
                  <input type="text" value={opinionPosition} onChange={e => setOpinionPosition(e.target.value)}
                    placeholder="e.g. Purchaser wishes to proceed despite the caveat..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-opinion-position" />
                </div>
                {submitBtn(opinionMutation.isPending, 'Generate Legal Opinion', Scale, !opinionIssue.trim() || !opinionFacts.trim())}
              </form>
              {opinionResult && (
                <>
                  <OutputBlock title="Legal Opinion" content={opinionResult} onCopy={() => copyText(opinionResult)} />
                  <SaveToMatterPanel title="Legal Opinion" kind="opinion" content={opinionResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── REQUISITION LETTER ── */}
          {aiMode === 'requisition' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <FileQuestion className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate a formal requisition on title letter to the vendor's solicitors, covering all issues discovered on the title search.</p>
              </div>
              <form onSubmit={handleRequisition} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title Details / Search Results</label>
                  <textarea value={reqTitle} onChange={e => setReqTitle(e.target.value)}
                    placeholder="Paste the land search results, title details, encumbrances, caveats, restrictions found..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={5} data-testid="input-req-title" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Issues to Raise</label>
                  <textarea value={reqIssues} onChange={e => setReqIssues(e.target.value)}
                    placeholder="e.g. Outstanding caveat by third party, restriction in interest not consented, discrepancy in lot size, expired leasehold..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={4} data-testid="input-req-issues" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vendor's Solicitor (Optional)</label>
                  <input type="text" value={reqVendor} onChange={e => setReqVendor(e.target.value)}
                    placeholder="e.g. Messrs Ahmad & Partners"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-req-vendor" />
                </div>
                {submitBtn(reqMutation.isPending, 'Generate Requisition', FileQuestion, !reqTitle.trim() || !reqIssues.trim())}
              </form>
              {reqResult && (
                <>
                  <OutputBlock title="Requisition Letter" content={reqResult} onCopy={() => copyText(reqResult)} />
                  <SaveToMatterPanel title="Requisition Letter" kind="letter" content={reqResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── COMPLETION STATEMENT ── */}
          {aiMode === 'completion' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Calculator className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate a complete completion statement (completion account) with all financial items, stamp duty, legal fees, and disbursements calculated.</p>
              </div>
              <form onSubmit={handleCompletionStatement} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Price (RM)</label>
                  <input type="text" value={compPrice} onChange={e => setCompPrice(e.target.value)}
                    placeholder="e.g. 850000"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-comp-price" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                  {sharedSelect(compTxType, setCompTxType)}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completion Date (Optional)</label>
                  <input type="date" value={compDate} onChange={e => setCompDate(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                    data-testid="input-comp-date" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adjustments / Notes (Optional)</label>
                  <textarea value={compAdjust} onChange={e => setCompAdjust(e.target.value)}
                    placeholder="e.g. 90% loan from Maybank, first-time buyer stamp duty exemption, outstanding assessment RM1,200..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={3} data-testid="input-comp-adjust" />
                </div>
                {submitBtn(compMutation.isPending, 'Generate Statement', Calculator, !compPrice.trim() || !compTxType)}
              </form>
              {compResult && (
                <>
                  <OutputBlock title="Completion Statement" content={compResult} onCopy={() => copyText(compResult)} />
                  <SaveToMatterPanel title="Completion Statement" kind="statement" content={compResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CASE LAW RESEARCH ── */}
          {aiMode === 'caseresearch' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <BookOpen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Research Malaysian case law on any conveyancing topic. Get leading cases, ratios, and practical applications with full citations.</p>
              </div>
              <form onSubmit={handleCaseResearch} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Research Topic</label>
                  <textarea value={caseTopic} onChange={e => setCaseTopic(e.target.value)}
                    placeholder="e.g. Enforceability of oral agreements in land transactions, caveat removal under s.326 NLC, indefeasibility of title..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    rows={4} data-testid="input-case-topic" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jurisdiction (Optional)</label>
                  <div className="relative">
                    <select value={caseJurisdiction} onChange={e => setCaseJurisdiction(e.target.value)}
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none"
                      data-testid="select-case-jurisdiction">
                      <option value="">All Malaysian courts</option>
                      <option value="Federal Court">Federal Court</option>
                      <option value="Court of Appeal">Court of Appeal</option>
                      <option value="High Court">High Court</option>
                      <option value="Sabah & Sarawak">Sabah & Sarawak courts</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Specific Issue (Optional)</label>
                  <input type="text" value={caseIssue} onChange={e => setCaseIssue(e.target.value)}
                    placeholder="e.g. Whether a purchaser's caveat survives after registration of transfer..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    data-testid="input-case-issue" />
                </div>
                {submitBtn(caseMutation.isPending, 'Research Case Law', BookOpen, !caseTopic.trim())}
              </form>
              {caseResult && (
                <>
                  <OutputBlock title="Case Law Research" content={caseResult} onCopy={() => copyText(caseResult)} />
                  <SaveToMatterPanel title="Case Law Research" kind="research" content={caseResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── STAMP DUTY CALCULATOR ── */}
          {aiMode === 'stampduty' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Stamp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Calculate exact stamp duty on transfer instruments under the Stamp Act 1949, including exemptions for first-time homebuyers.</p>
              </div>
              <form onSubmit={handleStampDuty} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Price (RM)</label>
                  <input type="text" value={sdPrice} onChange={e => setSdPrice(e.target.value)} placeholder="e.g. 500000"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" data-testid="input-sd-price" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Type (Optional)</label>
                  <input type="text" value={sdPropertyType} onChange={e => setSdPropertyType(e.target.value)} placeholder="e.g. Residential, Commercial, Agricultural"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buyer Profile (Optional)</label>
                  <input type="text" value={sdBuyer} onChange={e => setSdBuyer(e.target.value)} placeholder="e.g. Malaysian citizen, first-time buyer"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">First Home?</label>
                  <select value={sdFirstHome} onChange={e => setSdFirstHome(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Not specified</option>
                    <option value="yes">Yes - First Home</option>
                    <option value="no">No</option>
                  </select>
                </div>
                {submitBtn(sdMutation.isPending, 'Calculate Stamp Duty', Stamp, !sdPrice.trim())}
              </form>
              {sdResult && (
                <>
                  <OutputBlock title="Stamp Duty Calculation" content={sdResult} onCopy={() => copyText(sdResult)} />
                  <SaveToMatterPanel title="Stamp Duty Calculation" kind="calculation" content={sdResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── RPGT ADVISOR ── */}
          {aiMode === 'rpgt' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <TrendingDown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Analyze Real Property Gains Tax liability under the RPGT Act 1976, including exemptions and holding period calculations.</p>
              </div>
              <form onSubmit={handleRPGT} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acquisition Date</label>
                  <input type="date" value={rpgtAcqDate} onChange={e => setRpgtAcqDate(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disposal Date</label>
                  <input type="date" value={rpgtDispDate} onChange={e => setRpgtDispDate(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acquisition Price (RM)</label>
                  <input type="text" value={rpgtAcqPrice} onChange={e => setRpgtAcqPrice(e.target.value)} placeholder="e.g. 400000"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disposal Price (RM)</label>
                  <input type="text" value={rpgtDispPrice} onChange={e => setRpgtDispPrice(e.target.value)} placeholder="e.g. 650000"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seller Profile (Optional)</label>
                  <input type="text" value={rpgtSeller} onChange={e => setRpgtSeller(e.target.value)} placeholder="e.g. Malaysian citizen, company, non-citizen"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(rpgtMutation.isPending, 'Analyze RPGT', TrendingDown, !rpgtAcqPrice.trim() || !rpgtDispPrice.trim())}
              </form>
              {rpgtResult && (
                <>
                  <OutputBlock title="RPGT Analysis" content={rpgtResult} onCopy={() => copyText(rpgtResult)} />
                  <SaveToMatterPanel title="RPGT Analysis" kind="calculation" content={rpgtResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── TENANCY AGREEMENT DRAFTER ── */}
          {aiMode === 'tenancy' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Home className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Draft a comprehensive tenancy agreement compliant with Malaysian law including standard and special conditions.</p>
              </div>
              <form onSubmit={handleTenancy} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Details</label>
                  <textarea value={tenPropDetails} onChange={e => setTenPropDetails(e.target.value)} placeholder="e.g. Unit 12-3, Kondominium Sentral, Jalan PJ 5/1, 46000 Petaling Jaya, Selangor. 3-bedroom condo, furnished."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={4} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenancy Terms</label>
                  <textarea value={tenTerms} onChange={e => setTenTerms(e.target.value)} placeholder="e.g. 2 years, RM2,500/month, 2 months deposit, 1 month utility deposit, landlord: Ahmad, tenant: Mei Ling"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={4} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Special Conditions (Optional)</label>
                  <textarea value={tenSpecial} onChange={e => setTenSpecial(e.target.value)} placeholder="e.g. No pets, diplomatic clause, renewal option at RM2,700/month"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                {submitBtn(tenMutation.isPending, 'Draft Tenancy Agreement', Home, !tenPropDetails.trim() || !tenTerms.trim())}
              </form>
              {tenResult && (
                <>
                  <OutputBlock title="Tenancy Agreement Draft" content={tenResult} onCopy={() => copyText(tenResult)} />
                  <SaveToMatterPanel title="Tenancy Agreement Draft" kind="draft" content={tenResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── POWER OF ATTORNEY DRAFTER ── */}
          {aiMode === 'poa' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Gavel className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Draft a Power of Attorney compliant with the Powers of Attorney Act 1949, for land dealings or specific transactions.</p>
              </div>
              <form onSubmit={handlePOA} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Donor Details</label>
                  <textarea value={poaDonor} onChange={e => setPoaDonor(e.target.value)} placeholder="Full name, IC number, address of the person granting the power"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Donee Details</label>
                  <textarea value={poaDonee} onChange={e => setPoaDonee(e.target.value)} placeholder="Full name, IC number, address of the person receiving the power"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Powers Granted</label>
                  <textarea value={poaPowers} onChange={e => setPoaPowers(e.target.value)} placeholder="e.g. Execute MOT Form 14A, sign SPA, deal with Land Office, accept loan offer"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purpose (Optional)</label>
                  <input type="text" value={poaPurpose} onChange={e => setPoaPurpose(e.target.value)} placeholder="e.g. Sale of property at Lot 1234, Mukim Petaling"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(poaMutation.isPending, 'Draft Power of Attorney', Gavel, !poaDonor.trim() || !poaDonee.trim() || !poaPowers.trim())}
              </form>
              {poaResult && (
                <>
                  <OutputBlock title="Power of Attorney Draft" content={poaResult} onCopy={() => copyText(poaResult)} />
                  <SaveToMatterPanel title="Power of Attorney Draft" kind="draft" content={poaResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CAVEAT ADVISOR ── */}
          {aiMode === 'caveat' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Get expert advice on private caveats, registrar's caveats, and lien-holder's caveats under the NLC, including entry, removal, and court applications.</p>
              </div>
              <form onSubmit={handleCaveat} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Situation</label>
                  <textarea value={cavSituation} onChange={e => setCavSituation(e.target.value)} placeholder="Describe the caveat situation: who is lodging/removing, the basis of the claim, the urgency..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={5} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Caveat Type (Optional)</label>
                  <select value={cavType} onChange={e => setCavType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Auto-detect</option>
                    <option value="Private Caveat (s.322 NLC)">Private Caveat (s.322 NLC)</option>
                    <option value="Registrar's Caveat (s.320 NLC)">Registrar's Caveat (s.320 NLC)</option>
                    <option value="Lien-Holder's Caveat (s.330 NLC)">Lien-Holder's Caveat (s.330 NLC)</option>
                  </select>
                </div>
                {submitBtn(cavMutation.isPending, 'Get Caveat Advice', AlertOctagon, !cavSituation.trim())}
              </form>
              {cavResult && (
                <>
                  <OutputBlock title="Caveat Advice" content={cavResult} onCopy={() => copyText(cavResult)} />
                  <SaveToMatterPanel title="Caveat Advice" kind="advice" content={cavResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── LAND SEARCH ANALYZER ── */}
          {aiMode === 'landsearch' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Search className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Paste your official land search results for a comprehensive analysis of encumbrances, restrictions, charges, and caveats.</p>
              </div>
              <form onSubmit={handleLandSearch} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Land Search Results</label>
                  <textarea value={lsResults} onChange={e => setLsResults(e.target.value)} placeholder="Paste the full land search result here..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={8} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purpose (Optional)</label>
                  <input type="text" value={lsPurpose} onChange={e => setLsPurpose(e.target.value)} placeholder="e.g. Pre-purchase due diligence, refinancing, caveat entry"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(lsMutation.isPending, 'Analyze Land Search', Search, !lsResults.trim())}
              </form>
              {lsResult && (
                <>
                  <OutputBlock title="Land Search Analysis" content={lsResult} onCopy={() => copyText(lsResult)} />
                  <SaveToMatterPanel title="Land Search Analysis" kind="analysis" content={lsResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── DEVELOPER CLAIM ADVISOR ── */}
          {aiMode === 'devclaim' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <HardHat className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Get advice on LAD claims, defect liability claims, and other developer-related claims under the Housing Development Act 1966.</p>
              </div>
              <form onSubmit={handleDevClaim} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Claim Type</label>
                  <select value={dcType} onChange={e => setDcType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select claim type...</option>
                    <option value="LAD - Late Delivery">LAD - Late Delivery of Vacant Possession</option>
                    <option value="Defect Liability">Defect Liability Period Claims</option>
                    <option value="Abandonment">Abandoned Project</option>
                    <option value="Non-compliance">Developer Non-compliance</option>
                    <option value="Strata Title Delay">Late Strata Title Application</option>
                    <option value="Other">Other Claim</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Claim Details</label>
                  <textarea value={dcDetails} onChange={e => setDcDetails(e.target.value)} placeholder="Describe the issue: date of SPA, expected VP date, actual VP date, defects found, developer responses..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={5} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Details (Optional)</label>
                  <input type="text" value={dcProject} onChange={e => setDcProject(e.target.value)} placeholder="e.g. Residensi ABC, Developer XYZ Sdn Bhd, HDA Licence No."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(dcMutation.isPending, 'Get Developer Claim Advice', HardHat, !dcType || !dcDetails.trim())}
              </form>
              {dcResult && (
                <>
                  <OutputBlock title="Developer Claim Advice" content={dcResult} onCopy={() => copyText(dcResult)} />
                  <SaveToMatterPanel title="Developer Claim Advice" kind="advice" content={dcResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── BANKRUPTCY SEARCH ADVISOR ── */}
          {aiMode === 'bankruptcy' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <UserX className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Interpret bankruptcy search and winding-up search results. Get advice on implications for conveyancing transactions.</p>
              </div>
              <form onSubmit={handleBankruptcy} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Results</label>
                  <textarea value={bsResults} onChange={e => setBsResults(e.target.value)} placeholder="Paste the bankruptcy / winding-up search results..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={6} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Context (Optional)</label>
                  <input type="text" value={bsContext} onChange={e => setBsContext(e.target.value)} placeholder="e.g. Vendor in a sub-sale, guarantor of loan, company seller"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(bsMutation.isPending, 'Interpret Search', UserX, !bsResults.trim())}
              </form>
              {bsResult && (
                <>
                  <OutputBlock title="Bankruptcy Search Advice" content={bsResult} onCopy={() => copyText(bsResult)} />
                  <SaveToMatterPanel title="Bankruptcy Search Advice" kind="advice" content={bsResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── FOREIGN PURCHASE ADVISOR ── */}
          {aiMode === 'foreignpurchase' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Globe className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Get advice on EPU approval, state authority consent, minimum price thresholds, and restrictions for foreign property purchases in Malaysia.</p>
              </div>
              <form onSubmit={handleForeignPurchase} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buyer Nationality</label>
                  <input type="text" value={fpNationality} onChange={e => setFpNationality(e.target.value)} placeholder="e.g. Singaporean, Chinese, British, MM2H holder"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Type</label>
                  <input type="text" value={fpPropType} onChange={e => setFpPropType(e.target.value)} placeholder="e.g. Condominium, landed house, commercial, agricultural"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">State</label>
                  <select value={fpState} onChange={e => setFpState(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select state...</option>
                    <option value="Johor">Johor</option><option value="Kedah">Kedah</option><option value="Kelantan">Kelantan</option>
                    <option value="Melaka">Melaka</option><option value="Negeri Sembilan">Negeri Sembilan</option><option value="Pahang">Pahang</option>
                    <option value="Perak">Perak</option><option value="Perlis">Perlis</option><option value="Pulau Pinang">Pulau Pinang</option>
                    <option value="Sabah">Sabah</option><option value="Sarawak">Sarawak</option><option value="Selangor">Selangor</option>
                    <option value="Terengganu">Terengganu</option><option value="WP Kuala Lumpur">WP Kuala Lumpur</option><option value="WP Putrajaya">WP Putrajaya</option><option value="WP Labuan">WP Labuan</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Price (RM, Optional)</label>
                  <input type="text" value={fpPrice} onChange={e => setFpPrice(e.target.value)} placeholder="e.g. 1500000"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(fpMutation.isPending, 'Get Foreign Purchase Advice', Globe, !fpNationality.trim() || !fpPropType.trim() || !fpState)}
              </form>
              {fpResult && (
                <>
                  <OutputBlock title="Foreign Purchase Advice" content={fpResult} onCopy={() => copyText(fpResult)} />
                  <SaveToMatterPanel title="Foreign Purchase Advice" kind="advice" content={fpResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── LOAN DOC REVIEWER ── */}
          {aiMode === 'loandoc' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <FileCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Review loan facility agreements, letter of offers, and financing documents for key terms, risks, and compliance issues.</p>
              </div>
              <form onSubmit={handleLoanDoc} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Text</label>
                  <textarea value={ldText} onChange={e => setLdText(e.target.value)} placeholder="Paste the loan document, facility agreement, or letter of offer text..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={8} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loan Type (Optional)</label>
                  <select value={ldType} onChange={e => setLdType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select type...</option>
                    <option value="Housing Loan">Housing Loan</option>
                    <option value="Islamic Financing">Islamic Financing</option>
                    <option value="Commercial Loan">Commercial Loan</option>
                    <option value="Refinancing">Refinancing</option>
                    <option value="Bridging Loan">Bridging Loan</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Role (Optional)</label>
                  <select value={ldRole} onChange={e => setLdRole(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select role...</option>
                    <option value="Borrower">Borrower</option>
                    <option value="Guarantor">Guarantor</option>
                    <option value="Chargor">Chargor (Third Party)</option>
                  </select>
                </div>
                {submitBtn(ldMutation.isPending, 'Review Loan Document', FileCheck, !ldText.trim())}
              </form>
              {ldResult && (
                <>
                  <OutputBlock title="Loan Document Review" content={ldResult} onCopy={() => copyText(ldResult)} />
                  <SaveToMatterPanel title="Loan Document Review" kind="analysis" content={ldResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── TAX COMPLIANCE ── */}
          {aiMode === 'taxcompliance' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Landmark className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Get comprehensive LHDN tax compliance advice for property transactions including withholding tax, RPGT obligations, stamp duty, and filing requirements.</p>
              </div>
              <form onSubmit={handleTaxCompliance} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Details</label>
                  <textarea value={tcDetails} onChange={e => setTcDetails(e.target.value)} placeholder="Describe the transaction: sale price, property type, parties involved, dates, any special circumstances..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={5} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type (Optional)</label>
                  {sharedSelect(tcType, setTcType, "Select type (optional)...")}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parties (Optional)</label>
                  <input type="text" value={tcParties} onChange={e => setTcParties(e.target.value)} placeholder="e.g. Malaysian citizen vendor, foreign company purchaser"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(tcMutation.isPending, 'Get Tax Compliance Advice', Landmark, !tcDetails.trim())}
              </form>
              {tcResult && (
                <>
                  <OutputBlock title="Tax Compliance Advice" content={tcResult} onCopy={() => copyText(tcResult)} />
                  <SaveToMatterPanel title="Tax Compliance Advice" kind="advice" content={tcResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── STRATA MANAGEMENT ADVISOR ── */}
          {aiMode === 'strata' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Get legal advice on strata management issues under the Strata Management Act 2013 and Strata Titles Act 1985, including MC/JMB disputes.</p>
              </div>
              <form onSubmit={handleStrata} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Strata Issue</label>
                  <textarea value={strIssue} onChange={e => setStrIssue(e.target.value)} placeholder="Describe the issue: maintenance disputes, sinking fund arrears, by-law violations, renovation approvals, AGM procedures..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={5} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Building Type (Optional)</label>
                  <select value={strBuilding} onChange={e => setStrBuilding(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select type...</option>
                    <option value="Condominium">Condominium</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Commercial Complex">Commercial Complex</option>
                    <option value="Mixed Development">Mixed Development</option>
                    <option value="SOHO/SOFO/SOVO">SOHO/SOFO/SOVO</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Management Body (Optional)</label>
                  <select value={strMgmt} onChange={e => setStrMgmt(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select body...</option>
                    <option value="Management Corporation (MC)">Management Corporation (MC)</option>
                    <option value="Joint Management Body (JMB)">Joint Management Body (JMB)</option>
                    <option value="Developer (pre-JMB)">Developer (pre-JMB)</option>
                    <option value="Sub-MC">Sub-Management Corporation</option>
                  </select>
                </div>
                {submitBtn(strMutation.isPending, 'Get Strata Advice', Building2, !strIssue.trim())}
              </form>
              {strResult && (
                <>
                  <OutputBlock title="Strata Management Advice" content={strResult} onCopy={() => copyText(strResult)} />
                  <SaveToMatterPanel title="Strata Management Advice" kind="advice" content={strResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── QUIZ GENERATOR ── */}
          {aiMode === 'quiz' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Brain className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate MCQ quizzes on any Malaysian conveyancing topic. Questions include scenario-based problems with detailed explanations citing Malaysian legislation and case law.</p>
              </div>
              <form onSubmit={handleQuiz} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topic</label>
                  <input data-testid="input-quiz-topic" type="text" value={quizTopic} onChange={e => setQuizTopic(e.target.value)} placeholder="e.g. Indefeasibility of Title, Stamp Duty Exemptions, Caveat Law..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Difficulty</label>
                  <select data-testid="select-quiz-difficulty" value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Intermediate (default)</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Number of Questions</label>
                  <input data-testid="input-quiz-num" type="number" value={quizNum} onChange={e => setQuizNum(e.target.value)} min="3" max="20"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(quizMutation.isPending, 'Generate Quiz', Brain, !quizTopic.trim())}
              </form>
              {quizResult && (
                <>
                  <OutputBlock title="Generated Quiz" content={quizResult} onCopy={() => copyText(quizResult)} />
                  <SaveToMatterPanel title="Generated Quiz" kind="quiz" content={quizResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── TRANSACTION SIMULATOR ── */}
          {aiMode === 'simulator' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <PlayCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Simulate a complete property transaction step-by-step. Walk through every stage from due diligence to post-completion with realistic Malaysian details.</p>
              </div>
              <form onSubmit={handleSimulator} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Scenario</label>
                  <textarea data-testid="input-sim-scenario" value={simScenario} onChange={e => setSimScenario(e.target.value)} placeholder="e.g. Sub-sale of a leasehold condominium in Bangsar, RM1.2M, with existing CIMB charge, foreign purchaser..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={5} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Type (Optional)</label>
                  <select data-testid="select-sim-proptype" value={simPropType} onChange={e => setSimPropType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select type...</option>
                    <option value="Terrace House">Terrace House</option>
                    <option value="Semi-Detached">Semi-Detached</option>
                    <option value="Bungalow">Bungalow</option>
                    <option value="Condominium">Condominium</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Commercial Shophouse">Commercial Shophouse</option>
                    <option value="Agricultural Land">Agricultural Land</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type (Optional)</label>
                  <select data-testid="select-sim-txntype" value={simTxnType} onChange={e => setSimTxnType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Sub-sale (default)</option>
                    <option value="Developer Sale (Schedule G)">Developer Sale (Schedule G)</option>
                    <option value="Developer Sale (Schedule H)">Developer Sale (Schedule H)</option>
                    <option value="Sub-sale">Sub-sale</option>
                    <option value="Auction Purchase">Auction Purchase</option>
                    <option value="Transfer (Gift/Love & Affection)">Transfer (Gift/Love & Affection)</option>
                  </select>
                </div>
                {submitBtn(simMutation.isPending, 'Run Simulation', PlayCircle, !simScenario.trim())}
              </form>
              {simResult && (
                <>
                  <OutputBlock title="Transaction Simulation" content={simResult} onCopy={() => copyText(simResult)} />
                  <SaveToMatterPanel title="Transaction Simulation" kind="analysis" content={simResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CLAUSE LIBRARY ── */}
          {aiMode === 'clauselib' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Library className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Access a comprehensive clause library with standard clauses, variations, annotations, and case law references for Malaysian conveyancing agreements.</p>
              </div>
              <form onSubmit={handleClauseLib} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clause Type</label>
                  <input data-testid="input-clause-type" type="text" value={clauseType} onChange={e => setClauseType(e.target.value)} placeholder="e.g. Defect Liability, Liquidated Damages, Vendor's Representations, Completion Conditions..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Context (Optional)</label>
                  <input data-testid="input-clause-context" type="text" value={clauseContext} onChange={e => setClauseContext(e.target.value)} placeholder="e.g. sub-sale SPA, developer agreement, tenancy..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(clauseMutation.isPending, 'Search Clause Library', Library, !clauseType.trim())}
              </form>
              {clauseResult && (
                <>
                  <OutputBlock title="Clause Library Results" content={clauseResult} onCopy={() => copyText(clauseResult)} />
                  <SaveToMatterPanel title="Clause Library Results" kind="draft" content={clauseResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── DOCUMENT ANALYZER ── */}
          {aiMode === 'docanalyzer' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Paste any legal document text for comprehensive analysis — risk assessment, missing clauses, non-compliance issues, and recommendations.</p>
              </div>
              <form onSubmit={handleDocAnalyzer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Text</label>
                  <textarea data-testid="input-doc-text" value={docText} onChange={e => setDocText(e.target.value)} placeholder="Paste the legal document text here for analysis..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={8} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Type (Optional)</label>
                  <select data-testid="select-doc-type" value={docType} onChange={e => setDocType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Auto-detect</option>
                    <option value="Sale and Purchase Agreement">Sale and Purchase Agreement</option>
                    <option value="Loan Agreement">Loan Agreement</option>
                    <option value="Tenancy Agreement">Tenancy Agreement</option>
                    <option value="Deed of Assignment">Deed of Assignment</option>
                    <option value="Power of Attorney">Power of Attorney</option>
                    <option value="Caveat Application">Caveat Application</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {submitBtn(docMutation.isPending, 'Analyze Document', FileText, !docText.trim())}
              </form>
              {docResult && (
                <>
                  <OutputBlock title="Document Analysis" content={docResult} onCopy={() => copyText(docResult)} />
                  <SaveToMatterPanel title="Document Analysis" kind="analysis" content={docResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── COMPLIANCE CHECKER ── */}
          {aiMode === 'compliance' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Run a full compliance audit on any transaction — AML/CFT, regulatory, professional conduct, documentation, and timeline compliance checks.</p>
              </div>
              <form onSubmit={handleCompliance} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Details</label>
                  <textarea data-testid="input-comp-txn" value={compChkTxn} onChange={e => setCompChkTxn(e.target.value)} placeholder="Describe the transaction: parties, property details, purchase price, financing arrangements, any special circumstances..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={6} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Check Type (Optional)</label>
                  <select data-testid="select-comp-type" value={compChkType} onChange={e => setCompChkType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Full Compliance Audit</option>
                    <option value="AML/CFT only">AML/CFT Only</option>
                    <option value="Regulatory only">Regulatory Only</option>
                    <option value="Professional conduct only">Professional Conduct Only</option>
                    <option value="Documentation checklist">Documentation Checklist</option>
                  </select>
                </div>
                {submitBtn(compChkMutation.isPending, 'Run Compliance Check', CheckSquare, !compChkTxn.trim())}
              </form>
              {compChkResult && (
                <>
                  <OutputBlock title="Compliance Audit Report" content={compChkResult} onCopy={() => copyText(compChkResult)} />
                  <SaveToMatterPanel title="Compliance Audit Report" kind="report" content={compChkResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── TIMELINE GENERATOR ── */}
          {aiMode === 'timeline' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Timer className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate a detailed transaction timeline with milestones, deadlines, responsible parties, and critical path analysis for any property transaction type.</p>
              </div>
              <form onSubmit={handleTimeline} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type</label>
                  <select data-testid="select-tl-type" value={tlType} onChange={e => setTlType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Select transaction type...</option>
                    <option value="Sub-sale (freehold)">Sub-sale (Freehold)</option>
                    <option value="Sub-sale (leasehold, consent required)">Sub-sale (Leasehold with Consent)</option>
                    <option value="Developer purchase (Schedule G)">Developer Purchase (Schedule G)</option>
                    <option value="Developer purchase (Schedule H)">Developer Purchase (Schedule H)</option>
                    <option value="Auction purchase">Auction Purchase</option>
                    <option value="Transfer by gift/love and affection">Transfer by Gift</option>
                    <option value="Refinancing/redemption">Refinancing / Redemption</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Date (Optional)</label>
                  <input data-testid="input-tl-start" type="date" value={tlStart} onChange={e => setTlStart(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Special Conditions (Optional)</label>
                  <input data-testid="input-tl-conditions" type="text" value={tlConditions} onChange={e => setTlConditions(e.target.value)} placeholder="e.g. Foreign buyer (EPU consent needed), existing tenant, probate property..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(tlMutation.isPending, 'Generate Timeline', Timer, !tlType.trim())}
              </form>
              {tlResult && (
                <>
                  <OutputBlock title="Transaction Timeline" content={tlResult} onCopy={() => copyText(tlResult)} />
                  <SaveToMatterPanel title="Transaction Timeline" kind="deadlines" content={tlResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── MOCK EXAM GENERATOR ── */}
          {aiMode === 'mockexam' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <GraduationCap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate complete mock examination papers in UKM format with scenario-based problem questions and detailed suggested answers with marking schemes.</p>
              </div>
              <form onSubmit={handleMockExam} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subject / Topic</label>
                  <input data-testid="input-exam-subject" type="text" value={examSubject} onChange={e => setExamSubject(e.target.value)} placeholder="e.g. Land Dealings under the NLC, Strata Law, Stamp Duty & RPGT..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exam Type (Optional)</label>
                  <select data-testid="select-exam-type" value={examType} onChange={e => setExamType(e.target.value)}
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                    <option value="">Final Examination</option>
                    <option value="Mid-term test">Mid-term Test</option>
                    <option value="Tutorial problem questions">Tutorial Problem Questions</option>
                    <option value="CLP preparation">CLP Bar Exam Preparation</option>
                    <option value="Practical training assessment">Practical Training Assessment</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Number of Questions</label>
                  <input data-testid="input-exam-num" type="number" value={examNum} onChange={e => setExamNum(e.target.value)} min="2" max="10"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(examMutation.isPending, 'Generate Exam Paper', GraduationCap, !examSubject.trim())}
              </form>
              {examResult && (
                <>
                  <OutputBlock title="Mock Examination Paper" content={examResult} onCopy={() => copyText(examResult)} />
                  <SaveToMatterPanel title="Mock Examination Paper" kind="exam" content={examResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CASE LAW ANALYZER ── */}
          {aiMode === 'caseanalyzer' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Microscope className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Deep-dive analysis of any Malaysian property law case — facts, ratio decidendi, legal principles established, impact on practice, and exam notes.</p>
              </div>
              <form onSubmit={handleCaseAnalyzer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Case Name</label>
                  <input data-testid="input-ca-name" type="text" value={caName} onChange={e => setCaName(e.target.value)} placeholder="e.g. Adorna Properties Sdn Bhd v Boonsom Boonyanit [2001] 1 MLJ 241"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Additional Details (Optional)</label>
                  <textarea data-testid="input-ca-details" value={caDetails} onChange={e => setCaDetails(e.target.value)} placeholder="Any additional context about the case or specific aspects you want analyzed..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legal Issue Focus (Optional)</label>
                  <input data-testid="input-ca-issue" type="text" value={caIssue} onChange={e => setCaIssue(e.target.value)} placeholder="e.g. Deferred indefeasibility, fraud exception, bona fide purchaser..."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(caMutation.isPending, 'Analyze Case', Microscope, !caName.trim())}
              </form>
              {caResult && (
                <>
                  <OutputBlock title="Case Law Analysis" content={caResult} onCopy={() => copyText(caResult)} />
                  <SaveToMatterPanel title="Case Law Analysis" kind="analysis" content={caResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CORPORATE RESOLUTION ── */}
          {aiMode === 'corpresolution' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <FileSignature className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Generate Companies Act 2016-compliant Board / Member resolutions for property transactions. Covers s.61 common seal, s.66 execution and s.223 substantial property transaction approvals.</p>
              </div>
              <form onSubmit={handleCorpResolution} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                  <input type="text" value={crCompany} onChange={e => setCrCompany(e.target.value)}
                    placeholder="e.g. Mawar Holdings Sdn Bhd"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">SSM Company No. (Optional)</label>
                  <input type="text" value={crCompanyNo} onChange={e => setCrCompanyNo(e.target.value)}
                    placeholder="e.g. 200201234567 (1234567-X)"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolution Type</label>
                  <div className="relative">
                    <select value={crResType} onChange={e => setCrResType(e.target.value)}
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                      <option value="" disabled>Select resolution type...</option>
                      <option>Directors' Circular Resolution — Property Acquisition</option>
                      <option>Directors' Circular Resolution — Property Disposal</option>
                      <option>Directors' Circular Resolution — Charge / Loan Facility</option>
                      <option>Directors' Circular Resolution — Lease / Tenancy Grant</option>
                      <option>Members' Special Resolution — Substantial Property Transaction (s.223 CA 2016)</option>
                      <option>Written Resolution of Sole Member — Property Transaction</option>
                      <option>Common Seal Affixation Authority (s.61 CA 2016)</option>
                      <option>Authority to Solicitors — Corporate Client</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Details</label>
                  <textarea value={crTxDetails} onChange={e => setCrTxDetails(e.target.value)}
                    placeholder="e.g. Acquisition of freehold land held under Geran 12345 Lot 678 Mukim Petaling for RM 5,200,000 from Suria Properties Sdn Bhd, financed by Maybank Berhad term loan of RM 4,000,000."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={4} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signatories (Optional)</label>
                  <input type="text" value={crSignatories} onChange={e => setCrSignatories(e.target.value)}
                    placeholder="e.g. Directors A, B, C; Company Secretary"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(crMutation.isPending, 'Generate Resolution', FileSignature, !crCompany.trim() || !crResType.trim() || !crTxDetails.trim())}
              </form>
              {crResult && (
                <>
                  <OutputBlock title="Corporate Resolution" content={crResult} onCopy={() => copyText(crResult)} />
                  <SaveToMatterPanel title="Corporate Resolution" kind="draft" content={crResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── CORPORATE PROPERTY DD ── */}
          {aiMode === 'corpdd' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Building className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Combined corporate + property due diligence — SSM searches, capacity & power, encumbrances at SSM and Land Office level, plus stamp duty / RPGT / FIC and Bursa flags.</p>
              </div>
              <form onSubmit={handleCorpDD} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company / Counter-Party Details</label>
                  <textarea value={cddCompany} onChange={e => setCddCompany(e.target.value)}
                    placeholder="e.g. Maju Permai Sdn Bhd (Co. 199801001234), private company limited by shares, paid-up RM 5m, directors A & B, ultimate holding company XYZ Berhad (listed on Bursa Main Market)."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={4} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Details</label>
                  <textarea value={cddProperty} onChange={e => setCddProperty(e.target.value)}
                    placeholder="e.g. 4 storey shoplot, Geran 56789 Lot 12 Seksyen 13 Bandar Petaling Jaya, leasehold 99 years expiring 2087, charged to RHB Bank Berhad, restriction-in-interest requires SA consent."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={4} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Type (Optional)</label>
                  <input type="text" value={cddTxType} onChange={e => setCddTxType(e.target.value)}
                    placeholder="e.g. Share acquisition of an RPC; Asset acquisition; Sale & leaseback"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Specific Concerns (Optional)</label>
                  <textarea value={cddConcerns} onChange={e => setCddConcerns(e.target.value)}
                    placeholder="e.g. Possible undisclosed cross-guarantees, foreign shareholder triggering EPU consent, pending litigation."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                {submitBtn(cddMutation.isPending, 'Generate DD Report', Building, !cddCompany.trim() || !cddProperty.trim())}
              </form>
              {cddResult && (
                <>
                  <OutputBlock title="Corporate Property DD Report" content={cddResult} onCopy={() => copyText(cddResult)} />
                  <SaveToMatterPanel title="Corporate Property DD Report" kind="report" content={cddResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── JV / JDA DRAFTER ── */}
          {aiMode === 'jvagreement' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <Handshake className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Draft a Malaysian Joint Venture / Joint Development Agreement — covers entitlement model, JVCo / SPV model, HDA licensing, RPGT, intra-group reliefs and POA + Trust Deed mechanics.</p>
              </div>
              <form onSubmit={handleJVAgreement} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parties</label>
                  <textarea value={jvParties} onChange={e => setJvParties(e.target.value)}
                    placeholder="e.g. Landowner: Pn. Aminah binti Hassan (NRIC 600101-08-5678); Developer: Skyline Developments Sdn Bhd (Co. 201501012345), HDA licence no. 12345-6/12-2027/0123(N)."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property / Project Land</label>
                  <textarea value={jvProperty} onChange={e => setJvProperty(e.target.value)}
                    placeholder="e.g. Approx 5 acres freehold agricultural land Geran 11111 Lot 222 Mukim Hulu Langat, to be converted to building category for proposed mixed-use development with GDV RM 350m."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">JV Structure Type</label>
                  <div className="relative">
                    <select value={jvStructure} onChange={e => setJvStructure(e.target.value)}
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                      <option value="" disabled>Select structure...</option>
                      <option>Entitlement Model — Landowner takes % of GDV / units</option>
                      <option>Revenue Share Model — % of net sales proceeds</option>
                      <option>JVCo / SPV Model — Both parties shareholders of new SPV</option>
                      <option>Profit Share Model — Hurdle rate then waterfall</option>
                      <option>Turnkey Contract — Developer delivers completed units</option>
                      <option>Joint Development Agreement (JDA) — Mixed entitlement + cash</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commercial Terms (Optional)</label>
                  <textarea value={jvTerms} onChange={e => setJvTerms(e.target.value)}
                    placeholder="e.g. Landowner entitlement 22% of GDV with minimum guaranteed RM 65m; GDC capped at RM 240m; sales target 90% within 24 months."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration / Milestones (Optional)</label>
                  <input type="text" value={jvDuration} onChange={e => setJvDuration(e.target.value)}
                    placeholder="e.g. 5 years; CCC by Month 36; LAD RM 50/day per unit thereafter"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                {submitBtn(jvMutation.isPending, 'Draft JV / JDA', Handshake, !jvParties.trim() || !jvProperty.trim() || !jvStructure.trim())}
              </form>
              {jvResult && (
                <>
                  <OutputBlock title="JV / JDA Draft" content={jvResult} onCopy={() => copyText(jvResult)} />
                  <SaveToMatterPanel title="JV / JDA Draft" kind="draft" content={jvResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

          {/* ── GUARANTEE DRAFTER ── */}
          {aiMode === 'guarantee' && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <MatterPicker selectedMatter={pickedMatter} onSelect={setPickedMatter} onClear={() => setPickedMatter(null)} />
              <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">Draft personal / corporate / joint & several guarantees for property-secured facilities. Includes Etridge-style independent advice safeguards and s.123 CA 2016 financial assistance checks.</p>
              </div>
              <form onSubmit={handleGuarantee} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guarantee Type</label>
                  <div className="relative">
                    <select value={grnType} onChange={e => setGrnType(e.target.value)}
                      className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none">
                      <option value="" disabled>Select guarantee type...</option>
                      <option>Personal Guarantee — Single Individual</option>
                      <option>Personal Guarantee — Joint & Several Individuals</option>
                      <option>Corporate Guarantee — Holding Co. for Subsidiary</option>
                      <option>Cross Guarantee — Inter-Company within Group</option>
                      <option>Guarantee & Indemnity — Combined</option>
                      <option>Bank-Form Continuing All-Monies Guarantee</option>
                      <option>Spousal Guarantee — Etridge-Compliant</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guarantor(s)</label>
                  <textarea value={grnGuarantor} onChange={e => setGrnGuarantor(e.target.value)}
                    placeholder="e.g. Encik Lim Chee Wah (NRIC 750505-10-1122) and Pn. Tan Mei Ling (NRIC 770808-14-3344), both directors of the Borrower."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Principal Debtor / Borrower</label>
                  <input type="text" value={grnDebtor} onChange={e => setGrnDebtor(e.target.value)}
                    placeholder="e.g. Mawar Holdings Sdn Bhd (Co. 200201234567)"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lender / Chargee</label>
                  <input type="text" value={grnLender} onChange={e => setGrnLender(e.target.value)}
                    placeholder="e.g. Maybank Berhad"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Facility Amount</label>
                  <input type="text" value={grnAmount} onChange={e => setGrnAmount(e.target.value)}
                    placeholder="e.g. RM 4,000,000 term loan + RM 500,000 overdraft"
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Security (Optional)</label>
                  <textarea value={grnSecurity} onChange={e => setGrnSecurity(e.target.value)}
                    placeholder="e.g. First party first legal charge over Geran 12345 Lot 678 Mukim Petaling under s.241 NLC; assignment of insurance proceeds; assignment of rentals."
                    className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none" rows={3} />
                </div>
                {submitBtn(grnMutation.isPending, 'Draft Guarantee', ShieldCheck, !grnType.trim() || !grnGuarantor.trim() || !grnDebtor.trim() || !grnLender.trim() || !grnAmount.trim())}
              </form>
              {grnResult && (
                <>
                  <OutputBlock title="Guarantee Draft" content={grnResult} onCopy={() => copyText(grnResult)} />
                  <SaveToMatterPanel title="Guarantee Draft" kind="draft" content={grnResult} defaultMatterId={pickedMatter?.id} />
                </>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
