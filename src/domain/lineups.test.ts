import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineupsActionDate, partitionLineups, type LineupItem } from "./lineups";
import { isLineupStatus, type Status } from "./status";

function item(overrides: Partial<LineupItem> & Pick<LineupItem, "editionId" | "status" | "actionDate">): LineupItem {
  return {
    conventionId: overrides.editionId,
    conventionName: "FanimeCon",
    cycleLabel: "2027",
    statusLabel: overrides.status,
    city: null,
    ...overrides,
  };
}

describe("lineups action dates", () => {
  it("uses application start for waiting and open, including overdue dates", () => {
    assert.equal(
      lineupsActionDate({
        status: "waiting_to_apply",
        applicationStartDate: "2026-11-08",
        resultDate: null,
        startDate: "2027-05-22",
      }),
      "2026-11-08",
    );
    assert.equal(
      lineupsActionDate({
        status: "open",
        applicationStartDate: "2026-10-01",
        resultDate: null,
        startDate: "2027-05-22",
      }),
      "2026-10-01",
    );
  });

  it("uses result date then con start for submitted and waitlisted, and con start for approved", () => {
    assert.equal(
      lineupsActionDate({
        status: "submitted",
        applicationStartDate: "2026-01-01",
        resultDate: "2026-06-17",
        startDate: "2026-09-04",
      }),
      "2026-06-17",
    );
    assert.equal(
      lineupsActionDate({
        status: "waitlisted",
        applicationStartDate: null,
        resultDate: null,
        startDate: "2027-01-08",
      }),
      "2027-01-08",
    );
    assert.equal(
      lineupsActionDate({
        status: "approved",
        applicationStartDate: "2026-01-01",
        resultDate: "2026-02-01",
        startDate: "2026-12-12",
      }),
      "2026-12-12",
    );
  });

  it("excludes unknown and terminal statuses from lineups", () => {
    const excluded: Status[] = ["unknown", "attended", "rejected", "withdrawn", "passed"];
    for (const status of excluded) {
      assert.equal(isLineupStatus(status), false);
    }
  });

  it("puts undated active editions in Needs dates after dated rows", () => {
    const { dated, needsDates } = partitionLineups([
      item({ editionId: 1, conventionName: "Beta", status: "open", actionDate: "2026-12-01" }),
      item({ editionId: 2, conventionName: "Alpha", status: "waiting_to_apply", actionDate: null }),
      item({ editionId: 3, conventionName: "Gamma", status: "approved", actionDate: "2026-05-01" }),
    ]);
    assert.deepEqual(
      dated.map((row) => row.conventionName),
      ["Gamma", "Beta"],
    );
    assert.deepEqual(
      needsDates.map((row) => row.conventionName),
      ["Alpha"],
    );
  });
});
