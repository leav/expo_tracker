"use server";

import { redirect } from "next/navigation";
import { addAlias, removeAlias } from "../domain/aliases";
import { createConvention, updateConvention } from "../domain/conventions";
import type { DomainResult } from "../domain/db";
import {
  createEdition,
  editionInputFromForm,
  markEditionPassed,
  setEditionPaid,
  updateEdition,
} from "../domain/editions";
import { blankToNull, isError } from "../domain/fields";
import { openDatabase } from "../db";

function fail(path: string, result: DomainResult<unknown>): never {
  const message = result.ok ? "Saved." : result.error;
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createConventionAction(form: FormData) {
  const result = createConvention(openDatabase(), {
    displayName: String(form.get("displayName") ?? ""),
    website: blankToNull(form.get("website")),
    notes: blankToNull(form.get("notes")),
  });
  if (!result.ok) fail("/", result);
  redirect(`/series/${result.value.id}`);
}

export async function updateConventionAction(form: FormData) {
  const id = Number(form.get("conventionId"));
  const result = updateConvention(openDatabase(), {
    id,
    displayName: String(form.get("displayName") ?? ""),
    website: blankToNull(form.get("website")),
    notes: blankToNull(form.get("notes")),
    pollingEnabled: form.get("pollingEnabled") === "on",
  });
  if (!result.ok) fail(`/series/${id}`, result);
  redirect(`/series/${id}`);
}

export async function addAliasAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const result = addAlias(openDatabase(), {
    conventionId,
    name: String(form.get("name") ?? ""),
  });
  if (!result.ok) fail(`/series/${conventionId}`, result);
  redirect(`/series/${conventionId}`);
}

export async function removeAliasAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  removeAlias(openDatabase(), {
    conventionId,
    aliasId: Number(form.get("aliasId")),
  });
  redirect(`/series/${conventionId}`);
}

export async function createEditionAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const input = editionInputFromForm(form, conventionId);
  if (isError(input)) fail(`/series/${conventionId}`, { ok: false, error: input.error });
  const result = createEdition(openDatabase(), input);
  if (!result.ok) fail(`/series/${conventionId}`, result);
  redirect(`/series/${conventionId}`);
}

export async function updateEditionAction(form: FormData) {
  const conventionId = Number(form.get("conventionId"));
  const editionId = Number(form.get("editionId"));
  const input = editionInputFromForm(form, conventionId);
  if (isError(input)) fail(`/series/${conventionId}`, { ok: false, error: input.error });
  const result = updateEdition(openDatabase(), editionId, input);
  if (!result.ok) fail(`/series/${conventionId}`, result);
  redirect(`/series/${conventionId}`);
}

export async function markPassedAction(form: FormData) {
  const editionId = Number(form.get("editionId"));
  const result = markEditionPassed(openDatabase(), editionId);
  const next = String(form.get("returnTo") ?? "/");
  if (!result.ok) fail(next, result);
  redirect(next);
}

export async function setPaidAction(form: FormData) {
  const editionId = Number(form.get("editionId"));
  const result = setEditionPaid(openDatabase(), editionId, form.get("paid") === "on");
  const next = String(form.get("returnTo") ?? "/");
  if (!result.ok) fail(next, result);
  redirect(next);
}
