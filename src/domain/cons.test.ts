import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyInterestGauge,
  interestGauge,
  parseConsSort,
  pickAttendanceValue,
  pickRepresentativeEdition,
  shiftInterestGauge,
  sortCons,
  type ConsTile,
  type InterestGauge,
} from "./cons";

function gaugeWithCount(count: number, sortCount = count): InterestGauge {
  return { ...emptyInterestGauge, count, sortCount };
}

function tile(overrides: Partial<ConsTile> & Pick<ConsTile, "conventionId" | "displayName">): ConsTile {
  return {
    website: null,
    applicationPage: null,
    eventDate: null,
    status: null,
    statusLabel: null,
    city: null,
    region: null,
    locationLabel: null,
    estimatedAttendance: null,
    gauge: emptyInterestGauge,
    startMonth: null,
    hasEditions: true,
    ...overrides,
  };
}

describe("representative edition, interest, and cons sorts", () => {
  it("picks the nearest upcoming edition, then the most recent past, then the greatest cycle", () => {
    const rows = [
      { id: 1, cycleLabel: "2025", startDate: "2025-01-01" },
      { id: 2, cycleLabel: "2027", startDate: "2027-05-01" },
      { id: 3, cycleLabel: "2026", startDate: "2026-12-01" },
    ];
    assert.equal(pickRepresentativeEdition(rows, "2026-11-05")?.cycleLabel, "2026");
    assert.equal(pickRepresentativeEdition(rows, "2028-01-01")?.cycleLabel, "2027");
    assert.equal(
      pickRepresentativeEdition(
        [
          { id: 1, cycleLabel: "108", startDate: null },
          { id: 2, cycleLabel: "109", startDate: null },
        ],
        "2026-11-05",
      )?.cycleLabel,
      "109",
    );
    assert.equal(pickRepresentativeEdition([], "2026-11-05"), null);
  });

  it("breaks equal start dates with cycle label", () => {
    const rows = [
      { id: 1, cycleLabel: "2026-winter", startDate: "2026-12-01" },
      { id: 2, cycleLabel: "2026-summer", startDate: "2026-12-01" },
    ];
    assert.equal(pickRepresentativeEdition(rows, "2026-01-01")?.cycleLabel, "2026-summer");
  });

  it("prefers representative attendance, then the nearest edition that has a value", () => {
    const rows = [
      { cycleLabel: "2027", startDate: "2027-05-01", attendance: null },
      { cycleLabel: "2026", startDate: "2026-05-01", attendance: 10000 },
    ];
    assert.equal(pickAttendanceValue(rows, "2026-11-05"), 10000);
    rows[0].attendance = 27500;
    assert.equal(pickAttendanceValue(rows, "2026-11-05"), 27500);
  });

  it("builds gauge ticks by status family, omitting unknown and including pink manual ticks", () => {
    const gauge = interestGauge(3, [
      { status: "skipped" },
      { status: "attended" },
      { status: "unknown" },
      { status: "submitted" },
      { status: "attended" },
      { status: "withdrawn" },
      { status: "open" },
      { status: "rejected" },
    ]);
    assert.equal(gauge.count, 10);
    assert.equal(gauge.sortCount, 12);
    assert.equal(
      gauge.summary,
      "3 interest, 1 ready, 1 submitted, 2 attended, 1 withdrawn, 1 rejected, 1 skipped",
    );
    assert.deepEqual(
      gauge.segments.map((segment) => ({ kind: segment.kind, color: segment.color })),
      [
        { kind: "manual", color: "manual" },
        { kind: "open", color: "waiting" },
        { kind: "submitted", color: "waiting" },
        { kind: "attended", color: "done" },
        { kind: "withdrawn", color: "done" },
        { kind: "rejected", color: "closed" },
        { kind: "skipped", color: "skipped" },
      ],
    );
  });

  it("omits negative manual ticks, unknown editions, and empty gauges", () => {
    assert.deepEqual(interestGauge(0, []), emptyInterestGauge);
    assert.deepEqual(interestGauge(-2, []), emptyInterestGauge);
    assert.deepEqual(interestGauge(-4, [{ status: "unknown" }, { status: "unknown" }]), emptyInterestGauge);
  });

  it("shifts a tick from one status to another for optimistic lineup moves", () => {
    const gauge = interestGauge(0, [{ status: "approved" }, { status: "submitted" }]);
    assert.equal(shiftInterestGauge(gauge, "approved", "waiting_to_apply").summary, "1 waiting, 1 submitted");
    const attended = shiftInterestGauge(gauge, "approved", "attended");
    assert.equal(attended.summary, "1 submitted, 1 attended");
    assert.equal(attended.sortCount, 3);
  });

  it("sorts interest by sortCount so each attended tick counts as two", () => {
    const tiles = [
      tile({ conventionId: 1, displayName: "Beta", gauge: gaugeWithCount(1, 1) }),
      tile({ conventionId: 2, displayName: "Alpha", gauge: gaugeWithCount(1, 2) }),
      tile({ conventionId: 3, displayName: "Gamma", gauge: gaugeWithCount(2, 2) }),
    ];
    assert.deepEqual(
      sortCons(tiles, "interest").map((row) => row.displayName),
      ["Alpha", "Gamma", "Beta"],
    );
  });

  it("sorts by gauge count, state, month, and name with name as the tie-break", () => {
    const tiles = [
      tile({ conventionId: 1, displayName: "Beta", gauge: gaugeWithCount(2), region: "CA", startMonth: 5 }),
      tile({ conventionId: 2, displayName: "Alpha", gauge: gaugeWithCount(2), region: null, startMonth: null }),
      tile({ conventionId: 3, displayName: "Gamma", gauge: gaugeWithCount(5), region: "AZ", startMonth: 1 }),
    ];
    assert.deepEqual(
      sortCons(tiles, "interest").map((row) => row.displayName),
      ["Gamma", "Alpha", "Beta"],
    );
    assert.deepEqual(
      sortCons(tiles, "state").map((row) => row.displayName),
      ["Gamma", "Beta", "Alpha"],
    );
    assert.deepEqual(
      sortCons(tiles, "time").map((row) => row.displayName),
      ["Gamma", "Beta", "Alpha"],
    );
    assert.deepEqual(
      sortCons(tiles, "name").map((row) => row.displayName),
      ["Alpha", "Beta", "Gamma"],
    );
  });

  it("sorts attendance high to low, unknown last, with name as the tie-break", () => {
    const tiles = [
      tile({ conventionId: 1, displayName: "Beta", estimatedAttendance: 10000 }),
      tile({ conventionId: 2, displayName: "Alpha", estimatedAttendance: 50000 }),
      tile({ conventionId: 3, displayName: "Gamma", estimatedAttendance: null }),
      tile({ conventionId: 4, displayName: "Delta", estimatedAttendance: 50000 }),
      tile({ conventionId: 5, displayName: "Epsilon", estimatedAttendance: 0 }),
    ];
    assert.deepEqual(
      sortCons(tiles, "attendance").map((row) => row.displayName),
      ["Alpha", "Delta", "Beta", "Epsilon", "Gamma"],
    );
  });

  it("defaults expos sort to name and ignores unknown keys", () => {
    assert.equal(parseConsSort(undefined), "name");
    assert.equal(parseConsSort("interest"), "interest");
    assert.equal(parseConsSort("attendance"), "attendance");
    assert.equal(parseConsSort("distance"), "name");
  });
});
