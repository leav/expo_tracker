"use server";

import { redirect } from "next/navigation";
import type { DomainResult } from "../../domain/db";
import { blankToNull, parseDate, isError } from "../../domain/fields";
import { isStatus } from "../../domain/status";
import { openDatabase } from "../../db";
import { acceptAlias, acceptMerge, acceptUnresolved, applyParsedRows, dismissProposal } from "../../import/apply";
import { loadSheetCsv } from "../../import/load";
import { parseSheet } from "../../import/parse";

function fail(result: DomainResult<unknown>): never {
  const message = result.ok ? "Saved." : result.error;
  redirect(`/import?error=${encodeURIComponent(message)}`);
}

export async function importSheetAction() {
  try {
    const { csv } = await loadSheetCsv();
    applyParsedRows(openDatabase(), parseSheet(csv));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    redirect(`/import?error=${encodeURIComponent(message)}`);
  }
  redirect("/import");
}

export async function acceptMergeAction(form: FormData) {
  const result = acceptMerge(openDatabase(), Number(form.get("proposalId")));
  if (!result.ok) fail(result);
  redirect("/import");
}

export async function acceptAliasAction(form: FormData) {
  const result = acceptAlias(openDatabase(), Number(form.get("proposalId")));
  if (!result.ok) fail(result);
  redirect("/import");
}

export async function acceptUnresolvedAction(form: FormData) {
  const applicationStartDate = parseDate(blankToNull(form.get("applicationStartDate")), "Application start");
  if (isError(applicationStartDate)) fail({ ok: false, error: applicationStartDate.error });
  const applicationEndDate = parseDate(blankToNull(form.get("applicationEndDate")), "Application end");
  if (isError(applicationEndDate)) fail({ ok: false, error: applicationEndDate.error });
  const submittedAt = parseDate(blankToNull(form.get("submittedAt")), "Submitted");
  if (isError(submittedAt)) fail({ ok: false, error: submittedAt.error });
  const resultDate = parseDate(blankToNull(form.get("resultDate")), "Result");
  if (isError(resultDate)) fail({ ok: false, error: resultDate.error });
  const statusValue = blankToNull(form.get("status"));
  const dateField = blankToNull(form.get("dateField"));

  const result = acceptUnresolved(openDatabase(), Number(form.get("proposalId")), {
    dateField:
      dateField === "application_start" || dateField === "submitted_at" || dateField === "ignore"
        ? dateField
        : undefined,
    applicationStartDate,
    applicationEndDate,
    submittedAt,
    resultDate,
    status: statusValue && isStatus(statusValue) ? statusValue : undefined,
  });
  if (!result.ok) fail(result);
  redirect("/import");
}

export async function dismissProposalAction(form: FormData) {
  const result = dismissProposal(openDatabase(), Number(form.get("proposalId")));
  if (!result.ok) fail(result);
  redirect("/import");
}
