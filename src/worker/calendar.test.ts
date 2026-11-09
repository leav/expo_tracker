import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { calendarSync, editions } from "../db/schema";
import { disableReminder, enableReminder, listOpenCalendarSync, retryCalendarSync } from "../domain/calendarSync";
import { createConvention } from "../domain/conventions";
import type { TrackerDb } from "../domain/db";
import { createEdition, updateEdition } from "../domain/editions";
import { disconnectGoogle, saveGoogleConnection } from "../domain/settings";
import { createFakeCalendarClient } from "../google/fake";
import { processCalendarSync } from "./calendar";

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

describe("processCalendarSync", () => {
  let sqlite: Database.Database;
  let db: TrackerDb;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "drizzle" });
  });

  afterEach(() => {
    sqlite.close();
  });

  it("makes no Calendar calls without credentials", async () => {
    const convention = createConvention(db, { displayName: "Offline Sync Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2027"));
    assert.equal(created.ok, true);
    if (!created.ok) return;
    enableReminder(db, created.value.id, "application_start");
    const fake = createFakeCalendarClient();
    await processCalendarSync(db);
    assert.equal(fake.calls.length, 0);
    const open = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    assert.equal(open?.state, "queued");
    assert.equal(open?.action, "create");
  });

  it("creates one event, patches on date change, and does not create a second", async () => {
    const convention = createConvention(db, { displayName: "FanimeCon", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2028"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "application_start");
    const fake = createFakeCalendarClient();
    await processCalendarSync(db, fake.client);
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.applicationStartDateCalendarEventId, "fake-event-1");
    assert.deepEqual(fake.calls, [
      { op: "create", summary: "FanimeCon 2028 artist alley opens", date: "2026-11-08" },
    ]);

    updateEdition(
      db,
      created.value.id,
      { ...editionInput(convention.value.id, "2028"), applicationStartDate: "2026-11-20" },
      "2026-11-09",
    );
    await processCalendarSync(db, fake.client);
    const afterPatch = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(afterPatch?.applicationStartDateCalendarEventId, "fake-event-1");
    assert.equal(fake.calls.filter((call) => call.op === "create").length, 1);
    assert.deepEqual(fake.calls[1], {
      op: "patch",
      eventId: "fake-event-1",
      summary: "FanimeCon 2028 artist alley opens",
      date: "2026-11-20",
    });
  });

  it("deletes the event when the reminder is removed", async () => {
    const convention = createConvention(db, { displayName: "Remove Event Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2029"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const fake = createFakeCalendarClient();
    enableReminder(db, created.value.id, "start");
    await processCalendarSync(db, fake.client);
    disableReminder(db, created.value.id, "start");
    await processCalendarSync(db, fake.client);
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.startDateCalendarEventId, null);
    assert.equal(stored?.startReminderEnabled, false);
    assert.equal(fake.calls.at(-1)?.op, "delete");
  });

  it("keeps a failed fake call queued with an error and succeeds on retry", async () => {
    const convention = createConvention(db, { displayName: "Failing Sync Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2030"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    enableReminder(db, created.value.id, "start");
    const fake = createFakeCalendarClient({ failuresRemaining: 1 });
    await processCalendarSync(db, fake.client);
    const failed = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    assert.equal(failed?.state, "failed");
    assert.equal(failed?.lastError, "fake Calendar failure");
    assert.equal(fake.calls.length, 0);

    const retried = retryCalendarSync(db, failed!.id);
    assert.equal(retried.ok, true);
    await processCalendarSync(db, fake.client);
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.startDateCalendarEventId, "fake-event-1");
    const after = db.select().from(calendarSync).where(eq(calendarSync.id, failed!.id)).get();
    assert.equal(after?.state, "done");
  });

  it("retains local reminder flags after disconnect and makes no Calendar calls", async () => {
    const convention = createConvention(db, { displayName: "Disconnect Con", website: null, notes: null });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;
    const created = createEdition(db, editionInput(convention.value.id, "2031"));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    saveGoogleConnection(db, {
      email: "owner@example.com",
      refreshToken: "refresh",
      accessToken: "access",
      expiry: Date.now() + 60_000,
      scopes: "email",
      ownerEmailEnv: null,
    });
    enableReminder(db, created.value.id, "application_start");
    const fake = createFakeCalendarClient();
    await processCalendarSync(db, fake.client);
    assert.equal(fake.calls.length, 1);

    disconnectGoogle(db);
    updateEdition(
      db,
      created.value.id,
      { ...editionInput(convention.value.id, "2031"), applicationStartDate: "2026-12-01" },
      "2026-11-09",
    );
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.applicationStartReminderEnabled, true);

    const afterDisconnect = createFakeCalendarClient();
    await processCalendarSync(db);
    assert.equal(afterDisconnect.calls.length, 0);
    const open = listOpenCalendarSync(db).find((row) => row.editionId === created.value.id);
    assert.equal(open?.action, "patch");
    assert.equal(open?.state, "queued");
  });
});
