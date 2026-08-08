import { Link } from 'wouter';
import { PageHeader, Card, CardContent, Badge } from '@/components/ui';
import { Scale, Landmark, Gavel, Building2, ArrowRight, ListChecks, GitBranch, FileText, Wand2 } from 'lucide-react';
import { PRACTICE_AREAS, type PracticeArea } from '@/data/practice-hub';

const ICONS = { scale: Scale, landmark: Landmark, gavel: Gavel, building: Building2 } as const;

function AreaSection({ area }: { area: PracticeArea }) {
  const Icon = ICONS[area.icon];
  return (
    <section>
      <div className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-serif font-bold text-xl text-foreground">{area.name}</h2>
          <p className="text-sm text-muted-foreground">{area.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {area.matters.map(matter => (
          <Link key={matter.id} href={`/app/practice/${matter.id}`}>
            <Card className="h-full cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <CardContent className="p-5 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground leading-snug">{matter.name}</h3>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-1" />
                </div>
                <p className="text-sm text-muted-foreground flex-1 line-clamp-2">{matter.summary}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <Badge variant="outline" className="gap-1"><GitBranch className="h-3 w-3" /> Workflow</Badge>
                  <Badge variant="outline" className="gap-1"><ListChecks className="h-3 w-3" /> Checklist</Badge>
                  <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Cause Papers</Badge>
                  <Badge variant="outline" className="gap-1"><Wand2 className="h-3 w-3" /> AI Drafting</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function PracticeHub() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Your Online LA"
        description="Work the way you run a file: pick the matter you are handling and get its complete workflow, checklist, cause papers and AI drafting — all on one page."
      />
      <div className="space-y-10">
        {PRACTICE_AREAS.map(area => <AreaSection key={area.id} area={area} />)}
      </div>
    </div>
  );
}
