import { ExternalLink, ShoppingCart, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

/**
 * All subscriptions are purchased centrally on the LAWYes landing page.
 * This page exists only to redirect there.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 w-full h-[500px] purple-glow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-purple-500/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-primary cursor-pointer">
            MYCorpLegalAI
          </Link>
          <Link href="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      {/* Redirect card */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
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
              at the <strong className="text-primary">LAWYes</strong> portal —
              your single point for all LAWYes products.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/apps#pricing"
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Go to LAWYes to Purchase
            </a>
            <Link
              href="/login"
              className="flex items-center justify-center w-full px-6 py-3 border border-purple-500/20 text-muted-foreground hover:text-foreground hover:border-purple-500/40 font-medium rounded-lg transition-colors text-sm"
            >
              Have a code? Sign in
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Need help?{" "}
            <a href="/#contact" className="text-primary underline">
              Contact LAWYes support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
