import { useState } from "react";
import { BookOpen, ChevronDown, Menu, Scale, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const productLinks = [
  { label: "Litigation workspace", href: "/mylitai/" },
  { label: "Criminal practice", href: "/mycrimai/" },
  { label: "Conveyancing", href: "/myconveylitai/" },
  { label: "Corporate legal", href: "/mycorplegalai/" },
];

export function LawyesNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="shrink-0" data-testid="link-lawyes-home">
          <img
            src={`${import.meta.env.BASE_URL}lawyes-logo.png`}
            alt="LAWYes"
            className="h-12 w-auto max-w-[150px] object-contain object-left"
          />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              data-testid="button-products-menu"
            >
              Products <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="invisible absolute left-0 top-full w-64 translate-y-1 rounded-xl border border-border bg-card p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {productLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  data-testid={`link-product-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </a>
              ))}
              <a href="#apps" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10" data-testid="link-all-products">
                View all LAWYes products
              </a>
            </div>
          </div>
          <a href="/mylitai/app/case-law" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary" data-testid="link-judgment-library">
            <BookOpen className="h-4 w-4 text-primary" /> Judgment Library
          </a>
          <a href="#pricing" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary" data-testid="link-pricing">
            Pricing
          </a>
          <a href="#security" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary" data-testid="link-trust-security">
            Trust & security
          </a>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost">
            <Link href="/sign-in" data-testid="link-sign-in">Sign in</Link>
          </Button>
          <Button asChild className="gap-2">
            <a href="/mylitai/" data-testid="link-open-workspace"><Scale className="h-4 w-4" /> Open workspace</a>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
          data-testid="button-mobile-navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div id="mobile-navigation" className="border-t border-border bg-background px-5 py-4 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Products</p>
            {productLinks.map((item) => (
              <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {item.label}
              </a>
            ))}
            <a href="/mylitai/app/case-law" className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary" data-testid="link-mobile-judgment-library">
              <BookOpen className="h-4 w-4" /> Judgment Library
            </a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" data-testid="link-mobile-pricing">Pricing</a>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Button asChild variant="outline"><Link href="/sign-in" data-testid="link-mobile-sign-in">Sign in</Link></Button>
              <Button asChild><a href="/mylitai/" data-testid="link-mobile-workspace">Open workspace</a></Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}