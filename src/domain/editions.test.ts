import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { editions } from "../db/schema";
import { createConvention, updateConvention } from "./conventions";
import { listCons } from "./cons";
import type { TrackerDb } from "./db";
import { createEdition, setEditionPaid, updateEdition } from "./editions";
import { listLineups } from "./lineups";
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

  it("keeps location on the convention and infers waiting_to_apply", () => {
    const convention = createConvention(db, {
      displayName: "FanimeCon",
      website: null,
      notes: null,
      defaultCity: "San Jose",
      defaultRegion: "CA",
      estimatedAttendance: 27500,
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
      status: "unknown",
      submittedAt: null,
      resultDate: null,
      paid: false,
      notes: null,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.status, initialStatus("2026-11-08", todayInLosAngeles()));
    assert.equal("city" in (stored ?? {}), false);
    assert.equal("region" in (stored ?? {}), false);
    assert.equal(stored?.paid, false);
    assert.equal("attendance" in (stored ?? {}), false);
    assert.equal("intent" in (stored ?? {}), false);

    const tilesBefore = listCons(db, "name", todayInLosAngeles());
    const fanimeBefore = tilesBefore.find((tile) => tile.conventionId === convention.value.id);
    assert.equal(fanimeBefore?.locationLabel, "San Jose, CA");

    const updated = updateConvention(db, {
      id: convention.value.id,
      displayName: "FanimeCon",
      website: null,
      notes: null,
      defaultCity: "San Francisco",
      defaultRegion: "CA",
      estimatedAttendance: 27500,
    });
    assert.equal(updated.ok, true);

    const tilesAfter = listCons(db, "name", todayInLosAngeles());
    const fanimeAfter = tilesAfter.find((tile) => tile.conventionId === convention.value.id);
    assert.equal(fanimeAfter?.locationLabel, "San Francisco, CA");

    const waiting = updateEdition(db, created.value.id, {
      conventionId: convention.value.id,
      cycleLabel: "2027",
      startDate: "2027-05-22",
      endDate: null,
      applicationStartDate: "2026-11-08",
      applicationEndDate: null,
      status: "waiting_to_apply",
      submittedAt: null,
      resultDate: null,
      paid: false,
      notes: null,
    });
    assert.equal(waiting.ok, true);
    const board = listLineups(db, todayInLosAngeles());
    const lineup = board.columns.flatMap((column) => column.items).find((item) => item.editionId === created.value.id);
    assert.equal(lineup?.city, "San Francisco");
    assert.equal(lineup?.region, "CA");
    assert.equal(lineup?.locationLabel, "San Francisco, CA");

    const skipped = updateEdition(db, created.value.id, {
      conventionId: convention.value.id,
      cycleLabel: "2027",
      startDate: null,
      endDate: null,
      applicationStartDate: "2026-11-08",
      applicationEndDate: null,
      status: "skipped",
      submittedAt: null,
      resultDate: null,
      paid: false,
      notes: null,
    });
    assert.equal(skipped.ok, true);
    const storedSkipped = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(storedSkipped?.status, "skipped");
    const paid = setEditionPaid(db, created.value.id, true);
    assert.equal(paid.ok, false);
  });
});
