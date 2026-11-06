import { eq } from "drizzle-orm";
import { conventions, editions } from "../db/schema";
import { compareCycleLabels } from "./cycles";
import type { TrackerDb } from "./db";
import { seedDriveMinutes } from "./driveTime";
import { editionInterest, isStatus, statusLabels, type Status } from "./status";

export const consSortKeys = ["interest", "distance", "time", "name"] as const;
export type ConsSortKey = (typeof consSortKeys)[number];

export type RepresentativeEdition = {
  id: number;
  cycleLabel: string;
  startDate: string | null;
  status: Status;
};

export type ConsTile = {
  conventionId: number;
  displayName: string;
  eventDate: string | null;
  status: Status | null;
  statusLabel: string | null;
  city: string | null;
  region: string | null;
  locationLabel: string | null;
  interest: number;
  colorScore: number;
  driveMinutes: number | null;
  startMonth: number | null;
  hasEditions: boolean;
};

export function parseConsSort(value: string | null | undefined): ConsSortKey {
  if (value && (consSortKeys as readonly string[]).includes(value)) return value as ConsSortKey;
  return "interest";
}

export function compareCycleLabelsForSort(a: string, b: string): number {
  return compareCycleLabels(a, b);
}

export function pickRepresentativeEdition<T extends { startDate: string | null; cycleLabel: string }>(
  editionRows: T[],
  today: string,
): T | null {
  if (editionRows.length === 0) return null;
  const upcoming = editionRows
    .filter((row) => row.startDate && row.startDate >= today)
    .sort(
      (a, b) =>
        (a.startDate ?? "").localeCompare(b.startDate ?? "") || compareCycleLabels(a.cycleLabel, b.cycleLabel),
    );
  if (upcoming[0]) return upcoming[0];

  const past = editionRows
    .filter((row) => row.startDate && row.startDate < today)
    .sort(
      (a, b) =>
        (b.startDate ?? "").localeCompare(a.startDate ?? "") || compareCycleLabels(a.cycleLabel, b.cycleLabel),
    );
  if (past[0]) return past[0];

  return [...editionRows].sort((a, b) => compareCycleLabels(b.cycleLabel, a.cycleLabel))[0] ?? null;
}

export function pickAttendanceValue<T extends { startDate: string | null; cycleLabel: string; attendance: number | null }>(
  editionRows: T[],
  today: string,
): number | null {
  const representative = pickRepresentativeEdition(editionRows, today);
  if (representative?.attendance != null) return representative.attendance;
  const withValues = editionRows.filter((row) => row.attendance != null);
  return pickRepresentativeEdition(withValues, today)?.attendance ?? null;
}

export function conventionInterest(
  manualInterest: number,
  editionRows: { status: string }[],
): number {
  return manualInterest + editionRows.reduce((sum, row) => sum + editionInterest(row.status), 0);
}

export function clampInterestForColor(score: number): number {
  return Math.min(5, Math.max(-5, score));
}

export function interestBackground(score: number): string {
  const clamped = clampInterestForColor(score);
  if (clamped === 0) return "var(--card)";
  if (clamped > 0) {
    const t = clamped / 5;
    return `color-mix(in oklch, var(--card) ${Math.round((1 - t) * 72)}%, oklch(0.86 0.14 145))`;
  }
  const t = -clamped / 5;
  return `color-mix(in oklch, var(--card) ${Math.round((1 - t) * 72)}%, oklch(0.86 0.14 25))`;
}

export function locationLabel(city: string | null, region: string | null): string | null {
  const parts = [city, region].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function startMonth(startDate: string | null): number | null {
  if (!startDate) return null;
  const month = Number(startDate.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

export function sortCons(tiles: ConsTile[], key: ConsSortKey): ConsTile[] {
  const name = (a: ConsTile, b: ConsTile) => a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" });
  const sorted = [...tiles];
  sorted.sort((a, b) => {
    if (key === "interest") {
      return b.interest - a.interest || name(a, b);
    }
    if (key === "distance") {
      if (a.driveMinutes == null && b.driveMinutes == null) return name(a, b);
      if (a.driveMinutes == null) return 1;
      if (b.driveMinutes == null) return -1;
      return a.driveMinutes - b.driveMinutes || name(a, b);
    }
    if (key === "time") {
      if (a.startMonth == null && b.startMonth == null) return name(a, b);
      if (a.startMonth == null) return 1;
      if (b.startMonth == null) return -1;
      return a.startMonth - b.startMonth || name(a, b);
    }
    return name(a, b);
  });
  return sorted;
}

export function listCons(db: TrackerDb, sort: ConsSortKey, today: string): ConsTile[] {
  const conventionRows = db.select().from(conventions).all();
  const editionRows = db.select().from(editions).all();
  const editionsByConvention = new Map<number, typeof editionRows>();
  for (const row of editionRows) {
    const list = editionsByConvention.get(row.conventionId) ?? [];
    list.push(row);
    editionsByConvention.set(row.conventionId, list);
  }

  const tiles: ConsTile[] = conventionRows.map((convention) => {
    const ownEditions = editionsByConvention.get(convention.id) ?? [];
    const representative = pickRepresentativeEdition(ownEditions, today);
    const status = representative && isStatus(representative.status) ? representative.status : null;
    const city = convention.defaultCity;
    const region = convention.defaultRegion;
    const interest = conventionInterest(convention.manualInterest, ownEditions);
    return {
      conventionId: convention.id,
      displayName: convention.displayName,
      eventDate: representative?.startDate ?? null,
      status,
      statusLabel: status ? statusLabels[status] : null,
      city,
      region,
      locationLabel: locationLabel(city, region),
      interest,
      colorScore: clampInterestForColor(interest),
      driveMinutes: convention.driveMinutes ?? seedDriveMinutes(city),
      startMonth: startMonth(representative?.startDate ?? null),
      hasEditions: ownEditions.length > 0,
    };
  });

  return sortCons(tiles, sort);
}

export function representativeForConvention(
  db: TrackerDb,
  conventionId: number,
  today: string,
): RepresentativeEdition | null {
  const rows = db.select().from(editions).where(eq(editions.conventionId, conventionId)).all();
  const picked = pickRepresentativeEdition(rows, today);
  if (!picked || !isStatus(picked.status)) return null;
  return {
    id: picked.id,
    cycleLabel: picked.cycleLabel,
    startDate: picked.startDate,
    status: picked.status,
  };
}
