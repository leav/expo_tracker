import { eq, inArray } from "drizzle-orm";
import { calendarSync, conventions, editions } from "../db/schema";
import {
  calendarEventBody,
  calendarEventTitle,
  isReminderKind,
  type ReminderKind,
} from "../domain/calendarEvent";
import {
  reminderDate,
  reminderEventId,
  type CalendarSyncRow,
  type SyncAction,
} from "../domain/calendarSync";
import type { TrackerDb } from "../domain/db";
import { getSettings } from "../domain/settings";
import { CalendarNotFoundError, createGoogleCalendarClient, type CalendarClient } from "../google/calendar";

const CLAIMABLE = ["queued", "failed"] as const;

export async function processCalendarSync(db: TrackerDb, client?: CalendarClient): Promise<void> {
  const active = client ?? createGoogleCalendarClient(db) ?? null;
  if (!active) return;

  const calendarId = getSettings(db).calendarId;
  const rows = db.select().from(calendarSync).where(inArray(calendarSync.state, CLAIMABLE)).all();

  for (const row of rows) {
    const now = new Date().toISOString();
    db.update(calendarSync)
      .set({ state: "running", attempts: row.attempts + 1, updatedAt: now })
      .where(eq(calendarSync.id, row.id))
      .run();

    try {
      await applySyncRow(db, active, calendarId, row);
      db.update(calendarSync)
        .set({ state: "done", lastError: null, updatedAt: new Date().toISOString() })
        .where(eq(calendarSync.id, row.id))
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar sync failed.";
      db.update(calendarSync)
        .set({ state: "failed", lastError: message, updatedAt: new Date().toISOString() })
        .where(eq(calendarSync.id, row.id))
        .run();
    }
  }
}

async function applySyncRow(
  db: TrackerDb,
  client: CalendarClient,
  calendarId: string,
  row: CalendarSyncRow,
): Promise<void> {
  const action = row.action as SyncAction;
  if (action === "delete") {
    if (row.googleEventId) {
      try {
        await client.deleteEvent(calendarId, row.googleEventId);
      } catch (error) {
        if (!(error instanceof CalendarNotFoundError)) throw error;
      }
      clearStoredEventId(db, row);
    }
    return;
  }

  if (row.editionId == null || !isReminderKind(row.reminderKind)) return;
  const edition = db.select().from(editions).where(eq(editions.id, row.editionId)).get();
  if (!edition) return;
  const convention = db.select().from(conventions).where(eq(conventions.id, edition.conventionId)).get();
  if (!convention) return;

  const kind = row.reminderKind;
  const date = reminderDate(edition, kind);
  if (!date) throw new Error("That reminder date is missing.");

  const body = calendarEventBody(calendarEventTitle(kind, convention.displayName, edition.cycleLabel), date);

  if (action === "create") {
    const created = await client.createEvent(calendarId, body);
    writeStoredEventId(db, edition.id, kind, created.id);
    return;
  }

  const eventId = reminderEventId(edition, kind) ?? row.googleEventId;
  if (!eventId) {
    const created = await client.createEvent(calendarId, body);
    writeStoredEventId(db, edition.id, kind, created.id);
    return;
  }

  try {
    await client.patchEvent(calendarId, eventId, body);
  } catch (error) {
    if (!(error instanceof CalendarNotFoundError)) throw error;
    const created = await client.createEvent(calendarId, body);
    writeStoredEventId(db, edition.id, kind, created.id);
  }
}

function writeStoredEventId(db: TrackerDb, editionId: number, kind: ReminderKind, eventId: string): void {
  if (kind === "start") {
    db.update(editions).set({ startDateCalendarEventId: eventId }).where(eq(editions.id, editionId)).run();
  } else {
    db.update(editions)
      .set({ applicationStartDateCalendarEventId: eventId })
      .where(eq(editions.id, editionId))
      .run();
  }
}

function clearStoredEventId(db: TrackerDb, row: CalendarSyncRow): void {
  if (row.editionId == null || !isReminderKind(row.reminderKind)) return;
  if (row.reminderKind === "start") {
    db.update(editions)
      .set({ startDateCalendarEventId: null })
      .where(eq(editions.id, row.editionId))
      .run();
  } else {
    db.update(editions)
      .set({ applicationStartDateCalendarEventId: null })
      .where(eq(editions.id, row.editionId))
      .run();
  }
}
