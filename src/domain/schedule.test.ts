import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthCells,
  firstWeekdaySunday,
  isYearEntirelyBefore,
  markersForMonth,
  parseYear,
  scheduleMarkersFromRows,
  shiftYear,
  yearMonths,
  type ScheduleConventionRow,
} from "./schedule";

function convention(
  overrides: Partial<ScheduleConventionRow> & Pick<ScheduleConventionRow, "id" | "displayName">,
): ScheduleConventionRow {
  return {
    manualInterest: 0,
    editions: [],
    ...overrides,
  };
}

describe("scheduleMarkersFromRows", () => {
  it("plots future application start and event start for interested conventions", () => {
    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "FanimeCon",
          manualInterest: 0,
          editions: [
            {
              id: 10,
              cycleLabel: "2027",
              status: "waiting_to_apply",
              applicationStartDate: "2026-11-08",
              startDate: "2027-05-22",
            },
          ],
        }),
      ],
      "2026-11-05",
    );
    assert.deepEqual(
      markers.map((marker) => ({ date: marker.date, kind: marker.kind, kindLabel: marker.kindLabel })),
      [
        { date: "2026-11-08", kind: "application_start", kindLabel: "Application opens" },
        { date: "2027-05-22", kind: "event_start", kindLabel: "Starts" },
      ],
    );
  });

  it("includes today and omits past dates", () => {
    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "Today Con",
          editions: [
            {
              id: 1,
              cycleLabel: "2026",
              status: "open",
              applicationStartDate: "2026-11-05",
              startDate: "2026-11-04",
            },
          ],
        }),
      ],
      "2026-11-05",
    );
    assert.deepEqual(
      markers.map((marker) => marker.date),
      ["2026-11-05"],
    );
    assert.equal(markers[0]?.kind, "application_start");
  });

  it("omits zero-interest conventions", () => {
    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "Unknown Con",
          manualInterest: 0,
          editions: [
            {
              id: 1,
              cycleLabel: "2027",
              status: "unknown",
              applicationStartDate: "2026-12-01",
              startDate: "2027-01-01",
            },
          ],
        }),
      ],
      "2026-11-05",
    );
    assert.equal(markers.length, 0);
  });

  it("includes unknown editions when manual interest makes the series positive", () => {
    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "Manual Con",
          manualInterest: 2,
          editions: [
            {
              id: 1,
              cycleLabel: "2027",
              status: "unknown",
              applicationStartDate: "2026-12-01",
              startDate: null,
            },
          ],
        }),
      ],
      "2026-11-05",
    );
    assert.equal(markers.length, 1);
    assert.equal(markers[0]?.kind, "application_start");
  });

  it("omits skipped and withdrawn editions even when series interest is positive", () => {
    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "Mixed Con",
          manualInterest: 2,
          editions: [
            {
              id: 1,
              cycleLabel: "2026",
              status: "skipped",
              applicationStartDate: "2026-12-01",
              startDate: "2027-01-01",
            },
            {
              id: 2,
              cycleLabel: "2027",
              status: "withdrawn",
              applicationStartDate: "2026-12-15",
              startDate: "2027-02-01",
            },
            {
              id: 3,
              cycleLabel: "2028",
              status: "waiting_to_apply",
              applicationStartDate: "2027-11-01",
              startDate: "2028-05-01",
            },
          ],
        }),
      ],
      "2026-11-05",
    );
    assert.deepEqual(
      markers.map((marker) => ({ cycle: marker.cycleLabel, kind: marker.kind })),
      [
        { cycle: "2028", kind: "application_start" },
        { cycle: "2028", kind: "event_start" },
      ],
    );
  });

  it("still plots a rejected edition with a future con start when interest is positive", () => {
    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "Rejected Con",
          editions: [
            {
              id: 1,
              cycleLabel: "2027",
              status: "rejected",
              applicationStartDate: "2026-01-01",
              startDate: "2027-06-01",
            },
          ],
        }),
      ],
      "2026-11-05",
    );
    assert.deepEqual(
      markers.map((marker) => ({ date: marker.date, kind: marker.kind })),
      [{ date: "2027-06-01", kind: "event_start" }],
    );
  });
});

describe("year and month helpers", () => {
  it("parses and shifts year values", () => {
    assert.equal(parseYear("2027", "2026-11-05"), "2027");
    assert.equal(parseYear("bad", "2026-11-05"), "2026");
    assert.equal(parseYear(undefined, "2026-11-05"), "2026");
    assert.equal(shiftYear("2026", 1), "2027");
    assert.equal(shiftYear("2026", -1), "2025");
    assert.deepEqual(yearMonths("2026").slice(0, 2), ["2026-01", "2026-02"]);
    assert.equal(yearMonths("2026").length, 12);
  });

  it("builds a Sunday-start month grid and groups markers by day", () => {
    assert.equal(firstWeekdaySunday("2026-11"), 0);
    const cells = buildMonthCells("2026-11");
    assert.equal(cells[0]?.date, "2026-11-01");
    assert.equal(cells.filter((cell) => cell.date).length, 30);
    assert.equal(cells.length % 7, 0);

    const markers = scheduleMarkersFromRows(
      [
        convention({
          id: 1,
          displayName: "A Con",
          editions: [
            {
              id: 1,
              cycleLabel: "2027",
              status: "open",
              applicationStartDate: "2026-11-08",
              startDate: "2026-12-01",
            },
          ],
        }),
      ],
      "2026-11-01",
    );
    const byDay = markersForMonth(markers, "2026-11");
    assert.equal(byDay.get("2026-11-08")?.length, 1);
    assert.equal(byDay.has("2026-12-01"), false);
  });

  it("detects years entirely before today", () => {
    assert.equal(isYearEntirelyBefore("2025", "2026-11-05"), true);
    assert.equal(isYearEntirelyBefore("2026", "2026-11-05"), false);
    assert.equal(isYearEntirelyBefore("2027", "2026-11-05"), false);
  });
});
