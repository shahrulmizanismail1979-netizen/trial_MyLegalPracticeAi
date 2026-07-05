import { ExternalLink, Clock, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    price: "$19",
  },
  {
    title: "MyJudicialAi",
    description: "AI-powered work management platform for judges & judicial officers — case scheduling, judgment drafting, bench notes and chambers admin",
    url: "#",
    tag: "Judiciary",
    comingSoon: true,
    price: "$19",
  },
  {
    title: "MyClientAi",
    description: "AI-powered client intake, advisory & relationship management reference AI Portal",
    url: "#",
    tag: "Client Mgmt",
    comingSoon: true,
    price: "$19",
  },
  {
    title: "MyLawAcad",
    description: "AI-powered work management platform for law teachers & lecturers — lesson planning, marking, supervision and academic admin",
    url: "#",
    tag: "Lecturers",
    comingSoon: true,
    price: "$19",
  },
  {
    title: "MyLawResearch",
    description: "AI-powered legal research assistant for academic publications — drafting, citations, literature review & journal submission",
    url: "#",
    tag: "Publications",
    comingSoon: true,
    price: "$19",
  },
];

export function AppsGrid() {
  const scrollToPayment = () => {
    document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="apps" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-12">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          The <span className="text-primary">AI Portals</span> Collection
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Specialized intelligence platforms tailored for the diverse needs of the Malaysian legal ecosystem. Click on any live preview to explore the application — or pre-order an upcoming app to lock in today's price.
        </p>
      </div>

      {/* Price-change graphic highlight */}
      <div className="mb-12 relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-amber-500/10 to-red-500/10 p-6 md:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
              <TrendingUp className="h-7 w-7 text-red-500" />
            </div>
            <div className="md:hidden">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                <Clock className="h-3.5 w-3.5" /> Last Day
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white mb-2">
              <Clock className="h-3.5 w-3.5" /> Last Day at This Price
            </div>
            <h3 className="font-serif text-2xl md:text-3xl font-bold mb-1">
              Prices are going up soon
            </h3>
            <p className="text-muted-foreground md:text-lg">
              <span className="text-foreground font-semibold">Today is the last day</span> to purchase at the
              current price — this includes pre-orders for all upcoming apps. Lock in today's rate before the increase.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-base h-12 px-6 w-full md:w-auto"
              onClick={scrollToPayment}
            >
              Secure Today's Price
            </Button>
          </div>
        </div>
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

                    <div className="mt-auto space-y-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{app.price}</span>
                        <span className="text-sm text-muted-foreground">/month pre-order price</span>
                      </div>

                      <div className="flex items-start gap-2 rounded-lg bg-amber-400/5 border border-amber-400/20 p-3">
                        <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Pre-order now to lock in this price. Access will be granted as soon as the app is ready —
                          we'll notify you the moment it launches.
                        </p>
                      </div>

                      <Button
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={scrollToPayment}
                      >
                        Pre-order Now
                      </Button>
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
