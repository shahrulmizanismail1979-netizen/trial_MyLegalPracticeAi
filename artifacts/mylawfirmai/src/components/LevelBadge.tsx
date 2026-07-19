import { useT } from "@/lib/i18n";
import { Shield, Sparkles, Star, Zap, Crown, Flame, Trophy } from "lucide-react";

export function getLevelInfo(score: number) {
  if (score >= 99) return { level: 7, key: "game.level.7", icon: Crown, color: "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]", bg: "bg-yellow-400/20", border: "border-yellow-400/50" };
  if (score >= 91) return { level: 6, key: "game.level.6", icon: Flame, color: "text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]", bg: "bg-rose-500/20", border: "border-rose-500/50" };
  if (score >= 81) return { level: 5, key: "game.level.5", icon: Star, color: "text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]", bg: "bg-purple-500/20", border: "border-purple-500/50" };
  if (score >= 61) return { level: 4, key: "game.level.4", icon: Sparkles, color: "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]", bg: "bg-cyan-400/20", border: "border-cyan-400/50" };
  if (score >= 41) return { level: 3, key: "game.level.3", icon: Zap, color: "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]", bg: "bg-emerald-400/20", border: "border-emerald-400/50" };
  if (score >= 21) return { level: 2, key: "game.level.2", icon: Shield, color: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]", bg: "bg-blue-400/20", border: "border-blue-400/50" };
  return { level: 1, key: "game.level.1", icon: Trophy, color: "text-slate-400", bg: "bg-slate-400/20", border: "border-slate-400/50" };
}

export function LevelBadge({ score, className = "", showName = true }: { score: number, className?: string, showName?: boolean }) {
  const t = useT();
  const info = getLevelInfo(score);
  const Icon = info.icon;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${info.bg} ${info.border} ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${info.color}`} />
      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
        {t("game.lvl")} {info.level} {showName && <span className="ml-1 opacity-80">{t(info.key)}</span>}
      </span>
    </div>
  );
}
