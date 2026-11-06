import { eq } from "drizzle-orm";
import { conventions, editions } from "../db/schema";
import { conventionInterest } from "./cons";
import type { DomainResult, TrackerDb } from "./db";
import {
  canMoveLineupStatus,
  groupLineups,
  presentLineupItem,
  type LineupBoard,
  type LineupItem,
} from "./lineupBoard";
import { isLineupStatus, isStatus, type Status } from "./status";

export {
  addCalendarDays,
  addCalendarMonths,
  applyLineupMove,
  canMoveLineupStatus,
  compareLineupItems,
  formatLineupDate,
  groupLineups,
  lineupDateLabel,
  lineupDescriptor,
  presentLineupItem,
  relativeDayLabel,
  type LineupBoard,
  type LineupColumn,
  type LineupDescriptor,
  type LineupItem,
  type LineupSource,
} from "./lineupBoard";
export { fillEditionDates, type EditionDateFields } from "./editionDates";

export function listLineups(db: TrackerDb, today: string): LineupBoard {
  const conventionRows = db.select().from(conventions).all();
  const editionRows = db.select().from(editions).all();
  const editionsByConvention = new Map<number, typeof editionRows>();
  for (const row of editionRows) {
    const list = editionsByConvention.get(row.conventionId) ?? [];
    list.push(row);
    editionsByConvention.set(row.conventionId, list);
  }
  const conventionById = new Map(conventionRows.map((row) => [row.id, row]));

  const items: LineupItem[] = [];
  for (const row of editionRows) {
    if (!isStatus(row.status) || !isLineupStatus(row.status)) continue;
    const convention = conventionById.get(row.conventionId);
    if (!convention) continue;
    const presented = presentLineupItem(
      {
        editionId: row.id,
        conventionId: row.conventionId,
        conventionName: convention.displayName,
        cycleLabel: row.cycleLabel,
        status: row.status,
        applicationStartDate: row.applicationStartDate,
        applicationEndDate: row.applicationEndDate,
        resultDate: row.resultDate,
        startDate: row.startDate,
        city: convention.defaultCity,
        region: convention.defaultRegion,
        interest: conventionInterest(convention.manualInterest, editionsByConvention.get(row.conventionId) ?? []),
      },
      today,
    );
    if (presented) items.push(presented);
  }

  const columns = groupLineups(items);
  return { columns, total: items.length };
}

export function moveLineupEdition(
  db: TrackerDb,
  editionId: number,
  toStatus: Status,
): DomainResult<{ id: number; conventionId: number; status: Status }> {
  const current = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!current) return { ok: false, error: "That edition is gone." };
  if (!isStatus(current.status) || !isLineupStatus(current.status)) {
    return { ok: false, error: "Only Lineups editions can be moved on this board." };
  }
  if (current.status === toStatus) {
    return { ok: true, value: { id: current.id, conventionId: current.conventionId, status: current.status } };
  }
  if (!canMoveLineupStatus(current.status, toStatus)) {
    if (toStatus === "attended" || toStatus === "withdrawn") {
      return { ok: false, error: "Attended and Withdrawn are only for Approved editions." };
    }
    return { ok: false, error: "Drop that edition on a Lineups column." };
  }

  db.update(editions).set({ status: toStatus }).where(eq(editions.id, editionId)).run();
  return { ok: true, value: { id: current.id, conventionId: current.conventionId, status: toStatus } };
}
