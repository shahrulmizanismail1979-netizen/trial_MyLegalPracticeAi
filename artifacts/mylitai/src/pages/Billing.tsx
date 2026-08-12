import { Link } from 'wouter';
import { Calculator } from 'lucide-react';
import { BillingPage as SharedBillingPage, type BillingRequest } from '@workspace/billing-ui';
import { useLanguage } from '@/contexts/LanguageContext';

const request: BillingRequest = (path, init) =>
  fetch(`/api/lit/matters${path}`, { credentials: 'include', ...init });

export default function Billing() {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <Calculator className="h-6 w-6 text-primary" />
        <h1 className="font-serif text-2xl font-bold text-foreground">{t('nav.billing')}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Invoices, receivables and firm billing settings. Log time and generate invoices from each{' '}
        <Link href="/app/matters" className="text-primary underline">matter's Billing tab</Link>.
      </p>
      <SharedBillingPage request={request} accent="#8a6d2f" currency="RM" matterLink={(id) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/app/matters/${id}`} />
    </div>
  );
}
