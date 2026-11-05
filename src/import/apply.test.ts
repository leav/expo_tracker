import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { conventions, editions } from "../db/schema";
import type { TrackerDb } from "../domain/db";
import { acceptAlias, acceptMerge, applyParsedRows, listPendingProposals } from "./apply";
import { parseSheet } from "./parse";

const header = "名称,地点,开展日期,申请日期,申请结果,状态,预计总人流,官方网页,其他连接,注释";

const fixture = [
  header,
  'FanimeCon 26,,5/22/2026,,,申请已结束,"27,500",fanime.com,,',
  'FanimeCon 27,San Jose,5/22/2027,11/08/2026,,留意中,"27,500",fanime.com,,限时申请',
  "SacAnime Summer 26,,9/4/2026,6/5/2026,6/17/2026,已拒绝,\"21,000\",https://sacanime.com/,,",
  "SacAnime Winter 27,Sacramento,1/8/2027,10/12/2026,10/19/2026,已申请,\"20,000 - 25,000\",https://sacanime.com/,,",
  'Comic Market 108,,8/15/2026,,,申请已结束,"750,000",https://www.comiket.co.jp/index_e.html,,',
  'Comic Market 109,,,,,申请已结束,"750,000",https://www.comiket.co.jp/index_e.html,,',
  'Zenkaikon,"Lancaster, PA",3/18/2027,2026-09-12,,申请已结束,"9,000+",https://zenkaikon.com/,,AA申请 9/12 - 9/20',
  'Magwest,SAN JOSE,8/12/2026,,,Pass,"1,000+",https://magwest.org/,,',
  'castlepoint (cpac),"Secaucus, NJ",4/24/2027,,12/11/2026,已申请,5000,https://www.castlepointanime.com/,,',
].join("\n");

describe("sheet import apply", () => {
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

  it("proposes identity merges, lands Magwest, and leaves Zenkaikon in review", () => {
    const rows = parseSheet(fixture, "2026-11-04");
    const first = applyParsedRows(db, rows);
    assert.equal(first.mergesProposed, 3);
    assert.equal(first.unresolvedProposed, 1);
    assert.equal(first.aliasesProposed, 1);

    const magwest = db.select().from(conventions).where(eq(conventions.normalized, "magwest")).get();
    assert.equal(magwest?.estimatedAttendance, 1000);
    const magwestEdition = db.select().from(editions).where(eq(editions.conventionId, magwest?.id ?? 0)).get();
    assert.equal(magwestEdition?.status, "skipped");

    assert.equal(db.select().from(conventions).where(eq(conventions.normalized, "fanimecon")).get(), undefined);
    assert.equal(db.select().from(conventions).where(eq(conventions.normalized, "zenkaikon")).get(), undefined);

    const pending = listPendingProposals(db);
    assert.equal(pending.some((item) => item.kind === "unresolved" && item.dedupeKey === "unresolved:Zenkaikon"), true);

    for (const merge of pending.filter((item) => item.kind === "merge")) {
      const result = acceptMerge(db, merge.id);
      assert.equal(result.ok, true);
    }

    const fanime = db.select().from(conventions).where(eq(conventions.normalized, "fanimecon")).get();
    const sacanime = db.select().from(conventions).where(eq(conventions.normalized, "sacanime")).get();
    const comicMarket = db.select().from(conventions).where(eq(conventions.normalized, "comicmarket")).get();
    assert.equal(fanime?.displayName, "FanimeCon");
    assert.equal(fanime?.estimatedAttendance, 27500);
    assert.equal(fanime?.defaultCity, "San Jose");
    assert.equal(sacanime?.displayName, "SacAnime");
    assert.equal(comicMarket?.displayName, "Comic Market");

    const fanimeEditions = db.select().from(editions).where(eq(editions.conventionId, fanime?.id ?? 0)).all();
    assert.equal(fanimeEditions.length, 2);
    const fanime27 = fanimeEditions.find((row) => row.cycleLabel === "2027");
    assert.equal(fanime27?.applicationStartDate, "2026-11-08");
    assert.equal(fanime27?.status, "waiting_to_apply");
    assert.equal(fanime27?.startDateCalendarEventId, null);

    const sacanimeEditions = db.select().from(editions).where(eq(editions.conventionId, sacanime?.id ?? 0)).all();
    assert.equal(sacanimeEditions.length, 2);
    const comicMarketEditions = db.select().from(editions).where(eq(editions.conventionId, comicMarket?.id ?? 0)).all();
    assert.equal(comicMarketEditions.length, 2);

    const alias = listPendingProposals(db).find((item) => item.kind === "alias");
    assert.ok(alias);
    const acceptedAlias = acceptAlias(db, alias.id);
    assert.equal(acceptedAlias.ok, true);

    db.update(conventions).set({ estimatedAttendance: 1 }).where(eq(conventions.id, fanime?.id ?? 0)).run();
    const again = applyParsedRows(db, rows);
    assert.equal(db.select().from(conventions).where(eq(conventions.normalized, "fanimecon")).all().length, 1);
    assert.equal(db.select().from(editions).where(eq(editions.conventionId, fanime?.id ?? 0)).all().length, 2);
    assert.equal(
      db.select().from(conventions).where(eq(conventions.normalized, "fanimecon")).get()?.estimatedAttendance,
      1,
    );
    assert.equal(
      listPendingProposals(db).some((item) => item.kind === "unresolved" && item.dedupeKey === "unresolved:Zenkaikon"),
      true,
    );
    assert.equal(again.editionsUpserted >= 1, true);
  });
});
