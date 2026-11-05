import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampInterestForColor,
  conventionInterest,
  pickAttendanceValue,
  pickRepresentativeEdition,
  sortCons,
  type ConsTile,
} from "./cons";

function tile(overrides: Partial<ConsTile> & Pick<ConsTile, "conventionId" | "displayName">): ConsTile {
  return {
    eventDate: null,
    status: null,
    statusLabel: null,
    city: null,
    region: null,
    locationLabel: null,
    interest: 0,
    colorScore: 0,
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

  it("counts attended editions plus signed manual interest and clamps color", () => {
    assert.equal(conventionInterest(-2, [{ status: "attended" }, { status: "approved" }, { status: "attended" }]), 0);
    assert.equal(clampInterestForColor(12), 5);
    assert.equal(clampInterestForColor(-9), -5);
    assert.equal(clampInterestForColor(3), 3);
  });

  it("sorts by interest, distance, month, and name with name as the tie-break", () => {
    const tiles = [
      tile({ conventionId: 1, displayName: "Beta", interest: 2, driveMinutes: 400, startMonth: 5 }),
      tile({ conventionId: 2, displayName: "Alpha", interest: 2, driveMinutes: null, startMonth: null }),
      tile({ conventionId: 3, displayName: "Gamma", interest: 5, driveMinutes: 60, startMonth: 1 }),
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
