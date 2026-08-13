import { Link } from "wouter";
import {
  BookOpen, Scale, FileText, Workflow, Files, BookA, Landmark, Search,
  Brain, FileEdit, FileSearch, MessageSquareWarning, Users, Gavel,
  ArrowRight, Sparkles, Shield, Target, TrendingUp, FileCheck, Lightbulb,
  ChevronRight, HelpCircle, GraduationCap, Zap, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function HowToUsePage() {
  return (
    <div className="space-y-10 pb-12">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">Guide</Badge>
        </div>
        <h1 className="font-serif text-4xl font-bold tracking-tight flex items-center gap-3">
          <HelpCircle className="h-9 w-9 text-primary" />
          How To Use MycrimAi
        </h1>
        <p className="text-muted-foreground text-lg max-w-3xl">
          Your comprehensive guide to getting the most out of MycrimAi. This system is built specifically for Malaysian criminal law practitioners — from pupil-in-chambers preparing their first bail application to senior counsel handling complex High Court and appellate matters.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-card col-span-full">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Quick Start — 3 Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
                <h3 className="font-semibold">Browse the Library</h3>
                <p className="text-sm text-muted-foreground">Start with the <strong>Theory Topics</strong> for core criminal law principles, then explore <strong>Case Laws</strong> for key precedents, and check the <strong>Glossary</strong> for Malay-English legal terminology. The entire library is searchable — use <strong>Global Search</strong> to find anything instantly.</p>
              </div>
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
                <h3 className="font-semibold">Use AI Tools</h3>
                <p className="text-sm text-muted-foreground">Open any <strong>AI Tool</strong> from the sidebar. Ask legal questions in natural language using <strong>AI Legal Research</strong>, analyze case facts with the <strong>Case Analyzer</strong>, draft court documents with the <strong>Document Drafter</strong>, or build full strategies with the <strong>Case Strategy Planner</strong>.</p>
              </div>
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
                <h3 className="font-semibold">Practice & Sharpen</h3>
                <p className="text-sm text-muted-foreground">Use the <strong>Witness Practice Simulator</strong> to rehearse examining 11 different witness character types, and the <strong>Judge Practice Simulator</strong> to sharpen your advocacy before 9 judge personalities — from strict formal judges to appellate panels.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Reference Library
        </h2>
        <p className="text-muted-foreground">Your digital criminal law library — searchable, structured, and always at your fingertips. Each section is designed for rapid retrieval during research, trial preparation, and courtroom advocacy.</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Theory Topics", desc: "Core criminal law principles organized by subject — elements of offences under the Penal Code, general exceptions and defences (Chapter IV), sentencing principles, procedural law under the CPC, constitutional protections, and evidentiary rules. Each topic includes detailed explanations with statutory references and practical annotations for courtroom application.", href: "/workspace/topics", icon: BookOpen },
            { name: "Case Laws", desc: "Key Malaysian criminal case precedents with full citations, court levels (Federal Court, Court of Appeal, High Court), year decided, and carefully extracted key principles (ratio decidendi). Organized for rapid retrieval — use them in written submissions, oral arguments, and legal opinions to strengthen your case with authoritative judicial pronouncements.", href: "/workspace/case-laws", icon: Scale },
            { name: "Cause Papers", desc: "Templates and precedents for court documents used in daily criminal practice — charge sheets, notices of motion, affidavits in support, written submissions, bail applications, appeals, and revision applications. Each template follows proper Malaysian court formatting conventions. Copy, adapt, and file for your specific cases.", href: "/workspace/cause-papers", icon: FileText },
            { name: "Practice Workflows", desc: "Step-by-step procedural guides for common criminal applications — bail at Magistrate and High Court level, appeals to High Court and Court of Appeal, revision, criminal motions, mitigation hearings, and interlocutory applications. Each workflow breaks down the process into sequential steps with statutory references and time limits, ensuring no procedural requirement is missed.", href: "/workspace/workflows", icon: Workflow },
            { name: "Sample Documents", desc: "Ready-to-use template documents for various criminal proceedings — from letters of representation to the Attorney General's Chambers, to grounds of judgment requests, witness statements, and undertakings. Professionally drafted and formatted for Malaysian courts. Adapt the content and facts to your specific case.", href: "/workspace/sample-documents", icon: Files },
            { name: "Glossary", desc: "Comprehensive legal terminology with precise definitions and Bahasa Melayu translations. Essential for bilingual practice in Malaysian courts where proceedings may switch between English and Malay. Covers criminal law terms, procedural terminology, evidentiary concepts, and commonly used Latin maxims with their application in Malaysian jurisprudence.", href: "/workspace/glossary", icon: BookA },
            { name: "Costs & Fees", desc: "Complete fee schedules including court filing fees, professional costs scales, hearing fees, and miscellaneous charges with their legal basis under the relevant rules of court and practice directions. Know exactly what to charge your client and what court fees to expect at each stage of criminal proceedings.", href: "/workspace/costs-fees", icon: Landmark },
            { name: "Global Search", desc: "Search across ALL content types simultaneously — theory topics, case laws, cause papers, sample documents, glossary terms, and costs & fees. Type any keyword, section number, case name, or legal concept and find relevant entries across the entire library in seconds. Invaluable when you need to locate information quickly during preparation or in court.", href: "/workspace/search", icon: Search },
          ].map((item) => (
            <Link key={item.name} href={item.href}>
              <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer border-border/50">
                <CardHeader className="pb-2">
                  <item.icon className="h-5 w-5 text-primary mb-1" />
                  <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI-Powered Tools
        </h2>
        <p className="text-muted-foreground">11 intelligent assistants that help you research, analyze, draft, and strategize — powered by advanced AI with deep knowledge of Malaysian criminal law, procedure, evidence, and sentencing practice.</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-sm text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" /> Research & Analysis
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { name: "AI Legal Research", desc: "Ask any criminal law question in natural language and receive detailed answers with specific statute citations (Penal Code, CPC, Evidence Act, Dangerous Drugs Act), relevant case references from Malaysian courts, and practical guidance for practitioners. Supports multi-turn conversation — ask follow-up questions, request clarification, or explore related issues in a continuous research dialogue.", href: "/workspace/ai/research", icon: Brain },
                { name: "Case Fact Analyzer", desc: "Paste your case facts and receive a comprehensive structured analysis: all applicable charges with section references, the essential elements the prosecution must prove for each charge, potential defences available to the accused under the Penal Code's general exceptions and specific statutory defences, the sentencing range for each charge, relevant precedents from Malaysian courts, bail considerations under the CPC, and strategic recommendations for the defence counsel.", href: "/workspace/ai/case-analyzer", icon: Scale },
                { name: "Charge Sheet Analyzer", desc: "Paste any charge sheet — whether in English or Bahasa Malaysia — for a complete breakdown: identification of the exact statutory provision, every essential element the prosecution must prove beyond reasonable doubt with case authorities establishing each element, all viable defences (general exceptions, specific statutory defences, constitutional challenges, procedural defences), sentencing guidelines with mandatory/discretionary ranges and precedents, bail analysis with recommended conditions, and both prosecution and defence strategy recommendations.", href: "/workspace/ai/charge-analyzer", icon: FileSearch },
                { name: "Sentencing Predictor", desc: "Input the offence details, accused's profile, and case circumstances to receive a comprehensive sentencing prediction: the statutory sentencing range (mandatory/discretionary), the predicted likely sentence based on current judicial trends, 3-4 comparable case precedents with citations and how their facts compare, aggravating and mitigating factor analysis with weight assessment, sentencing trend observations, guilty plea discount analysis, and strategic recommendations for sentencing submissions.", href: "/workspace/ai/sentencing", icon: Target },
              ].map((item) => (
                <Link key={item.name} href={item.href}>
                  <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer border-border/50">
                    <CardHeader className="pb-2">
                      <item.icon className="h-5 w-5 text-primary mb-1" />
                      <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileEdit className="h-4 w-4" /> Drafting & Strategy
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { name: "Document Drafter", desc: "Generate professional legal documents following Malaysian court formatting standards: bail applications (Permohonan Jaminan), written submissions (Hujahan Bertulis), mitigation pleas (Rayuan Mitigasi), notices of appeal (Notis Rayuan), representation letters to the Attorney General (Surat Representasi), criminal motions (Usul Jenayah), stay of execution applications, and revision applications. Each document is formatted with proper case numbering, numbered paragraphs, statutory references, prayer/relief section, and signature blocks ready for filing.", href: "/workspace/ai/document-drafter", icon: FileEdit },
                { name: "Legal Opinion Writer", desc: "Generate formal, professionally structured legal opinions with all required sections: heading with 'PRIVATE & CONFIDENTIAL' marking, introduction, organized statement of facts, clearly identified legal issues, applicable law with exact statutory provisions and key authorities, detailed analysis applying law to facts with consideration of counterarguments, risk assessment with overall case strength rating, actionable advice and recommendations with alternative strategies, and a concluding summary. Supports 7 opinion types: client advisory, case evaluation, defence strategy, appeal prospects, bail opinion, plea bargain advisory, and general legal opinion.", href: "/workspace/ai/legal-opinion", icon: FileCheck },
                { name: "Case Strategy Planner", desc: "Build a comprehensive defence or prosecution strategy covering 8 critical dimensions: overall case assessment with strength rating and justification, legal framework with applicable charges/defences and burden of proof analysis, evidence strategy with admissibility issues and gap analysis, witness strategy with examination sequence and cross-examination planning, primary and alternative legal arguments with supporting authorities and anticipated rebuttals, day-by-day trial timeline, risk matrix with contingency plans for adverse rulings, and sentencing strategy with mitigation preparation. Choose between defence counsel or prosecution (DPP) perspective.", href: "/workspace/ai/case-strategy", icon: TrendingUp },
                { name: "Appeal Grounds Analyzer", desc: "Paste a trial court judgment or grounds of decision and receive a comprehensive identification of every potential appeal ground: errors of law (misapplication of statutory provisions, wrong legal tests), misdirections on fact (unsupported findings, failure to consider material evidence, perverse findings), procedural irregularities (breach of evidence rules, non-compliance with mandatory procedures, breach of natural justice), sentencing errors (manifestly excessive/inadequate sentence, wrong sentencing principles), and constitutional issues. Each ground is rated by prospects of success (Strong/Moderate/Weak) with supporting Malaysian appellate authorities and a suggested draft petition of appeal structure.", href: "/workspace/ai/appeal-grounds", icon: Lightbulb },
              ].map((item) => (
                <Link key={item.name} href={item.href}>
                  <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer border-border/50">
                    <CardHeader className="pb-2">
                      <item.icon className="h-5 w-5 text-primary mb-1" />
                      <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" /> Practice Simulators
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Cross-Examination Helper", desc: "Paste a witness statement and receive strategic cross-examination questions organized by purpose: credibility attacks, inconsistency exploitation, material fact challenges, prior statement impeachment foundations under Section 145 of the Evidence Act 1950, and expert/technical questions. Each question includes its strategic purpose and references to the Evidence Act provisions governing cross-examination technique.", href: "/workspace/ai/cross-examination", icon: MessageSquareWarning },
                { name: "Witness Practice", desc: "Practice examining 11 different witness personality types — cooperative, hostile, evasive, nervous, expert, child (ages 10-12), elderly, reluctant, lying (coached), police officer/IO, and complainant/victim — across 4 examination modes: examination-in-chief (open-ended questions), cross-examination (leading questions), re-examination (limited scope), and hostile witness examination (prior inconsistent statements under s.145 Evidence Act). The AI witness reacts realistically to your technique — good technique is rewarded, poor technique is exposed.", href: "/workspace/ai/witness-practice", icon: Users },
                { name: "Judge Practice", desc: "Practice advocacy before 9 simulated judge personalities — strict & formal, impatient, inquisitive & academic, sympathetic, pro-prosecution leaning, pro-defence leaning, appellate panel (3 judges with different perspectives), newly appointed, and senior High Court judge — across 7 courtroom scenarios: bail application, trial submission, sentencing & mitigation, interlocutory application, appeal argument, evidential objections, and general practice. The AI judge challenges your arguments, tests your legal knowledge, and provides constructive feedback on your advocacy performance.", href: "/workspace/ai/judge-practice", icon: Gavel },
              ].map((item) => (
                <Link key={item.name} href={item.href}>
                  <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer border-border/50">
                    <CardHeader className="pb-2">
                      <item.icon className="h-5 w-5 text-primary mb-1" />
                      <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-card/50">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Tips for Senior Practitioners
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> For Complex Cases
              </h4>
              <p>Start with the <strong>Case Strategy Planner</strong> to map out your entire approach — evidence assessment, witness management, legal arguments, and trial timeline — before diving into preparation. Combine it with the <strong>Case Fact Analyzer</strong> to identify all potential charges and defences from the prosecution brief, and use the <strong>Sentencing Predictor</strong> to advise your client on realistic sentencing expectations early in the retainer.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" /> For Appeals
              </h4>
              <p>Feed the trial court's grounds of judgment into the <strong>Appeal Grounds Analyzer</strong> to identify every potential ground — errors of law, misdirections on fact, procedural irregularities, and sentencing errors — then use <strong>AI Legal Research</strong> to find additional supporting authorities for each ground. The tool rates each ground's prospects and suggests a petition structure, saving hours of initial appellate research.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> For Trial Preparation
              </h4>
              <p>Use the <strong>Cross-Examination Helper</strong> to prepare targeted questions from each prosecution witness's statement — organized by credibility attacks, inconsistency exploitation, and impeachment foundations under s.145 Evidence Act. Then rehearse with the <strong>Witness Simulator</strong> using the witness personality that matches your actual witness. Finish by practising your submissions before the <strong>Judge Simulator</strong> set to the temperament of the presiding judge.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> For Client Advisory
              </h4>
              <p>Use the <strong>Legal Opinion Writer</strong> to draft structured client advisory opinions — with proper legal analysis, risk assessment, and actionable recommendations — then use the <strong>Sentencing Predictor</strong> to give clients realistic sentencing expectations backed by comparable precedents. The <strong>Charge Sheet Analyzer</strong> helps you explain the charges and their implications to clients in a clear, comprehensive manner.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-4">
        <Button size="lg" className="font-medium" asChild>
          <Link href="/workspace">
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
