import { conventions, editions } from "../db/schema";
import { interestGauge, type InterestGauge } from "./cons";
import { compareCycleLabels } from "./cycles";
import type { TrackerDb } from "./db";
import { isStatus, type Status } from "./status";

export const scheduleKinds = ["application_start", "event_start"] as const;
export type ScheduleKind = (typeof scheduleKinds)[number];

export const scheduleKindLabels: Record<ScheduleKind, string> = {
  application_start: "Application opens",
  event_start: "Starts",
};

export const scheduleAttentions = ["apply", "travel"] as const;
export type ScheduleAttention = (typeof scheduleAttentions)[number];

export type ScheduleMarker = {
  date: string;
  kind: ScheduleKind;
  kindLabel: string;
  conventionId: number;
  conventionName: string;
  cycleLabel: string;
  editionId: number;
  status: Status;
  gauge: InterestGauge;
};

export type ScheduleEditionRow = {
  id: number;
  cycleLabel: string;
  status: string;
  applicationStartDate: string | null;
  startDate: string | null;
};

export type ScheduleConventionRow = {
  id: number;
  displayName: string;
  manualInterest: number;
  editions: ScheduleEditionRow[];
};

const excludedStatuses = new Set(["skipped", "withdrawn"]);

function kindRank(kind: ScheduleKind): number {
  return kind === "application_start" ? 0 : 1;
}

export function markerAttention(kind: ScheduleKind, status: Status): ScheduleAttention | null {
  if (kind === "application_start" && (status === "waiting_to_apply" || status === "open")) {
    return "apply";
  }
  if (kind === "event_start" && status === "approved") return "travel";
  return null;
}

export function cellAttentions(
  markers: Pick<ScheduleMarker, "kind" | "status">[],
): ScheduleAttention[] {
  const seen = new Set<ScheduleAttention>();
  for (const marker of markers) {
    const attention = markerAttention(marker.kind, marker.status);
    if (attention) seen.add(attention);
  }
  return scheduleAttentions.filter((attention) => seen.has(attention));
}

export function joinDisplayNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

type AttentionTitleMarker = Pick<ScheduleMarker, "kind" | "status" | "conventionName" | "cycleLabel">;

function markerDisplayName(marker: AttentionTitleMarker): string {
  return `${marker.conventionName} ${marker.cycleLabel}`;
}

export function attentionNames(
  markers: AttentionTitleMarker[],
  attention: ScheduleAttention,
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const marker of markers) {
    if (markerAttention(marker.kind, marker.status) !== attention) continue;
    const name = markerDisplayName(marker);
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function cellAttentionTitle(markers: AttentionTitleMarker[]): string | null {
  const parts: string[] = [];
  for (const attention of scheduleAttentions) {
    const names = joinDisplayNames(attentionNames(markers, attention));
    if (!names) continue;
    if (attention === "apply") parts.push(`Remember to apply for ${names}!`);
    else parts.push(`Remember to vend at ${names}!`);
  }
  return parts.length === 0 ? null : parts.join(" ");
}

function compareMarkers(a: ScheduleMarker, b: ScheduleMarker): number {
  return (
    a.date.localeCompare(b.date) ||
    a.conventionName.localeCompare(b.conventionName) ||
    compareCycleLabels(a.cycleLabel, b.cycleLabel) ||
    kindRank(a.kind) - kindRank(b.kind)
  );
}

function pushIfPresent(
  markers: ScheduleMarker[],
  date: string | null,
  kind: ScheduleKind,
  base: Omit<ScheduleMarker, "date" | "kind" | "kindLabel">,
): void {
  if (!date) return;
  markers.push({
    ...base,
    date,
    kind,
    kindLabel: scheduleKindLabels[kind],
  });
}

export function scheduleMarkersFromRows(rows: ScheduleConventionRow[]): ScheduleMarker[] {
  const markers: ScheduleMarker[] = [];
  for (const convention of rows) {
    const gauge = interestGauge(convention.manualInterest, convention.editions);

    for (const edition of convention.editions) {
      if (!isStatus(edition.status) || excludedStatuses.has(edition.status)) continue;
      const base = {
        conventionId: convention.id,
        conventionName: convention.displayName,
        cycleLabel: edition.cycleLabel,
        editionId: edition.id,
        status: edition.status,
        gauge,
      };
      pushIfPresent(markers, edition.applicationStartDate, "application_start", base);
      pushIfPresent(markers, edition.startDate, "event_start", base);
    }
  }
  return markers.sort(compareMarkers);
}

export function listScheduleMarkers(db: TrackerDb): ScheduleMarker[] {
  const conventionRows = db
    .select({
      id: conventions.id,
      displayName: conventions.displayName,
      manualInterest: conventions.manualInterest,
    })
    .from(conventions)
    .all();

  const editionRows = db
    .select({
      id: editions.id,
      conventionId: editions.conventionId,
      cycleLabel: editions.cycleLabel,
      status: editions.status,
      applicationStartDate: editions.applicationStartDate,
      startDate: editions.startDate,
    })
    .from(editions)
    .all();

  const byConvention = new Map<number, ScheduleEditionRow[]>();
  for (const row of editionRows) {
    const list = byConvention.get(row.conventionId) ?? [];
    list.push({
      id: row.id,
      cycleLabel: row.cycleLabel,
      status: row.status,
      applicationStartDate: row.applicationStartDate,
      startDate: row.startDate,
    });
    byConvention.set(row.conventionId, list);
  }

  return scheduleMarkersFromRows(
    conventionRows.map((convention) => ({
      id: convention.id,
      displayName: convention.displayName,
      manualInterest: convention.manualInterest,
      editions: byConvention.get(convention.id) ?? [],
    })),
  );
}

export function markersForMonth(
  markers: ScheduleMarker[],
  yearMonth: string,
): Map<string, ScheduleMarker[]> {
  const prefix = `${yearMonth}-`;
  const grouped = new Map<string, ScheduleMarker[]>();
  for (const marker of markers) {
    if (!marker.date.startsWith(prefix)) continue;
    const list = grouped.get(marker.date) ?? [];
    list.push(marker);
    grouped.set(marker.date, list);
  }
  return grouped;
}

export function parseYear(value: string | null | undefined, today: string): string {
  if (value && /^\d{4}$/.test(value)) return value;
  return today.slice(0, 4);
}

export function shiftYear(year: string, delta: number): string {
  return String(Number(year) + delta).padStart(4, "0");
}

export function canShiftYear(
  markers: Pick<ScheduleMarker, "date">[],
  year: string,
  delta: -1 | 1,
): boolean {
  if (delta < 0) return markers.some((marker) => marker.date.slice(0, 4) < year);
  return markers.some((marker) => marker.date.slice(0, 4) > year);
}

export function formatYearLabel(year: string): string {
  return year;
}

export function yearMonths(year: string): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function formatMonthLabel(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function parseYearMonth(value: string | null | undefined, today: string): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const month = Number(value.slice(5, 7));
    if (month >= 1 && month <= 12) return value;
  }
  return today.slice(0, 7);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;
}

export function daysInMonth(yearMonth: string): number {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Sunday = 0 … Saturday = 6 for the first day of the month. */
export function firstWeekdaySunday(yearMonth: string): number {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export type MonthCell = {
  date: string | null;
  day: number | null;
};

export function buildMonthCells(yearMonth: string): MonthCell[] {
  const days = daysInMonth(yearMonth);
  const leading = firstWeekdaySunday(yearMonth);
  const cells: MonthCell[] = [];
  for (let i = 0; i < leading; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= days; day++) {
    cells.push({
      date: `${yearMonth}-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

export function isMonthEntirelyBefore(yearMonth: string, today: string): boolean {
  const lastDay = `${yearMonth}-${String(daysInMonth(yearMonth)).padStart(2, "0")}`;
  return lastDay < today;
}

export function formatYearMonthLabel(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
