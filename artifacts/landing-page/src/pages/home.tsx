import { useEffect } from "react";
import { Hero } from "@/components/hero";
import { ReceptionChat } from "@/components/reception-chat";
import { AppsGrid } from "@/components/apps-grid";
import { SubscriberStats } from "@/components/subscriber-stats";
import { Pricing } from "@/components/pricing";
import { FirmBundles } from "@/components/firm-bundles";
import { CorporateBundles } from "@/components/corporate-bundles";
import { EducationBundles } from "@/components/education-bundles";
import { Payment } from "@/components/payment";
import { Security } from "@/components/security";
import { ContributeCTA } from "@/components/contribute-cta";
import { Trust } from "@/components/trust";
import { TermsPrivacy } from "@/components/terms-privacy";
import { Footer } from "@/components/footer";
import { CheckoutSuccess } from "@/components/checkout-success";
import { PersonaFrontDoor } from "@/components/persona-front-door";
import { PersonaSwitcher } from "@/components/persona-switch";
import { PoweredByBanner } from "@/components/powered-by-banner";
import { usePersona } from "@/lib/persona";

export default function Home() {
  const { persona, skipped } = usePersona();

  // A fresh checkout return must always see its confirmation — never hide it
  // behind the persona front door (new subscribers have no persona yet).
  const isCheckoutReturn =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("session_id");

  // When an external portal sends visitors directly to /#pricing we must bypass
  // the front door so they land on the pricing section, not the persona selector.
  const isAnchorLink =
    typeof window !== "undefined" && window.location.hash !== "";

  // After the page renders, honour any URL hash by scrolling to the target
  // element. This is needed because SPAs don't auto-scroll on initial paint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    // Give React one more tick to finish painting before scrolling.
    const id = hash.replace("#", "");
    const scrollToAnchor = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    // Try immediately, then retry once after a short delay for lazy sections.
    scrollToAnchor();
    const timer = setTimeout(scrollToAnchor, 400);
    return () => clearTimeout(timer);
  }, []);

  if (!persona && !skipped && !isCheckoutReturn && !isAnchorLink) {
    return (
      <>
        <PoweredByBanner />
        <PersonaFrontDoor />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      <PoweredByBanner />
      <div className="fixed inset-0 pointer-events-none z-0" style={{ top: "48px" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
      
      <CheckoutSuccess />
      <PersonaSwitcher />
      
      <div className="relative z-10 animate-in fade-in duration-1000">
        <Hero />
        <ReceptionChat />
        <ContributeCTA />
        <AppsGrid />
        <SubscriberStats />
        <Pricing />
        
        {/* Bundles ordered and shown based on persona */}
        {persona === "practitioner" && (
          <>
            <FirmBundles />
            <CorporateBundles />
            <EducationBundles />
          </>
        )}
        
        {persona === "inhouse" && (
          <>
            <CorporateBundles />
            <FirmBundles />
            <EducationBundles />
          </>
        )}
        
        {(persona === "academic" || persona === "student") && (
          <>
            <EducationBundles />
            <FirmBundles />
            <CorporateBundles />
          </>
        )}

        {persona === "judicial" && (
          <>
            <FirmBundles />
            <EducationBundles />
            <CorporateBundles />
          </>
        )}

        {/* No persona (or "other"): show everything in default order */}
        {(!persona || persona === "other") && (
          <>
            <FirmBundles />
            <CorporateBundles />
            <EducationBundles />
          </>
        )}

        <Security />
        <Payment />
        <Trust />
        <TermsPrivacy />
        <Footer />
      </div>
    </main>
  );
}
