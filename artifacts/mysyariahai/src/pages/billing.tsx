import { Link } from "wouter";
import { Calculator } from "lucide-react";
import { BillingPage as SharedBillingPage, type BillingRequest } from "@workspace/billing-ui";
import { useLanguage } from "@/lib/language-context";

const request: BillingRequest = (path, init) =>
  fetch(`/api/sya/matters${path}`, { credentials: "include", ...init });

export default function BillingPage() {
  const { t } = useLanguage();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <Calculator className="h-6 w-6 text-secondary" />
        <h1 className="font-serif text-2xl font-bold text-foreground">{t("Billing", "Pengebilan")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t("Invoices, receivables and firm billing settings. Log time and generate invoices from each",
          "Invois, penghutang dan tetapan pengebilan firma. Rekod masa dan jana invois dari setiap")}{" "}
        <Link href="/matters" className="text-secondary underline">
          {t("matter's Billing tab", "tab Pengebilan fail kes")}
        </Link>.
      </p>
      <SharedBillingPage
        request={request}
        accent="#0f766e"
        currency="RM"
        matterLink={(id) => `${base}/matters/${id}`}
      />
    </div>
  );
}
