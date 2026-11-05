import { asc, eq } from "drizzle-orm";
import { aliases, conventions, editions } from "../db/schema";
import type { DomainResult, TrackerDb } from "./db";
import { blankToNull, isError, parseAttendance, parseDate } from "./fields";
import {
  boardColumns,
  boardPlacement,
  initialStatus,
  isIntent,
  isStatus,
  resolveEditionState,
  todayInLosAngeles,
  type BoardColumn,
  type Intent,
  type Status,
} from "./status";

export type EditionInput = {
  conventionId: number;
  cycleLabel: string;
  startDate: string | null;
  endDate: string | null;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  venue: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  attendance: number | null;
  intent: Intent;
  status: Status;
  submittedAt: string | null;
  resultAt: string | null;
  paid: boolean;
  notes: string | null;
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
  const resultAt = parseDate(blankToNull(form.get("resultAt")), "Result");
  if (isError(resultAt)) return resultAt;
  const attendance = parseAttendance(blankToNull(form.get("attendance")));
  if (isError(attendance)) return attendance;

  const intentValue = blankToNull(form.get("intent")) ?? "tracking";
  const statusValue = blankToNull(form.get("status")) ?? "unknown";
  if (!isIntent(intentValue) || !isStatus(statusValue)) {
    return { error: "Choose a status from the list." };
  }
  const resolved = resolveEditionState(intentValue, statusValue);

  return {
    conventionId,
    cycleLabel,
    startDate,
    endDate,
    applicationStartDate,
    applicationEndDate,
    venue: blankToNull(form.get("venue")),
    city: blankToNull(form.get("city")),
    region: blankToNull(form.get("region")),
    country: blankToNull(form.get("country")),
    attendance,
    intent: resolved.intent,
    status: resolved.status,
    submittedAt,
    resultAt,
    paid: form.get("paid") === "on",
    notes: blankToNull(form.get("notes")),
  };
}

export function createEdition(db: TrackerDb, input: EditionInput): DomainResult<{ id: number }> {
  const duplicate = db
    .select({ cycleLabel: editions.cycleLabel })
    .from(editions)
    .where(eq(editions.conventionId, input.conventionId))
    .all()
    .some((row) => row.cycleLabel === input.cycleLabel);
  if (duplicate) return { ok: false, error: `Cycle ${input.cycleLabel} is already on this convention.` };

  const status = input.status === "unknown" ? initialStatus(input.applicationStartDate, todayInLosAngeles()) : input.status;
  const resolved = resolveEditionState(input.intent, status);
  const inserted = db
    .insert(editions)
    .values({
      ...input,
      intent: resolved.intent,
      status: resolved.status,
      applicationConfirmed: input.applicationStartDate !== null,
      paid: resolved.status === "accepted" || resolved.status === "attended" ? input.paid : false,
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

  const resolved = resolveEditionState(input.intent, input.status);
  const paid = resolved.status === "accepted" || resolved.status === "attended" ? input.paid : current.paid;
  db.update(editions)
    .set({
      ...input,
      intent: resolved.intent,
      status: resolved.status,
      applicationConfirmed: input.applicationStartDate !== null,
      paid,
    })
    .where(eq(editions.id, editionId))
    .run();
  return { ok: true, value: { id: editionId } };
}

export function markEditionPassed(db: TrackerDb, editionId: number): DomainResult<{ id: number }> {
  const current = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!current) return { ok: false, error: "That edition is gone." };
  const resolved = resolveEditionState("skip", "passed");
  db.update(editions)
    .set({ intent: resolved.intent, status: resolved.status })
    .where(eq(editions.id, editionId))
    .run();
  return { ok: true, value: { id: editionId } };
}

export function setEditionPaid(db: TrackerDb, editionId: number, paid: boolean): DomainResult<{ id: number }> {
  const current = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!current) return { ok: false, error: "That edition is gone." };
  if (current.status !== "accepted" && current.status !== "attended") {
    return { ok: false, error: "Paid is for an accepted edition." };
  }
  db.update(editions).set({ paid }).where(eq(editions.id, editionId)).run();
  return { ok: true, value: { id: editionId } };
}

export type BoardCard = {
  editionId: number;
  conventionId: number;
  conventionName: string;
  cycleLabel: string;
  applicationStartDate: string | null;
  city: string | null;
  openBadge: boolean;
  paid: boolean;
  status: Status;
};

export function listBoard(db: TrackerDb): { columns: { name: BoardColumn; cards: BoardCard[] }[]; withdrawn: BoardCard[] } {
  const rows = db
    .select({
      editionId: editions.id,
      conventionId: editions.conventionId,
      conventionName: conventions.displayName,
      cycleLabel: editions.cycleLabel,
      applicationStartDate: editions.applicationStartDate,
      city: editions.city,
      intent: editions.intent,
      status: editions.status,
      paid: editions.paid,
    })
    .from(editions)
    .innerJoin(conventions, eq(editions.conventionId, conventions.id))
    .all();

  const columns = boardColumns.map((name) => ({ name, cards: [] as BoardCard[] }));
  const withdrawn: BoardCard[] = [];
  for (const row of rows) {
    if (!isIntent(row.intent) || !isStatus(row.status)) continue;
    const placement = boardPlacement(row.intent, row.status);
    const card: BoardCard = {
      editionId: row.editionId,
      conventionId: row.conventionId,
      conventionName: row.conventionName,
      cycleLabel: row.cycleLabel,
      applicationStartDate: row.applicationStartDate,
      city: row.city,
      openBadge: placement.openBadge,
      paid: row.paid,
      status: row.status,
    };
    if (row.status === "withdrawn" || placement.column === null) {
      withdrawn.push(card);
      continue;
    }
    columns.find((column) => column.name === placement.column)?.cards.push(card);
  }
  for (const column of columns) {
    column.cards.sort((a, b) => a.conventionName.localeCompare(b.conventionName) || compareCycleLabels(a.cycleLabel, b.cycleLabel));
  }
  withdrawn.sort((a, b) => compareCycleLabels(a.cycleLabel, b.cycleLabel));
  return { columns, withdrawn };
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
  return { convention, aliases: aliasRows, editions: editionRows };
}

export function compareCycleLabels(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}
