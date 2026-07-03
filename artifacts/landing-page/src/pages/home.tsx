import { Hero } from "@/components/hero";
import { AppsGrid } from "@/components/apps-grid";
import { Pricing } from "@/components/pricing";
import { FirmBundles } from "@/components/firm-bundles";
import { CorporateBundles } from "@/components/corporate-bundles";
import { EducationBundles } from "@/components/education-bundles";
import { Payment } from "@/components/payment";
import { Trust } from "@/components/trust";
import { TermsPrivacy } from "@/components/terms-privacy";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
      
      <div className="relative z-10">
        <Hero />
        <AppsGrid />
        <Pricing />
        <FirmBundles />
        <CorporateBundles />
        <EducationBundles />
        <Payment />
        <Trust />
        <TermsPrivacy />
        <Footer />
      </div>
    </main>
  );
}