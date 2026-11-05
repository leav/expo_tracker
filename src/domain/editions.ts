import { asc, eq } from "drizzle-orm";
import { aliases, conventions, editions } from "../db/schema";
import { conventionInterest } from "./cons";
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

export type EditionInput = {
  conventionId: number;
  cycleLabel: string;
  startDate: string | null;
  endDate: string | null;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  city: string | null;
  region: string | null;
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
    city: blankToNull(form.get("city")),
    region: blankToNull(form.get("region")),
    status: statusValue,
    submittedAt,
    resultDate,
    paid: form.get("paid") === "on",
    notes: blankToNull(form.get("notes")),
  };
}

function locationFromConvention(
  db: TrackerDb,
  conventionId: number,
  input: EditionInput,
): DomainResult<EditionInput> {
  const convention = db.select().from(conventions).where(eq(conventions.id, conventionId)).get();
  if (!convention) return { ok: false, error: "That convention is gone." };
  return {
    ok: true,
    value: {
      ...input,
      city: input.city ?? convention.defaultCity,
      region: input.region ?? convention.defaultRegion,
    },
  };
}

export function createEdition(db: TrackerDb, input: EditionInput): DomainResult<{ id: number }> {
  const withLocation = locationFromConvention(db, input.conventionId, input);
  if (!withLocation.ok) return withLocation;
  const values = withLocation.value;

  const duplicate = db
    .select({ cycleLabel: editions.cycleLabel })
    .from(editions)
    .where(eq(editions.conventionId, values.conventionId))
    .all()
    .some((row) => row.cycleLabel === values.cycleLabel);
  if (duplicate) return { ok: false, error: `Cycle ${values.cycleLabel} is already on this convention.` };

  const status =
    values.inferInitialStatus === false
      ? values.status
      : values.status === "unknown"
        ? initialStatus(values.applicationStartDate, todayInLosAngeles())
        : values.status;

  const inserted = db
    .insert(editions)
    .values({
      conventionId: values.conventionId,
      cycleLabel: values.cycleLabel,
      startDate: values.startDate,
      endDate: values.endDate,
      applicationStartDate: values.applicationStartDate,
      applicationEndDate: values.applicationEndDate,
      city: values.city,
      region: values.region,
      submittedAt: values.submittedAt,
      resultDate: values.resultDate,
      notes: values.notes,
      status,
      paid: isPaidStatus(status) ? values.paid : false,
      sheetRowKey: values.sheetRowKey ?? null,
    })
    .returning({ id: editions.id })
    .get();
  return { ok: true, value: { id: inserted.id } };
}

export function updateEdition(
  db: TrackerDb,
  editionId: number,
  input: EditionInput,
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

  const paid = isPaidStatus(input.status) ? input.paid : current.paid;
  db.update(editions)
    .set({
      cycleLabel: input.cycleLabel,
      startDate: input.startDate,
      endDate: input.endDate,
      applicationStartDate: input.applicationStartDate,
      applicationEndDate: input.applicationEndDate,
      city: input.city,
      region: input.region,
      submittedAt: input.submittedAt,
      resultDate: input.resultDate,
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
    interest: conventionInterest(convention.manualInterest, editionRows),
  };
}

export { compareCycleLabels };

function fillIfEmpty<T>(current: T, incoming: T): T {
  if (current === null || current === undefined || current === "") return incoming;
  return current;
}

export function importEdition(db: TrackerDb, input: EditionInput & { sheetRowKey: string }): DomainResult<{ id: number }> {
  const existingByKey = db.select().from(editions).where(eq(editions.sheetRowKey, input.sheetRowKey)).get();
  const existingByCycle = db
    .select()
    .from(editions)
    .where(eq(editions.conventionId, input.conventionId))
    .all()
    .find((row) => row.cycleLabel === input.cycleLabel);
  const existing = existingByKey ?? existingByCycle ?? null;

  if (!existing) {
    return createEdition(db, {
      ...input,
      paid: false,
      inferInitialStatus: false,
    });
  }

  db.update(editions)
    .set({
      sheetRowKey: existing.sheetRowKey ?? input.sheetRowKey,
      startDate: fillIfEmpty(existing.startDate, input.startDate),
      endDate: fillIfEmpty(existing.endDate, input.endDate),
      applicationStartDate: fillIfEmpty(existing.applicationStartDate, input.applicationStartDate),
      applicationEndDate: fillIfEmpty(existing.applicationEndDate, input.applicationEndDate),
      city: fillIfEmpty(existing.city, input.city),
      region: fillIfEmpty(existing.region, input.region),
      submittedAt: fillIfEmpty(existing.submittedAt, input.submittedAt),
      resultDate: fillIfEmpty(existing.resultDate, input.resultDate),
      notes: fillIfEmpty(existing.notes, input.notes),
    })
    .where(eq(editions.id, existing.id))
    .run();
  return { ok: true, value: { id: existing.id } };
}
