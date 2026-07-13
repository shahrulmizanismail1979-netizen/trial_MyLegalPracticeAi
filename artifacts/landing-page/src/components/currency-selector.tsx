import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCurrency,
  SUPPORTED_CURRENCIES,
  CURRENCY_LABELS,
  type CurrencyCode,
} from "@/lib/currency";

export function CurrencySelector({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
        <SelectTrigger className="w-[130px] h-9 bg-card/70 border-border/60 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CURRENCIES.map((code) => (
            <SelectItem key={code} value={code}>
              {CURRENCY_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BilledInUsdNote() {
  const { isConverted } = useCurrency();
  if (!isConverted) return null;
  return (
    <p className="text-xs text-muted-foreground/80 mt-1">
      Converted for display — you'll be billed in USD.
    </p>
  );
}
