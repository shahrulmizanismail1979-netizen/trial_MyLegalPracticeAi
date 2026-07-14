import { useState } from 'react';
import { Link } from 'wouter';
import { Scale, BookOpen, Gavel, GitBranch, FileText, Calculator, BookA, FolderOpen, ChevronDown, ChevronUp, Bot, FileSearch, PenTool, Clock, MessageSquare, Volume2, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Landing() {
  const [showGuide, setShowGuide] = useState(false);
  const { t, lang } = useLanguage();

  const featureTags = [
    { icon: BookOpen, label: `42 ${t('badges.theoryTopics')}` },
    { icon: Gavel, label: `148 ${t('badges.caseLaws')}` },
    { icon: FileText, label: `65 ${t('badges.causePapers')}` },
    { icon: GitBranch, label: `32 ${t('badges.workflows')}` },
    { icon: FolderOpen, label: `53 ${t('badges.sampleDocuments')}` },
    { icon: Calculator, label: t('badges.costsFees') },
    { icon: BookA, label: `183 ${t('badges.glossaryTerms')}` },
  ];

  const guideModules = [
    {
      icon: BookOpen,
      title: 'Legal Provisions & Description',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/20',
      description: 'Comprehensive coverage of 27 legal theory topics across all areas of Malaysian civil litigation, including 5 deep-dive topics on chambers practice (Interlocutory Applications, Mareva, Anton Piller, Order 14 Summary Judgment, and Striking Out / Discovery). Each topic includes an Overview, Visual Guide, and Full Content with verified Malaysian legislation, case law citations, and Practical Notes for Practitioners.',
      tips: ['Click any topic card to open a detailed 3-tab modal', 'Use the "Ask AI Senior Counsel" shortcut within each topic for instant guidance', 'Listen to content with the built-in text-to-speech button'],
    },
    {
      icon: Gavel,
      title: 'Case Laws (Jurisprudence)',
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      borderColor: 'border-purple-400/20',
      description: '105 landmark Malaysian cases with ratios, critical analyses, and citations — categorised by litigation procedure topic. Covers Originating Process, Summary Judgment, Striking Out, Interlocutory & Injunctions, Discovery, Foreclosure, Execution, Winding Up, Bankruptcy, Appeals, Judicial Review, and Limitation.',
      tips: ['Filter by litigation topic using the color-coded tabs', 'View the distribution chart showing case coverage across all topics', 'Each case card shows its litigation category badge', 'All citations must be independently verified against primary sources (WestlawAsia, CLJ, MLJ)'],
    },
    {
      icon: FileText,
      title: 'Cause Papers & AI Drafter',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      borderColor: 'border-emerald-400/20',
      description: '65 official court forms and cause papers used in Malaysian litigation. Each form includes its description, relevant rules, and a link to the AI Drafter that generates properly-formatted drafts based on the facts you provide.',
      tips: ['Click "Draft with AI" on any form to generate a complete, formatted document', 'The AI Drafter streams the output in real-time so you can see the document being built', 'Download or copy the generated draft for further editing'],
    },
    {
      icon: GitBranch,
      title: 'Procedural Workflows',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/20',
      description: '18 step-by-step visual workflow guides for key litigation procedures including Order for Sale (Foreclosure), Summary Judgment, Winding Up Petition, Bankruptcy proceedings, and more. Each workflow shows the exact procedural sequence with timeframes, documents needed, and sample court templates.',
      tips: ['Click a workflow to see the full visual timeline of steps', 'Each step shows required documents, timeframes, and relevant rules', 'Access embedded sample court documents directly from each step'],
    },
    {
      icon: FolderOpen,
      title: 'AI Chambers & Sample Documents',
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/10',
      borderColor: 'border-orange-400/20',
      description: '47 professionally-formatted Malaysian court document templates including Letters of Demand, Writs of Summons, Statements of Claim, Affidavits, Bankruptcy Notices, Originating Summons, and more. Access the AI Brief Writer and Document Analyser for advanced legal document assistance.',
      tips: ['Browse templates by category or search for specific documents', 'Use the AI Brief Writer to generate legal briefs from case facts', 'Upload documents to the AI Document Analyser for intelligent review'],
    },
    {
      icon: Calculator,
      title: 'Costs & Fees',
      color: 'text-rose-400',
      bgColor: 'bg-rose-400/10',
      borderColor: 'border-rose-400/20',
      description: 'Interactive calculators for Malaysian legal costs, court fees, and stamp duties. Covers solicitor-client costs, party-party costs based on the Rules of Court 2012 scales, and filing fee schedules across different court levels.',
      tips: ['Select the type of proceeding and enter the claim amount', 'The calculator automatically applies the correct fee schedule', 'View breakdowns for different cost categories'],
    },
    {
      icon: BookA,
      title: 'Legal Concepts (Glossary)',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10',
      borderColor: 'border-cyan-400/20',
      description: '98 essential legal terms, definitions, Latin maxims, and judicial interpretations key to Malaysian litigation practice. Each term includes its source legislation, practical examples, and related concepts across all practice areas.',
      tips: ['Browse alphabetically using the letter filter', 'Search for any term using the search bar', 'Each definition includes real-world examples and cross-references'],
    },
    {
      icon: Bot,
      title: 'AI Senior Counsel',
      color: 'text-amber-300',
      bgColor: 'bg-amber-300/10',
      borderColor: 'border-amber-300/20',
      description: 'Your AI-powered legal research assistant, available on every page via the sidebar. Ask questions about any area of Malaysian litigation — from procedural steps to substantive law, case law analysis, and strategic advice. Powered by advanced AI with full markdown rendering.',
      tips: ['Click the AI Senior Counsel button in the sidebar to open the chat', 'Use suggested starter questions or type your own legal query', 'Responses include proper citations — always verify independently', 'Listen to AI responses using the text-to-speech button'],
    },
  ];

  return (
    <div className="min-h-screen bg-[#080c18] flex flex-col items-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-amber-600/8 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto pt-16 md:pt-24">
        <div className="h-20 w-20 bg-amber-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/40 mb-10">
          <Scale className="h-10 w-10 text-[#080c18]" strokeWidth={2.5} />
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-[1.1] tracking-tight mb-8">
          {lang === 'ms' ? (<>Amalan Guaman<br />Litigasi Malaysia</>) : (<>Malaysian Litigation<br />Legal Practice</>)}
        </h1>

        <div className="w-14 h-[2px] bg-amber-500/80 rounded-full mb-8" />

        <p className="text-sm text-gray-400 font-medium mb-1">{t('brand.createdBy')}</p>
        <p className="text-base md:text-lg font-bold text-white/90 mb-10">
          {t('brand.creator')}<br className="hidden sm:block" /> {t('brand.affiliation')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          {featureTags.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm text-sm text-gray-300 font-medium"
            >
              <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              {label}
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowGuide(!showGuide)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 hover:border-amber-500/50 transition-all duration-200 cursor-pointer select-none mb-10"
        >
          <BookOpen className="h-4 w-4" />
          {t('cta.howToUse')}
          {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showGuide && (
          <div className="w-full max-w-4xl mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="text-left bg-[#0d1424] border border-white/10 rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-serif font-bold text-white mb-2">Platform Guide</h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                MyLitAi is a comprehensive AI-powered educational platform covering <strong className="text-white/80">all areas of Malaysian civil litigation practice</strong>. 
                Enter your unique access code to unlock the full workspace. Here is what you will find inside:
              </p>

              <div className="space-y-4">
                {guideModules.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <div
                      key={mod.title}
                      className={`rounded-xl border ${mod.borderColor} ${mod.bgColor} p-5`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`h-10 w-10 rounded-lg ${mod.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`h-5 w-5 ${mod.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-serif font-bold text-base ${mod.color} mb-2`}>{mod.title}</h3>
                          <p className="text-gray-300 text-sm leading-relaxed mb-3">{mod.description}</p>
                          <div className="space-y-1.5">
                            {mod.tips.map((tip, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                                <span>{tip}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-amber-950/30 border border-amber-800/30">
                <div className="flex items-start gap-3">
                  <Volume2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 font-semibold text-sm mb-1">Built-in Audio Support</p>
                    <p className="text-amber-200/60 text-xs leading-relaxed">
                      Text-to-speech is available throughout the platform — listen to theory content, workflow steps, AI responses, and drafted documents. 
                      Look for the speaker icon on any content section.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-red-950/20 border border-red-800/30">
                <div className="flex items-start gap-3">
                  <Search className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 font-semibold text-sm mb-1">Important: Verify All References</p>
                    <p className="text-red-200/60 text-xs leading-relaxed">
                      This is an educational study tool. All case citations, statutory references, and procedural details must be independently verified 
                      against primary sources (WestlawAsia, CLJ, MLJ, official court records) before any professional or academic reliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <Link href="/login">
          <button className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-[#080c18] font-bold text-lg px-10 py-4 rounded-full transition-all duration-200 shadow-xl shadow-amber-500/25 hover:shadow-amber-400/35 hover:scale-[1.03] cursor-pointer select-none">
            {t('cta.enter')}
            <span className="text-xl leading-none">→</span>
          </button>
        </Link>

        <p className="mt-10 mb-16 text-[11px] tracking-[0.2em] text-gray-600 uppercase font-medium">
          {lang === 'ms' ? 'Platform Amalan Undang-Undang Berkuasa AI' : 'AI-Powered Legal Practice Platform'}
        </p>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
