import { ShieldCheck, Lock, EyeOff, FileKey2, Server, ScrollText } from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "Encrypted in transit & at rest",
    description:
      "The platform uses encryption controls for data in transit and at rest. Users should still apply their firm's approved device, network, document-handling, and incident-reporting practices.",
  },
  {
    icon: EyeOff,
    title: "Your work stays confidential",
    description:
      "Queries and case material are treated as private workspace information rather than public content. Share only material you are authorised to process and remove unnecessary personal or confidential data.",
  },
  {
    icon: FileKey2,
    title: "Client privilege respected",
    description:
      "Workspace access controls support confidential legal work, but technology does not determine privilege. Lawyers remain responsible for privilege analysis, client authority, disclosure restrictions, and careful sharing.",
  },
  {
    icon: Server,
    title: "Access-controlled storage",
    description:
      "Authentication and access controls restrict workspace activity. Keep credentials individual, review team membership and matter access, end shared-device sessions, and report unexpected access promptly.",
  },
  {
    icon: ScrollText,
    title: "PDPA-aligned handling",
    description:
      "The privacy policy explains collection, operational use, retention, access, correction, and deletion requests. Users should also apply their own privacy, confidentiality, and records obligations.",
  },
  {
    icon: ShieldCheck,
    title: "Secure card payments",
    description:
      "Card payments are handled through Stripe. Review the checkout screen, billing interval, selected portal or bundle, and receipt before treating access as activated.",
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
          private and confidential nature of legal work. Technical controls form
          one part of that work; careful input selection, access review, and
          professional supervision remain essential.
        </p>
      </div>
      <details className="mt-8 rounded-2xl border border-border bg-card/60 p-6">
        <summary className="cursor-pointer font-semibold text-foreground">
          Before entering confidential or personal information
        </summary>
        <div className="mt-4 grid gap-4 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
          <p><strong className="text-foreground">Minimise:</strong> include only the facts and extracts needed for the defined task. Redact unrelated identifiers and do not use a general prompt as a document archive.</p>
          <p><strong className="text-foreground">Confirm authority:</strong> consider client instructions, privilege, confidentiality undertakings, court restrictions, data-protection requirements, and third-party rights.</p>
          <p><strong className="text-foreground">Control access:</strong> use your own credentials, verify matter and team access, avoid unattended shared devices, and export only to an approved location.</p>
          <p><strong className="text-foreground">Review the output:</strong> generated text may repeat sensitive source material. Check the intended audience, attachments, metadata, and redactions before saving or sharing.</p>
        </div>
      </details>

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
