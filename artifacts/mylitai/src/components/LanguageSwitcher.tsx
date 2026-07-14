import { Globe } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Button } from './ui';

type Props = {
  className?: string;
  compact?: boolean;
};

export function LanguageSwitcher({ className = '', compact = false }: Props) {
  const { lang, setLang } = useLanguage();

  const toggle = () => setLang(lang === 'en' ? 'ms' : 'en');
  const otherLabel: Record<Language, string> = { en: 'BM', ms: 'EN' };
  const fullLabel: Record<Language, string> = { en: 'English', ms: 'Bahasa Melayu' };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className={`h-8 px-2 gap-1 text-xs font-semibold ${className}`}
        title={`Switch to ${otherLabel[lang] === 'BM' ? 'Bahasa Melayu' : 'English'}`}
      >
        <Globe className="h-3.5 w-3.5" />
        {lang === 'en' ? 'EN' : 'BM'}
      </Button>
    );
  }

  return (
    <div className={`flex items-center gap-1 rounded-lg border border-border bg-card p-1 ${className}`}>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`flex-1 px-2 py-1 text-xs font-semibold rounded transition-colors ${
          lang === 'en'
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang('ms')}
        className={`flex-1 px-2 py-1 text-xs font-semibold rounded transition-colors ${
          lang === 'ms'
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        BM
      </button>
    </div>
  );
}
