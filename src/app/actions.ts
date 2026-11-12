"use server";

import { redirect } from "next/navigation";
import { addAlias, removeAlias } from "../domain/aliases";
import {
  createConvention,
  deleteConvention,
  updateConvention,
  type ConventionInput,
} from "../domain/conventions";
import type { DomainResult } from "../domain/db";
import {
  createEdition,
  deleteEdition,
  editionInputFromForm,
  setEditionPaid,
  updateEdition,
} from "../domain/editions";
import { blankToNull, isError, parseAttendance, parseSignedInteger } from "../domain/fields";
import { listLineups, moveLineupEdition, type LineupBoard } from "../domain/lineups";
import { isStatus, todayInLosAngeles } from "../domain/status";
import { openDatabase } from "../db";
import { revalidateWorkspace } from "./revalidate";

function fail(path: string, result: DomainResult<unknown>): never {
  const message = result.ok ? "Saved." : result.error;
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function conventionFromForm(form: FormData): ConventionInput | { error: string } {
  const estimatedAttendance = parseAttendance(blankToNull(form.get("estimatedAttendance")));
  if (isError(estimatedAttendance)) return estimatedAttendance;
  const manualInterest = parseSignedInteger(blankToNull(form.get("manualInterest")), "Interest");
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

export async function createConventionAction(form: FormData) {
  const input = conventionFromForm(form);
  if (isError(input)) fail("/", { ok: false, error: input.error });
  const result = createConvention(openDatabase(), input);
  if (!result.ok) fail("/", result);
  revalidateWorkspace(result.value.id);
  redirect(`/cons/${result.value.id}`);
}

export async function updateConventionAction(form: FormData) {
  const id = Number(form.get("conventionId"));
  const input = conventionFromForm(form);
  if (isError(input)) fail(`/cons/${id}`, { ok: false, error: input.error });
  const result = updateConvention(openDatabase(), { ...input, id });
  if (!result.ok) fail(`/cons/${id}`, result);
  revalidateWorkspace(id);
  redirect(`/cons/${id}`);
}

export async function deleteConventionAction(form: FormData) {
  const id = Number(form.get("conventionId"));
  const result = deleteConvention(openDatabase(), id);
  if (!result.ok) fail(`/cons/${id}`, result);
  revalidateWorkspace(id);
  redirect("/");
}

export async function addAliasAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const result = addAlias(openDatabase(), {
    conventionId,
    name: String(form.get("name") ?? ""),
  });
  if (!result.ok) fail(`/cons/${conventionId}`, result);
  redirect(`/cons/${conventionId}`);
}

export async function removeAliasAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  removeAlias(openDatabase(), {
    conventionId,
    aliasId: Number(form.get("aliasId")),
  });
  redirect(`/cons/${conventionId}`);
}

export async function createEditionAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const input = editionInputFromForm(form, conventionId);
  if (isError(input)) fail(`/cons/${conventionId}`, { ok: false, error: input.error });
  const result = createEdition(openDatabase(), input);
  if (!result.ok) fail(`/cons/${conventionId}`, result);
  revalidateWorkspace(conventionId);
  redirect(`/cons/${conventionId}`);
}

export async function updateEditionAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const editionId = Number(form.get("editionId"));
  const input = editionInputFromForm(form, conventionId);
  if (isError(input)) fail(`/cons/${conventionId}`, { ok: false, error: input.error });
  const result = updateEdition(openDatabase(), editionId, input, todayInLosAngeles());
  if (!result.ok) fail(`/cons/${conventionId}`, result);
  revalidateWorkspace(conventionId);
  redirect(`/cons/${conventionId}`);
}

export async function deleteEditionAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const editionId = Number(form.get("editionId"));
  const result = deleteEdition(openDatabase(), editionId);
  if (!result.ok) fail(`/cons/${conventionId}`, result);
  revalidateWorkspace(conventionId);
  redirect(`/cons/${conventionId}`);
}

export async function setPaidAction(form: FormData) {
  const editionId = Number(form.get("editionId"));
  const result = setEditionPaid(openDatabase(), editionId, form.get("paid") === "on");
  const next = String(form.get("returnTo") ?? "/");
  if (!result.ok) fail(next, result);
  redirect(next);
}

export async function moveLineupEditionAction(
  editionId: number,
  status: string,
): Promise<{ ok: true; board: LineupBoard } | { ok: false; error: string }> {
  const id = Number(editionId);
  if (!Number.isInteger(id)) return { ok: false, error: "That edition is gone." };
  if (!isStatus(status)) return { ok: false, error: "Choose a status from the list." };
  const db = openDatabase();
  const today = todayInLosAngeles();
  const result = moveLineupEdition(db, id, status, today);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateWorkspace(result.value.conventionId);
  return { ok: true, board: listLineups(db, today) };
}
