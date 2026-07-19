import { useState } from "react";

export type RadarDatum = {
  key: string;
  label: string;
  color: string;
  score: number | null;
};

export type DonutDatum = {
  key: string;
  label: string;
  color: string;
  /** Fraction 0..1. */
  weight: number;
};

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

/**
 * Interactive spider/radar chart of a staff member's component scores (0-100).
 * Hovering or focusing a vertex surfaces the exact score in a caption below.
 */
export function ScoreRadar({
  data,
  notRatedLabel,
  ariaLabel,
  size = 240,
}: {
  data: RadarDatum[];
  notRatedLabel: string;
  ariaLabel: string;
  size?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const pad = 34;
  const R = size / 2 - pad;
  const n = data.length;
  const rings = [0.25, 0.5, 0.75, 1];

  // axis angle: start at top (-90) going clockwise.
  const angleOf = (i: number) => -90 + (i * 360) / n;
  const valueRadius = (score: number | null) => ((score ?? 0) / 100) * R;

  const ringPoints = (frac: number) =>
    data
      .map((_, i) => {
        const p = polar(cx, cy, R * frac, angleOf(i));
        return `${p.x},${p.y}`;
      })
      .join(" ");

  const dataPoints = data
    .map((d, i) => {
      const p = polar(cx, cy, valueRadius(d.score), angleOf(i));
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
        className="max-w-full"
      >
        <title>{ariaLabel}</title>
        {/* grid rings */}
        {rings.map((frac) => (
          <polygon
            key={frac}
            points={ringPoints(frac)}
            className="fill-none stroke-border/50"
            strokeWidth={1}
          />
        ))}
        {/* axes + labels */}
        {data.map((d, i) => {
          const end = polar(cx, cy, R, angleOf(i));
          const lab = polar(cx, cy, R + 18, angleOf(i));
          return (
            <g key={d.key}>
              <line
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                className="stroke-border/60"
                strokeWidth={1}
              />
              <text
                x={lab.x}
                y={lab.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-[10px] font-medium ${active === i ? "fill-foreground" : "fill-muted-foreground"}`}
              >
                {d.label}
              </text>
            </g>
          );
        })}
        {/* data polygon */}
        <polygon
          points={dataPoints}
          className="fill-primary/20 stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* vertices */}
        {data.map((d, i) => {
          const p = polar(cx, cy, valueRadius(d.score), angleOf(i));
          const isActive = active === i;
          return (
            <circle
              key={d.key}
              cx={p.x}
              cy={p.y}
              r={isActive ? 6 : 4}
              tabIndex={0}
              style={{ fill: d.color, cursor: "pointer" }}
              className="stroke-background transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              strokeWidth={2}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <title>
                {d.label}: {d.score == null ? notRatedLabel : d.score}
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {data.map((d, i) => (
          <button
            type="button"
            key={d.key}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${active === i ? "bg-accent/60" : ""}`}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="font-medium">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {d.score == null ? notRatedLabel : d.score}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Interactive donut of the overall-score weight mix. Hovering or focusing a
 * slice highlights it and updates the center read-out.
 */
export function WeightDonut({
  data,
  centerLabel,
  ariaLabel,
  size = 200,
}: {
  data: DonutDatum[];
  centerLabel: string;
  ariaLabel: string;
  size?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const C = 2 * Math.PI * r;
  const stroke = 22;

  let acc = 0;
  const segments = data.map((d, i) => {
    const len = d.weight * C;
    const seg = { d, i, len, offset: acc };
    acc += len;
    return seg;
  });

  const activeDatum = active != null ? data[active] : null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-muted/40"
            strokeWidth={stroke}
          />
          {/* slices, rotated so the first starts at the top */}
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map(({ d, i, len, offset }) => {
              const dim = active != null && active !== i;
              return (
                <circle
                  key={d.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={active === i ? stroke + 6 : stroke}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                  style={{ opacity: dim ? 0.35 : 1, cursor: "pointer", transition: "all 150ms" }}
                  className="focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  tabIndex={0}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <title>
                    {d.label}: {Math.round(d.weight * 100)}%
                  </title>
                </circle>
              );
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {activeDatum ? (
            <>
              <span className="font-serif text-2xl tabular-nums" style={{ color: activeDatum.color }}>
                {Math.round(activeDatum.weight * 100)}%
              </span>
              <span className="px-4 text-xs font-medium text-muted-foreground">
                {activeDatum.label}
              </span>
            </>
          ) : (
            <>
              <span className="font-serif text-lg text-foreground">100%</span>
              <span className="px-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {centerLabel}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {data.map((d, i) => (
          <button
            type="button"
            key={d.key}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${active === i ? "bg-accent/60" : ""}`}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="font-medium">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(d.weight * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
