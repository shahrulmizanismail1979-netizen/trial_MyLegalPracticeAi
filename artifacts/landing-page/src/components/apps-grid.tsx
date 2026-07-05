import { ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const apps = [
  {
    title: "MyLitAI",
    description: "Draft cause papers, analyse case strategies, and navigate Malaysian civil procedure with an AI litigation assistant.",
    url: "https://mylitai.life",
    tag: "Litigation"
  },
  {
    title: "MySyalitAI",
    description: "Draft syarie pleadings, check Syariah procedure rules, and prepare submissions for Syariah Court matters.",
    url: "https://mysyalitai.life",
    tag: "Syariah"
  },
  {
    title: "MyCorpAI",
    description: "Prepare board resolutions, manage Companies Act compliance, and handle corporate secretarial workflows.",
    url: "https://mycorpai.life",
    tag: "Corporate"
  },
  {
    title: "MyConveyAI",
    description: "Draft sale & purchase agreements, conduct land title searches, and manage property transaction checklists.",
    url: "https://myconveyai.life",
    tag: "Conveyancing"
  },
  {
    title: "MyCrimAI",
    description: "Draft criminal submissions, research sentencing precedents, and navigate Rules of the Subordinate Courts.",
    url: "https://mycrimai.life/",
    tag: "Criminal"
  },
  {
    title: "MyCorpCommBankLitAi",
    description: "Handle corporate disputes, draft commercial agreements, and manage banking litigation matters.",
    url: "https://myccblitai.life/",
    tag: "Corp/Comm/Banking"
  },
  {
    title: "MyAccidentAi",
    description: "Draft personal injury claims, assess quantum of damages, and manage running-down cases.",
    url: "https://myaccidentai.life/",
    tag: "Accident & PI"
  },
  {
    title: "MyLawFirmAi",
    description: "Manage firm HR, billing cycles, compliance deadlines, and operational workflows.",
    url: "#",
    tag: "Firm Management",
    comingSoon: true,
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
    description: "Plan lessons, draft assessments, manage student supervision, and handle academic administration.",
    url: "#",
    tag: "Lecturers",
    comingSoon: true,
  },
  {
    title: "MyLawResearch",
    description: "Draft articles, manage citations, conduct literature reviews, and prepare journal submissions.",
    url: "#",
    tag: "Publications",
    comingSoon: true,
  },
];

export function AppsGrid() {
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
        {apps.map((app, index) => {
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

          return (
            <a
              key={app.title}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Card className="h-full bg-card/50 border-border/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card hover:-translate-y-1">
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
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary to-yellow-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-lg" />
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
