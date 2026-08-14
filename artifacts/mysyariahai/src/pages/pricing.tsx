import { ExternalLink, ShoppingCart, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";

/**
 * All subscriptions are purchased centrally on the LAWYes landing page.
 * This page exists only to redirect there.
 */
export default function PricingPage() {
  const { mode } = useLanguage();
  const isBm = mode === "bm";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-serif text-lg font-bold text-secondary">MySyariahAI</span>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {isBm ? "Kembali" : "Back"}
            </Link>
          </Button>
        </div>
      </header>

      {/* Redirect card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
              <ShoppingCart className="h-9 w-9 text-secondary" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">
              {isBm ? "Langgan di LAWYes" : "Subscribe at LAWYes"}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isBm
                ? "Semua pembelian pelan dan pengurusan langganan dikendalikan secara berpusat di portal LAWYes."
                : "All plan purchases and subscription management are handled centrally at the LAWYes portal — your single point for all LAWYes products."}
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild size="lg" className="w-full gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              <a href="/#pricing">
                <ExternalLink className="h-4 w-4" />
                {isBm ? "Pergi ke LAWYes untuk Membeli" : "Go to LAWYes to Purchase"}
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">{isBm ? "Kembali ke MySyariahAI" : "Back to MySyariahAI"}</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {isBm ? "Sudah ada kod akses?" : "Already have an access code?"}{" "}
            <Link href="/login" className="text-secondary underline">
              {isBm ? "Log masuk di sini" : "Sign in here"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
