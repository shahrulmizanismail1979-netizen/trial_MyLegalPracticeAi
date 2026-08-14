import { ExternalLink, ShoppingCart, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

/**
 * All subscriptions are purchased centrally on the LAWYes landing page.
 * This page exists only to redirect there.
 */
export function PricingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <span className="font-serif text-lg font-bold text-primary cursor-pointer">MyCrimAI</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>
      </header>

      {/* Redirect card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShoppingCart className="h-9 w-9 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Subscribe at LAWYes
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              All plan purchases and subscription management are handled centrally
              at the <strong>LAWYes</strong> portal — your single point for all
              LAWYes products.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              asChild
              size="lg"
              className="w-full gap-2"
            >
              <a href="/#pricing">
                <ExternalLink className="h-4 w-4" />
                Go to LAWYes to Purchase
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Back to MyCrimAI</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Already have an access code?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
