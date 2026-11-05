export const intents = ["tracking", "applying", "skip"] as const;
export const statuses = [
  "unknown",
  "not_open",
  "open",
  "submitted",
  "waitlisted",
  "accepted",
  "attended",
  "rejected",
  "withdrawn",
  "passed",
] as const;

export type Intent = (typeof intents)[number];
export type Status = (typeof statuses)[number];

export const boardColumns = [
  "Tracking",
  "Applied",
  "Waitlist",
  "Accepted",
  "Attended",
  "Rejected",
  "Pass",
] as const;

export type BoardColumn = (typeof boardColumns)[number];

const trackingStatuses = new Set<Status>(["unknown", "not_open", "open"]);
const applyingStatuses = new Set<Status>([
  "submitted",
  "waitlisted",
  "accepted",
  "attended",
  "rejected",
  "withdrawn",
]);

export function isIntent(value: string): value is Intent {
  return (intents as readonly string[]).includes(value);
}

export function isStatus(value: string): value is Status {
  return (statuses as readonly string[]).includes(value);
}

export function resolveEditionState(intent: Intent, status: Status): {
  intent: Intent;
  status: Status;
} {
  if (status === "passed" || intent === "skip") {
    return { intent: "skip", status: "passed" };
  }
  if (trackingStatuses.has(status)) {
    return { intent: "tracking", status };
  }
  if (applyingStatuses.has(status)) {
    return { intent: "applying", status };
  }
  return { intent, status };
}

export function boardPlacement(
  intent: Intent,
  status: Status,
): { column: BoardColumn | null; openBadge: boolean } {
  const resolved = resolveEditionState(intent, status);
  if (resolved.status === "withdrawn") return { column: null, openBadge: false };
  if (resolved.status === "passed") return { column: "Pass", openBadge: false };
  if (resolved.status === "unknown" && resolved.intent !== "tracking") {
    return { column: null, openBadge: false };
  }
  switch (resolved.status) {
    case "unknown":
    case "not_open":
      return { column: "Tracking", openBadge: false };
    case "open":
      return { column: "Tracking", openBadge: true };
    case "submitted":
      return { column: "Applied", openBadge: false };
    case "waitlisted":
      return { column: "Waitlist", openBadge: false };
    case "accepted":
      return { column: "Accepted", openBadge: false };
    case "attended":
      return { column: "Attended", openBadge: false };
    case "rejected":
      return { column: "Rejected", openBadge: false };
    default:
      return { column: null, openBadge: false };
  }
}

export function initialStatus(applicationStartDate: string | null, today: string): Status {
  if (applicationStartDate && applicationStartDate > today) return "not_open";
  return "unknown";
}

export function todayInLosAngeles(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
