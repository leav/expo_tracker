import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { calendarSync, editions } from "../db/schema";
import {
  disableReminder,
  enableReminder,
  listOpenCalendarSync,
  nextCalendarSyncDecision,
  retryCalendarSync,
} from "./calendarSync";
import { createConvention, deleteConvention } from "./conventions";
import type { TrackerDb } from "./db";
import { createEdition, deleteEdition, updateEdition } from "./editions";

function editionInput(conventionId: number, cycleLabel: string) {
  return {
    conventionId,
    cycleLabel,
    startDate: "2027-03-15" as string | null,
    endDate: null,
    applicationStartDate: "2026-11-08" as string | null,
    applicationEndDate: null,
    status: "waiting_to_apply" as const,
    submittedAt: null,
    resultDate: null,
    paid: false,
    notes: null,
    inferInitialStatus: false,
  };
}

describe("nextCalendarSyncDecision", () => {
  it("inserts create when nothing is open", () => {
    assert.deepEqual(nextCalendarSyncDecision({ intent: "create", eventId: null, open: null }), {
      type: "insert",
      action: "create",
    });
  });

  it("patches an existing event and creates when the event id is missing", () => {
    assert.deepEqual(nextCalendarSyncDecision({ intent: "patch", eventId: "evt-1", open: null }), {
      type: "insert",
      action: "patch",
    });
    assert.deepEqual(nextCalendarSyncDecision({ intent: "patch", eventId: null, open: null }), {
      type: "insert",
      action: "create",
    });
  });

  it("does not delete when there is no event to remove", () => {
    assert.deepEqual(nextCalendarSyncDecision({ intent: "delete", eventId: null, open: null }), { type: "noop" });
  });

  it("keeps a pending create when the date is patched", () => {
    assert.deepEqual(
      nextCalendarSyncDecision({
        intent: "patch",
        eventId: null,
        open: { action: "create", state: "queued" },
      }),
      { type: "noop" },
    );
  });

  it("cancels a pending create when the reminder is removed before Google has an event", () => {
    assert.deepEqual(
      nextCalendarSyncDecision({
        intent: "delete",
        eventId: null,
        open: { action: "create", state: "queued" },
      }),
      { type: "cancel" },
    );
  });

  it("turns a pending delete back into a patch when the reminder is re-added", () => {
    assert.deepEqual(
      nextCalendarSyncDecision({
        intent: "create",
        eventId: "evt-1",
        open: { action: "delete", state: "queued" },
      }),
      { type: "update", action: "patch" },
    );
  });
});

describe("calendar reminder outbox", () => {
  let sqlite: Database.Database;
  let db: TrackerDb;

  before(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "drizzle" });
  });

  after(() => {
    sqlite.close();
  });

  it("does not queue Calendar work when a date is saved without Add reminder", () => {
    const convention = createConvention(db, { displayName: "No Reminder Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;

    const created = createEdition(db, editionInput(convention.value.id, "2027"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const updated = updateEdition(
      db,
      created.value.id,
      { ...editionInput(convention.value.id, "2027"), applicationStartDate: "2026-11-20" },
      "2026-11-09",
    );
    assert.equal(updated.ok, true);

    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.applicationStartReminderEnabled, false);
    assert.equal(stored?.startReminderEnabled, false);
    assert.equal(listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id).length, 0);
  });

  it("queues create on Add reminder, then patch on a date correction, not a second create", () => {
    const convention = createConvention(db, { displayName: "Patch Reminder Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2028"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const enabled = enableReminder(db, created.value.id, "application_start");
    assert.equal(enabled.ok, true);
    const afterEnable = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(afterEnable?.applicationStartReminderEnabled, true);

    const queued = listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id);
    assert.equal(queued.length, 1);
    assert.equal(queued[0]?.action, "create");
    assert.equal(queued[0]?.reminderKind, "application_start");

    db.update(editions)
      .set({ applicationStartDateCalendarEventId: "evt-app-1" })
      .where(eq(editions.id, created.value.id))
      .run();
    db.update(calendarSync).set({ state: "done" }).where(eq(calendarSync.id, queued[0]!.id)).run();

    const patched = updateEdition(
      db,
      created.value.id,
      { ...editionInput(convention.value.id, "2028"), applicationStartDate: "2026-11-22" },
      "2026-11-09",
    );
    assert.equal(patched.ok, true);

    const open = listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id);
    assert.equal(open.length, 1);
    assert.equal(open[0]?.action, "patch");
    assert.equal(
      listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id && row.action === "create").length,
      0,
    );
  });

  it("keeps a pending create when the date changes before the event exists", () => {
    const convention = createConvention(db, { displayName: "Pending Create Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2029"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "start");
    const before = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    assert.equal(before?.action, "create");

    updateEdition(
      db,
      created.value.id,
      { ...editionInput(convention.value.id, "2029"), startDate: "2027-04-01" },
      "2026-11-09",
    );
    const after = listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id);
    assert.equal(after.length, 1);
    assert.equal(after[0]?.action, "create");
    assert.equal(after[0]?.id, before?.id);
  });

  it("queues delete on Remove reminder and cancels a pending create with no event id", () => {
    const convention = createConvention(db, { displayName: "Remove Reminder Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2030"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "start");
    disableReminder(db, created.value.id, "start");
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.startReminderEnabled, false);
    assert.equal(listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id).length, 0);
  });

  it("disables and queues delete when an enabled date is cleared", () => {
    const convention = createConvention(db, { displayName: "Clear Date Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2031"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "application_start");
    db.update(editions)
      .set({ applicationStartDateCalendarEventId: "evt-clear-1" })
      .where(eq(editions.id, created.value.id))
      .run();
    const openCreate = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    db.update(calendarSync).set({ state: "done" }).where(eq(calendarSync.id, openCreate!.id)).run();

    const cleared = updateEdition(
      db,
      created.value.id,
      { ...editionInput(convention.value.id, "2031"), applicationStartDate: null },
      "2026-11-09",
    );
    assert.equal(cleared.ok, true);
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.applicationStartReminderEnabled, false);
    const open = listOpenCalendarSync(db).filter((row) => row.editionId === created.value.id);
    assert.equal(open.length, 1);
    assert.equal(open[0]?.action, "delete");
    assert.equal(open[0]?.googleEventId, "evt-clear-1");
  });

  it("queues delete with the stored event id before an edition is removed", () => {
    const convention = createConvention(db, { displayName: "Delete Edition Reminder Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2032"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "start");
    db.update(editions)
      .set({ startDateCalendarEventId: "evt-del-1" })
      .where(eq(editions.id, created.value.id))
      .run();
    const openCreate = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    db.update(calendarSync).set({ state: "done" }).where(eq(calendarSync.id, openCreate!.id)).run();

    const deleted = deleteEdition(db, created.value.id);
    assert.equal(deleted.ok, true);
    const open = listOpenCalendarSync(db).filter((row) => row.googleEventId === "evt-del-1");
    assert.equal(open.length, 1);
    assert.equal(open[0]?.action, "delete");
    assert.equal(open[0]?.editionId, null);
  });

  it("queues calendar deletes when a convention is deleted", () => {
    const convention = createConvention(db, { displayName: "Delete Con Reminder", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2033"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "start");
    db.update(editions)
      .set({ startDateCalendarEventId: "evt-con-del" })
      .where(eq(editions.id, created.value.id))
      .run();
    const openCreate = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    db.update(calendarSync).set({ state: "done" }).where(eq(calendarSync.id, openCreate!.id)).run();

    const deleted = deleteConvention(db, convention.value.id);
    assert.equal(deleted.ok, true);
    const open = listOpenCalendarSync(db).filter((row) => row.googleEventId === "evt-con-del");
    assert.equal(open.length, 1);
    assert.equal(open[0]?.action, "delete");
  });

  it("rejects Add reminder when the date is empty", () => {
    const convention = createConvention(db, { displayName: "Empty Date Reminder", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, {
      ...editionInput(convention.value.id, "2034"),
      startDate: null,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const result = enableReminder(db, created.value.id, "start");
    assert.equal(result.ok, false);
  });

  it("retries a failed sync by moving it back to queued", () => {
    const convention = createConvention(db, { displayName: "Retry Sync Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2035"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "start");
    const open = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    assert.ok(open);
    db.update(calendarSync)
      .set({ state: "failed", lastError: "boom" })
      .where(eq(calendarSync.id, open.id))
      .run();

    const retried = retryCalendarSync(db, open.id);
    assert.equal(retried.ok, true);
    const after = db.select().from(calendarSync).where(eq(calendarSync.id, open.id)).get();
    assert.equal(after?.state, "queued");
    assert.equal(after?.lastError, null);
  });
});
