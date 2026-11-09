export function GoogleCalendarMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 16 16"
      width="12"
      height="12"
    >
      <rect width="16" height="16" rx="3" fill="currentColor" opacity="0.12" />
      <text
        x="8"
        y="12"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
      >
        G
      </text>
    </svg>
  );
}
