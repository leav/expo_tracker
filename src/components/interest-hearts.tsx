import { cn } from "cn";

export function InterestHearts({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  if (score === 0) return null;
  const glyph = score > 0 ? "❤️" : "💔";
  return (
    <span className={cn("inline-flex flex-wrap items-center", className)} aria-label={`interest ${score}`}>
      {Array.from({ length: Math.abs(score) }, (_, index) => (
        <span key={index} aria-hidden="true">
          {glyph}
        </span>
      ))}
    </span>
  );
}
