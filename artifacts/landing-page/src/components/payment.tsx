import { MessageCircle, CreditCard, ShieldCheck, Settings } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const WHATSAPP_URL = `https://wa.me/60139725475?text=${encodeURIComponent(
  "Hi, I'd like to subscribe to the AI Portals. Please help me get set up.",
)}`;

export function Payment() {
  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="payment" className="py-24 px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Secure Your <span className="text-primary">Access</span>
        </h2>
        <p className="text-muted-foreground text-lg">
          Subscribe online by card in seconds, or talk to us directly for firm,
          corporate, and academic bundles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card checkout */}
        <div className="bg-card p-8 rounded-2xl border border-border shadow-2xl flex flex-col text-center items-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
            <CreditCard className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl font-medium mb-3">Subscribe online</h3>
          <p className="text-muted-foreground mb-6 flex-1">
            Choose a plan in the pricing section and check out securely by card.
            Your subscription activates instantly — billed monthly, cancel anytime.
          </p>
          <Button
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            onClick={scrollToPricing}
          >
            View Plans &amp; Subscribe
          </Button>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Payments secured by Stripe</span>
          </div>
          <Link href="/manage-subscription" className="mt-5 w-full">
            <Button variant="outline" className="w-full gap-2">
              <Settings className="h-4 w-4" />
              Manage or cancel subscription
            </Button>
          </Link>
        </div>

        {/* WhatsApp */}
        <div className="bg-card p-8 rounded-2xl border border-border shadow-2xl flex flex-col text-center items-center">
          <div className="h-12 w-12 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] mb-6">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl font-medium mb-3">Talk to us</h3>
          <p className="text-muted-foreground mb-6 flex-1">
            Have a question, or arranging a firm, corporate, or academic bundle?
            Message us on WhatsApp and we'll help you get set up.
          </p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button className="w-full h-14 text-lg px-8 bg-[#25D366] text-white hover:bg-[#20bd5a] border-none font-semibold gap-2.5">
              <MessageCircle className="h-6 w-6" />
              Talk to us via WhatsApp
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
