import { asc, eq } from "drizzle-orm";
import { aliases, conventions, editions } from "../db/schema";
import { interestGauge } from "./cons";
import { compareCycleLabels } from "./cycles";
import type { DomainResult, TrackerDb } from "./db";
import { blankToNull, isError, parseDate } from "./fields";
import {
  initialStatus,
  isPaidStatus,
  isStatus,
  todayInLosAngeles,
  type Status,
} from "./status";
import { fillStatusDates } from "./statusDates";

export type EditionInput = {
  conventionId: number;
  cycleLabel: string;
  startDate: string | null;
  endDate: string | null;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  status: Status;
  submittedAt: string | null;
  resultDate: string | null;
  paid: boolean;
  notes: string | null;
  sheetRowKey?: string | null;
  inferInitialStatus?: boolean;
};

export function editionInputFromForm(form: FormData, conventionId: number): EditionInput | { error: string } {
  const cycleLabel = blankToNull(form.get("cycleLabel"));
  if (!cycleLabel) return { error: "An edition needs a cycle, such as 2027." };

  const startDate = parseDate(blankToNull(form.get("startDate")), "Event start");
  if (isError(startDate)) return startDate;
  const endDate = parseDate(blankToNull(form.get("endDate")), "Event end");
  if (isError(endDate)) return endDate;
  const applicationStartDate = parseDate(blankToNull(form.get("applicationStartDate")), "Application start");
  if (isError(applicationStartDate)) return applicationStartDate;
  const applicationEndDate = parseDate(blankToNull(form.get("applicationEndDate")), "Application end");
  if (isError(applicationEndDate)) return applicationEndDate;
  const submittedAt = parseDate(blankToNull(form.get("submittedAt")), "Submitted");
  if (isError(submittedAt)) return submittedAt;
  const resultDate = parseDate(blankToNull(form.get("resultDate")), "Result");
  if (isError(resultDate)) return resultDate;

  const statusValue = blankToNull(form.get("status")) ?? "unknown";
  if (!isStatus(statusValue)) {
    return { error: "Choose a status from the list." };
  }

  return {
    conventionId,
    cycleLabel,
    startDate,
    endDate,
    applicationStartDate,
    applicationEndDate,
    status: statusValue,
    submittedAt,
    resultDate,
    paid: form.get("paid") === "on",
    notes: blankToNull(form.get("notes")),
  };
}

export function createEdition(db: TrackerDb, input: EditionInput): DomainResult<{ id: number }> {
  const convention = db.select().from(conventions).where(eq(conventions.id, input.conventionId)).get();
  if (!convention) return { ok: false, error: "That convention is gone." };

  const duplicate = db
    .select({ cycleLabel: editions.cycleLabel })
    .from(editions)
    .where(eq(editions.conventionId, input.conventionId))
    .all()
    .some((row) => row.cycleLabel === input.cycleLabel);
  if (duplicate) return { ok: false, error: `Cycle ${input.cycleLabel} is already on this convention.` };

  const status =
    input.inferInitialStatus === false
      ? input.status
      : input.status === "unknown"
        ? initialStatus(input.applicationStartDate, todayInLosAngeles())
        : input.status;

  const inserted = db
    .insert(editions)
    .values({
      conventionId: input.conventionId,
      cycleLabel: input.cycleLabel,
      startDate: input.startDate,
      endDate: input.endDate,
      applicationStartDate: input.applicationStartDate,
      applicationEndDate: input.applicationEndDate,
      submittedAt: input.submittedAt,
      resultDate: input.resultDate,
      notes: input.notes,
      status,
      paid: isPaidStatus(status) ? input.paid : false,
      sheetRowKey: input.sheetRowKey ?? null,
    })
    .returning({ id: editions.id })
    .get();
  return { ok: true, value: { id: inserted.id } };
}

export function updateEdition(
  db: TrackerDb,
  editionId: number,
  input: EditionInput,
  today: string,
): DomainResult<{ id: number }> {
  const current = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!current || current.conventionId !== input.conventionId) {
    return { ok: false, error: "That edition is gone." };
  }
  const duplicate = db
    .select({ id: editions.id, cycleLabel: editions.cycleLabel })
    .from(editions)
    .where(eq(editions.conventionId, input.conventionId))
    .all()
    .find((row) => row.id !== editionId && row.cycleLabel === input.cycleLabel);
  if (duplicate) return { ok: false, error: `Cycle ${input.cycleLabel} is already on this convention.` };

  const dates = fillStatusDates({
    fromStatus: current.status,
    toStatus: input.status,
    submittedAt: input.submittedAt,
    resultDate: input.resultDate,
    today,
  });
  const paid = isPaidStatus(input.status) ? input.paid : current.paid;
  db.update(editions)
    .set({
      cycleLabel: input.cycleLabel,
      startDate: input.startDate,
      endDate: input.endDate,
      applicationStartDate: input.applicationStartDate,
      applicationEndDate: input.applicationEndDate,
      submittedAt: dates.submittedAt,
      resultDate: dates.resultDate,
      notes: input.notes,
      status: input.status,
      paid,
    })
    .where(eq(editions.id, editionId))
    .run();
  return { ok: true, value: { id: editionId } };
}

export function deleteEdition(db: TrackerDb, editionId: number): DomainResult<{ id: number }> {
  const current = db.select({ id: editions.id }).from(editions).where(eq(editions.id, editionId)).get();
  if (!current) return { ok: false, error: "That edition is gone." };
  db.delete(editions).where(eq(editions.id, editionId)).run();
  return { ok: true, value: { id: editionId } };
}

export function setEditionPaid(db: TrackerDb, editionId: number, paid: boolean): DomainResult<{ id: number }> {
  const current = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!current) return { ok: false, error: "That edition is gone." };
  if (!isStatus(current.status) || !isPaidStatus(current.status)) {
    return { ok: false, error: "Paid is for an approved edition." };
  }
  db.update(editions).set({ paid }).where(eq(editions.id, editionId)).run();
  return { ok: true, value: { id: editionId } };
}

export function getSeries(db: TrackerDb, conventionId: number) {
  const convention = db.select().from(conventions).where(eq(conventions.id, conventionId)).get();
  if (!convention) return null;
  const aliasRows = db
    .select()
    .from(aliases)
    .where(eq(aliases.conventionId, conventionId))
    .orderBy(asc(aliases.name))
    .all();
  const editionRows = db
    .select()
    .from(editions)
    .where(eq(editions.conventionId, conventionId))
    .all()
    .sort((a, b) => compareCycleLabels(a.cycleLabel, b.cycleLabel));
  return {
    convention,
    aliases: aliasRows,
    editions: editionRows,
    gauge: interestGauge(convention.manualInterest, editionRows),
  };
}

export { compareCycleLabels };
