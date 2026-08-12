import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Calculator } from 'lucide-react';
import { BillingPage as SharedBillingPage, type BillingRequest } from '@workspace/billing-ui';

const request: BillingRequest = (path, init) =>
  fetch(`/api/convey/matters${path}`, {
    ...init,
    headers: {
      ...(localStorage.getItem('convey_token')
        ? { Authorization: `Bearer ${localStorage.getItem('convey_token')}` }
        : {}),
      ...(init?.headers || {}),
    },
  });

const matterBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/matters`;

export function Billing() {
  return (
    <div className="min-h-screen bg-gold-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <Link href="/dashboard">
          <a className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-400 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to workspace
          </a>
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Calculator className="w-7 h-7 text-amber-500" />
          <h1 className="font-serif font-bold text-2xl text-slate-50">Billing</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Invoices, receivables and firm billing settings. Log time and generate invoices from each{' '}
          <Link href="/matters" className="text-amber-400 underline">matter's Billing tab</Link>.
        </p>

        <SharedBillingPage
          request={request}
          accent="#d97706"
          currency="RM"
          matterLink={(id) => `${matterBase}/${id}`}
        />
      </div>
    </div>
  );
}
