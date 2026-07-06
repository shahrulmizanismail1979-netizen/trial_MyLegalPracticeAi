import { useEffect } from "react";
import { Hero } from "@/components/hero";
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

const ALLOWED_REDIRECTS = new Set([
  "https://mylitai.life",
  "https://mylitai.life/irac/",
  "https://mysyalitai.life",
  "https://mycorpai.life",
  "https://myconveyai.life",
  "https://mycrimai.life/",
  "https://myccblitai.life/",
  "https://myaccidentai.life/",
]);

export default function Home() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      const redirect = params.get("redirect");
      if (redirect && ALLOWED_REDIRECTS.has(redirect)) {
        window.location.href = redirect;
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
      
      <div className="relative z-10">
        <Hero />
        <ContributeCTA />
        <AppsGrid />
        <SubscriberStats />
        <Pricing />
        <FirmBundles />
        <CorporateBundles />
        <EducationBundles />
        <Security />
        <Payment />
        <Trust />
        <TermsPrivacy />
        <Footer />
      </div>
    </main>
  );
}