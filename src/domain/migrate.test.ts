import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, describe, it } from "node:test";
import type { Database } from "sql.js";
import { loadSqlJsNode } from "../db/engine-node";
import { allRows, execSql, getRow, runSql } from "../db/raw";

function sqlFile(name: string): string {
  return fs.readFileSync(`drizzle/${name}`, "utf8").replaceAll("--> statement-breakpoint", "");
}

async function openRawSqlite(): Promise<Database> {
  const SQL = await loadSqlJsNode();
  return new SQL.Database();
}

describe("0002 core workspace migration", () => {
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    execSql(sqlite, sqlFile("0000_powerful_lenny_balinger.sql"));
    execSql(sqlite, sqlFile("0001_import_review.sql"));
    runSql(
      sqlite,
      "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      ["FanimeCon", "fanimecon", null, 0, null],
    );
    runSql(
      sqlite,
      `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, "2026", "2026-05-22", null, 27500, "applying", "accepted", "2026-01-01", 0, null, "FanimeCon 26"],
    );
    runSql(
      sqlite,
      `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, "2027", "2027-05-22", "San Jose", null, "tracking", "not_open", null, 0, null, "FanimeCon 27"],
    );
    execSql(sqlite, sqlFile("0002_core_workspace.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("maps statuses, consolidates attendance, and seeds location defaults", () => {
    const convention = getRow<{
      estimated_attendance: number | null;
      default_city: string | null;
      polling_enabled?: number;
    }>(sqlite, "SELECT * FROM convention WHERE id = 1");
    const editions = allRows<{
      cycle_label: string;
      status: string;
      city: string | null;
    }>(sqlite, "SELECT cycle_label, status, city FROM edition ORDER BY cycle_label");
    const columnNames = allRows<{ name: string }>(sqlite, "PRAGMA table_info(edition)").map((column) => column.name);

    assert.ok(convention);
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
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    execSql(sqlite, sqlFile("0000_powerful_lenny_balinger.sql"));
    execSql(sqlite, sqlFile("0001_import_review.sql"));
    runSql(
      sqlite,
      "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      ["FanimeCon", "fanimecon", null, 0, null],
    );
    runSql(
      sqlite,
      `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, region, venue, country, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, "2027", "2027-05-22", "San Jose", "CA", "McEnery", "US", null, "tracking", "not_open", null, 0, null, "FanimeCon 27"],
    );
    execSql(sqlite, sqlFile("0002_core_workspace.sql"));
    execSql(sqlite, sqlFile("0003_city_state_only.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("drops unused location columns and keeps city and region", () => {
    const convention = getRow<Record<string, unknown>>(sqlite, "SELECT * FROM convention WHERE id = 1");
    const edition = getRow<{
      city: string | null;
      region: string | null;
    }>(sqlite, "SELECT * FROM edition WHERE cycle_label = '2027'");
    const conventionColumns = allRows<{ name: string }>(sqlite, "PRAGMA table_info(convention)").map(
      (column) => column.name,
    );
    const editionColumns = allRows<{ name: string }>(sqlite, "PRAGMA table_info(edition)").map((column) => column.name);

    assert.ok(convention);
    assert.ok(edition);
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

describe("0004 skipped status migration", () => {
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    execSql(sqlite, sqlFile("0000_powerful_lenny_balinger.sql"));
    execSql(sqlite, sqlFile("0001_import_review.sql"));
    runSql(
      sqlite,
      "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      ["Magwest", "magwest", null, 0, null],
    );
    runSql(
      sqlite,
      `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, "2026", "2026-08-12", "SAN JOSE", null, "skip", "passed", null, 0, null, "Magwest 26"],
    );
    execSql(sqlite, sqlFile("0002_core_workspace.sql"));
    execSql(sqlite, sqlFile("0003_city_state_only.sql"));
    execSql(sqlite, sqlFile("0004_skipped_status.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("renames passed statuses to skipped", () => {
    const edition = getRow<{ status: string }>(sqlite, "SELECT status FROM edition WHERE cycle_label = '2026'");
    assert.ok(edition);
    assert.equal(edition.status, "skipped");
  });
});

describe("0005 edition location on convention migration", () => {
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    execSql(sqlite, sqlFile("0000_powerful_lenny_balinger.sql"));
    execSql(sqlite, sqlFile("0001_import_review.sql"));
    runSql(
      sqlite,
      "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      ["Empty City Con", "emptycitycon", null, 0, null],
    );
    runSql(
      sqlite,
      "INSERT INTO convention (display_name, normalized, website, polling_enabled, notes) VALUES (?, ?, ?, ?, ?)",
      ["Kept City Con", "keptcitycon", null, 0, null],
    );
    runSql(
      sqlite,
      `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, region, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, "2027", "2027-05-22", "Oakland", "CA", null, "tracking", "not_open", null, 0, null, "Empty 27"],
    );
    runSql(
      sqlite,
      `INSERT INTO edition (
          convention_id, cycle_label, start_date, city, region, attendance, intent, status, result_at, paid, notes, sheet_row_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [2, "2027", "2027-06-01", "Berkeley", "CA", null, "tracking", "not_open", null, 0, null, "Kept 27"],
    );
    execSql(sqlite, sqlFile("0002_core_workspace.sql"));
    execSql(sqlite, sqlFile("0003_city_state_only.sql"));
    execSql(sqlite, sqlFile("0004_skipped_status.sql"));
    runSql(sqlite, "UPDATE convention SET default_city = NULL, default_region = NULL WHERE id = 1");
    runSql(sqlite, "UPDATE convention SET default_city = ?, default_region = ? WHERE id = 2", ["San Jose", "CA"]);
    execSql(sqlite, sqlFile("0005_edition_location_on_con.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("backfills empty convention location, keeps existing, and drops edition columns", () => {
    const empty = getRow<{
      default_city: string | null;
      default_region: string | null;
    }>(sqlite, "SELECT default_city, default_region FROM convention WHERE id = 1");
    const kept = getRow<{
      default_city: string | null;
      default_region: string | null;
    }>(sqlite, "SELECT default_city, default_region FROM convention WHERE id = 2");
    const editionColumns = allRows<{ name: string }>(sqlite, "PRAGMA table_info(edition)").map((column) => column.name);

    assert.ok(empty);
    assert.ok(kept);
    assert.equal(empty.default_city, "Oakland");
    assert.equal(empty.default_region, "CA");
    assert.equal(kept.default_city, "San Jose");
    assert.equal(kept.default_region, "CA");
    assert.equal(editionColumns.includes("city"), false);
    assert.equal(editionColumns.includes("region"), false);
  });
});

describe("0006 calendar reminders migration", () => {
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    for (const name of [
      "0000_powerful_lenny_balinger.sql",
      "0001_import_review.sql",
      "0002_core_workspace.sql",
      "0003_city_state_only.sql",
      "0004_skipped_status.sql",
      "0005_edition_location_on_con.sql",
    ]) {
      execSql(sqlite, sqlFile(name));
    }
    runSql(sqlite, "INSERT INTO convention (display_name, normalized, manual_interest) VALUES (?, ?, 0)", [
      "M5 Con",
      "m5con",
    ]);
    runSql(sqlite, "INSERT INTO edition (convention_id, cycle_label, status, paid) VALUES (1, '2027', 'unknown', 0)");
    execSql(sqlite, sqlFile("0006_calendar_reminders.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("adds reminder flags defaulting to off and calendar tables", () => {
    const edition = getRow<{
      start_reminder_enabled: number;
      application_start_reminder_enabled: number;
    }>(
      sqlite,
      "SELECT start_reminder_enabled, application_start_reminder_enabled FROM edition WHERE cycle_label = '2027'",
    );
    assert.ok(edition);
    assert.equal(edition.start_reminder_enabled, 0);
    assert.equal(edition.application_start_reminder_enabled, 0);

    const tables = allRows<{ name: string }>(sqlite, "SELECT name FROM sqlite_master WHERE type = 'table'").map(
      (row) => row.name,
    );
    assert.equal(tables.includes("setting"), true);
    assert.equal(tables.includes("google_credential"), true);
    assert.equal(tables.includes("calendar_sync"), true);
  });
});

describe("0007 ics drop google migration", () => {
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    for (const name of [
      "0000_powerful_lenny_balinger.sql",
      "0001_import_review.sql",
      "0002_core_workspace.sql",
      "0003_city_state_only.sql",
      "0004_skipped_status.sql",
      "0005_edition_location_on_con.sql",
      "0006_calendar_reminders.sql",
    ]) {
      execSql(sqlite, sqlFile(name));
    }
    execSql(sqlite, sqlFile("0007_ics_drop_google.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("drops google tables and reminder columns", () => {
    const tables = allRows<{ name: string }>(sqlite, "SELECT name FROM sqlite_master WHERE type = 'table'").map(
      (row) => row.name,
    );
    assert.equal(tables.includes("google_credential"), false);
    assert.equal(tables.includes("calendar_sync"), false);
    assert.equal(tables.includes("setting"), true);

    const editionColumns = allRows<{ name: string }>(sqlite, "PRAGMA table_info(edition)").map((row) => row.name);
    assert.equal(editionColumns.includes("start_reminder_enabled"), false);
    assert.equal(editionColumns.includes("application_start_reminder_enabled"), false);
    assert.equal(editionColumns.includes("start_date_calendar_event_id"), false);
    assert.equal(editionColumns.includes("application_start_date_calendar_event_id"), false);

    const settingColumns = allRows<{ name: string }>(sqlite, "PRAGMA table_info(setting)").map((row) => row.name);
    assert.equal(settingColumns.includes("owner_email"), false);
    assert.equal(settingColumns.includes("calendar_id"), false);
    assert.equal(settingColumns.includes("drive_limit_hours"), true);
  });
});

describe("0008 drop drive, import, and settings", () => {
  let sqlite: Database;

  before(async () => {
    sqlite = await openRawSqlite();
    for (const name of [
      "0000_powerful_lenny_balinger.sql",
      "0001_import_review.sql",
      "0002_core_workspace.sql",
      "0003_city_state_only.sql",
      "0004_skipped_status.sql",
      "0005_edition_location_on_con.sql",
      "0006_calendar_reminders.sql",
      "0007_ics_drop_google.sql",
    ]) {
      execSql(sqlite, sqlFile(name));
    }
    execSql(sqlite, sqlFile("0008_drop_drive_import_settings.sql"));
  });

  after(() => {
    sqlite.close();
  });

  it("drops drive columns, import_proposal, and setting", () => {
    const tables = allRows<{ name: string }>(sqlite, "SELECT name FROM sqlite_master WHERE type = 'table'").map(
      (row) => row.name,
    );
    assert.equal(tables.includes("import_proposal"), false);
    assert.equal(tables.includes("setting"), false);

    const conventionColumns = allRows<{ name: string }>(sqlite, "PRAGMA table_info(convention)").map((row) => row.name);
    assert.equal(conventionColumns.includes("drive_minutes"), false);
    assert.equal(conventionColumns.includes("drive_source"), false);
    assert.equal(conventionColumns.includes("default_region"), true);
  });
});
