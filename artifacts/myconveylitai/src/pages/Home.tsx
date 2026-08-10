import { motion } from 'framer-motion';
import {
  Scale, BookOpen, ArrowRight, Gavel, FileText, BookMarked, LogIn, UserPlus,
  LayoutDashboard, Brain, ShieldCheck, ChevronDown, Bot, GraduationCap, Search,
  Calculator, FileCheck, PenTool, ListChecks, Clock, ShieldAlert, FileSearch,
  GitCompare, MapPin, Receipt, Mail, ClipboardCheck, FileQuestion, Stamp,
  TrendingDown, Home as HomeIcon, AlertOctagon, HardHat, UserX, Globe, Landmark,
  Building2, PlayCircle, Library, CheckSquare, Timer, Microscope,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useRef, useState } from 'react';

const pillars = [
  { icon: BookOpen, label: 'Legal Theory' },
  { icon: Gavel, label: 'Jurisprudence' },
  { icon: FileText, label: 'Conveyancing Practice' },
  { icon: BookMarked, label: 'Statutory Forms' },
];

const steps = [
  {
    num: '01',
    icon: UserPlus,
    title: 'Get Your Account',
    description: 'Your firm\'s account manager will create your credentials through the Admin Dashboard. You will receive a username and password to access the platform.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    num: '02',
    icon: LogIn,
    title: 'Log In to the Platform',
    description: 'Click "Enter Workspace" and sign in with the credentials provided by your admin. Your session will be remembered for easy access.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    num: '03',
    icon: LayoutDashboard,
    title: 'Explore the Dashboard',
    description: 'Access 6 comprehensive reference sections covering substantive law, conveyancing workflows, statutory forms, landmark cases, costs & fees, and legal terminology.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    num: '04',
    icon: Brain,
    title: 'Use 39 AI-Powered Tools',
    description: 'Select any AI tool from the dashboard — from document drafting to compliance checking — all powered by advanced AI tailored for Malaysian conveyancing law.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
];

interface ToolDetail {
  name: string;
  icon: React.ComponentType<{className?: string}>;
  desc: string;
}

interface ToolGroupDetail {
  group: string;
  color: string;
  bg: string;
  border: string;
  groupDesc: string;
  tools: ToolDetail[];
}

const toolGroups: ToolGroupDetail[] = [
  {
    group: 'Learn',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    groupDesc: 'Interactive reference tools to deepen your expertise in Malaysian conveyancing law through AI-assisted research.',
    tools: [
      { name: 'AI Legal Tutor', icon: Bot, desc: 'Ask any question about Malaysian conveyancing law, the National Land Code 2020, HDA 1966, or property transactions. Get detailed, referenced answers instantly.' },
      { name: 'Case Law Research', icon: BookOpen, desc: 'Research Malaysian case law relevant to conveyancing. Find leading cases, understand judicial reasoning, and get citations for your legal work.' },
    ],
  },
  {
    group: 'Draft',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    groupDesc: 'AI-powered document drafting tools to generate professional legal documents and correspondence.',
    tools: [
      { name: 'AI Drafter', icon: PenTool, desc: 'Generate legal clauses, contract provisions, and document sections. Supports SPA clauses, loan agreements, undertaking letters, and more.' },
      { name: 'Client Advice Letter', icon: Mail, desc: 'Draft formal advice letters to clients covering transaction status, legal implications, obligations, and recommended actions.' },
      { name: 'Legal Opinion Generator', icon: Scale, desc: 'Generate formal legal opinions on property law issues including title validity, encumbrances, planning restrictions, and compliance matters.' },
      { name: 'Tenancy Agreement Drafter', icon: HomeIcon, desc: 'Draft comprehensive tenancy agreements with customizable clauses for residential or commercial properties under Malaysian law.' },
      { name: 'Power of Attorney Drafter', icon: Gavel, desc: 'Draft general or specific Power of Attorney documents, including provisions for property transactions and NLC requirements.' },
    ],
  },
  {
    group: 'Review',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    groupDesc: 'Analytical review tools to examine, compare, and interpret legal documents and search results.',
    tools: [
      { name: 'SPA / Contract Reviewer', icon: FileSearch, desc: 'Submit any Sale and Purchase Agreement or contract for clause-by-clause legal review. Identifies risks, non-standard terms, and compliance issues.' },
      { name: 'Clause Comparator', icon: GitCompare, desc: 'Compare two versions of any legal clause side by side. Highlights differences and assesses the legal impact of each variation.' },
      { name: 'Land Title Interpreter', icon: MapPin, desc: 'Decode official land title information — geran/pajakan/hakmilik. Explains restrictions, endorsements, caveats, and encumbrances on the title.' },
      { name: 'Due Diligence Report', icon: ClipboardCheck, desc: 'Generate a comprehensive due diligence report for property transactions covering title, planning, charges, tenancies, and compliance matters.' },
      { name: 'Requisition Letter Generator', icon: FileQuestion, desc: 'Draft requisitions on title to the vendor\'s solicitors based on land search results, title defects, or outstanding issues.' },
      { name: 'Land Search Analyzer', icon: Search, desc: 'Upload or describe official land search results from the land office. Get a plain-language analysis of ownership, charges, caveats, and restrictions.' },
      { name: 'Loan Document Reviewer', icon: FileCheck, desc: 'Review bank facility agreements and loan documentation. Identifies unusual conditions, obligations, and potential issues for the borrower.' },
    ],
  },
  {
    group: 'Practice',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    groupDesc: 'Practical workflow tools for risk management, calculations, and transaction administration.',
    tools: [
      { name: 'Risk Scanner', icon: ShieldAlert, desc: 'Paste any clause or document to identify red flags, legal risks, ambiguities, and potential liability issues in conveyancing transactions.' },
      { name: 'Checklist Generator', icon: ListChecks, desc: 'Generate step-by-step practitioner checklists for any type of property transaction — sub-sale, new development, auction, refinancing, etc.' },
      { name: 'Deadline Calculator', icon: Clock, desc: 'Calculate statutory deadlines for stamping (30 days), adjudication period, registration, completion, and other time-sensitive requirements.' },
      { name: 'Fee Quotation Generator', icon: Receipt, desc: 'Generate professional fee quotations based on the Solicitors\' Remuneration Order 2023 (SRO 2023) scale fees with detailed breakdowns.' },
      { name: 'Completion Statement', icon: Calculator, desc: 'Generate completion account statements with purchase price breakdown, adjustments, apportionments, and balance calculations.' },
    ],
  },
  {
    group: 'Tax & Finance',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    groupDesc: 'Tax calculation and financial compliance tools for property transactions.',
    tools: [
      { name: 'Stamp Duty Calculator', icon: Stamp, desc: 'Calculate stamp duty on instruments of transfer (MOT/POS) with ad valorem rates, exemptions for first-time buyers, HOC campaigns, and the latest Budget changes.' },
      { name: 'RPGT Advisor', icon: TrendingDown, desc: 'Analyze Real Property Gains Tax liability based on acquisition date, disposal date, nationality, and applicable exemptions under Schedule 5 RPGTA 1976.' },
      { name: 'LHDN Tax Compliance', icon: Landmark, desc: 'Advise on LHDN tax compliance requirements for property transactions including withholding tax, RPGT filing obligations, and penalty avoidance.' },
    ],
  },
  {
    group: 'Specialist',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    groupDesc: 'Specialist advisory tools for niche areas of Malaysian conveyancing practice.',
    tools: [
      { name: 'Caveat Advisor', icon: AlertOctagon, desc: 'Advise on entry, removal, and lapsing of private caveats, registrar\'s caveats, and lien-holder\'s caveats under NLC Sections 322-329.' },
      { name: 'Developer Claim Advisor', icon: HardHat, desc: 'Advise on LAD (Liquidated Ascertained Damages) claims, defect liability claims, and purchaser rights under the Housing Development Act 1966.' },
      { name: 'Bankruptcy Search Advisor', icon: UserX, desc: 'Interpret bankruptcy search results from the Insolvency Department and winding-up searches. Advise on implications for property transactions.' },
      { name: 'Foreign Purchase Advisor', icon: Globe, desc: 'Advise on EPU approval, state authority consent, minimum price thresholds, and legal requirements for foreign nationals purchasing Malaysian property.' },
      { name: 'Strata Management Advisor', icon: Building2, desc: 'Advise on strata title, MC/JMB obligations, maintenance charges, sinking funds, and legal issues under the Strata Management Act 2013.' },
    ],
  },
  {
    group: 'Assessment',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    groupDesc: 'Sharpen your expertise with AI-generated assessments, exam-style scenarios, and deep case analysis.',
    tools: [
      { name: 'Quiz Generator', icon: Brain, desc: 'Generate multiple-choice quizzes on any conveyancing topic — NLC provisions, HDA, stamp duty, registration procedures, and more. Choose difficulty and number of questions.' },
      { name: 'Mock Exam Generator', icon: GraduationCap, desc: 'Generate full examination-style papers with essay questions, problem-based scenarios, and model answers covering Malaysian conveyancing law practice.' },
      { name: 'Case Law Analyzer', icon: Microscope, desc: 'Submit any case name or citation for deep-dive analysis — material facts, legal issues, court reasoning, ratio decidendi, and practical implications.' },
    ],
  },
  {
    group: 'Automation',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    groupDesc: 'Workflow automation tools to streamline document management and transaction planning.',
    tools: [
      { name: 'Transaction Simulator', icon: PlayCircle, desc: 'Walk through a full conveyancing transaction step by step — from engagement to completion. Simulates timelines, obligations, and milestones for any transaction type.' },
      { name: 'Clause Library', icon: Library, desc: 'Search and browse a library of standard clauses for SPAs, loan agreements, tenancies, and special conditions. Get template clauses ready for use.' },
      { name: 'Document Analyzer', icon: FileText, desc: 'Upload or paste any legal document for AI analysis. Identifies document type, key provisions, parties, obligations, risks, and summary of terms.' },
      { name: 'Compliance Checker', icon: CheckSquare, desc: 'Run a full compliance audit on any transaction — covering AML/CFT requirements, regulatory obligations, professional conduct rules, and documentation checklists.' },
      { name: 'Timeline Generator', icon: Timer, desc: 'Generate a detailed timeline with milestones and deadlines for any conveyancing transaction type, including statutory timeframes and practical scheduling.' },
    ],
  },
];

const contentHighlights = [
  { icon: BookOpen, value: '21', label: 'Theory Topics', color: 'text-blue-400' },
  { icon: GraduationCap, value: '62', label: 'Workflows', color: 'text-emerald-400' },
  { icon: FileText, value: '16', label: 'Form Templates', color: 'text-violet-400' },
  { icon: Search, value: '100', label: 'Landmark Cases', color: 'text-amber-400' },
  { icon: Calculator, value: '193', label: 'Legal Terms', color: 'text-cyan-400' },
  { icon: Bot, value: '39', label: 'AI Tools', color: 'text-pink-400' },
];

const sectionFade = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

function ToolGroupCard({ group: g, index: gi }: { group: ToolGroupDetail; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: gi * 0.05, ease: [0.16, 1, 0.3, 1] as const } },
      }}
      className={`rounded-2xl border ${g.border} ${g.bg} backdrop-blur-sm overflow-visible`}
      data-testid={`toolgroup-${g.group.toLowerCase().replace(/\s/g, '-')}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
        data-testid={`button-toggle-${g.group.toLowerCase().replace(/\s/g, '-')}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${g.bg} border ${g.border} text-xs font-bold ${g.color} uppercase tracking-wider flex-shrink-0`}>
            {g.group}
          </div>
          <span className="text-sm text-slate-400 truncate hidden sm:inline">{g.groupDesc}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-slate-500 font-mono">{g.tools.length} tools</span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <motion.div
        initial={false}
        animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }}
        className="overflow-hidden"
      >
        <div className="px-5 pb-5">
          <p className="text-sm text-slate-400 mb-4 sm:hidden">{g.groupDesc}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {g.tools.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <div key={tool.name} className="flex gap-3 p-3 rounded-xl bg-background/60 border border-border/50" data-testid={`tool-detail-${tool.name.toLowerCase().replace(/[\s\/]/g, '-')}`}>
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${g.bg} border ${g.border} flex items-center justify-center mt-0.5`}>
                    <ToolIcon className={`w-4.5 h-4.5 ${g.color}`} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-200 mb-0.5">{tool.name}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Home() {
  const [, setLocation] = useLocation();
  const guideRef = useRef<HTMLDivElement>(null);

  const scrollToGuide = () => {
    guideRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">

      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <section className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-amber-500/5 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-blue-600/5 blur-[140px] pointer-events-none" />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-amber-400/3 blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          className="relative z-10 max-w-3xl w-full text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.12)] mb-10"
          >
            <Scale className="w-12 h-12 text-amber-400" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-slate-50 leading-tight tracking-tight mb-8"
            data-testid="text-homepage-title"
          >
            Malaysian Conveyancing<br />Legal Practice
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="w-16 h-px bg-amber-500/50 mx-auto mb-8"
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
            className="space-y-2 mb-12"
          >
            <p className="text-base md:text-lg text-slate-400 font-medium tracking-wide" data-testid="text-homepage-created-by">
              Created by
            </p>
            <p className="text-xl md:text-2xl text-slate-200 font-semibold" data-testid="text-homepage-author-name">
              Prof Madya Dr Shahrul Mizan Ismail
            </p>
            <p className="text-lg md:text-xl text-slate-300 font-medium" data-testid="text-homepage-author-faculty">
              Fakulti Undang-Undang
            </p>
            <p className="text-lg md:text-xl text-slate-300 font-medium" data-testid="text-homepage-author-institution">
              Universiti Kebangsaan Malaysia
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: [0.16, 1, 0.3, 1] as const }}
            className="flex flex-wrap justify-center gap-3 mb-14"
          >
            {pillars.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/60 text-slate-400 text-sm font-medium"
              >
                <Icon className="w-4 h-4 text-amber-500/80" />
                <span>{label}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: [0.16, 1, 0.3, 1] as const }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              data-testid="button-get-started"
              onClick={() => setLocation('/signup')}
              className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-slate-900 font-bold text-lg shadow-[0_0_30px_rgba(245,158,11,0.25)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              data-testid="button-enter-workspace"
              onClick={() => setLocation('/login')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-border bg-card/50 hover:bg-card text-slate-300 hover:text-slate-100 font-semibold text-sm transition-all"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </button>
            <button
              data-testid="button-view-pricing"
              onClick={() => setLocation('/pricing')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-border bg-card/50 hover:bg-card text-slate-300 hover:text-slate-100 font-semibold text-sm transition-all"
            >
              View Plans
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="mt-12 text-slate-600 text-xs font-mono tracking-widest uppercase"
          >
            AI-Powered Legal Practice Platform
          </motion.p>
        </motion.div>
      </section>

      {/* ═══════════════════ HOW TO USE SECTION ═══════════════════ */}
      <section ref={guideRef} className="relative py-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto">

          {/* Section heading */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={sectionFade}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              Getting Started Guide
            </div>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-slate-50 mb-4" data-testid="text-how-to-use-title">
              How To Use MyConveyLitAI
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Access requires a valid account. Follow these steps to get started with the platform.
            </p>
          </motion.div>

          {/* Access requirement banner */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={sectionFade}
            className="mb-16 p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm"
            data-testid="banner-password-access"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mt-0.5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-amber-300 mb-1">Password-Protected Access</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  All content on MyConveyLitAI is protected by password access. User accounts are created and managed through the Admin Dashboard.
                  Please contact your account manager to obtain your login credentials (username and password).
                  Without valid credentials, you will not be able to access the reference materials or AI tools.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const } },
                }}
                className={`relative p-6 rounded-2xl border ${step.border} ${step.bg} backdrop-blur-sm`}
                data-testid={`card-step-${step.num}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center`}>
                    <step.icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-mono font-bold ${step.color} opacity-60`}>STEP {step.num}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-100 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Content highlights */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={sectionFade}
            className="text-center mb-10"
          >
            <h3 className="text-2xl md:text-3xl font-serif font-bold text-slate-50 mb-3" data-testid="text-whats-inside">What's Inside</h3>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              A comprehensive library of Malaysian conveyancing resources at your fingertips.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={sectionFade}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-24"
          >
            {contentHighlights.map((item) => (
              <div key={item.label} className="flex flex-col items-center p-4 rounded-2xl border border-border bg-card/40" data-testid={`stat-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                <item.icon className={`w-6 h-6 ${item.color} mb-2`} />
                <span className="text-2xl font-bold text-slate-100">{item.value}</span>
                <span className="text-xs text-slate-500 font-medium mt-1">{item.label}</span>
              </div>
            ))}
          </motion.div>

          {/* AI Tools detailed overview */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={sectionFade}
            className="text-center mb-12"
          >
            <h3 className="text-2xl md:text-3xl font-serif font-bold text-slate-50 mb-3" data-testid="text-ai-tools-overview">35 AI-Powered Tools</h3>
            <p className="text-slate-400 text-base max-w-2xl mx-auto">
              Organized into 8 specialized groups, every tool is purpose-built for Malaysian conveyancing practice. Click any group below to see the full details.
            </p>
          </motion.div>

          <div className="space-y-5 mb-24">
            {toolGroups.map((g, gi) => (
              <ToolGroupCard key={g.group} group={g} index={gi} />
            ))}
          </div>

          {/* Final CTA */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={sectionFade}
            className="text-center"
          >
            <div className="p-8 rounded-2xl border border-border bg-card/30 backdrop-blur-sm">
              <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-100 mb-3">Ready to Begin?</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                Sign in with your credentials to access all features.
              </p>
              <button
                data-testid="button-enter-workspace-bottom"
                onClick={() => setLocation('/login')}
                className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-slate-900 font-bold text-base shadow-[0_0_30px_rgba(245,158,11,0.25)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Enter Workspace
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-10 text-slate-600 text-xs font-mono tracking-widest uppercase mb-8">
              MyConveyLitAI — AI-Powered Legal Practice Platform
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
