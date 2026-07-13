import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Scale, Mail, IdCard, Loader2, Gift, KeyRound, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { signup, type AccessUser } from '@/lib/subscription';

// Grandfather cutoff (must match backend): end of 7 June 2026, Malaysia time.
const CUTOFF = new Date('2026-06-07T23:59:59+08:00');

export function Signup() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedUser, setIssuedUser] = useState<AccessUser | null>(null);
  const [copied, setCopied] = useState(false);
  const { setIsAuthenticated, setCurrentUser, setAuthToken } = useApp();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const beforeCutoff = Date.now() <= CUTOFF.getTime();
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setSubmitting(true);
    try {
      const result = await signup({ email: email.trim(), displayName: displayName || undefined });
      setAuthToken(result.token);
      setCurrentUser(result.user as any);
      // Hold authentication until the user has saved their access code, so the
      // success screen with the code is guaranteed to be shown.
      setIssuedCode(result.accessCode);
      setIssuedUser(result.user);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Sign-up failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const enterWorkspace = () => {
    if (!issuedUser) return;
    setIsAuthenticated(true);
    navigate(issuedUser.grandfathered ? '/dashboard' : '/pricing');
  };

  const inputClass =
    'block w-full pl-14 pr-5 py-4 border border-gold-700 rounded-2xl leading-5 bg-gold-950/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-inner disabled:opacity-50';

  return (
    <div className="min-h-screen bg-gold-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-xl w-full bg-gold-900/80 backdrop-blur-xl border border-gold-800 p-8 md:p-14 rounded-[2.5rem] shadow-2xl relative z-10"
      >
        {issuedCode ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 mb-6 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
              <KeyRound className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-50 leading-tight mb-3 tracking-tight">
              Save your access code
            </h1>
            <p className="text-slate-400 mb-2 leading-relaxed">
              This is your <b className="text-amber-300">only</b> way to sign in — there is no
              username or password. Store it somewhere safe.
            </p>

            <div className="my-7 p-5 rounded-2xl bg-gold-950/60 border border-amber-500/30">
              <p className="text-2xl md:text-3xl font-mono font-bold tracking-widest text-amber-400 break-all select-all" data-testid="text-access-code">
                {issuedCode}
              </p>
            </div>

            <button
              onClick={copyCode}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border border-gold-700 bg-gold-950/50 text-slate-100 hover:border-amber-500/50 hover:text-amber-300 transition-all active:scale-95 mb-3"
              data-testid="button-copy-code"
            >
              {copied ? <><Check className="w-5 h-5" /> Copied</> : <><Copy className="w-5 h-5" /> Copy code</>}
            </button>

            <button
              onClick={enterWorkspace}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] text-base font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 transition-all active:scale-95"
              data-testid="button-enter-workspace"
            >
              I've saved it — continue
            </button>

            {issuedUser?.grandfathered && (
              <p className="text-sm text-amber-200/80 mt-5">
                Your account has full <b>Firm-tier</b> access — free, forever.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 mb-6 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                <Scale className="w-10 h-10 text-amber-500" />
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-50 leading-tight mb-2 tracking-tight">
                Create your account
              </h1>
              <p className="text-slate-400">Malaysian Conveyancing Legal Practice</p>
            </div>

            {beforeCutoff && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                <Gift className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/90 leading-relaxed">
                  <b className="text-amber-300">Founding-member offer:</b> sign up by 7 June 2026 and
                  get full <b>Firm-tier</b> access — every section, all 39 AI tools, document export and
                  AI audio narration — <b>free, forever.</b>
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="email" required value={email} disabled={submitting}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass} placeholder="Email address" data-testid="input-signup-email"
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <IdCard className="h-5 w-5 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="text" value={displayName} disabled={submitting}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass} placeholder="Display name (optional)" data-testid="input-signup-displayname"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !emailValid}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] text-base font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-amber-500 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                data-testid="button-signup"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Create account'}
              </button>

              <p className="text-center text-slate-500 text-sm mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-amber-500 hover:text-amber-400 font-semibold" data-testid="link-login">
                  Sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
