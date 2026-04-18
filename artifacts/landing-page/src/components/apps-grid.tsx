import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const apps = [
  {
    title: "MyLitAI",
    description: "AI-powered Litigation reference web book for litigators",
    url: "https://mylitai.life",
    tag: "Litigation"
  },
  {
    title: "MySyalitAI",
    description: "AI-powered Syariah Litigation reference web book for syarie lawyers",
    url: "https://mysyalitai.life",
    tag: "Syariah"
  },
  {
    title: "MyCorpAI",
    description: "AI-powered Corporate Secretary reference web book for corporate secretaries",
    url: "https://mycorpai.life",
    tag: "Corporate"
  },
  {
    title: "MyConveyAI",
    description: "AI-powered Conveyancing reference web book for conveyancers",
    url: "https://myconveyai.life",
    tag: "Conveyancing"
  },
  {
    title: "MyCrimAI",
    description: "AI-powered Criminal Law reference web book for criminal law practitioners",
    url: "https://mycrimai.replit.app/",
    tag: "Criminal"
  },
  {
    title: "MyCorpCommBankLitAi",
    description: "AI-powered Corporate, Commercial & Banking Litigation reference web book for Malaysian legal practice",
    url: "https://my-ccb-lit-ai.replit.app/",
    tag: "Corp/Comm/Banking"
  },
  {
    title: "MyAccidentAi",
    description: "AI-powered Accident, Personal Injury & Running Down Litigation reference web book",
    url: "https://legal-ai-explore.replit.app/",
    tag: "Accident & PI"
  }
];

export function AppsGrid() {
  return (
    <section id="apps" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-16">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          The <span className="text-primary">AI Web Books</span> Collection
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Seven specialized intelligence platforms tailored for the diverse needs of the Malaysian legal ecosystem. Click on any preview to explore the live application.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app, index) => (
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
        ))}
      </div>
    </section>
  );
}