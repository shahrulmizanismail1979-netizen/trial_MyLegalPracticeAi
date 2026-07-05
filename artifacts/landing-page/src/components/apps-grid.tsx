import { ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const apps = [
  {
    title: "MyLitAI",
    description: "AI-powered Litigation reference AI Portal for litigators",
    url: "https://mylitai.life",
    tag: "Litigation"
  },
  {
    title: "MySyalitAI",
    description: "AI-powered Syariah Litigation reference AI Portal for syarie lawyers",
    url: "https://mysyalitai.life",
    tag: "Syariah"
  },
  {
    title: "MyCorpAI",
    description: "AI-powered Corporate Secretary reference AI Portal for corporate secretaries",
    url: "https://mycorpai.life",
    tag: "Corporate"
  },
  {
    title: "MyConveyAI",
    description: "AI-powered Conveyancing reference AI Portal for conveyancers",
    url: "https://myconveyai.life",
    tag: "Conveyancing"
  },
  {
    title: "MyCrimAI",
    description: "AI-powered Criminal Law reference AI Portal for criminal law practitioners",
    url: "https://mycrimai.life/",
    tag: "Criminal"
  },
  {
    title: "MyCorpCommBankLitAi",
    description: "AI-powered Corporate, Commercial & Banking Litigation reference AI Portal for Malaysian legal practice",
    url: "https://myccblitai.life/",
    tag: "Corp/Comm/Banking"
  },
  {
    title: "MyAccidentAi",
    description: "AI-powered Accident, Personal Injury & Running Down Litigation reference AI Portal",
    url: "https://myaccidentai.life/",
    tag: "Accident & PI"
  },
  {
    title: "MyLawFirmAi",
    description: "AI-powered law firm management & operations reference AI Portal",
    url: "#",
    tag: "Firm Management",
    comingSoon: true,
  },
  {
    title: "MyJudicialAi",
    description: "AI-powered work management platform for judges & judicial officers — case scheduling, judgment drafting, bench notes and chambers admin",
    url: "#",
    tag: "Judiciary",
    comingSoon: true,
  },
  {
    title: "MyClientAi",
    description: "AI-powered client intake, advisory & relationship management reference AI Portal",
    url: "#",
    tag: "Client Mgmt",
    comingSoon: true,
  },
  {
    title: "MyLawAcad",
    description: "AI-powered work management platform for law teachers & lecturers — lesson planning, marking, supervision and academic admin",
    url: "#",
    tag: "Lecturers",
    comingSoon: true,
  },
  {
    title: "MyLawResearch",
    description: "AI-powered legal research assistant for academic publications — drafting, citations, literature review & journal submission",
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
