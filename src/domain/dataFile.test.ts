import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { loadSqlJsNode } from "../db/engine-node";
import { openMemoryDatabase } from "../db/memory";
import { aliases, conventions, editionLinks, editions } from "../db/schema";
import { addAlias } from "./aliases";
import { createConvention } from "./conventions";
import {
  applyDataFile,
  dataFileDownloadName,
  dataFileFromBytes,
  exportDataFile,
  parseDataFile,
  previewDataFile,
  type DataFile,
} from "./dataFile";
import type { TrackerDb } from "./db";
import { createEdition } from "./editions";

async function withDb(run: (db: TrackerDb, exportBytes: () => Uint8Array) => void | Promise<void>) {
  const opened = await openMemoryDatabase();
  try {
    await run(opened.db, () => {
      const bytes = opened.sqlite.export();
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return copy;
    });
  } finally {
    opened.sqlite.close();
  }
}

function seedFanime(db: TrackerDb, status: "submitted" | "open" = "submitted") {
  const convention = createConvention(db, {
    displayName: "FanimeCon",
    website: "https://www.fanime.com",
    notes: "personal notes",
    defaultCity: "San Jose",
    defaultRegion: "CA",
    estimatedAttendance: 25000,
    manualInterest: 2,
  });
  assert.equal(convention.ok, true);
  if (!convention.ok) return { conventionId: 0, editionId: 0 };
  addAlias(db, { conventionId: convention.value.id, name: "Fanime" });
  const edition = createEdition(db, {
    conventionId: convention.value.id,
    cycleLabel: "2027",
    startDate: "2027-05-21",
    endDate: "2027-05-24",
    applicationStartDate: "2026-12-01",
    applicationEndDate: "2027-01-15",
    status,
    submittedAt: status === "submitted" ? "2026-12-02" : null,
    resultDate: null,
    paid: false,
    notes: "bring extra prints",
    inferInitialStatus: false,
  });
  assert.equal(edition.ok, true);
  if (!edition.ok) return { conventionId: convention.value.id, editionId: 0 };
  db.insert(editionLinks)
    .values({ editionId: edition.value.id, url: "https://example.com/apply", kind: "eventeny" })
    .run();
  return { conventionId: convention.value.id, editionId: edition.value.id };
}

function seedOther(db: TrackerDb) {
  const convention = createConvention(db, {
    displayName: "SacAnime",
    website: null,
    notes: null,
    defaultCity: "Sacramento",
    defaultRegion: "CA",
  });
  assert.equal(convention.ok, true);
  if (!convention.ok) return 0;
  createEdition(db, {
    conventionId: convention.value.id,
    cycleLabel: "2026-winter",
    startDate: "2026-01-16",
    endDate: null,
    applicationStartDate: null,
    applicationEndDate: null,
    status: "approved",
    submittedAt: null,
    resultDate: null,
    paid: true,
    notes: null,
    inferInitialStatus: false,
  });
  return convention.value.id;
}

describe("data file export", () => {
  it("omits application status and other personal fields when asked", async () => {
    await withDb((db) => {
      seedFanime(db);
      const withStatus = exportDataFile(db, { includeApplicationStatus: true });
      assert.equal(withStatus.conventions[0]?.interest, 2);
      assert.equal(withStatus.conventions[0]?.notes, "personal notes");
      assert.equal(withStatus.conventions[0]?.editions?.[0]?.status, "submitted");
      assert.equal(withStatus.conventions[0]?.editions?.[0]?.submittedAt, "2026-12-02");
      assert.equal(withStatus.conventions[0]?.editions?.[0]?.paid, false);
      assert.equal(withStatus.conventions[0]?.editions?.[0]?.notes, "bring extra prints");

      const shared = exportDataFile(db, { includeApplicationStatus: false });
      assert.equal("interest" in shared.conventions[0]!, false);
      assert.equal("notes" in shared.conventions[0]!, false);
      const edition = shared.conventions[0]?.editions?.[0];
      assert.ok(edition);
      assert.equal("status" in edition, false);
      assert.equal("submittedAt" in edition, false);
      assert.equal("resultDate" in edition, false);
      assert.equal("paid" in edition, false);
      assert.equal("notes" in edition, false);
      assert.equal(edition.eventStart, "2027-05-21");
      assert.equal(edition.links?.[0]?.kind, "eventeny");
      assert.deepEqual(shared.conventions[0]?.aliases, ["Fanime"]);
    });
  });

  it("exports a subset of expos", async () => {
    await withDb((db) => {
      const fanime = seedFanime(db);
      seedOther(db);
      const doc = exportDataFile(db, { conventionIds: [fanime.conventionId] });
      assert.deepEqual(
        doc.conventions.map((row) => row.name),
        ["FanimeCon"],
      );
    });
  });

  it("names the download with the local calendar date", () => {
    assert.equal(dataFileDownloadName(new Date(2026, 10, 11, 23, 0, 0)), "expo-tracker-2026-11-11.json");
  });
});

describe("data file parse", () => {
  it("rejects invalid documents", () => {
    assert.equal(parseDataFile("{").ok, false);
    assert.equal(parseDataFile(JSON.stringify({ format: "other", version: 1, conventions: [] })).ok, false);
    assert.equal(parseDataFile(JSON.stringify({ format: "expo-tracker", version: 2, conventions: [] })).ok, false);
    const badStatus = parseDataFile(
      JSON.stringify({
        format: "expo-tracker",
        version: 1,
        conventions: [{ name: "FanimeCon", editions: [{ cycle: "2027", status: "nope" }] }],
      }),
    );
    assert.equal(badStatus.ok, false);
    const badDate = parseDataFile(
      JSON.stringify({
        format: "expo-tracker",
        version: 1,
        conventions: [{ name: "FanimeCon", editions: [{ cycle: "2027", eventStart: "05/21/2027" }] }],
      }),
    );
    assert.equal(badDate.ok, false);
  });

  it("ignores unknown keys", () => {
    const parsed = parseDataFile(
      JSON.stringify({
        format: "expo-tracker",
        version: 1,
        extra: true,
        conventions: [{ name: "FanimeCon", favorite: "yes", editions: [{ cycle: "2027", booth: "A1" }] }],
      }),
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.conventions[0]?.name, "FanimeCon");
    assert.equal(parsed.value.conventions[0]?.editions?.[0]?.cycle, "2027");
  });
});

describe("data file merge and replace", () => {
  it("matches an alias and does not clobber omitted status", async () => {
    await withDb((db) => {
      seedFanime(db, "submitted");
      const shared: DataFile = {
        format: "expo-tracker",
        version: 1,
        conventions: [
          {
            name: "Fanime",
            city: "San Jose",
            editions: [{ cycle: "2027", eventStart: "2027-05-22", eventEnd: "2027-05-25" }],
          },
        ],
      };
      const preview = previewDataFile(db, shared, { replace: false });
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.deepEqual(preview.value, {
        added: 0,
        updated: 1,
        removed: 0,
        warnings: [],
        rows: [
          {
            expoName: "FanimeCon",
            expoChange: null,
            editions: [{ cycle: "2027", change: "modified" }],
          },
        ],
      });

      const applied = applyDataFile(db, shared, { replace: false });
      assert.equal(applied.ok, true);
      const row = db.select().from(editions).all()[0];
      assert.equal(row?.status, "submitted");
      assert.equal(row?.submittedAt, "2026-12-02");
      assert.equal(row?.startDate, "2027-05-22");
      assert.equal(row?.endDate, "2027-05-25");
      const convention = db.select().from(conventions).all()[0];
      assert.equal(convention?.displayName, "FanimeCon");
    });
  });

  it("adds a new expo and a new edition on an existing expo", async () => {
    await withDb((db) => {
      seedFanime(db);
      const doc: DataFile = {
        format: "expo-tracker",
        version: 1,
        conventions: [
          {
            name: "FanimeCon",
            editions: [{ cycle: "2028", eventStart: "2028-05-26", status: "waiting_to_apply" }],
          },
          { name: "[MOCK] Calendar Con", city: "Oakland", state: "CA" },
        ],
      };
      const preview = previewDataFile(db, doc);
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.equal(preview.value.added, 1);
      assert.equal(preview.value.updated, 1);
      assert.equal(preview.value.removed, 0);
      assert.deepEqual(preview.value.rows, [
        {
          expoName: "FanimeCon",
          expoChange: null,
          editions: [{ cycle: "2028", change: "added" }],
        },
        { expoName: "[MOCK] Calendar Con", expoChange: "added", editions: [] },
      ]);

      const applied = applyDataFile(db, doc);
      assert.equal(applied.ok, true);
      const names = new Set(
        db.select({ name: conventions.displayName }).from(conventions).all().map((row) => row.name),
      );
      assert.deepEqual(names, new Set(["[MOCK] Calendar Con", "FanimeCon"]));
      const cycles = db
        .select({ cycle: editions.cycleLabel })
        .from(editions)
        .all()
        .map((row) => row.cycle)
        .sort();
      assert.deepEqual(cycles, ["2027", "2028"]);
    });
  });

  it("does not delete on merge and removes extras on replace", async () => {
    await withDb((db) => {
      const fanime = seedFanime(db);
      seedOther(db);
      const onlyFanime = exportDataFile(db, {
        includeApplicationStatus: true,
        conventionIds: [fanime.conventionId],
      });

      const merged = applyDataFile(db, onlyFanime, { replace: false });
      assert.equal(merged.ok, true);
      assert.equal(db.select().from(conventions).all().length, 2);

      const preview = previewDataFile(db, onlyFanime, { replace: true });
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.equal(preview.value.added, 0);
      assert.equal(preview.value.updated, 1);
      assert.equal(preview.value.removed, 1);
      assert.equal(preview.value.rows.at(-1)?.expoName, "SacAnime");
      assert.equal(preview.value.rows.at(-1)?.expoChange, "removed");

      const replaced = applyDataFile(db, onlyFanime, { replace: true });
      assert.equal(replaced.ok, true);
      const remaining = db.select({ name: conventions.displayName }).from(conventions).all();
      assert.deepEqual(
        remaining.map((row) => row.name),
        ["FanimeCon"],
      );
    });
  });

  it("skips an alias owned by another expo", async () => {
    await withDb((db) => {
      seedFanime(db);
      seedOther(db);
      const doc: DataFile = {
        format: "expo-tracker",
        version: 1,
        conventions: [{ name: "SacAnime", aliases: ["Fanime"] }],
      };
      const preview = previewDataFile(db, doc);
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.equal(preview.value.warnings.length, 1);
      assert.match(preview.value.warnings[0] ?? "", /Fanime/);
      applyDataFile(db, doc);
      const stolen = db.select().from(aliases).where(eq(aliases.name, "Fanime")).all();
      assert.equal(stolen.length, 1);
    });
  });

  it("round-trips sqlite bytes through the same document shape", async () => {
    await withDb(async (db, exportBytes) => {
      seedFanime(db);
      const fromLive = exportDataFile(db, { includeApplicationStatus: true });
      const bytes = exportBytes();
      const parsed = dataFileFromBytes(await loadSqlJsNode(), bytes);
      assert.equal(parsed.ok, true);
      if (!parsed.ok) return;
      assert.equal(parsed.value.source, "sqlite");
      assert.deepEqual(parsed.value.document, fromLive);
    });
  });
});
