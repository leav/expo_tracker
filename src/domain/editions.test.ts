import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { editions } from "../db/schema";
import { createConvention } from "./conventions";
import type { TrackerDb } from "./db";
import { createEdition, markEditionPassed, setEditionPaid } from "./editions";
import { initialStatus, todayInLosAngeles } from "./status";

describe("edition writes", () => {
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

  it("creates a tracking edition and then marks it passed without setting paid", () => {
    const convention = createConvention(db, {
      displayName: "FanimeCon",
      website: null,
      notes: null,
    });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;

    const created = createEdition(db, {
      conventionId: convention.value.id,
      cycleLabel: "2027",
      startDate: null,
      endDate: null,
      applicationStartDate: "2026-11-08",
      applicationEndDate: null,
      venue: null,
      city: null,
      region: null,
      country: null,
      attendance: null,
      intent: "tracking",
      status: "unknown",
      submittedAt: null,
      resultAt: null,
      paid: false,
      notes: null,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.intent, "tracking");
    assert.equal(stored?.status, initialStatus("2026-11-08", todayInLosAngeles()));
    assert.equal(stored?.applicationConfirmed, true);
    assert.equal(stored?.paid, false);

    const skipped = markEditionPassed(db, created.value.id);
    assert.equal(skipped.ok, true);
    const passed = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(passed?.intent, "skip");
    assert.equal(passed?.status, "passed");
    assert.equal(passed?.paid, false);

    const paid = setEditionPaid(db, created.value.id, true);
    assert.equal(paid.ok, false);
  });
});
