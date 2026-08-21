import { CircleX } from "lucide-react";

const BRANDS = [
  "ChatGPT",
  "Gemini",
  "NotebookLM",
  "Perplexity",
  "ElevenLabs",
];

export function PoweredByBanner() {
  // Duplicate so the marquee loops seamlessly
  const items = [...BRANDS, ...BRANDS];

  return (
    <div
      className="w-full bg-primary text-primary-foreground flex items-stretch overflow-hidden"
      style={{ height: "64px" }}
    >
      {/* ── Static phrase — always visible on the left ── */}
      <div className="flex-shrink-0 flex items-center px-6 md:px-10 border-r border-white/25 bg-black/10">
        <p className="text-[11px] md:text-[13px] font-semibold uppercase tracking-[0.25em] opacity-90 whitespace-nowrap leading-snug text-center">
          Powered by<br className="md:hidden" />
          <span className="hidden md:inline"> </span>the same AI as
        </p>
      </div>

      {/* ── Scrolling brand names ── */}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex items-center h-full animate-[marquee_26s_linear_infinite]"
          style={{ width: "max-content" }}
        >
          {items.map((brand, i) => (
            <span
              key={i}
              className="flex items-center gap-3 px-8 whitespace-nowrap"
            >
              <span className="opacity-40 text-[9px]">✦</span>
              <span className="text-[18px] md:text-[20px] font-black tracking-tight uppercase">
                {brand}
              </span>
            </span>
          ))}
        </div>
      </div>

        <a
          href={`${import.meta.env.BASE_URL}unsubscribe`}
          className="flex shrink-0 items-center gap-1.5 border-l border-white/25 bg-black/15 px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-black/25 sm:px-5 sm:text-sm"
          aria-label="Cancel free trial or unsubscribe"
        >
          <CircleX className="h-4 w-4" />
          <span>Cancel trial / unsubscribe</span>
        </a>
    </div>
  );
}
