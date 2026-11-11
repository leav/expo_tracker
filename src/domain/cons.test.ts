import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conventionInterest,
  emptyInterestGauge,
  interestGauge,
  pickAttendanceValue,
  pickRepresentativeEdition,
  shiftInterestGauge,
  sortCons,
  type ConsTile,
  type InterestGauge,
} from "./cons";

function gaugeWithCount(count: number): InterestGauge {
  return { ...emptyInterestGauge, count };
}

function tile(overrides: Partial<ConsTile> & Pick<ConsTile, "conventionId" | "displayName">): ConsTile {
  return {
    website: null,
    eventDate: null,
    status: null,
    statusLabel: null,
    city: null,
    region: null,
    locationLabel: null,
    gauge: emptyInterestGauge,
    driveMinutes: null,
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

  it("sums status-weighted edition interest plus signed manual interest", () => {
    assert.equal(
      conventionInterest(0, [
        { status: "waiting_to_apply" },
        { status: "open" },
        { status: "submitted" },
        { status: "waitlisted" },
        { status: "approved" },
        { status: "attended" },
        { status: "rejected" },
      ]),
      7,
    );
    assert.equal(conventionInterest(0, [{ status: "skipped" }]), -1);
    assert.equal(conventionInterest(0, [{ status: "unknown" }, { status: "withdrawn" }]), 0);
    assert.equal(
      conventionInterest(-2, [
        { status: "attended" },
        { status: "approved" },
        { status: "skipped" },
        { status: "unknown" },
      ]),
      -1,
    );
  });

  it("builds gauge ticks by status family, including hollow unknown and pink manual ticks", () => {
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
    assert.equal(gauge.count, 11);
    assert.equal(
      gauge.summary,
      "3 interest, 1 unknown, 1 ready, 1 submitted, 2 attended, 1 withdrawn, 1 rejected, 1 skipped",
    );
    assert.deepEqual(
      gauge.segments.map((segment) => ({ kind: segment.kind, color: segment.color, filled: segment.filled })),
      [
        { kind: "manual", color: "manual", filled: true },
        { kind: "unknown", color: "unknown", filled: false },
        { kind: "open", color: "waiting", filled: true },
        { kind: "submitted", color: "waiting", filled: true },
        { kind: "attended", color: "done", filled: true },
        { kind: "withdrawn", color: "done", filled: true },
        { kind: "rejected", color: "closed", filled: true },
        { kind: "skipped", color: "skipped", filled: true },
      ],
    );
  });

  it("omits negative manual ticks and empty gauges", () => {
    assert.deepEqual(interestGauge(0, []), emptyInterestGauge);
    assert.deepEqual(interestGauge(-2, []), emptyInterestGauge);
    const unknownOnly = interestGauge(-4, [{ status: "unknown" }, { status: "unknown" }]);
    assert.equal(unknownOnly.count, 2);
    assert.equal(unknownOnly.summary, "2 unknown");
    assert.equal(unknownOnly.ticks.every((tick) => !tick.filled), true);
  });

  it("shifts a tick from one status to another for optimistic lineup moves", () => {
    const gauge = interestGauge(0, [{ status: "approved" }, { status: "submitted" }]);
    assert.equal(shiftInterestGauge(gauge, "approved", "waiting_to_apply").summary, "1 waiting, 1 submitted");
    assert.equal(shiftInterestGauge(gauge, "approved", "attended").summary, "1 submitted, 1 attended");
  });

  it("sorts by gauge count, distance, month, and name with name as the tie-break", () => {
    const tiles = [
      tile({ conventionId: 1, displayName: "Beta", gauge: gaugeWithCount(2), driveMinutes: 400, startMonth: 5 }),
      tile({ conventionId: 2, displayName: "Alpha", gauge: gaugeWithCount(2), driveMinutes: null, startMonth: null }),
      tile({ conventionId: 3, displayName: "Gamma", gauge: gaugeWithCount(5), driveMinutes: 60, startMonth: 1 }),
    ];
    assert.deepEqual(
      sortCons(tiles, "interest").map((row) => row.displayName),
      ["Gamma", "Alpha", "Beta"],
    );
    assert.deepEqual(
      sortCons(tiles, "distance").map((row) => row.displayName),
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
});
