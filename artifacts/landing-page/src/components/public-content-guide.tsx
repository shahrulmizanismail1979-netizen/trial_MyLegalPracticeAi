import { BookOpenCheck, ChevronDown, ClipboardCheck, ListChecks } from "lucide-react";
import { PORTAL_CATALOG } from "@/lib/product-catalog";
import { PRODUCT_GUIDES, PUBLIC_FAQS } from "@/data/public-content";

export function PublicContentGuide() {
  return (
    <section id="help" className="px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <BookOpenCheck className="h-4 w-4" />
            Practical guide
          </div>
          <h2 className="font-serif text-3xl font-bold md:text-5xl">
            Prepare the input. <span className="text-primary">Review the result.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Each portal supports a different working context. Open a guide for a concrete
            example, suggested source material, and the checks to complete before relying
            on or sharing an output.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {PRODUCT_GUIDES.map((guide) => {
            const portal = PORTAL_CATALOG.find((entry) => entry.id === guide.portalId);
            if (!portal) return null;
            return (
              <details
                key={guide.portalId}
                className="group rounded-2xl border border-border/70 bg-card/60 p-5 open:bg-card"
                data-testid={`product-guide-${guide.portalId}`}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">{portal.tag}</span>
                    <span className="mt-1 block font-serif text-xl font-semibold">{portal.title}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{guide.bestFor}</span>
                  </span>
                  <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-5 space-y-5 border-t border-border/60 pt-5 text-sm leading-relaxed">
                  <GuideList title="Prepare" items={guide.prepare} />
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                    <p className="font-semibold text-foreground">Try a bounded instruction</p>
                    <p className="mt-2 text-muted-foreground">{guide.example}</p>
                  </div>
                  <GuideList title="Interpret" items={guide.interpret} />
                  <GuideList title="Review before use" items={guide.review} />
                  <a className="inline-flex font-semibold text-primary hover:underline" href={portal.url}>
                    Open {portal.title}
                  </a>
                </div>
              </details>
            );
          })}
        </div>

        <div className="mt-20 grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <ClipboardCheck className="h-4 w-4" />
              Frequently asked questions
            </div>
            <h2 className="font-serif text-3xl font-bold">A safer working method</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              These answers explain how to scope an instruction, distinguish source modes,
              and carry out professional review. They do not replace matter-specific legal
              judgment.
            </p>
          </div>
          <div className="space-y-3">
            {PUBLIC_FAQS.map((item) => (
              <details key={item.question} className="group rounded-xl border border-border bg-card/60 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.question}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="pt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <ListChecks className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <ul className="mt-2 space-y-2 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="text-primary">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
