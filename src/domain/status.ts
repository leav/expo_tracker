export const statuses = [
  "unknown",
  "waiting_to_apply",
  "open",
  "submitted",
  "waitlisted",
  "approved",
  "attended",
  "rejected",
  "withdrawn",
  "passed",
] as const;

export type Status = (typeof statuses)[number];

export const statusLabels: Record<Status, string> = {
  unknown: "Unknown",
  waiting_to_apply: "Waiting to apply",
  open: "Ready to apply",
  submitted: "Submitted",
  waitlisted: "Waitlisted",
  approved: "Approved",
  attended: "Attended",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  passed: "Passed",
};

export const lineupStatuses = [
  "waiting_to_apply",
  "open",
  "submitted",
  "waitlisted",
  "approved",
] as const satisfies readonly Status[];

const lineupStatusSet = new Set<Status>(lineupStatuses);
const paidStatusSet = new Set<Status>(["approved", "attended"]);
const decisionStatusSet = new Set<Status>([
  "submitted",
  "waitlisted",
  "approved",
  "attended",
  "rejected",
]);

export function isStatus(value: string): value is Status {
  return (statuses as readonly string[]).includes(value);
}

export function isLineupStatus(status: Status): boolean {
  return lineupStatusSet.has(status);
}

export function isPaidStatus(status: Status): boolean {
  return paidStatusSet.has(status);
}

export function isDecisionStatus(status: Status): boolean {
  return decisionStatusSet.has(status);
}

export function normalizeLegacyStatus(value: string | null | undefined): Status | null {
  if (!value) return null;
  if (value === "accepted") return "approved";
  if (value === "not_open") return "waiting_to_apply";
  return isStatus(value) ? value : null;
}

export function initialStatus(applicationStartDate: string | null, today: string): Status {
  if (applicationStartDate && applicationStartDate > today) return "waiting_to_apply";
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
