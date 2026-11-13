import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthCells,
  canShiftYear,
  cellAttentionTitle,
  cellAttentions,
  firstWeekdaySunday,
  joinDisplayNames,
  markerAttention,
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
  it("plots application start and event start regardless of interest", () => {
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
      markers.map((marker) => ({
        date: marker.date,
        kind: marker.kind,
        kindLabel: marker.kindLabel,
        status: marker.status,
      })),
      [
        {
          date: "2026-11-08",
          kind: "application_start",
          kindLabel: "Application opens",
          status: "waiting_to_apply",
        },
        { date: "2027-05-22", kind: "event_start", kindLabel: "Starts", status: "waiting_to_apply" },
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

  it("plots dates for unknown zero-interest conventions", () => {
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
    assert.deepEqual(
      markers.map((marker) => ({ date: marker.date, kind: marker.kind, status: marker.status })),
      [
        { date: "2026-12-01", kind: "application_start", status: "unknown" },
        { date: "2027-01-01", kind: "event_start", status: "unknown" },
      ],
    );
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

describe("schedule attention", () => {
  it("flags waiting and open application starts as apply", () => {
    assert.equal(markerAttention("application_start", "waiting_to_apply"), "apply");
    assert.equal(markerAttention("application_start", "open"), "apply");
    assert.equal(markerAttention("application_start", "submitted"), null);
    assert.equal(markerAttention("application_start", "approved"), null);
    assert.equal(markerAttention("application_start", "unknown"), null);
  });

  it("flags approved event starts as travel", () => {
    assert.equal(markerAttention("event_start", "approved"), "travel");
    assert.equal(markerAttention("event_start", "waitlisted"), null);
    assert.equal(markerAttention("event_start", "attended"), null);
    assert.equal(markerAttention("event_start", "waiting_to_apply"), null);
    assert.equal(markerAttention("event_start", "open"), null);
  });

  it("unique-sorts apply then travel for a mixed day", () => {
    const markers = scheduleMarkersFromRows([
      convention({
        id: 1,
        displayName: "Wait Con",
        editions: [
          {
            id: 1,
            cycleLabel: "2027",
            status: "waiting_to_apply",
            applicationStartDate: "2027-03-15",
            startDate: "2027-08-01",
          },
        ],
      }),
      convention({
        id: 2,
        displayName: "Open Con",
        editions: [
          {
            id: 2,
            cycleLabel: "2027",
            status: "open",
            applicationStartDate: "2027-03-15",
            startDate: null,
          },
        ],
      }),
      convention({
        id: 3,
        displayName: "Approved Con",
        editions: [
          {
            id: 3,
            cycleLabel: "2027",
            status: "approved",
            applicationStartDate: "2026-01-01",
            startDate: "2027-03-15",
          },
        ],
      }),
      convention({
        id: 4,
        displayName: "Submitted Con",
        editions: [
          {
            id: 4,
            cycleLabel: "2027",
            status: "submitted",
            applicationStartDate: "2027-03-15",
            startDate: "2027-09-01",
          },
        ],
      }),
    ]);
    const sameDay = markers.filter((marker) => marker.date === "2027-03-15");
    assert.deepEqual(cellAttentions(sameDay), ["apply", "travel"]);
  });

  it("collapses duplicate apply badges and leaves control statuses empty", () => {
    const markers = scheduleMarkersFromRows([
      convention({
        id: 1,
        displayName: "Open A",
        editions: [
          {
            id: 1,
            cycleLabel: "2027",
            status: "open",
            applicationStartDate: "2027-04-01",
            startDate: null,
          },
        ],
      }),
      convention({
        id: 2,
        displayName: "Open B",
        editions: [
          {
            id: 2,
            cycleLabel: "2027",
            status: "open",
            applicationStartDate: "2027-04-01",
            startDate: null,
          },
        ],
      }),
      convention({
        id: 3,
        displayName: "Waitlisted Con",
        editions: [
          {
            id: 3,
            cycleLabel: "2027",
            status: "waitlisted",
            applicationStartDate: "2027-04-01",
            startDate: "2027-04-01",
          },
        ],
      }),
    ]);
    const sameDay = markers.filter((marker) => marker.date === "2027-04-01");
    assert.deepEqual(cellAttentions(sameDay), ["apply"]);
    assert.deepEqual(
      cellAttentions([{ kind: "event_start", status: "attended" }]),
      [],
    );
  });

  it("joins one, two, and three display names", () => {
    assert.equal(joinDisplayNames([]), "");
    assert.equal(joinDisplayNames(["FanimeCon 2027"]), "FanimeCon 2027");
    assert.equal(joinDisplayNames(["FanimeCon 2027", "SacAnime 2027"]), "FanimeCon 2027 and SacAnime 2027");
    assert.equal(
      joinDisplayNames(["Alpha 2027", "Beta 2027", "Gamma 2027"]),
      "Alpha 2027, Beta 2027, and Gamma 2027",
    );
  });

  it("builds apply, travel, mixed, and empty cell reminder titles", () => {
    assert.equal(cellAttentionTitle([]), null);
    assert.equal(
      cellAttentionTitle([
        {
          kind: "application_start",
          status: "waiting_to_apply",
          conventionName: "FanimeCon",
          cycleLabel: "2027",
        },
      ]),
      "Remember to apply for FanimeCon 2027!",
    );
    assert.equal(
      cellAttentionTitle([
        {
          kind: "event_start",
          status: "approved",
          conventionName: "FanimeCon",
          cycleLabel: "2027",
        },
      ]),
      "Remember to vend at FanimeCon 2027!",
    );
    assert.equal(
      cellAttentionTitle([
        {
          kind: "application_start",
          status: "open",
          conventionName: "Wait Con",
          cycleLabel: "2027",
        },
        {
          kind: "event_start",
          status: "approved",
          conventionName: "Go Con",
          cycleLabel: "2027",
        },
      ]),
      "Remember to apply for Wait Con 2027! Remember to vend at Go Con 2027!",
    );
    assert.equal(
      cellAttentionTitle([
        {
          kind: "application_start",
          status: "submitted",
          conventionName: "Submitted Con",
          cycleLabel: "2027",
        },
      ]),
      null,
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
