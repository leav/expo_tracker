import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillEditionDates } from "./editionDates";
import { addCalendarDays, addCalendarMonths } from "./lineupBoard";

describe("edition date calendar helpers", () => {
  it("adds calendar days across month and year boundaries", () => {
    assert.equal(addCalendarDays("2026-11-06", 7), "2026-11-13");
    assert.equal(addCalendarDays("2027-03-15", 1), "2027-03-16");
    assert.equal(addCalendarDays("2026-12-28", 7), "2027-01-04");
  });

  it("adds calendar months and clamps to the last day of the month", () => {
    assert.equal(addCalendarMonths("2026-11-06", 1), "2026-12-06");
    assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(addCalendarMonths("2026-12-15", 1), "2027-01-15");
    assert.equal(addCalendarMonths("2026-03-31", 1), "2026-04-30");
  });
});

describe("fillEditionDates", () => {
  it("fills empty application end and result from application start", () => {
    assert.deepEqual(
      fillEditionDates({
        applicationStartDate: "2026-11-06",
        applicationEndDate: null,
        resultDate: null,
        startDate: null,
        endDate: null,
      }),
      {
        applicationStartDate: "2026-11-06",
        applicationEndDate: "2026-11-13",
        resultDate: "2026-12-06",
        startDate: null,
        endDate: null,
      },
    );
  });

  it("fills empty event end from event start", () => {
    assert.deepEqual(
      fillEditionDates({
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: null,
        startDate: "2027-03-15",
        endDate: null,
      }),
      {
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: null,
        startDate: "2027-03-15",
        endDate: "2027-03-16",
      },
    );
  });

  it("does not overwrite dates that are already set", () => {
    assert.deepEqual(
      fillEditionDates({
        applicationStartDate: "2026-11-06",
        applicationEndDate: "2026-11-20",
        resultDate: "2026-12-01",
        startDate: "2027-03-15",
        endDate: "2027-03-18",
      }),
      {
        applicationStartDate: "2026-11-06",
        applicationEndDate: "2026-11-20",
        resultDate: "2026-12-01",
        startDate: "2027-03-15",
        endDate: "2027-03-18",
      },
    );
  });

  it("fills only the empty targets when some dates are already set", () => {
    assert.deepEqual(
      fillEditionDates({
        applicationStartDate: "2026-01-31",
        applicationEndDate: "2026-02-10",
        resultDate: null,
        startDate: "2027-03-15",
        endDate: null,
      }),
      {
        applicationStartDate: "2026-01-31",
        applicationEndDate: "2026-02-10",
        resultDate: "2026-02-28",
        startDate: "2027-03-15",
        endDate: "2027-03-16",
      },
    );
  });

  it("leaves everything empty when no start dates are set", () => {
    assert.deepEqual(
      fillEditionDates({
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: null,
        startDate: null,
        endDate: null,
      }),
      {
        applicationStartDate: null,
        applicationEndDate: null,
        resultDate: null,
        startDate: null,
        endDate: null,
      },
    );
  });
});
