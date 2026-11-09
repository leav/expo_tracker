import { conventions, editions } from "../db/schema";
import { deleteConvention } from "./conventions";
import type { TrackerDb } from "./db";
import { deleteEdition } from "./editions";

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

  for (const row of deletedConventions) {
    deleteConvention(db, row.id);
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

  for (const row of deletedEditions) {
    deleteEdition(db, row.id);
  }

  return { deletedConventions, deletedEditions };
}
