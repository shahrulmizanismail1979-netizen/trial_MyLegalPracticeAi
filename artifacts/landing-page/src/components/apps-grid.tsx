import { useState } from "react";
import { ExternalLink, Sparkles, ChevronDown, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";
import { usePersona } from "@/lib/persona";

type AppVersion = {
  label: string;
  url: string;
  badge: string;
  description: string;
};

type App = {
  title: string;
  description: string;
  url: string;
  tag: string;
  comingSoon?: boolean;
  versions?: AppVersion[];
};

const apps: App[] = [
  {
    title: "MyLitAI",
    description: "Draft cause papers, analyse case strategies, and navigate Malaysian civil procedure with an AI litigation assistant.",
    url: "/mylitai/",
    tag: "Litigation",
    versions: [
      {
        label: "Standard",
        badge: "Version 1",
        url: "/mylitai/",
        description: "Classic AI litigation assistant. Ask any question, get instant guidance on civil procedure, pleadings, case strategy, and court practice — conversational and open-ended.",
      },
      {
        label: "IRAC Method",
        badge: "Version 2",
        url: "/mylitai-irac/",
        description: "Structured legal analysis using the IRAC framework (Issue → Rule → Application → Conclusion). Best for systematically breaking down legal problems, preparing written submissions, and structured advocacy.",
      },
    ],
  },
  {
    title: "MySyalitAI",
    description: "Draft syarie pleadings, check Syariah procedure rules, and prepare submissions for Syariah Court matters.",
    url: "/mysyariahai/",
    tag: "Syariah"
  },
  {
    title: "MyCorpAI",
    description: "Prepare board resolutions, manage Companies Act compliance, and handle corporate secretarial workflows.",
    url: "/mycorplegalai/",
    tag: "Corporate"
  },
  {
    title: "MyConveyLitAI",
    description: "Draft sale & purchase agreements, conduct land title searches, and manage property transaction checklists.",
    url: "/myconveylitai/",
    tag: "Conveyancing"
  },
  {
    title: "MyCrimAI",
    description: "Draft criminal submissions, research sentencing precedents, and navigate Rules of the Subordinate Courts.",
    url: "/mycrimai/",
    tag: "Criminal"
  },
  {
    title: "MyCorpCommBankLitAi",
    description: "Handle corporate disputes, draft commercial agreements, and manage banking litigation matters.",
    url: "/myccblitai/",
    tag: "Corp/Comm/Banking"
  },
  {
    title: "MyAccidentAi",
    description: "Draft personal injury claims, assess quantum of damages, and manage running-down cases.",
    url: "/myaccidentai/",
    tag: "Accident & PI"
  },
  {
    title: "MyLawFirmAi",
    description: "Run your firm's operations — AI-triaged tasks, meeting minutes, staff recognition, goals, and voice-driven workflows.",
    url: "/mylawfirmai/",
    tag: "Firm Management",
  },
  {
    title: "MyJudicialAi",
    description: "Schedule hearings, draft judgments, prepare bench notes, and manage chambers administration.",
    url: "#",
    tag: "Judiciary",
    comingSoon: true,
  },
  {
    title: "MyClientAi",
    description: "Handle client intake, manage case files, draft advisory notes, and track communication.",
    url: "#",
    tag: "Client Mgmt",
    comingSoon: true,
  },
  {
    title: "MyLawAcad",
    description: "AI-proctored exams and educator-built assessments — plan lessons, draft assessments, and manage academic administration.",
    url: "/mylawacad/",
    tag: "Lecturers",
  },
  {
    title: "MyLawResearch",
    description: "Draft articles, manage citations, conduct literature reviews, and prepare journal submissions.",
    url: "#",
    tag: "Publications",
    comingSoon: true,
  },
];

function VersionCard({ version }: { version: AppVersion }) {
  const { format } = useCurrency();

  return (
    <div className="w-full flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
          {version.badge}
        </span>
        <span className="text-xs font-semibold text-foreground">
          {format(25)}<span className="text-muted-foreground font-normal">/month</span>
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">{version.label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {version.description}
      </p>

      <div className="mt-2 flex">
        <a
          href={version.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold py-2 px-4 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export function AppsGrid() {
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const { persona } = usePersona();

  // Reorder apps based on persona
  const orderedApps = [...apps].sort((a, b) => {
    const getScore = (app: App) => {
      if (persona === "inhouse") {
        if (app.tag === "Corporate") return 100;
        if (app.tag === "Corp/Comm/Banking") return 90;
        if (app.tag === "Firm Management") return 10;
        if (app.tag === "Lecturers") return 5;
        if (app.tag === "Publications") return 5;
        return 50;
      }
      if (persona === "academic") {
        if (app.tag === "Lecturers") return 100;
        if (app.tag === "Publications") return 90;
        if (app.tag === "Litigation") return 80; // Good for teaching
        if (app.tag === "Firm Management") return 10;
        return 50;
      }
      // practitioner
      if (app.tag === "Litigation") return 100;
      if (app.tag === "Syariah") return 90;
      if (app.tag === "Conveyancing") return 80;
      if (app.tag === "Criminal") return 70;
      if (app.tag === "Firm Management") return 60;
      if (app.tag === "Lecturers") return 10;
      if (app.tag === "Publications") return 10;
      return 50;
    };
    return getScore(b) - getScore(a);
  });

  return (
    <section id="apps" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-12">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          The <span className="text-primary">AI Portals</span> Collection
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Specialized intelligence platforms tailored for the diverse needs of the Malaysian legal ecosystem. Click on any live preview to explore the application.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orderedApps.map((app, index) => {
          if (app.comingSoon) {
            return (
              <div key={app.title} className="block" style={{ animationDelay: `${index * 100}ms` }}>
                <Card className="h-full flex flex-col bg-card/50 border-border/50 backdrop-blur-sm transition-all duration-300 hover:border-amber-400/40 hover:bg-card">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-primary px-3 py-1 rounded-full border border-primary/20 bg-primary/10">
                        {app.tag}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-2 py-1 rounded-full border border-amber-400/30 bg-amber-400/10">
                        Coming Soon
                      </span>
                    </div>
                    <CardTitle className="font-serif text-2xl">
                      {app.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    <CardDescription className="text-base text-muted-foreground mb-5">
                      {app.description}
                    </CardDescription>
                    <div className="mt-auto">
                      <div className="flex items-start gap-2 rounded-lg bg-amber-400/5 border border-amber-400/20 p-3">
                        <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Coming soon. Access will be granted as soon as the app is ready —
                          we'll notify you the moment it launches.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          }

          if (app.versions) {
            const isExpanded = expandedApp === app.title;
            return (
              <div key={app.title} style={{ animationDelay: `${index * 100}ms` }}>
                <Card
                  className={`h-full flex flex-col bg-card/50 border-border/50 backdrop-blur-sm transition-all duration-300 cursor-pointer select-none ${
                    isExpanded
                      ? "border-primary/60 bg-card shadow-lg shadow-primary/10"
                      : "hover:border-primary/50 hover:bg-card hover:-translate-y-1"
                  }`}
                  onClick={() => setExpandedApp(isExpanded ? null : app.title)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-primary px-3 py-1 rounded-full border border-primary/20 bg-primary/10">
                        {app.tag}
                      </span>
                      {isExpanded ? (
                        <X className="h-5 w-5 text-primary transition-colors" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-colors" />
                      )}
                    </div>
                    <CardTitle className={`font-serif text-2xl transition-colors ${isExpanded ? "text-primary" : ""}`}>
                      {app.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    <CardDescription className="text-base text-muted-foreground mb-4">
                      {app.description}
                    </CardDescription>

                    {!isExpanded && (
                      <div className="mt-auto space-y-2">
                        <div className="flex items-center gap-2 text-xs text-primary font-medium">
                          <ChevronDown className="h-3.5 w-3.5" />
                          {app.versions.length} versions available — click to choose
                        </div>
                        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {app.versions.map((v) => (
                            <a
                              key={v.url}
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                            >
                              {v.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Choose your version
                        </p>
                        {app.versions.map((v) => (
                          <VersionCard key={v.url} version={v} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          }

          return (
            <a
              key={app.title}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Card className="h-full bg-card/50 border-border/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card hover:-translate-y-1 relative overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-medium uppercase tracking-wider text-primary px-3 py-1 rounded-full border border-primary/20 bg-primary/10">
                      {app.tag}
                    </span>
                    <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="font-serif text-2xl group-hover:text-primary transition-colors">
                    {app.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-muted-foreground">
                    {app.description}
                  </CardDescription>
                </CardContent>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary to-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-lg" />
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
