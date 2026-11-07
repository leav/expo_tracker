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
import { createEdition } from "./editions";
import {
  addCalendarDays,
  applyLineupMove,
  canMoveLineupStatus,
  formatLineupDate,
  groupLineups,
  lineupDateLabel,
  lineupDescriptor,
  listLineups,
  moveLineupEdition,
  presentLineupItem,
  relativeDayLabel,
  type LineupItem,
  type LineupSource,
} from "./lineups";
import { isLineupStatus, type Status } from "./status";

const today = "2026-11-06";

function source(overrides: Partial<LineupSource> & Pick<LineupSource, "editionId" | "status">): LineupSource {
  return {
    conventionId: overrides.editionId,
    conventionName: "FanimeCon",
    cycleLabel: "2027",
    applicationStartDate: null,
    applicationEndDate: null,
    resultDate: null,
    startDate: null,
    city: null,
    region: null,
    interest: 1,
    ...overrides,
  };
}

function item(overrides: Partial<LineupSource> & Pick<LineupSource, "editionId" | "status">): LineupItem {
  const presented = presentLineupItem(source(overrides), today);
  assert.ok(presented);
  return presented;
}

describe("lineups dates and grouping", () => {
  it("uses application start for waiting to apply", () => {
    assert.deepEqual(
      lineupDescriptor({
        status: "waiting_to_apply",
        applicationStartDate: "2026-11-08",
        applicationEndDate: "2026-11-20",
        resultDate: null,
        startDate: "2027-05-22",
      }),
      { actionDate: "2026-11-08", dateKind: "application_start", estimated: false },
    );
    assert.equal(
      presentLineupItem(source({ editionId: 1, status: "waiting_to_apply", applicationStartDate: "2026-11-08" }), today)
        ?.dateLabel,
      "Applications open 11/08",
    );
  });

  it("uses application end for ready to apply, or start plus seven days when estimated", () => {
    assert.deepEqual(
      lineupDescriptor({
        status: "open",
        applicationStartDate: "2026-11-06",
        applicationEndDate: "2026-11-20",
        resultDate: null,
        startDate: "2027-05-22",
      }),
      { actionDate: "2026-11-20", dateKind: "application_end", estimated: false },
    );
    assert.deepEqual(
      lineupDescriptor({
        status: "open",
        applicationStartDate: "2026-11-06",
        applicationEndDate: null,
        resultDate: null,
        startDate: "2027-05-22",
      }),
      { actionDate: "2026-11-13", dateKind: "application_end", estimated: true },
    );
    assert.equal(
      presentLineupItem(
        source({
          editionId: 1,
          status: "open",
          applicationStartDate: "2026-11-06",
          applicationEndDate: "2026-11-20",
        }),
        today,
      )?.dateLabel,
      "Apply by 11/20",
    );
    assert.equal(
      presentLineupItem(source({ editionId: 1, status: "open", applicationStartDate: "2026-11-06" }), today)?.dateLabel,
      "Estimated close 11/13",
    );
  });

  it("adds seven calendar days across month, year, and leap-year boundaries", () => {
    assert.equal(addCalendarDays("2026-01-28", 7), "2026-02-04");
    assert.equal(addCalendarDays("2026-12-28", 7), "2027-01-04");
    assert.equal(addCalendarDays("2024-02-27", 7), "2024-03-05");
    assert.equal(addCalendarDays("2025-02-27", 7), "2025-03-06");
  });

  it("formats lineup dates as month/day without a year", () => {
    assert.equal(formatLineupDate("2026-12-12"), "12/12");
    assert.equal(formatLineupDate("2026-11-06"), "11/06");
    assert.equal(formatLineupDate("2027-03-15"), "03/15");
  });

  it("uses result date for submitted and event start for waitlisted and approved", () => {
    assert.deepEqual(
      lineupDescriptor({
        status: "submitted",
        applicationStartDate: "2026-01-01",
        applicationEndDate: null,
        resultDate: "2026-06-17",
        startDate: "2026-09-04",
      }),
      { actionDate: "2026-06-17", dateKind: "result", estimated: false },
    );
    assert.deepEqual(
      lineupDescriptor({
        status: "submitted",
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: null,
        startDate: "2026-09-04",
      }),
      { actionDate: null, dateKind: "result", estimated: false },
    );
    assert.deepEqual(
      lineupDescriptor({
        status: "waitlisted",
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: "2026-06-17",
        startDate: "2027-01-08",
      }),
      { actionDate: "2027-01-08", dateKind: "event_start", estimated: false },
    );
    assert.deepEqual(
      lineupDescriptor({
        status: "approved",
        applicationStartDate: "2026-01-01",
        applicationEndDate: null,
        resultDate: "2026-02-01",
        startDate: "2026-12-12",
      }),
      { actionDate: "2026-12-12", dateKind: "event_start", estimated: false },
    );
    assert.equal(
      presentLineupItem(source({ editionId: 1, status: "submitted", resultDate: "2026-11-20" }), today)?.dateLabel,
      "Results expected 11/20",
    );
    assert.equal(
      presentLineupItem(source({ editionId: 1, status: "waitlisted", startDate: "2027-03-15" }), today)?.dateLabel,
      "Event starts 03/15",
    );
  });

  it("joins convention city and state for the card label", () => {
    assert.equal(
      presentLineupItem(source({ editionId: 1, status: "open", city: "San Jose", region: "CA" }), today)?.locationLabel,
      "San Jose, CA",
    );
    assert.equal(
      presentLineupItem(source({ editionId: 1, status: "open", city: "Rosemont, IL" }), today)?.locationLabel,
      "Rosemont, IL",
    );
  });

  it("labels missing dates and excludes unknown and terminal statuses", () => {
    assert.equal(lineupDateLabel({ actionDate: null, dateKind: "application_start", estimated: false }), "Date not set");
    assert.equal(
      lineupDescriptor({
        status: "open",
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: null,
        startDate: "2027-05-01",
      })?.actionDate,
      null,
    );
    const excluded: Status[] = ["unknown", "attended", "rejected", "withdrawn", "skipped"];
    for (const status of excluded) {
      assert.equal(isLineupStatus(status), false);
      assert.equal(
        lineupDescriptor({
          status,
          applicationStartDate: "2026-11-08",
          applicationEndDate: null,
          resultDate: "2026-11-20",
          startDate: "2027-05-01",
        }),
        null,
      );
    }
  });

  it("uses relative cues from today", () => {
    assert.equal(relativeDayLabel("2026-11-06", today), "today");
    assert.equal(relativeDayLabel("2026-11-07", today), "in 1 day");
    assert.equal(relativeDayLabel("2026-11-09", today), "in 3 days");
    assert.equal(relativeDayLabel("2026-11-05", today), "1 day ago");
    assert.equal(relativeDayLabel("2026-11-04", today), "2 days ago");
  });

  it("groups columns in status order, with Date not set first, then date, name, and cycle", () => {
    const columns = groupLineups([
      item({ editionId: 1, conventionName: "Beta", status: "open", applicationEndDate: "2026-12-01" }),
      item({ editionId: 2, conventionName: "Alpha", status: "waiting_to_apply" }),
      item({ editionId: 3, conventionName: "Gamma", status: "approved", startDate: "2026-05-01" }),
      item({ editionId: 4, conventionName: "Delta", status: "open", applicationStartDate: "2026-11-06" }),
      item({ editionId: 5, conventionName: "Alpha", cycleLabel: "2026", status: "waiting_to_apply", applicationStartDate: "2026-11-08" }),
      item({ editionId: 6, conventionName: "Zeta", status: "waiting_to_apply", applicationStartDate: "2026-11-08" }),
      item({ editionId: 7, conventionName: "Submitted Con", status: "submitted", resultDate: "2026-11-20" }),
      item({ editionId: 8, conventionName: "Wait Con", status: "waitlisted", startDate: "2027-01-08" }),
    ]);
    assert.deepEqual(
      columns.map((column) => column.status),
      ["waiting_to_apply", "open", "submitted", "waitlisted", "approved"],
    );
    assert.deepEqual(
      columns[0]?.items.map((row) => `${row.conventionName} ${row.cycleLabel}`),
      ["Alpha 2027", "Alpha 2026", "Zeta 2027"],
    );
    assert.deepEqual(
      columns[1]?.items.map((row) => row.conventionName),
      ["Delta", "Beta"],
    );
    assert.equal(columns[1]?.items[0]?.estimated, true);
    assert.equal(columns[1]?.items[1]?.estimated, false);
  });

  it("allows moves among visible columns and approved-only terminal targets", () => {
    assert.equal(canMoveLineupStatus("waiting_to_apply", "open"), true);
    assert.equal(canMoveLineupStatus("open", "submitted"), true);
    assert.equal(canMoveLineupStatus("submitted", "waitlisted"), true);
    assert.equal(canMoveLineupStatus("waitlisted", "approved"), true);
    assert.equal(canMoveLineupStatus("approved", "waiting_to_apply"), true);
    assert.equal(canMoveLineupStatus("approved", "attended"), true);
    assert.equal(canMoveLineupStatus("approved", "withdrawn"), true);
    assert.equal(canMoveLineupStatus("waiting_to_apply", "attended"), false);
    assert.equal(canMoveLineupStatus("submitted", "withdrawn"), false);
    assert.equal(canMoveLineupStatus("open", "skipped"), false);
    assert.equal(canMoveLineupStatus("approved", "approved"), false);
    assert.equal(canMoveLineupStatus("unknown", "open"), false);
    assert.equal(canMoveLineupStatus("attended", "approved"), false);
  });

  it("optimistically moves a card between columns and off the board for terminal targets", () => {
    const board = {
      total: 1,
      columns: groupLineups([
        item({
          editionId: 1,
          status: "approved",
          startDate: "2027-03-15",
          applicationStartDate: "2026-11-08",
        }),
      ]),
    };
    const waiting = applyLineupMove(board, 1, "waiting_to_apply", today);
    assert.equal(waiting.columns[0]?.items[0]?.dateLabel, "Applications open 11/08");
    assert.equal(waiting.columns[4]?.items.length, 0);
    const attended = applyLineupMove(board, 1, "attended", today);
    assert.equal(attended.total, 0);
    assert.deepEqual(
      applyLineupMove(board, 1, "skipped", today),
      board,
    );
  });
});

describe("lineup writes", () => {
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

  it("moves a visible lineup edition and rejects unallowed terminal targets", () => {
    const convention = createConvention(db, {
      displayName: "Move Con",
      website: null,
      notes: null,
      defaultCity: "Oakland",
      defaultRegion: "CA",
      estimatedAttendance: null,
    });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;

    const created = createEdition(db, {
      conventionId: convention.value.id,
      cycleLabel: "2027",
      startDate: "2027-03-15",
      endDate: null,
      applicationStartDate: "2026-11-08",
      applicationEndDate: null,
      status: "waiting_to_apply",
      submittedAt: null,
      resultDate: null,
      paid: false,
      notes: null,
      inferInitialStatus: false,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const opened = moveLineupEdition(db, created.value.id, "open", today);
    assert.equal(opened.ok, true);
    const boardOpen = listLineups(db, today);
    const openItem = boardOpen.columns
      .find((column) => column.status === "open")
      ?.items.find((row) => row.editionId === created.value.id);
    assert.equal(openItem?.dateLabel, "Estimated close 11/15");
    assert.equal(openItem?.city, "Oakland");
    assert.equal(openItem?.region, "CA");
    assert.equal(openItem?.locationLabel, "Oakland, CA");
    assert.equal(openItem?.interest, 1);

    const rejected = moveLineupEdition(db, created.value.id, "withdrawn", today);
    assert.equal(rejected.ok, false);

    const submitted = moveLineupEdition(db, created.value.id, "submitted", today);
    assert.equal(submitted.ok, true);
    const afterSubmit = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(afterSubmit?.status, "submitted");
    assert.equal(afterSubmit?.submittedAt, today);
    assert.equal(afterSubmit?.resultDate, null);

    const approved = moveLineupEdition(db, created.value.id, "approved", today);
    assert.equal(approved.ok, true);
    const afterApproved = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(afterApproved?.status, "approved");
    assert.equal(afterApproved?.submittedAt, today);
    assert.equal(afterApproved?.resultDate, today);

    const attended = moveLineupEdition(db, created.value.id, "attended", today);
    assert.equal(attended.ok, true);
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.status, "attended");
    assert.equal(stored?.resultDate, today);
    const boardAfter = listLineups(db, today);
    assert.equal(
      boardAfter.columns.flatMap((column) => column.items).some((row) => row.editionId === created.value.id),
      false,
    );
  });

  it("keeps existing submitted and result dates when dragging", () => {
    const convention = createConvention(db, {
      displayName: "Keep Dates Con",
      website: null,
      notes: null,
      defaultCity: "Berkeley",
      defaultRegion: "CA",
      estimatedAttendance: null,
    });
    assert.equal(convention.ok, true);
    if (!convention.ok) return;

    const created = createEdition(db, {
      conventionId: convention.value.id,
      cycleLabel: "2027",
      startDate: "2027-03-15",
      endDate: null,
      applicationStartDate: "2026-11-08",
      applicationEndDate: null,
      status: "open",
      submittedAt: "2026-10-01",
      resultDate: "2026-10-15",
      paid: false,
      notes: null,
      inferInitialStatus: false,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const submitted = moveLineupEdition(db, created.value.id, "submitted", today);
    assert.equal(submitted.ok, true);
    const waitlisted = moveLineupEdition(db, created.value.id, "waitlisted", today);
    assert.equal(waitlisted.ok, true);
    const stored = db.select().from(editions).where(eq(editions.id, created.value.id)).get();
    assert.equal(stored?.submittedAt, "2026-10-01");
    assert.equal(stored?.resultDate, "2026-10-15");
  });
});
