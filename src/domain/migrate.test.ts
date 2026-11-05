import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";

function sqlFile(name: string): string {
  return fs.readFileSync(`drizzle/${name}`, "utf8").replaceAll("--> statement-breakpoint", "");
}

describe("0002 core workspace migration", () => {
  let sqlite: Database.Database;

  before(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(sqlFile("0000_powerful_lenny_balinger.sql"));
    sqlite.exec(sqlFile("0001_import_review.sql"));
    sqlite
      .prepare(
        "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      )
      .run("FanimeCon", "fanimecon", null, 0, null);
    sqlite
      .prepare(
        `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, "2026", "2026-05-22", null, 27500, "applying", "accepted", "2026-01-01", 0, null, "FanimeCon 26");
    sqlite
      .prepare(
        `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, "2027", "2027-05-22", "San Jose", null, "tracking", "not_open", null, 0, null, "FanimeCon 27");
    sqlite.exec(sqlFile("0002_core_workspace.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("maps statuses, consolidates attendance, and seeds location defaults", () => {
    const convention = sqlite.prepare("SELECT * FROM convention WHERE id = 1").get() as {
      estimated_attendance: number | null;
      default_city: string | null;
      polling_enabled?: number;
    };
    const editions = sqlite.prepare("SELECT cycle_label, status, city FROM edition ORDER BY cycle_label").all() as {
      cycle_label: string;
      status: string;
      city: string | null;
    }[];
    const columns = sqlite.prepare("PRAGMA table_info(edition)").all() as { name: string }[];
    const columnNames = columns.map((column) => column.name);

    assert.equal(convention.estimated_attendance, 27500);
    assert.equal(convention.default_city, "San Jose");
    assert.equal("polling_enabled" in convention, false);
    assert.deepEqual(
      editions.map((row) => [row.cycle_label, row.status, row.city]),
      [
        ["2026", "approved", null],
        ["2027", "waiting_to_apply", "San Jose"],
      ],
    );
    assert.equal(columnNames.includes("intent"), false);
    assert.equal(columnNames.includes("attendance"), false);
    assert.equal(columnNames.includes("result_date"), true);
  });
});

describe("0003 city and state only migration", () => {
  let sqlite: Database.Database;

  before(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(sqlFile("0000_powerful_lenny_balinger.sql"));
    sqlite.exec(sqlFile("0001_import_review.sql"));
    sqlite
      .prepare(
        "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      )
      .run("FanimeCon", "fanimecon", null, 0, null);
    sqlite
      .prepare(
        `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, region, venue, country, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        1,
        "2027",
        "2027-05-22",
        "San Jose",
        "CA",
        "McEnery",
        "US",
        null,
        "tracking",
        "not_open",
        null,
        0,
        null,
        "FanimeCon 27",
      );
    sqlite.exec(sqlFile("0002_core_workspace.sql"));
    sqlite.exec(sqlFile("0003_city_state_only.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("drops unused location columns and keeps city and region", () => {
    const convention = sqlite.prepare("SELECT * FROM convention WHERE id = 1").get() as Record<string, unknown>;
    const edition = sqlite.prepare("SELECT * FROM edition WHERE cycle_label = '2027'").get() as {
      city: string | null;
      region: string | null;
    };
    const conventionColumns = (sqlite.prepare("PRAGMA table_info(convention)").all() as { name: string }[]).map(
      (column) => column.name,
    );
    const editionColumns = (sqlite.prepare("PRAGMA table_info(edition)").all() as { name: string }[]).map(
      (column) => column.name,
    );

    assert.equal(edition.city, "San Jose");
    assert.equal(edition.region, "CA");
    assert.equal(convention.default_city, "San Jose");
    assert.equal(convention.default_region, "CA");
    for (const name of ["default_venue", "default_address", "default_postal_code", "default_country"]) {
      assert.equal(conventionColumns.includes(name), false);
    }
    for (const name of ["venue", "address", "postal_code", "country"]) {
      assert.equal(editionColumns.includes(name), false);
    }
    assert.equal(conventionColumns.includes("default_city"), true);
    assert.equal(conventionColumns.includes("default_region"), true);
    assert.equal(editionColumns.includes("city"), true);
    assert.equal(editionColumns.includes("region"), true);
  });
});
