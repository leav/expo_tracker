import { addAlias, removeAlias } from "../domain/aliases";
import {
  createConvention,
  deleteConvention,
  updateConvention,
  type ConventionInput,
} from "../domain/conventions";
import type { DomainResult, TrackerDb } from "../domain/db";
import {
  createEdition,
  deleteEdition,
  editionInputFromForm,
  updateEdition,
} from "../domain/editions";
import { blankToNull, isError, parseAttendance, parseSignedInteger } from "../domain/fields";
import { listLineups, moveLineupEdition, type LineupBoard } from "../domain/lineups";
import { isStatus, todayInLosAngeles } from "../domain/status";

export function conventionFromForm(form: FormData): ConventionInput | { error: string } {
  const estimatedAttendance = parseAttendance(blankToNull(form.get("estimatedAttendance")));
  if (isError(estimatedAttendance)) return estimatedAttendance;
  const manualInterest = parseSignedInteger(blankToNull(form.get("manualInterest")), "My interest");
  if (isError(manualInterest)) return manualInterest;
  return {
    displayName: String(form.get("displayName") ?? ""),
    website: blankToNull(form.get("website")),
    notes: blankToNull(form.get("notes")),
    defaultCity: blankToNull(form.get("defaultCity")),
    defaultRegion: blankToNull(form.get("defaultRegion")),
    estimatedAttendance,
    manualInterest,
  };
}

export function submitCreateConvention(db: TrackerDb, form: FormData) {
  const input = conventionFromForm(form);
  if (isError(input)) return { ok: false as const, error: input.error };
  return createConvention(db, input);
}

export function submitUpdateConvention(db: TrackerDb, form: FormData) {
  const id = Number(form.get("conventionId"));
  const input = conventionFromForm(form);
  if (isError(input)) return { ok: false as const, error: input.error };
  return updateConvention(db, { ...input, id });
}

export function submitDeleteConvention(db: TrackerDb, form: FormData) {
  return deleteConvention(db, Number(form.get("conventionId")));
}

export function submitAddAlias(db: TrackerDb, form: FormData) {
  return addAlias(db, {
    conventionId: Number(form.get("conventionId")),
    name: String(form.get("name") ?? ""),
  });
}

export function submitRemoveAlias(db: TrackerDb, form: FormData) {
  removeAlias(db, {
    conventionId: Number(form.get("conventionId")),
    aliasId: Number(form.get("aliasId")),
  });
  return { ok: true as const, value: undefined };
}

export function submitCreateEdition(db: TrackerDb, form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const input = editionInputFromForm(form, conventionId);
  if (isError(input)) return { ok: false as const, error: input.error };
  return createEdition(db, input);
}

export function submitUpdateEdition(db: TrackerDb, form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const editionId = Number(form.get("editionId"));
  const input = editionInputFromForm(form, conventionId);
  if (isError(input)) return { ok: false as const, error: input.error };
  return updateEdition(db, editionId, input, todayInLosAngeles());
}

export function submitDeleteEdition(db: TrackerDb, form: FormData) {
  return deleteEdition(db, Number(form.get("editionId")));
}

export function submitMoveLineupEdition(
  db: TrackerDb,
  editionId: number,
  status: string,
): DomainResult<LineupBoard> {
  const id = Number(editionId);
  if (!Number.isInteger(id)) return { ok: false, error: "That edition is gone." };
  if (!isStatus(status)) return { ok: false, error: "Choose a status from the list." };
  const today = todayInLosAngeles();
  const result = moveLineupEdition(db, id, status, today);
  if (!result.ok) return result;
  return { ok: true, value: listLineups(db, today) };
}
