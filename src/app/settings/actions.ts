"use server";

import { redirect } from "next/navigation";
import { openDatabase } from "../../db";
import type { DomainResult } from "../../domain/db";
import { blankToNull, isError, parsePositiveInteger } from "../../domain/fields";
import { disconnectGoogle, updateSettings } from "../../domain/settings";
import { revalidateWorkspace } from "../revalidate";

function fail(result: DomainResult<unknown> | { error: string }): never {
  const message = "error" in result ? result.error : "Saved.";
  redirect(`/settings?error=${encodeURIComponent(message)}`);
}

export async function disconnectGoogleAction() {
  disconnectGoogle(openDatabase());
  revalidateWorkspace();
  redirect("/settings");
}

export async function updateSettingsAction(form: FormData) {
  const driveLimitHours = parsePositiveInteger(blankToNull(form.get("driveLimitHours")), "Drive-limit hours");
  if (isError(driveLimitHours)) fail(driveLimitHours);
  const result = updateSettings(openDatabase(), {
    driveLimitHours,
    calendarId: String(form.get("calendarId") ?? ""),
  });
  if (!result.ok) fail(result);
  revalidateWorkspace();
  redirect("/settings");
}
