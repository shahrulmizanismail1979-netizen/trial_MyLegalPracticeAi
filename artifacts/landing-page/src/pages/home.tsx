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
import { usePersona } from "@/lib/persona";

export default function Home() {
  const { persona, skipped } = usePersona();

  // A fresh checkout return must always see its confirmation — never hide it
  // behind the persona front door (new subscribers have no persona yet).
  const isCheckoutReturn =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("session_id");

  if (!persona && !skipped && !isCheckoutReturn) {
    return <PersonaFrontDoor />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
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
