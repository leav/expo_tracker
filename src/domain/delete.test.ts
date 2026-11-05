import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { aliases, conventions, editionLinks, editions } from "../db/schema";
import { addAlias } from "./aliases";
import { createConvention, deleteConvention } from "./conventions";
import type { TrackerDb } from "./db";
import { createEdition, deleteEdition } from "./editions";

function editionInput(conventionId: number, cycleLabel: string) {
  return {
    conventionId,
    cycleLabel,
    startDate: null,
    endDate: null,
    applicationStartDate: null,
    applicationEndDate: null,
    city: null,
    region: null,
    status: "unknown" as const,
    submittedAt: null,
    resultDate: null,
    paid: false,
    notes: null,
  };
}

describe("delete convention and edition", () => {
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

  it("deletes an edition and its links, leaving siblings and the convention", () => {
    const convention = createConvention(db, {
      displayName: "Delete Edition Con",
      website: null,
      notes: null,
    });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;

    const first = createEdition(db, editionInput(convention.value.id, "2026"));
    const second = createEdition(db, editionInput(convention.value.id, "2027"));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;

    db.insert(editionLinks)
      .values({ editionId: first.value.id, url: "https://example.com/2026", kind: "website" })
      .run();
    db.insert(editionLinks)
      .values({ editionId: second.value.id, url: "https://example.com/2027", kind: "website" })
      .run();

    const deleted = deleteEdition(db, first.value.id);
    assert.equal(deleted.ok, true);

    assert.equal(db.select().from(editions).where(eq(editions.id, first.value.id)).get(), undefined);
    assert.equal(
      db.select().from(editionLinks).where(eq(editionLinks.editionId, first.value.id)).all().length,
      0,
    );
    assert.ok(db.select().from(editions).where(eq(editions.id, second.value.id)).get());
    assert.equal(
      db.select().from(editionLinks).where(eq(editionLinks.editionId, second.value.id)).all().length,
      1,
    );
    assert.ok(db.select().from(conventions).where(eq(conventions.id, convention.value.id)).get());
  });

  it("deletes a convention with aliases, editions, and links", () => {
    const convention = createConvention(db, {
      displayName: "Delete Con Series",
      website: null,
      notes: null,
    });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;

    const alias = addAlias(db, { conventionId: convention.value.id, name: "DCS" });
    assert.equal(alias.ok, true);

    const edition = createEdition(db, editionInput(convention.value.id, "2028"));
    assert.equal(edition.ok, true);
    if (!edition.ok) return;

    db.insert(editionLinks)
      .values({ editionId: edition.value.id, url: "https://example.com/dcs", kind: "website" })
      .run();

    const deleted = deleteConvention(db, convention.value.id);
    assert.equal(deleted.ok, true);

    assert.equal(db.select().from(conventions).where(eq(conventions.id, convention.value.id)).get(), undefined);
    assert.equal(
      db.select().from(aliases).where(eq(aliases.conventionId, convention.value.id)).all().length,
      0,
    );
    assert.equal(
      db.select().from(editions).where(eq(editions.conventionId, convention.value.id)).all().length,
      0,
    );
    assert.equal(
      db.select().from(editionLinks).where(eq(editionLinks.editionId, edition.value.id)).all().length,
      0,
    );
  });

  it("returns gone errors for missing ids", () => {
    assert.deepEqual(deleteConvention(db, 999999), { ok: false, error: "That convention is gone." });
    assert.deepEqual(deleteEdition(db, 999999), { ok: false, error: "That edition is gone." });
  });
});
