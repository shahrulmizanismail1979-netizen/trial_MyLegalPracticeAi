import { ArrowLeft, ExternalLink, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  AuroraBackground,
  CinematicShell,
  GoldButton,
  GhostButton,
} from "@/components/cinematic";

/**
 * All subscriptions are purchased centrally on the LAWYes landing page.
 * This page exists only to redirect there.
 */
export default function BillingPage() {
  const [, navigate] = useLocation();
  return (
    <CinematicShell>
      {/* Aurora decorative background */}
      <AuroraBackground />

      <div className="relative flex-1 flex flex-col px-6 py-10">
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-[#c9a24b]/10 border border-[#c9a24b]/25 flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 text-[#c9a24b]" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-[#c9a24b]">
                Subscribe at LAWYes
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                All plan purchases and subscription management for MyLawAcad are
                handled centrally at the{" "}
                <strong className="text-[#c9a24b]">LAWYes</strong> portal — your
                single point for all LAWYes products.
              </p>
            </div>

            <div className="space-y-3">
              <GoldButton
                onClick={() => { window.location.href = "/#pricing"; }}
                className="w-full gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Go to LAWYes to Purchase
              </GoldButton>
              <GhostButton className="w-full" onClick={() => navigate("/dashboard")}>
                Back to MyLawAcad
              </GhostButton>
            </div>

            <p className="text-xs text-muted-foreground">
              Already have an access code?{" "}
              <Link href="/login" className="text-[#c9a24b] underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </CinematicShell>
  );
}
