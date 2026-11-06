import { eq } from "drizzle-orm";
import { conventions, editions } from "../db/schema";
import { compareCycleLabels } from "./cycles";
import type { TrackerDb } from "./db";
import { isLineupStatus, isStatus, statusLabels, type Status } from "./status";

export type LineupItem = {
  editionId: number;
  conventionId: number;
  conventionName: string;
  cycleLabel: string;
  status: Status;
  statusLabel: string;
  actionDate: string | null;
  city: string | null;
};

export function lineupsActionDate(input: {
  status: Status;
  applicationStartDate: string | null;
  resultDate: string | null;
  startDate: string | null;
}): string | null {
  switch (input.status) {
    case "waiting_to_apply":
    case "open":
      return input.applicationStartDate;
    case "submitted":
    case "waitlisted":
      return input.resultDate ?? input.startDate;
    case "approved":
      return input.startDate;
    default:
      return null;
  }
}

export function partitionLineups(items: LineupItem[]): { dated: LineupItem[]; needsDates: LineupItem[] } {
  const dated = items
    .filter((item) => item.actionDate)
    .sort(
      (a, b) =>
        (a.actionDate ?? "").localeCompare(b.actionDate ?? "") ||
        a.conventionName.localeCompare(b.conventionName) ||
        compareCycleLabels(a.cycleLabel, b.cycleLabel),
    );
  const needsDates = items
    .filter((item) => !item.actionDate)
    .sort(
      (a, b) => a.conventionName.localeCompare(b.conventionName) || compareCycleLabels(a.cycleLabel, b.cycleLabel),
    );
  return { dated, needsDates };
}

export function listLineups(db: TrackerDb): { dated: LineupItem[]; needsDates: LineupItem[] } {
  const rows = db
    .select({
      editionId: editions.id,
      conventionId: editions.conventionId,
      conventionName: conventions.displayName,
      cycleLabel: editions.cycleLabel,
      status: editions.status,
      applicationStartDate: editions.applicationStartDate,
      resultDate: editions.resultDate,
      startDate: editions.startDate,
      defaultCity: conventions.defaultCity,
    })
    .from(editions)
    .innerJoin(conventions, eq(editions.conventionId, conventions.id))
    .all();

  const items: LineupItem[] = [];
  for (const row of rows) {
    if (!isStatus(row.status) || !isLineupStatus(row.status)) continue;
    items.push({
      editionId: row.editionId,
      conventionId: row.conventionId,
      conventionName: row.conventionName,
      cycleLabel: row.cycleLabel,
      status: row.status,
      statusLabel: statusLabels[row.status],
      actionDate: lineupsActionDate(row),
      city: row.defaultCity,
    });
  }
  return partitionLineups(items);
}
