import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "sql.js";
import { openMemoryDatabase } from "../db/memory";
import { aliases, conventions, editionLinks, editions } from "../db/schema";
import { addAlias } from "./aliases";
import { createConvention } from "./conventions";
import type { TrackerDb } from "./db";
import { createEdition } from "./editions";
import { cleanMockData, isMockConventionName, isMockCycleLabel } from "./mock";

function editionInput(conventionId: number, cycleLabel: string) {
  return {
    conventionId,
    cycleLabel,
    startDate: null,
    endDate: null,
    applicationStartDate: null,
    applicationEndDate: null,
    status: "unknown" as const,
    submittedAt: null,
    resultDate: null,
    paid: false,
    notes: null,
  };
}

describe("mock naming", () => {
  it("recognizes mock convention name prefixes", () => {
    assert.equal(isMockConventionName("[MOCK] Calendar Con"), true);
    assert.equal(isMockConventionName("[mock] Lineups Board"), true);
    assert.equal(isMockConventionName("MOCK: Status Con"), true);
    assert.equal(isMockConventionName("MOCK - Delete Con"), true);
    assert.equal(isMockConventionName("Mock Interest Con"), true);
    assert.equal(isMockConventionName("FanimeCon"), false);
    assert.equal(isMockConventionName("Mockingbird Con"), false);
    assert.equal(isMockConventionName("  [MOCK] Padded  "), true);
  });

  it("recognizes mock cycle label prefixes", () => {
    assert.equal(isMockCycleLabel("mock-2027"), true);
    assert.equal(isMockCycleLabel("mock_2027"), true);
    assert.equal(isMockCycleLabel("mock:2027"), true);
    assert.equal(isMockCycleLabel("mock 2027"), true);
    assert.equal(isMockCycleLabel("[mock]2027"), true);
    assert.equal(isMockCycleLabel("mock"), true);
    assert.equal(isMockCycleLabel("MOCK-2027"), true);
    assert.equal(isMockCycleLabel("2027"), false);
    assert.equal(isMockCycleLabel("2027-summer"), false);
    assert.equal(isMockCycleLabel("mocking"), false);
  });
});

describe("cleanMockData", () => {
  let sqlite: Database;
  let db: TrackerDb;

  before(async () => {
    const opened = await openMemoryDatabase();
    sqlite = opened.sqlite;
    db = opened.db;
  });

  after(() => {
    sqlite.close();
  });

  it("deletes mock conventions and orphan mock-cycle editions, leaving real data", () => {
    const real = createConvention(db, {
      displayName: "FanimeCon",
      website: null,
      notes: null,
    });
    assert.equal(real.ok, true);
    if (!real.ok) return;

    const mock = createConvention(db, {
      displayName: "[MOCK] Cleanup Con",
      website: null,
      notes: null,
    });
    assert.equal(mock.ok, true);
    if (!mock.ok) return;

    const alias = addAlias(db, { conventionId: mock.value.id, name: "MCC" });
    assert.equal(alias.ok, true);

    const realEdition = createEdition(db, editionInput(real.value.id, "2027"));
    const orphanMockEdition = createEdition(db, editionInput(real.value.id, "mock-2028"));
    const mockEdition = createEdition(db, editionInput(mock.value.id, "2027"));
    assert.equal(realEdition.ok, true);
    assert.equal(orphanMockEdition.ok, true);
    assert.equal(mockEdition.ok, true);
    if (!realEdition.ok || !orphanMockEdition.ok || !mockEdition.ok) return;

    db.insert(editionLinks)
      .values({ editionId: mockEdition.value.id, url: "https://example.com/mock", kind: "website" })
      .run();
    db.insert(editionLinks)
      .values({
        editionId: orphanMockEdition.value.id,
        url: "https://example.com/orphan",
        kind: "website",
      })
      .run();

    const summary = cleanMockData(db);

    assert.deepEqual(summary.deletedConventions, [
      { id: mock.value.id, displayName: "[MOCK] Cleanup Con" },
    ]);
    assert.deepEqual(summary.deletedEditions, [
      {
        id: orphanMockEdition.value.id,
        conventionId: real.value.id,
        cycleLabel: "mock-2028",
      },
    ]);

    assert.ok(db.select().from(conventions).where(eq(conventions.id, real.value.id)).get());
    assert.equal(db.select().from(conventions).where(eq(conventions.id, mock.value.id)).get(), undefined);
    assert.equal(
      db.select().from(aliases).where(eq(aliases.conventionId, mock.value.id)).all().length,
      0,
    );
    assert.ok(db.select().from(editions).where(eq(editions.id, realEdition.value.id)).get());
    assert.equal(db.select().from(editions).where(eq(editions.id, mockEdition.value.id)).get(), undefined);
    assert.equal(
      db.select().from(editions).where(eq(editions.id, orphanMockEdition.value.id)).get(),
      undefined,
    );
    assert.equal(
      db.select().from(editionLinks).where(eq(editionLinks.editionId, mockEdition.value.id)).all()
        .length,
      0,
    );
    assert.equal(
      db
        .select()
        .from(editionLinks)
        .where(eq(editionLinks.editionId, orphanMockEdition.value.id))
        .all().length,
      0,
    );
  });

  it("returns empty when nothing matches", () => {
    const summary = cleanMockData(db);
    assert.deepEqual(summary, { deletedConventions: [], deletedEditions: [] });
    assert.ok(db.select().from(conventions).where(eq(conventions.displayName, "FanimeCon")).get());
  });
});
