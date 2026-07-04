import { ShieldCheck, Lock, EyeOff, FileKey2, Server, ScrollText } from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "Encrypted in transit & at rest",
    description:
      "Every connection is protected with industry-standard TLS encryption, and your data is encrypted at rest. Nothing you send travels or sits in the open.",
  },
  {
    icon: EyeOff,
    title: "Your work stays confidential",
    description:
      "Your queries, documents, and case details are never sold or published, and are not used to train public AI models. What you put in stays yours.",
  },
  {
    icon: FileKey2,
    title: "Client privilege respected",
    description:
      "We understand solicitor-client privilege. Confidential matters you research are treated as privileged and tied to your named licence alone.",
  },
  {
    icon: Server,
    title: "Access-controlled storage",
    description:
      "Data is held in isolated, access-controlled infrastructure behind strict authentication. Only you can reach your account and your private activity.",
  },
  {
    icon: ScrollText,
    title: "PDPA-aligned handling",
    description:
      "Personal data is handled in line with Malaysia's Personal Data Protection Act 2010 (PDPA) — collected only as needed, retained responsibly, deletable on request.",
  },
  {
    icon: ShieldCheck,
    title: "Secure card payments",
    description:
      "Card payments are processed by Stripe, a PCI-DSS Level 1 certified provider. Your full card details are never seen or stored on our servers.",
  },
];

export function Security() {
  return (
    <section id="security" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <ShieldCheck className="h-4 w-4" />
          Security &amp; Confidentiality
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Built for the way <span className="text-primary">lawyers work</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Legal work demands discretion. Every AI Portal is built to protect the
          private and confidential nature of the information you rely on — so you
          can research, draft, and advise with complete peace of mind.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="bg-card/50 border border-border/50 rounded-2xl p-6 transition-all duration-300 hover:border-primary/40 hover:bg-card"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
