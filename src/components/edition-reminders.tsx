import { ExternalLink } from "lucide-react";
import {
  disableReminderAction,
  enableReminderAction,
  retryCalendarSyncAction,
} from "../app/actions";
import type { ReminderKind } from "../domain/calendarEvent";
import type { CalendarSyncRow } from "../domain/calendarSync";
import { hrefForGoogleCalendarEvent } from "../domain/googleCalendarEvent";
import { Button } from "./ui/button";

export function EditionReminders({
  conventionId,
  editionId,
  applicationStartDate,
  startDate,
  applicationStartReminderEnabled,
  startReminderEnabled,
  applicationStartGoogleEventId,
  startGoogleEventId,
  calendarId,
  ownerEmail,
  sync,
  googleConnected,
}: {
  conventionId: number;
  editionId: number;
  applicationStartDate: string | null;
  startDate: string | null;
  applicationStartReminderEnabled: boolean;
  startReminderEnabled: boolean;
  applicationStartGoogleEventId: string | null;
  startGoogleEventId: string | null;
  calendarId: string;
  ownerEmail: string | null;
  sync: Partial<Record<ReminderKind, CalendarSyncRow>>;
  googleConnected: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-dashed p-3">
      <ReminderRow
        conventionId={conventionId}
        editionId={editionId}
        kind="application_start"
        label="Application start reminder"
        date={applicationStartDate}
        enabled={applicationStartReminderEnabled}
        googleEventId={applicationStartGoogleEventId}
        calendarId={calendarId}
        ownerEmail={ownerEmail}
        sync={sync.application_start}
        googleConnected={googleConnected}
      />
      <ReminderRow
        conventionId={conventionId}
        editionId={editionId}
        kind="start"
        label="Event start reminder"
        date={startDate}
        enabled={startReminderEnabled}
        googleEventId={startGoogleEventId}
        calendarId={calendarId}
        ownerEmail={ownerEmail}
        sync={sync.start}
        googleConnected={googleConnected}
      />
    </div>
  );
}

function ReminderRow({
  conventionId,
  editionId,
  kind,
  label,
  date,
  enabled,
  googleEventId,
  calendarId,
  ownerEmail,
  sync,
  googleConnected,
}: {
  conventionId: number;
  editionId: number;
  kind: ReminderKind;
  label: string;
  date: string | null;
  enabled: boolean;
  googleEventId: string | null;
  calendarId: string;
  ownerEmail: string | null;
  sync?: CalendarSyncRow;
  googleConnected: boolean;
}) {
  const canAdd = Boolean(date) && !enabled;
  const googleHref = enabled
    ? hrefForGoogleCalendarEvent({ eventId: googleEventId, calendarId, ownerEmail })
    : null;
  const status = statusCopy(enabled, sync, googleConnected, date);
  return (
    <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        {googleHref ? (
          <a
            href={googleHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs underline underline-offset-2"
          >
            Open in Google Calendar
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">(opens Google Calendar)</span>
          </a>
        ) : null}
        {sync?.state === "failed" && sync.lastError ? (
          <p className="text-xs text-destructive">{sync.lastError}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {canAdd ? (
          <form action={enableReminderAction}>
            <input type="hidden" name="conventionId" value={conventionId} />
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="outline" size="sm" disabled={!date}>
              Add reminder
            </Button>
          </form>
        ) : null}
        {enabled ? (
          <form action={disableReminderAction}>
            <input type="hidden" name="conventionId" value={conventionId} />
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="outline" size="sm">
              Remove reminder
            </Button>
          </form>
        ) : null}
        {sync?.state === "failed" ? (
          <form action={retryCalendarSyncAction}>
            <input type="hidden" name="conventionId" value={conventionId} />
            <input type="hidden" name="syncId" value={sync.id} />
            <Button type="submit" variant="outline" size="sm">
              Retry
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function statusCopy(
  enabled: boolean,
  sync: CalendarSyncRow | undefined,
  googleConnected: boolean,
  date: string | null,
): string | null {
  if (!date) return "Set this date, then add a reminder.";
  if (sync?.state === "failed") return "Failed";
  if (sync?.state === "queued" || sync?.state === "running") {
    if (!googleConnected) return "Queued. Connect Google in Settings to sync.";
    return sync.state === "running" ? "Syncing" : "Queued";
  }
  if (enabled) return null;
  return "No Google Calendar reminder until you add one.";
}
