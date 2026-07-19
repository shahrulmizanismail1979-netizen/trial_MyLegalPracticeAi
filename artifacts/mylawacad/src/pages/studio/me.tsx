import { Link } from "wouter";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
} from "@/components/cinematic-studio";
import { ShieldOff } from "lucide-react";

export default function StudioMe() {
  return (
    <CinematicShell>
      <PageHeader
        eyebrow="Studio · My Progress"
        title="My Progress"
        description="View your results directly after completing an assessment."
        right={
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 text-sm font-semibold uppercase tracking-widest text-white/70 transition-colors"
          >
            ← Studio
          </Link>
        }
      />

      <div className="container mx-auto px-6 py-16 flex items-center justify-center">
        <SpotlightCard className="p-10 text-center max-w-lg">
          <ShieldOff className="w-12 h-12 mx-auto mb-4 text-amber-400/60" />
          <div className="font-display text-xl text-white/90 mb-3">
            Progress lookup has been removed
          </div>
          <div className="text-sm text-white/60 leading-relaxed">
            To protect student privacy, cross-platform history lookups by email
            are no longer supported. Your results are shown immediately after
            each assessment — bookmark or save that page to revisit them.
          </div>
        </SpotlightCard>
      </div>
    </CinematicShell>
  );
}
