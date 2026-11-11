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
  return (
    <span className={cn("grid gap-1", className)}>
      <span
        className={cn("inline-flex items-center", compact ? "flex-nowrap gap-px" : "flex-wrap gap-0.5")}
        title={gauge.summary}
        aria-label={gauge.summary}
      >
        {gauge.ticks.map((tick, index) => (
          <span
            key={`${tick.kind}-${index}`}
            aria-hidden="true"
            className={cn(
              "box-border shrink-0 rounded-[1px]",
              compact ? "h-2 w-[3px]" : "h-3.5 w-1.5",
              tick.filled ? "border-0" : "border border-muted-foreground bg-transparent",
            )}
            style={tick.filled ? { backgroundColor: colorVar[tick.color] } : undefined}
          />
        ))}
      </span>
      {showSummary ? <span className="text-sm text-muted-foreground">{gauge.summary}</span> : null}
    </span>
  );
}
