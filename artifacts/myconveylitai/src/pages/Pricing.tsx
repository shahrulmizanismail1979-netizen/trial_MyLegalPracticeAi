import { ExternalLink, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

/**
 * All subscriptions are purchased centrally on the LAWYes landing page.
 * This page exists only to redirect there.
 */
export function Pricing() {
  return (
    <div className="min-h-screen bg-gold-950 relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-amber-800/30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-serif text-lg font-bold text-amber-400">MyConveyLitAI</span>
          <Link href="/" className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      {/* Redirect card */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <ShoppingCart className="h-9 w-9 text-amber-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-amber-100">
              Subscribe at LAWYes
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              All plan purchases and subscription management are handled centrally
              at the <strong className="text-amber-300">LAWYes</strong> portal —
              your single point for all LAWYes products.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/apps#pricing"
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Go to LAWYes to Purchase
            </a>
            <Link
              href="/"
              className="flex items-center justify-center w-full px-6 py-3 border border-amber-800/40 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 font-medium rounded-lg transition-colors text-sm"
            >
              Back to MyConveyLitAI
            </Link>
          </div>

          <p className="text-xs text-slate-500">
            Already have an access code?{' '}
            <Link href="/login" className="text-amber-400 underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
