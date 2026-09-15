import { Link } from "wouter";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface UpgradeCardProps {
  title?: string;
  description?: string;
  /** Lowest tier name that unlocks this feature, for the prompt copy. */
  requiredTierName?: string;
}

export function UpgradeCard({
  title = "This tool needs an upgrade",
  description = "Your current plan does not include this tool.",
  requiredTierName,
}: UpgradeCardProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg border-primary/30 bg-card/60" data-testid="card-upgrade-required">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">
            {description}
            {requiredTierName ? (
              <>
                {" "}
                Available on the <strong>{requiredTierName}</strong> plan and above.
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="lg" className="w-full" data-testid="button-view-plans" onClick={() => { window.location.href = "/apps#pricing"; }}>
            <Sparkles className="mr-2 h-4 w-4" />
            View plans &amp; upgrade
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/workspace">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
