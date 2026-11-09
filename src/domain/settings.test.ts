import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import type { TrackerDb } from "./db";
import {
  disconnectGoogle,
  getGoogleConnection,
  getSettings,
  saveGoogleConnection,
  updateSettings,
} from "./settings";

describe("settings and google connection", () => {
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
    assert.equal(current.calendarId, "primary");

    const updated = updateSettings(db, { driveLimitHours: 8, calendarId: "  " });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.value.driveLimitHours, 8);
    assert.equal(updated.value.calendarId, "primary");
  });

  it("stores the first Google account as owner and rejects a different account", () => {
    const first = saveGoogleConnection(db, {
      email: "owner@example.com",
      refreshToken: "refresh",
      accessToken: "access",
      expiry: Date.now() + 60_000,
      scopes: "email calendar.events",
      ownerEmailEnv: null,
    });
    assert.equal(first.ok, true);
    assert.equal(getSettings(db).ownerEmail, "owner@example.com");

    const mismatchEnv = saveGoogleConnection(db, {
      email: "other@example.com",
      refreshToken: "refresh",
      accessToken: "access",
      expiry: Date.now() + 60_000,
      scopes: "email",
      ownerEmailEnv: "owner@example.com",
    });
    assert.equal(mismatchEnv.ok, false);

    disconnectGoogle(db);
    assert.equal(getGoogleConnection(db), null);
    assert.equal(getSettings(db).ownerEmail, "owner@example.com");
  });
});
