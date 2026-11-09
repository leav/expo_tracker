import { and, eq, inArray } from "drizzle-orm";
import { calendarSync, editions } from "../db/schema";
import { isReminderKind, reminderKinds, type ReminderKind } from "./calendarEvent";
import type { DomainResult, TrackerDb } from "./db";

export type SyncAction = "create" | "patch" | "delete";
export type SyncState = "queued" | "running" | "done" | "failed";

export type CalendarSyncRow = typeof calendarSync.$inferSelect;
type EditionRow = typeof editions.$inferSelect;

export type OpenSync = {
  id: number;
  action: SyncAction;
  googleEventId: string | null;
  state: SyncState;
};

export type EnqueueDecision =
  | { type: "insert"; action: SyncAction }
  | { type: "update"; action: SyncAction }
  | { type: "cancel" }
  | { type: "noop" };

const OPEN_STATES: SyncState[] = ["queued", "running", "failed"];

export function nextCalendarSyncDecision(input: {
  intent: SyncAction;
  eventId: string | null;
  open: { action: SyncAction; state: SyncState } | null;
}): EnqueueDecision {
  const { intent, eventId, open } = input;

  if (open?.state === "running") {
    if (intent === "patch" && !eventId) return { type: "insert", action: "create" };
    if (intent === "delete" && !eventId) return { type: "noop" };
    return { type: "insert", action: intent };
  }

  if (!open) {
    if (intent === "create") return { type: "insert", action: "create" };
    if (intent === "patch") return { type: "insert", action: eventId ? "patch" : "create" };
    return eventId ? { type: "insert", action: "delete" } : { type: "noop" };
  }

  if (intent === "create") {
    if (open.action === "delete") return { type: "update", action: eventId ? "patch" : "create" };
    return { type: "noop" };
  }

  if (intent === "patch") {
    if (open.action === "create") return { type: "noop" };
    if (open.action === "patch") return { type: "noop" };
    return { type: "update", action: eventId ? "patch" : "create" };
  }

  if (open.action === "delete") return { type: "noop" };
  if (open.action === "create" && !eventId) return { type: "cancel" };
  return eventId ? { type: "update", action: "delete" } : { type: "cancel" };
}

export function reminderDate(edition: EditionRow, kind: ReminderKind): string | null {
  return kind === "start" ? edition.startDate : edition.applicationStartDate;
}

export function reminderEnabled(edition: EditionRow, kind: ReminderKind): boolean {
  return kind === "start" ? edition.startReminderEnabled : edition.applicationStartReminderEnabled;
}

export function reminderEventId(edition: EditionRow, kind: ReminderKind): string | null {
  return kind === "start" ? edition.startDateCalendarEventId : edition.applicationStartDateCalendarEventId;
}

export function enableReminder(db: TrackerDb, editionId: number, kind: ReminderKind): DomainResult<{ id: number }> {
  const edition = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!edition) return { ok: false, error: "That edition is gone." };
  if (!reminderDate(edition, kind)) {
    return { ok: false, error: "Set a date before adding a reminder." };
  }

  setReminderEnabled(db, editionId, kind, true);
  enqueueCalendarSync(db, editionId, kind, "create");
  return { ok: true, value: { id: editionId } };
}

export function disableReminder(db: TrackerDb, editionId: number, kind: ReminderKind): DomainResult<{ id: number }> {
  const edition = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!edition) return { ok: false, error: "That edition is gone." };

  setReminderEnabled(db, editionId, kind, false);
  enqueueCalendarSync(db, editionId, kind, "delete");
  return { ok: true, value: { id: editionId } };
}

export function retryCalendarSync(db: TrackerDb, syncId: number): DomainResult<{ id: number }> {
  const row = db.select().from(calendarSync).where(eq(calendarSync.id, syncId)).get();
  if (!row) return { ok: false, error: "That sync job is gone." };
  if (row.state !== "failed") return { ok: false, error: "Only a failed reminder sync can be retried." };

  const now = nowIso();
  db.update(calendarSync)
    .set({ state: "queued", lastError: null, updatedAt: now })
    .where(eq(calendarSync.id, syncId))
    .run();
  return { ok: true, value: { id: syncId } };
}

export function syncRemindersForDateChanges(
  db: TrackerDb,
  previous: EditionRow,
  next: { startDate: string | null; applicationStartDate: string | null },
): void {
  for (const kind of reminderKinds) {
    if (!reminderEnabled(previous, kind)) continue;
    const prevDate = reminderDate(previous, kind);
    const nextDate = kind === "start" ? next.startDate : next.applicationStartDate;
    if (prevDate === nextDate) continue;
    if (!nextDate) {
      setReminderEnabled(db, previous.id, kind, false);
      enqueueCalendarSync(db, previous.id, kind, "delete");
    } else {
      enqueueCalendarSync(db, previous.id, kind, "patch");
    }
  }
}

export function queueDeletesForEdition(db: TrackerDb, editionId: number): void {
  const edition = db.select().from(editions).where(eq(editions.id, editionId)).get();
  if (!edition) return;
  for (const kind of reminderKinds) {
    enqueueCalendarSync(db, editionId, kind, "delete");
  }
}

export function listOpenCalendarSyncByEdition(
  db: TrackerDb,
  editionIds: number[],
): Map<number, Partial<Record<ReminderKind, CalendarSyncRow>>> {
  const map = new Map<number, Partial<Record<ReminderKind, CalendarSyncRow>>>();
  if (editionIds.length === 0) return map;

  const rows = db
    .select()
    .from(calendarSync)
    .where(and(inArray(calendarSync.editionId, editionIds), inArray(calendarSync.state, OPEN_STATES)))
    .all();

  for (const row of rows) {
    if (row.editionId == null || !isReminderKind(row.reminderKind)) continue;
    const current = map.get(row.editionId) ?? {};
    const existing = current[row.reminderKind];
    if (!existing || syncDisplayRank(row) >= syncDisplayRank(existing)) {
      current[row.reminderKind] = row;
    }
    map.set(row.editionId, current);
  }
  return map;
}

export function listOpenCalendarSync(db: TrackerDb): CalendarSyncRow[] {
  return db.select().from(calendarSync).where(inArray(calendarSync.state, OPEN_STATES)).all();
}

export function enqueueCalendarSync(
  db: TrackerDb,
  editionId: number,
  kind: ReminderKind,
  intent: SyncAction,
): void {
  const edition = db.select().from(editions).where(eq(editions.id, editionId)).get();
  const eventId = edition ? reminderEventId(edition, kind) : null;
  const open = findOpenSync(db, editionId, kind);
  const decision = nextCalendarSyncDecision({
    intent,
    eventId,
    open: open ? { action: open.action, state: open.state } : null,
  });
  const now = nowIso();

  if (decision.type === "noop") return;
  if (decision.type === "cancel") {
    if (!open) return;
    db.update(calendarSync)
      .set({ state: "done", lastError: null, updatedAt: now })
      .where(eq(calendarSync.id, open.id))
      .run();
    return;
  }
  if (decision.type === "update") {
    if (!open) return;
    db.update(calendarSync)
      .set({
        action: decision.action,
        googleEventId: eventId,
        state: "queued",
        lastError: null,
        updatedAt: now,
      })
      .where(eq(calendarSync.id, open.id))
      .run();
    return;
  }

  db.insert(calendarSync)
    .values({
      editionId,
      reminderKind: kind,
      action: decision.action,
      googleEventId: eventId,
      state: "queued",
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function findOpenSync(db: TrackerDb, editionId: number, kind: ReminderKind): OpenSync | null {
  const rows = db
    .select()
    .from(calendarSync)
    .where(
      and(
        eq(calendarSync.editionId, editionId),
        eq(calendarSync.reminderKind, kind),
        inArray(calendarSync.state, OPEN_STATES),
      ),
    )
    .all();
  if (rows.length === 0) return null;
  const running = rows.find((row) => row.state === "running");
  const row = running ?? rows[0];
  return {
    id: row.id,
    action: row.action as SyncAction,
    googleEventId: row.googleEventId,
    state: row.state as SyncState,
  };
}

function setReminderEnabled(db: TrackerDb, editionId: number, kind: ReminderKind, enabled: boolean): void {
  if (kind === "start") {
    db.update(editions).set({ startReminderEnabled: enabled }).where(eq(editions.id, editionId)).run();
  } else {
    db.update(editions)
      .set({ applicationStartReminderEnabled: enabled })
      .where(eq(editions.id, editionId))
      .run();
  }
}

function syncDisplayRank(row: CalendarSyncRow): number {
  if (row.state === "failed") return 3;
  if (row.state === "queued") return 2;
  if (row.state === "running") return 1;
  return 0;
}

function nowIso(): string {
  return new Date().toISOString();
}
