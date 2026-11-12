import type { CSSProperties } from "react";
import type { GaugeTick, InterestGauge } from "../domain/cons";
import { cn } from "../lib/utils";

const colorVar: Record<GaugeTick["color"], string> = {
  manual: "var(--gauge-manual)",
  unknown: "transparent",
  waiting: "var(--gauge-waiting)",
  approved: "var(--gauge-approved)",
  done: "var(--gauge-done)",
  closed: "var(--gauge-closed)",
  skipped: "var(--gauge-skipped)",
};

export function InterestGauge({
  gauge,
  compact,
  showSummary,
  className,
}: {
  gauge: InterestGauge;
  compact?: boolean;
  showSummary?: boolean;
  className?: string;
}) {
  if (gauge.count === 0) return null;
  const tickRowStyle = {
    "--gauge-tick-length": compact ? "0.5rem" : "0.875rem",
    "--gauge-tick-gap": compact ? "1px" : "0.125rem",
    "--gauge-tick-width": "calc((var(--gauge-tick-length) - var(--gauge-tick-gap)) / 2)",
    gap: "var(--gauge-tick-gap)",
  } as CSSProperties;
  return (
    <span className={cn("grid gap-1", className)}>
      <span
        className={cn("inline-flex items-center", compact ? "flex-nowrap" : "flex-wrap")}
        title={gauge.summary}
        aria-label={gauge.summary}
        style={tickRowStyle}
      >
        {gauge.ticks.map((tick, index) => (
          <span
            key={`${tick.kind}-${index}`}
            aria-hidden="true"
            className={cn(
              "box-border shrink-0 rounded-[1px]",
              tick.filled ? "border-0" : "border border-muted-foreground bg-transparent",
            )}
            style={{
              height: "var(--gauge-tick-length)",
              width: tick.kind === "attended" ? "var(--gauge-tick-length)" : "var(--gauge-tick-width)",
              ...(tick.filled ? { backgroundColor: colorVar[tick.color] } : {}),
            }}
          />
        ))}
      </span>
      {showSummary ? <span className="text-sm text-muted-foreground">{gauge.summary}</span> : null}
    </span>
  );
}
