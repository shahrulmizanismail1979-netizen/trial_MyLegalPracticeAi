import { useState } from 'react';
import { Link } from 'wouter';
import { Scale, KeyRound, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVerifyPassword } from '@workspace/api-client-react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

type Mode = 'password' | 'code';

export function Login() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const { setIsAuthenticated, setCurrentUser, setAuthToken } = useApp();
  const verifyMutation = useVerifyPassword();
  const { toast } = useToast();

  const canSubmit =
    mode === 'password'
      ? email.trim().length > 0 && password.length > 0
      : accessCode.trim().length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const data =
      mode === 'password'
        ? { username: email.trim().toLowerCase(), password }
        : { accessCode: accessCode.trim() };

    try {
      const result = await verifyMutation.mutateAsync({ data: data as any });

      const payload = result as typeof result & { token?: string };
      if (payload.success && payload.user) {
        if (payload.token) setAuthToken(payload.token);
        setCurrentUser(payload.user as any);
        setIsAuthenticated(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: 'Invalid login details.',
        });
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('403') || msg.includes('deactivated')) {
        toast({
          variant: 'destructive',
          title: 'Account Deactivated',
          description: 'Your account has been deactivated. Contact your administrator.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description:
            mode === 'password'
              ? 'Invalid email or password.'
              : 'Invalid access code.',
        });
      }
    }
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
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 mb-8 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <Scale className="w-10 h-10 text-amber-500" />
          </div>

          <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-50 leading-tight mb-4 tracking-tight">
            Malaysian Conveyancing<br />Legal Practice
          </h1>

          <div className="space-y-1">
            <p className="text-lg md:text-xl text-slate-400 font-medium">
              by Prof Madya Dr Shahrul Mizan Ismail
            </p>
            <p className="text-sm text-amber-500 font-mono tracking-widest uppercase">
              Fakulti Undang-Undang, UKM
            </p>
          </div>
        </div>

        {/* Mode switch */}
        <div className="max-w-sm mx-auto mb-6 grid grid-cols-2 gap-2 p-1 bg-gold-950/50 border border-gold-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              mode === 'password'
                ? 'bg-amber-500 text-slate-900 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-password"
          >
            Email &amp; Password
          </button>
          <button
            type="button"
            onClick={() => setMode('code')}
            className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              mode === 'code'
                ? 'bg-amber-500 text-slate-900 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-access-code"
          >
            Access Code
          </button>
        </div>

        <form onSubmit={handleLogin} className="max-w-sm mx-auto space-y-4">
          {mode === 'password' ? (
            <>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={verifyMutation.isPending}
                  className={inputClass}
                  placeholder="Email or username"
                  data-testid="input-email"
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={verifyMutation.isPending}
                  className={inputClass}
                  placeholder="Password"
                  data-testid="input-password"
                />
              </div>
            </>
          ) : (
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
              </div>
              <input
                type="text"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                disabled={verifyMutation.isPending}
                className={`${inputClass} font-mono tracking-widest`}
                placeholder="MYCV-XXXX-XXXX-XXXX"
                data-testid="input-access-code"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || !canSubmit}
            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] text-base font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-amber-500 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            data-testid="button-login"
          >
            {verifyMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Unlock Workspace'}
          </button>

          <p className="text-center text-slate-500 text-sm mt-6">
            {mode === 'password'
              ? 'Existing users: sign in with the email & password you were given.'
              : 'Enter the access code you received when you signed up.'}
          </p>
          <p className="text-center text-slate-500 text-sm">
            No account yet?{' '}
            <Link href="/signup" className="text-amber-500 hover:text-amber-400 font-semibold" data-testid="link-signup">
              Create one
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
