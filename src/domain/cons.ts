import { eq } from "drizzle-orm";
import { conventions, editions } from "../db/schema";
import { compareCycleLabels } from "./cycles";
import type { TrackerDb } from "./db";
import { locationLabel } from "./location";
import { editionInterest, isStatus, statusLabels, type Status } from "./status";

export { locationLabel };

export const consSortKeys = ["name", "interest", "time", "state"] as const;
export type ConsSortKey = (typeof consSortKeys)[number];

export type RepresentativeEdition = {
  id: number;
  cycleLabel: string;
  startDate: string | null;
  status: Status;
};

export const gaugeKindOrder = [
  "manual",
  "unknown",
  "waiting_to_apply",
  "open",
  "submitted",
  "waitlisted",
  "approved",
  "attended",
  "withdrawn",
  "rejected",
  "skipped",
] as const;

export type GaugeKind = (typeof gaugeKindOrder)[number];

export type GaugeColor =
  | "manual"
  | "unknown"
  | "waiting"
  | "approved"
  | "done"
  | "closed"
  | "skipped";

export type GaugeSegment = {
  kind: GaugeKind;
  count: number;
  filled: boolean;
  color: GaugeColor;
  label: string;
};

export type GaugeTick = {
  kind: GaugeKind;
  filled: boolean;
  color: GaugeColor;
};

export type InterestGauge = {
  segments: GaugeSegment[];
  ticks: GaugeTick[];
  summary: string;
  count: number;
  sortCount: number;
};

export const emptyInterestGauge: InterestGauge = {
  segments: [],
  ticks: [],
  summary: "",
  count: 0,
  sortCount: 0,
};

const gaugeLabels: Record<GaugeKind, string> = {
  manual: "interest",
  unknown: "unknown",
  waiting_to_apply: "waiting",
  open: "ready",
  submitted: "submitted",
  waitlisted: "waitlisted",
  approved: "approved",
  attended: "attended",
  withdrawn: "withdrawn",
  rejected: "rejected",
  skipped: "skipped",
};

export type ConsTile = {
  conventionId: number;
  displayName: string;
  website: string | null;
  eventDate: string | null;
  status: Status | null;
  statusLabel: string | null;
  city: string | null;
  region: string | null;
  locationLabel: string | null;
  gauge: InterestGauge;
  startMonth: number | null;
  hasEditions: boolean;
};

export function parseConsSort(value: string | null | undefined): ConsSortKey {
  if (value && (consSortKeys as readonly string[]).includes(value)) return value as ConsSortKey;
  return "name";
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

function gaugeColor(kind: GaugeKind): GaugeColor {
  switch (kind) {
    case "manual":
      return "manual";
    case "unknown":
      return "unknown";
    case "waiting_to_apply":
    case "open":
    case "submitted":
    case "waitlisted":
      return "waiting";
    case "approved":
      return "approved";
    case "attended":
    case "withdrawn":
      return "done";
    case "rejected":
      return "closed";
    case "skipped":
      return "skipped";
  }
}

function gaugeFilled(kind: GaugeKind): boolean {
  return kind !== "unknown";
}

function buildInterestGauge(counts: Map<GaugeKind, number>): InterestGauge {
  const segments: GaugeSegment[] = [];
  const ticks: GaugeTick[] = [];
  for (const kind of gaugeKindOrder) {
    const count = counts.get(kind) ?? 0;
    if (count <= 0) continue;
    const filled = gaugeFilled(kind);
    const color = gaugeColor(kind);
    segments.push({ kind, count, filled, color, label: gaugeLabels[kind] });
    for (let index = 0; index < count; index++) {
      ticks.push({ kind, filled, color });
    }
  }
  if (ticks.length === 0) return emptyInterestGauge;
  return {
    segments,
    ticks,
    summary: segments.map((segment) => `${segment.count} ${segment.label}`).join(", "),
    count: ticks.length,
    sortCount: ticks.reduce((sum, tick) => sum + (tick.kind === "attended" ? 2 : 1), 0),
  };
}

export function interestGauge(
  manualInterest: number,
  editionRows: { status: string }[],
): InterestGauge {
  const counts = new Map<GaugeKind, number>();
  const manualTicks = Math.max(0, Math.trunc(manualInterest));
  if (manualTicks > 0) counts.set("manual", manualTicks);
  for (const row of editionRows) {
    if (!isStatus(row.status)) continue;
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  return buildInterestGauge(counts);
}

export function shiftInterestGauge(gauge: InterestGauge, from: Status, to: Status): InterestGauge {
  const counts = new Map<GaugeKind, number>();
  for (const segment of gauge.segments) {
    counts.set(segment.kind, segment.count);
  }
  counts.set(from, (counts.get(from) ?? 0) - 1);
  counts.set(to, (counts.get(to) ?? 0) + 1);
  return buildInterestGauge(counts);
}

export function startMonth(startDate: string | null): number | null {
  if (!startDate) return null;
  const month = Number(startDate.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

function regionSortKey(region: string | null): string | null {
  const trimmed = region?.trim();
  return trimmed ? trimmed : null;
}

export function sortCons(tiles: ConsTile[], key: ConsSortKey): ConsTile[] {
  const name = (a: ConsTile, b: ConsTile) => a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" });
  const sorted = [...tiles];
  sorted.sort((a, b) => {
    if (key === "interest") {
      return b.gauge.sortCount - a.gauge.sortCount || name(a, b);
    }
    if (key === "state") {
      const aRegion = regionSortKey(a.region);
      const bRegion = regionSortKey(b.region);
      if (aRegion == null && bRegion == null) return name(a, b);
      if (aRegion == null) return 1;
      if (bRegion == null) return -1;
      return aRegion.localeCompare(bRegion, "en", { sensitivity: "base" }) || name(a, b);
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
    return {
      conventionId: convention.id,
      displayName: convention.displayName,
      website: convention.website,
      eventDate: representative?.startDate ?? null,
      status,
      statusLabel: status ? statusLabels[status] : null,
      city,
      region,
      locationLabel: locationLabel(city, region),
      gauge: interestGauge(convention.manualInterest, ownEditions),
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
