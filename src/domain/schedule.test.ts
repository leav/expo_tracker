import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthCells,
  canShiftYear,
  firstWeekdaySunday,
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
  it("plots application start and event start for interested conventions", () => {
    const markers = scheduleMarkersFromRows([
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
    ]);
    assert.deepEqual(
      markers.map((marker) => ({ date: marker.date, kind: marker.kind, kindLabel: marker.kindLabel })),
      [
        { date: "2026-11-08", kind: "application_start", kindLabel: "Application opens" },
        { date: "2027-05-22", kind: "event_start", kindLabel: "Starts" },
      ],
    );
  });

  it("includes past dates, today, and future dates", () => {
    const markers = scheduleMarkersFromRows([
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
          {
            id: 2,
            cycleLabel: "2027",
            status: "waiting_to_apply",
            applicationStartDate: "2026-12-01",
            startDate: null,
          },
        ],
      }),
    ]);
    assert.deepEqual(
      markers.map((marker) => ({ date: marker.date, kind: marker.kind })),
      [
        { date: "2026-11-04", kind: "event_start" },
        { date: "2026-11-05", kind: "application_start" },
        { date: "2026-12-01", kind: "application_start" },
      ],
    );
  });

  it("omits zero-interest conventions", () => {
    const markers = scheduleMarkersFromRows([
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
    ]);
    assert.equal(markers.length, 0);
  });

  it("includes unknown editions when manual interest makes the series positive", () => {
    const markers = scheduleMarkersFromRows([
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
    ]);
    assert.equal(markers.length, 1);
    assert.equal(markers[0]?.kind, "application_start");
  });

  it("omits skipped and withdrawn editions even when series interest is positive", () => {
    const markers = scheduleMarkersFromRows([
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
    ]);
    assert.deepEqual(
      markers.map((marker) => ({ cycle: marker.cycleLabel, kind: marker.kind })),
      [
        { cycle: "2028", kind: "application_start" },
        { cycle: "2028", kind: "event_start" },
      ],
    );
  });

  it("includes a Google event id only when that reminder is enabled and the id exists", () => {
    const markers = scheduleMarkersFromRows([
      convention({
        id: 1,
        displayName: "Reminder Con",
        manualInterest: 2,
        editions: [
          {
            id: 1,
            cycleLabel: "2027",
            status: "waiting_to_apply",
            applicationStartDate: "2026-12-01",
            startDate: "2027-03-01",
            applicationStartReminderEnabled: true,
            applicationStartDateCalendarEventId: "evt-app",
            startReminderEnabled: false,
            startDateCalendarEventId: "evt-stale",
          },
        ],
      }),
    ]);
    assert.deepEqual(
      markers.map((marker) => ({ kind: marker.kind, googleEventId: marker.googleEventId })),
      [
        { kind: "application_start", googleEventId: "evt-app" },
        { kind: "event_start", googleEventId: null },
      ],
    );
  });

  it("still plots a rejected edition with past and future dates when interest is positive", () => {
    const markers = scheduleMarkersFromRows([
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
    ]);
    assert.deepEqual(
      markers.map((marker) => ({ date: marker.date, kind: marker.kind })),
      [
        { date: "2026-01-01", kind: "application_start" },
        { date: "2027-06-01", kind: "event_start" },
      ],
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

    const markers = scheduleMarkersFromRows([
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
    ]);
    const byDay = markersForMonth(markers, "2026-11");
    assert.equal(byDay.get("2026-11-08")?.length, 1);
    assert.equal(byDay.has("2026-12-01"), false);
  });

  it("allows year shifts through gaps and disables only at marker extrema", () => {
    const markers = [
      { date: "2024-05-01" },
      { date: "2027-03-15" },
    ];
    assert.equal(canShiftYear(markers, "2027", -1), true);
    assert.equal(canShiftYear(markers, "2027", 1), false);
    assert.equal(canShiftYear(markers, "2026", -1), true);
    assert.equal(canShiftYear(markers, "2026", 1), true);
    assert.equal(canShiftYear(markers, "2024", -1), false);
    assert.equal(canShiftYear(markers, "2024", 1), true);
    assert.equal(canShiftYear([], "2026", -1), false);
    assert.equal(canShiftYear([], "2026", 1), false);
  });
});
