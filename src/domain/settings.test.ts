import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import type { TrackerDb } from "./db";
import { getSettings, updateSettings } from "./settings";

describe("settings", () => {
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

  it("seeds defaults and updates drive-limit hours", () => {
    const current = getSettings(db);
    assert.equal(current.timezone, "America/Los_Angeles");
    assert.equal(current.driveLimitHours, 12);

    const updated = updateSettings(db, { driveLimitHours: 8 });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.value.driveLimitHours, 8);
  });
});
