import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Scale, Lock } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Login() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { t, lang } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    const result = await login(code.trim());
    setLoading(false);
    if (result.success) {
      setLocation('/app');
    } else {
      setError(result.error || (lang === 'ms' ? 'Kod akses tidak sah atau telah tamat tempoh. Sila cuba lagi.' : 'Invalid or expired access code. Please try again.'));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract pattern" 
          className="w-full h-full object-cover opacity-10"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-card border-2 border-primary rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-primary/20">
            <Scale className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('brand.name')}</h1>
          <p className="text-muted-foreground mt-2">{lang === 'ms' ? 'Akses Pengamal Selamat' : 'Secure Practitioner Access'}</p>
        </div>

        <Card className="border-primary/20 shadow-2xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> {lang === 'ms' ? 'Kod Akses' : 'Access Code'}
                </label>
                <Input 
                  type="password"
                  placeholder={lang === 'ms' ? 'Masukkan kod akses anda' : 'Enter your access code'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  disabled={loading}
                  className="h-12 text-lg"
                />
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full text-lg" disabled={loading || !code.trim()}>
                {loading ? (lang === 'ms' ? 'Mengesahkan...' : 'Verifying...') : t('cta.enter')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
