import { compareCycleLabels } from "./cycles";
import { locationLabel } from "./location";
import { isLineupStatus, lineupStatuses, statusLabels, type LineupStatus, type Status } from "./status";

export type LineupDateKind = "application_start" | "application_end" | "result" | "event_start";

export type LineupDescriptor = {
  actionDate: string | null;
  dateKind: LineupDateKind;
  estimated: boolean;
};

export type LineupSource = {
  editionId: number;
  conventionId: number;
  conventionName: string;
  cycleLabel: string;
  status: Status;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  resultDate: string | null;
  startDate: string | null;
  city: string | null;
  region: string | null;
  interest: number;
};

export type LineupItem = {
  editionId: number;
  conventionId: number;
  conventionName: string;
  cycleLabel: string;
  status: LineupStatus;
  statusLabel: string;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  resultDate: string | null;
  startDate: string | null;
  actionDate: string | null;
  dateKind: LineupDateKind;
  dateLabel: string;
  relativeLabel: string | null;
  estimated: boolean;
  city: string | null;
  region: string | null;
  locationLabel: string | null;
  interest: number;
};

export type LineupColumn = {
  status: LineupStatus;
  label: string;
  items: LineupItem[];
};

export type LineupBoard = {
  columns: LineupColumn[];
  total: number;
};

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function calendarDayDelta(date: string, today: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const then = Date.UTC(year, month - 1, day);
  const now = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((then - now) / 86_400_000);
}

export function formatLineupDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

export function relativeDayLabel(date: string, today: string): string {
  const delta = calendarDayDelta(date, today);
  if (delta === 0) return "today";
  if (delta === 1) return "in 1 day";
  if (delta > 1) return `in ${delta} days`;
  if (delta === -1) return "1 day ago";
  return `${-delta} days ago`;
}

export function lineupDescriptor(input: {
  status: Status;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  resultDate: string | null;
  startDate: string | null;
}): LineupDescriptor | null {
  switch (input.status) {
    case "waiting_to_apply":
      return { actionDate: input.applicationStartDate, dateKind: "application_start", estimated: false };
    case "open":
      if (input.applicationEndDate) {
        return { actionDate: input.applicationEndDate, dateKind: "application_end", estimated: false };
      }
      if (input.applicationStartDate) {
        return {
          actionDate: addCalendarDays(input.applicationStartDate, 7),
          dateKind: "application_end",
          estimated: true,
        };
      }
      return { actionDate: null, dateKind: "application_end", estimated: false };
    case "submitted":
      return { actionDate: input.resultDate, dateKind: "result", estimated: false };
    case "waitlisted":
    case "approved":
      return { actionDate: input.startDate, dateKind: "event_start", estimated: false };
    default:
      return null;
  }
}

export function lineupDateLabel(descriptor: LineupDescriptor): string {
  if (!descriptor.actionDate) return "Date not set";
  const formatted = formatLineupDate(descriptor.actionDate);
  switch (descriptor.dateKind) {
    case "application_start":
      return `Applications open ${formatted}`;
    case "application_end":
      return descriptor.estimated ? `Estimated close ${formatted}` : `Apply by ${formatted}`;
    case "result":
      return `Results expected ${formatted}`;
    case "event_start":
      return `Event starts ${formatted}`;
  }
}

export function presentLineupItem(source: LineupSource, today: string): LineupItem | null {
  if (!isLineupStatus(source.status)) return null;
  const descriptor = lineupDescriptor(source);
  if (!descriptor) return null;
  return {
    editionId: source.editionId,
    conventionId: source.conventionId,
    conventionName: source.conventionName,
    cycleLabel: source.cycleLabel,
    status: source.status,
    statusLabel: statusLabels[source.status],
    applicationStartDate: source.applicationStartDate,
    applicationEndDate: source.applicationEndDate,
    resultDate: source.resultDate,
    startDate: source.startDate,
    actionDate: descriptor.actionDate,
    dateKind: descriptor.dateKind,
    dateLabel: lineupDateLabel(descriptor),
    relativeLabel: descriptor.actionDate ? relativeDayLabel(descriptor.actionDate, today) : null,
    estimated: descriptor.estimated,
    city: source.city,
    region: source.region,
    locationLabel: locationLabel(source.city, source.region),
    interest: source.interest,
  };
}

export function compareLineupItems(a: LineupItem, b: LineupItem): number {
  if (a.actionDate == null && b.actionDate != null) return -1;
  if (a.actionDate != null && b.actionDate == null) return 1;
  return (
    (a.actionDate ?? "").localeCompare(b.actionDate ?? "") ||
    a.conventionName.localeCompare(b.conventionName) ||
    compareCycleLabels(a.cycleLabel, b.cycleLabel)
  );
}

export function groupLineups(items: LineupItem[]): LineupColumn[] {
  return lineupStatuses.map((status) => ({
    status,
    label: statusLabels[status],
    items: items.filter((item) => item.status === status).sort(compareLineupItems),
  }));
}

export function canMoveLineupStatus(from: Status, to: Status): boolean {
  if (from === to) return false;
  if (!isLineupStatus(from)) return false;
  if (isLineupStatus(to)) return true;
  return from === "approved" && (to === "attended" || to === "withdrawn");
}

export function applyLineupMove(board: LineupBoard, editionId: number, toStatus: Status, today: string): LineupBoard {
  const items = board.columns.flatMap((column) => column.items);
  const current = items.find((item) => item.editionId === editionId);
  if (!current || !canMoveLineupStatus(current.status, toStatus)) return board;
  const remaining = items.filter((item) => item.editionId !== editionId);
  if (!isLineupStatus(toStatus)) {
    return { columns: groupLineups(remaining), total: remaining.length };
  }
  const next = presentLineupItem({ ...current, status: toStatus }, today);
  if (!next) return board;
  const nextItems = [...remaining, next];
  return { columns: groupLineups(nextItems), total: nextItems.length };
}
