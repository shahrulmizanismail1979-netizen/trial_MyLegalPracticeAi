import { Link, useLocation } from "wouter";
import {
  Scale, ChevronRight, BrainCircuit, FileSearch, Shield,
  ScrollText, Building2, Users, Landmark, Receipt, TrendingUp,
  Globe, Swords, FileCheck, Handshake, Building, Briefcase,
  Sparkles, BookOpen, Gavel, PenTool, AlertTriangle,
  Drama, UserRoundSearch, Mic, GraduationCap, Presentation
} from "lucide-react";
import { useEffect } from "react";

const FEATURES = [
  { icon: ScrollText, title: "Legal Opinion Writer", desc: "Generate structured legal opinions with proper formatting, analysis, CA 2016 section references, and professional conclusions" },
  { icon: Building2, title: "Transaction Structuring", desc: "Compare share sale vs asset sale vs scheme of arrangement with full tax, regulatory, and commercial analysis" },
  { icon: FileSearch, title: "DD Report Generator", desc: "Structured legal due diligence reports with Red/Amber/Green risk ratings and recommended conditions precedent" },
  { icon: Shield, title: "S.17A MACC Compliance", desc: "Build tailored T.R.U.S.T. adequate procedures frameworks with risk matrices and implementation timelines" },
  { icon: Users, title: "SHA Clause Builder", desc: "Drag-along, tag-along, deadlock, pre-emption, reserved matters, and exit mechanisms with precedent drafting" },
  { icon: Landmark, title: "SSM Filing Navigator", desc: "Exact forms, deadlines, fees, penalties, and step-by-step filing guides for every corporate action" },
  { icon: Receipt, title: "Stamp Duty Calculator", desc: "Exact duty calculations on share transfers, loans, property, and all instruments under Stamp Act 1949" },
  { icon: BrainCircuit, title: "AI Case Finder", desc: "Find relevant Malaysian case law with citations, ratio decidendi, and practical significance analysis" },
  { icon: TrendingUp, title: "IPO Readiness Assessment", desc: "Gap analysis for Bursa Malaysia Main or ACE Market listing covering governance, financials, and compliance" },
  { icon: Globe, title: "Cross-Border Advisor", desc: "Navigate MITI, EPU, BNM, and sector-specific approvals for cross-border M&A and foreign investments" },
  { icon: Swords, title: "Dispute Resolution", desc: "Litigation strategy, AIAC arbitration, mediation, interim relief, and Fortuna injunction advisory" },
  { icon: FileCheck, title: "Contract Review & Markup", desc: "AI-powered clause-by-clause review of commercial contracts with risk analysis and suggested amendments" },
  { icon: Briefcase, title: "Employment Law Advisor", desc: "Retrenchment, s.20A transfer of undertaking, constructive dismissal, and Industrial Court proceedings" },
  { icon: Building, title: "Islamic Finance Advisor", desc: "Shariah-compliant structures, sukuk issuance, murabahah facilities, and BNM/SC regulatory requirements" },
  { icon: Handshake, title: "Negotiation Strategy", desc: "BATNA analysis, negotiation points by issue, package trades, and draft term sheets for any deal type" },
  { icon: Gavel, title: "Resolution Generator", desc: "Board resolutions, members' resolutions (ordinary and special), DRIWs, and circular resolutions with proper format" },
  { icon: Drama, title: "Negotiation Simulator", desc: "Practise negotiating against 8 opposing counsel personality types — from Bulldozers to Smooth Talkers" },
  { icon: UserRoundSearch, title: "Mediation Simulator", desc: "Handle multi-party mediations with clashing personalities and hidden interests in realistic scenarios" },
  { icon: Mic, title: "Arbitration Simulator", desc: "Present cases before arbitrators with 6 different temperaments — Sticklers, Sceptics, and Scholars" },
  { icon: GraduationCap, title: "Client Trainer", desc: "Master client management with 10 personality types — anxious entrepreneurs to demanding tycoons" },
  { icon: Presentation, title: "Board Presentation Sim", desc: "Present to boards with hostile, disengaged, or divided directors and practise handling tough questions" },
];

const STATS = [
  { value: "25+", label: "AI Practice Tools" },
  { value: "6", label: "Reference Libraries" },
  { value: "50+", label: "Legal Topics" },
  { value: "15+", label: "Case Summaries" },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      setLocation("/dashboard");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-25">
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full bg-purple-600/20 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-primary/15 blur-[150px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] rounded-full bg-purple-800/15 blur-[120px]" />
      </div>

      <header className="py-6 px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Scale className="w-8 h-8 text-primary" />
          <span className="font-serif font-bold text-xl text-primary tracking-tight">MYCorpLegalAI</span>
        </div>
        <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors px-4 py-2 rounded-md border border-border hover:border-primary/30">
          Practitioner Login
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 z-10">
        <div className="text-center mt-16 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            25+ AI-Powered Practice Tools · Gemini 2.5 Flash · Real-Time Streaming
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold max-w-4xl leading-tight mb-6 text-foreground drop-shadow-sm mx-auto">
            Malaysian Corporate
            <span className="block bg-gradient-to-r from-primary via-amber-400 to-purple-400 bg-clip-text text-transparent">
              Legal Practice Suite
            </span>
          </h1>

          <div className="mb-8 space-y-1">
            <p className="text-lg md:text-xl font-serif font-semibold text-primary">Prof Madya Dr Shahrul Mizan Ismail</p>
            <p className="text-base text-muted-foreground">Fakulti Undang-Undang</p>
            <p className="text-base text-muted-foreground">Universiti Kebangsaan Malaysia</p>
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 mx-auto leading-relaxed">
            Built for senior practitioners, law students, and corporate advisors.
            Draft opinions, structure transactions, review contracts, navigate SSM filings,
            assess IPO readiness, simulate negotiations, and resolve disputes — all powered by AI trained on Malaysian corporate law.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-md font-semibold text-lg hover:bg-accent transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(212,168,83,0.5)]"
            >
              Enter Suite
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <div className="text-sm text-muted-foreground">
              Authorized practitioners only
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto mb-12">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-serif font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-6xl w-full mb-16">
          <h2 className="text-center text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-2">
            Purpose-Built for Malaysian Practitioners
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-8 max-w-xl mx-auto">
            Every tool uses structured inputs tailored to real-world workflows — not generic chatbots
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="bg-card/60 border border-border/50 rounded-lg p-4 text-center hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3 group-hover:border-primary/30 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl w-full mb-16 bg-card/40 border border-purple-500/20 rounded-2xl p-8 md:p-12 text-center">
          <BookOpen className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-foreground mb-3">Comprehensive Reference Library</h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-6">
            6 in-depth sections covering substantive corporate law (20 topics with legislation references and practice notes),
            step-by-step corporate workflows (10 procedures), forms and drafting templates (29 precedents),
            leading cases (16 landmark decisions with full analysis), compliance calendars with deadlines and penalties,
            and an extensive legal terminology glossary (65+ terms) — all with contextual "Ask AI" buttons.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {["Companies Act 2016", "CMSA 2007", "MACC Act 2009", "AMLA 2001", "Stamp Act 1949", "Employment Act 1955", "Competition Act 2010", "PDPA 2010", "Arbitration Act 2005", "IFSA 2013"].map((law) => (
              <span key={law} className="text-xs px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/80 font-medium">
                {law}
              </span>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground z-10 border-t border-purple-500/10">
        <p>&copy; {new Date().getFullYear()} MYCorpLegalAI. For academic and professional reference. AI responses do not constitute formal legal advice.</p>
      </footer>
    </div>
  );
}
