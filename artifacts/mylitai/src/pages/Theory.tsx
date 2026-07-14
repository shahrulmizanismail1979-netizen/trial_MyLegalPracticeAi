import { useState } from 'react';
import { useListTheoryTopics } from '@/hooks/use-theory';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Badge, Button, Modal } from '@/components/ui';
import { BookOpen, FileText, Scale, AlertTriangle, Volume2, VolumeX, MessageSquare, ChevronRight } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TheoryTopic = Record<string, any>;
import { speak, stop, isSupported, stripMarkdown } from '@/lib/tts';

// ─── TTS Button Component ───────────────────────────────────────────────────────
function TTSButton({ text, className = '' }: { text: string; className?: string }) {
  const [speaking, setSpeaking] = useState(false);
  if (!isSupported()) return null;

  const toggle = () => {
    if (speaking) {
      stop();
      setSpeaking(false);
    } else {
      speak(stripMarkdown(text), () => setSpeaking(false));
      setSpeaking(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        speaking
          ? 'bg-primary/10 text-primary border-primary/40 animate-pulse'
          : 'bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40'
      } ${className}`}
      title={speaking ? 'Stop audio' : 'Listen to this section'}
    >
      {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}

// ─── Visual Key Principles Display ─────────────────────────────────────────────
function KeyPrinciplesDisplay({ principles }: { principles: string[] }) {
  return (
    <div className="grid gap-3">
      {principles.map((principle, i) => (
        <div key={i} className="flex items-start gap-3 bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-colors">
          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {i + 1}
          </div>
          <p className="text-sm text-foreground leading-relaxed pt-0.5">{principle}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Concept Visual Layout (simplified process diagram) ─────────────────────────
function ConceptFlow({ content }: { content: string }) {
  // Extract numbered or bulleted sections for visual display
  const lines = content.split('\n').filter(l => l.trim());
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('**') && line.endsWith('**') && line.length < 80) {
      if (current) sections.push(current);
      current = { heading: line.replace(/\*\*/g, ''), body: [] };
    } else if (current) {
      if (line.trim()) current.body.push(line.trim());
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      {sections.slice(0, 6).map((section, i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="bg-primary/5 border-b border-border px-4 py-2 flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">{i + 1}</span>
            </div>
            <h5 className="text-sm font-semibold text-foreground">{section.heading}</h5>
            {i < sections.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />}
          </div>
          {section.body.length > 0 && (
            <div className="px-4 py-3">
              <ul className="space-y-1">
                {section.body.slice(0, 3).map((line, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary/50 mt-0.5">•</span>
                    <span>{line.replace(/^[-*•]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Theory Page ───────────────────────────────────────────────────────────
export default function Theory() {
  const { data: topics, isLoading } = useListTheoryTopics();
  const [selectedTopic, setSelectedTopic] = useState<TheoryTopic | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'visual' | 'full'>('overview');

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading Theory Modules...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Legal Provisions & Description"
        description="Core legal principles, statutory interpretation, and substantive law across all areas of Malaysian civil litigation."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topics?.map((topic: any) => (
          <Card key={topic.id} className="flex flex-col hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 transition-all">
            <CardHeader>
              <div className="flex items-start justify-between gap-4 mb-2">
                <Badge variant="secondary">{topic.category}</Badge>
                <BookOpen className="h-5 w-5 text-primary opacity-40" />
              </div>
              <CardTitle className="leading-snug text-lg">{topic.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground flex-1 mb-4 line-clamp-3">{topic.overview}</p>
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Scale className="h-3 w-3 text-primary" /> {topic.keyPrinciples.length} principles
                </span>
                <span>·</span>
                <span>{topic.legislation.length} statutes</span>
              </div>
              <Button onClick={() => { setSelectedTopic(topic); setActiveTab('overview'); }} className="w-full" variant="outline">
                Study Module
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!topics || topics.length === 0) && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <BookOpen className="h-12 w-12 mx-auto text-muted mb-4" />
            <p>No theory topics available at the moment.</p>
          </div>
        )}
      </div>

      <Modal isOpen={!!selectedTopic} onClose={() => setSelectedTopic(null)} title={selectedTopic?.title || ''}>
        {selectedTopic && (
          <div className="space-y-6 pb-4">
            {/* Header controls */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{selectedTopic.category}</Badge>
              <TTSButton text={selectedTopic.overview + '. Key principles: ' + selectedTopic.keyPrinciples.join('. ')} />
              <a
                href={`#ai-ask`}
                onClick={(e) => {
                  e.preventDefault();
                  // Pre-fill AI tutor via custom event
                  window.dispatchEvent(new CustomEvent('ai-prefill', { detail: { question: `Explain the concept of "${selectedTopic.title}" in simple terms with practical examples from Malaysian litigation practice.` } }));
                }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Ask AI Senior Counsel
              </a>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
              {(['overview', 'visual', 'full'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-sm py-1.5 px-3 rounded-md font-medium transition-colors capitalize ${
                    activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'overview' ? 'Overview' : tab === 'visual' ? '🗂 Visual Guide' : '📄 Full Content'}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                  <p className="text-base leading-relaxed text-foreground/90 font-medium">{selectedTopic.overview}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-lg font-semibold flex items-center gap-2">
                      <Scale className="h-5 w-5 text-primary" /> Key Principles
                    </h4>
                    <TTSButton text={selectedTopic.keyPrinciples.join('. ')} />
                  </div>
                  <KeyPrinciplesDisplay principles={selectedTopic.keyPrinciples} />
                </div>

                <div className="space-y-3">
                  <h4 className="font-serif text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Relevant Legislation
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTopic.legislation.map((leg: any, i: any) => (
                      <Badge key={i} variant="secondary" className="bg-secondary/60 font-mono text-xs py-1.5">{leg}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Visual Guide Tab */}
            {activeTab === 'visual' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Structured visual breakdown of the module content:</p>
                  <TTSButton text={selectedTopic.content.substring(0, 1500)} />
                </div>
                <ConceptFlow content={selectedTopic.content} />
                <div className="bg-secondary/30 border border-border rounded-xl p-4 mt-4">
                  <h4 className="text-sm font-semibold text-primary mb-3">Quick Reference — Key Principles</h4>
                  <div className="space-y-2">
                    {selectedTopic.keyPrinciples.map((p: any, i: any) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                        <span className="text-foreground">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Full Content Tab */}
            {activeTab === 'full' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Full module content:</p>
                  <TTSButton text={selectedTopic.content} />
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed bg-card border border-border rounded-xl p-5 max-h-[50vh] overflow-y-auto">
                  {selectedTopic.content.split('\n').map((line: any, i: any) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <h5 key={i} className="font-bold text-foreground mt-4 mb-2">{line.replace(/\*\*/g, '')}</h5>;
                    }
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                      return <li key={i} className="text-muted-foreground ml-4">{line.slice(2)}</li>;
                    }
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-muted-foreground mb-1">{line.replace(/\*\*(.*?)\*\*/g, '**$1**')}</p>;
                  })}
                </div>
              </div>
            )}

            {/* Key Authorities */}
            {selectedTopic.relatedCases && selectedTopic.relatedCases.length > 0 && (
              <div className="space-y-3 bg-secondary/20 p-4 rounded-xl border border-border">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-serif text-base font-semibold text-primary">Key Authorities</h4>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-950/40 text-amber-400 border border-amber-700/40 rounded px-1.5 py-0.5 shrink-0">
                    <AlertTriangle className="h-2.5 w-2.5" /> Verify independently
                  </span>
                </div>
                <ul className="space-y-2">
                  {selectedTopic.relatedCases.map((rc: any, i: any) => (
                    <li key={i} className="text-sm font-medium text-foreground border-l-2 border-primary/50 pl-3 hover:text-primary transition-colors cursor-pointer">
                      {rc}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  Verify all citations through WestlawAsia, CLJ, or MLJ before professional use.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
