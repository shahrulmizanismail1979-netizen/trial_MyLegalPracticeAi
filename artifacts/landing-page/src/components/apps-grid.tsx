import { useState } from "react";
import { ExternalLink, Sparkles, ChevronDown, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePersona } from "@/lib/persona";
import { COMING_SOON_PORTALS, LIVE_PORTALS, type PortalCatalogEntry } from "@/lib/product-catalog";

function VersionCard({ version }: { version: NonNullable<PortalCatalogEntry["versions"]>[number] }) {

  return (
    <div className="w-full flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
          {version.badge}
        </span>
        <span className="text-xs font-semibold text-foreground">Subscription access</span>
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
  const orderedApps = [...LIVE_PORTALS, ...COMING_SOON_PORTALS].sort((a, b) => {
    const getScore = (app: PortalCatalogEntry) => {
      if (persona === "inhouse") {
        if (app.tag === "Corporate") return 100;
        if (app.tag === "Corporate, Commercial & Banking") return 90;
        if (app.tag === "Firm Management") return 10;
        if (app.tag === "Legal Education") return 5;
        if (app.tag === "Publications") return 5;
        return 50;
      }
      if (persona === "academic") {
        if (app.tag === "Legal Education") return 100;
        if (app.tag === "Publications") return 90;
        if (app.tag === "Litigation") return 80; // Good for teaching
        if (app.tag === "Firm Management") return 10;
        return 50;
      }
      if (persona === "student") {
        if (app.tag === "Legal Education") return 100; // IRAC / learning tools live here
        if (app.tag === "Publications") return 90;
        if (app.tag === "Litigation") return 85; // Learn on real drafting tools
        if (app.tag === "Criminal") return 70;
        if (app.tag === "Firm Management") return 5;
        return 50;
      }
      if (persona === "judicial") {
        if (app.tag === "Litigation") return 100; // Case-law research first
        if (app.tag === "Criminal") return 95;
        if (app.tag === "Syariah") return 90;
        if (app.tag === "Corporate, Commercial & Banking") return 80;
        if (app.tag === "Firm Management") return 5;
        if (app.tag === "Conveyancing") return 40;
        return 50;
      }
      if (persona === "other") {
        return 50; // Balanced default order
      }
      // practitioner (and null)
      if (app.tag === "Litigation") return 100;
      if (app.tag === "Syariah") return 90;
      if (app.tag === "Conveyancing") return 80;
      if (app.tag === "Criminal") return 70;
      if (app.tag === "Firm Management") return 60;
       if (app.tag === "Legal Education") return 10;
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
          {LIVE_PORTALS.length} live portals for the Malaysian legal ecosystem. {COMING_SOON_PORTALS.length} additional portals are in development. Click a live portal to explore it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orderedApps.map((app, index) => {
          if (app.availability === "coming-soon") {
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
                          This portal is still in development. Availability, included
                          features, and access details will be published if it launches.
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
