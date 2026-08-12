import { UserRound } from "lucide-react";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { PARALEGALS } from "@/lib/paralegals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AIProviderSwitcher({ className }: { className?: string }) {
  const { provider, adminDefault, override, openaiAvailable, perplexityAvailable, setOverride } =
    useAIProvider();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1.5 text-[hsl(40_30%_82%)] hover:text-[hsl(40_40%_95%)] ${className ?? ""}`}
          title="Choose your paralegal"
        >
          <UserRound className="w-4 h-4 text-[hsl(var(--gold-bright))]" />
          <span className="hidden sm:inline text-xs font-medium">{PARALEGALS[provider].name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Choose your paralegal</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setOverride(null)}>
          <span className="flex-1">
            Firm's choice
            <span className="block text-xs text-muted-foreground">
              Use whichever paralegal the firm has set ({PARALEGALS[adminDefault].name})
            </span>
          </span>
          {override === null && <span className="text-[hsl(var(--gold-bright))]">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(["openai", "gemini", "perplexity"] as const).map((p) => {
          const meta = PARALEGALS[p];
          const disabled =
            (p === "openai" && !openaiAvailable) ||
            (p === "perplexity" && !perplexityAvailable);
          return (
            <DropdownMenuItem
              key={p}
              onClick={() => !disabled && setOverride(p)}
              disabled={disabled}
              className="items-start gap-2 py-2"
            >
              <UserRound className="w-4 h-4 mt-0.5 text-[hsl(var(--gold-bright))] shrink-0" />
              <span className="flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  {meta.name}
                  <span className="text-xs font-normal text-muted-foreground">· {meta.role}</span>
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  <span className="text-[hsl(var(--gold-bright))]/80">Strengths:</span> {meta.strengths}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  <span className="text-foreground/70">Trade-offs:</span> {meta.weaknesses}
                </span>
                {disabled && (
                  <span className="block text-xs italic text-muted-foreground mt-0.5">
                    Currently unavailable.
                  </span>
                )}
              </span>
              {override === p && (
                <span className="text-[hsl(var(--gold-bright))] mt-0.5 shrink-0">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
