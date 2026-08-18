const BRANDS = [
  "ChatGPT",
  "Gemini",
  "NotebookLM",
  "Perplexity",
  "ElevenLabs",
];

export function PoweredByBanner() {
  // Duplicate list so the marquee loops seamlessly
  const items = [...BRANDS, ...BRANDS];

  return (
    <div className="w-full bg-primary text-primary-foreground overflow-hidden" style={{ height: "36px" }}>
      <div className="flex items-center h-full gap-0 animate-[marquee_22s_linear_infinite]" style={{ width: "max-content" }}>
        {items.map((brand, i) => (
          <span key={i} className="flex items-center gap-3 px-5 whitespace-nowrap text-[11px] font-medium tracking-[0.18em] uppercase opacity-95">
            <span className="opacity-60 text-[8px]">✦</span>
            {i === 0 || i === BRANDS.length ? (
              <>
                <span className="opacity-75 font-normal normal-case tracking-normal text-[11px]">
                  Powered by the same AI as
                </span>
                <span className="opacity-60 text-[8px] ml-1">✦</span>
                <span>{brand}</span>
              </>
            ) : (
              <span>{brand}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
