import { inArray } from "drizzle-orm";
import { conventions, editions } from "../db/schema";
import type { TrackerDb } from "./db";

const MOCK_CONVENTION_NAME = /^(?:\[mock\]|mock\s*[:\-]|mock\s+)/i;
const MOCK_CYCLE_LABEL = /^(?:\[mock\]|mock(?:[\s:_-]|$))/i;

export function isMockConventionName(displayName: string): boolean {
  return MOCK_CONVENTION_NAME.test(displayName.trim());
}

export function isMockCycleLabel(cycleLabel: string): boolean {
  return MOCK_CYCLE_LABEL.test(cycleLabel.trim());
}

export type MockCleanupSummary = {
  deletedConventions: { id: number; displayName: string }[];
  deletedEditions: { id: number; conventionId: number; cycleLabel: string }[];
};

export function cleanMockData(db: TrackerDb): MockCleanupSummary {
  const allConventions = db
    .select({ id: conventions.id, displayName: conventions.displayName })
    .from(conventions)
    .all();
  const deletedConventions = allConventions.filter((row) => isMockConventionName(row.displayName));
  const mockConventionIds = new Set(deletedConventions.map((row) => row.id));

  if (deletedConventions.length > 0) {
    db.delete(conventions)
      .where(
        inArray(
          conventions.id,
          deletedConventions.map((row) => row.id),
        ),
      )
      .run();
  }

  const remainingEditions = db
    .select({
      id: editions.id,
      conventionId: editions.conventionId,
      cycleLabel: editions.cycleLabel,
    })
    .from(editions)
    .all();
  const deletedEditions = remainingEditions.filter(
    (row) => !mockConventionIds.has(row.conventionId) && isMockCycleLabel(row.cycleLabel),
  );

  if (deletedEditions.length > 0) {
    db.delete(editions)
      .where(
        inArray(
          editions.id,
          deletedEditions.map((row) => row.id),
        ),
      )
      .run();
  }

  return { deletedConventions, deletedEditions };
}
