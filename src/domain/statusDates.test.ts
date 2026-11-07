import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillStatusDates } from "./statusDates";

const today = "2026-11-06";

describe("fillStatusDates", () => {
  it("fills submittedAt when transitioning into submitted", () => {
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "open",
        toStatus: "submitted",
        submittedAt: null,
        resultDate: null,
        today,
      }),
      { submittedAt: today, resultDate: null },
    );
  });

  it("fills resultDate when transitioning into approved, waitlisted, or rejected", () => {
    for (const toStatus of ["approved", "waitlisted", "rejected"] as const) {
      assert.deepEqual(
        fillStatusDates({
          fromStatus: "submitted",
          toStatus,
          submittedAt: "2026-10-01",
          resultDate: null,
          today,
        }),
        { submittedAt: "2026-10-01", resultDate: today },
      );
    }
  });

  it("does not overwrite existing submitted or result dates", () => {
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "open",
        toStatus: "submitted",
        submittedAt: "2026-10-15",
        resultDate: null,
        today,
      }),
      { submittedAt: "2026-10-15", resultDate: null },
    );
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "submitted",
        toStatus: "approved",
        submittedAt: "2026-10-15",
        resultDate: "2026-10-20",
        today,
      }),
      { submittedAt: "2026-10-15", resultDate: "2026-10-20" },
    );
  });

  it("does not fill dates when the status is unchanged", () => {
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "submitted",
        toStatus: "submitted",
        submittedAt: null,
        resultDate: null,
        today,
      }),
      { submittedAt: null, resultDate: null },
    );
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "approved",
        toStatus: "approved",
        submittedAt: null,
        resultDate: null,
        today,
      }),
      { submittedAt: null, resultDate: null },
    );
  });

  it("leaves dates alone for unrelated status transitions", () => {
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "waiting_to_apply",
        toStatus: "open",
        submittedAt: null,
        resultDate: null,
        today,
      }),
      { submittedAt: null, resultDate: null },
    );
    assert.deepEqual(
      fillStatusDates({
        fromStatus: "approved",
        toStatus: "attended",
        submittedAt: null,
        resultDate: null,
        today,
      }),
      { submittedAt: null, resultDate: null },
    );
  });
});
