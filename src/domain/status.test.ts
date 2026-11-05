import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardPlacement, initialStatus, resolveEditionState } from "./status";

describe("edition status and intent", () => {
  it("keeps a new tracking edition on the Tracking column", () => {
    const state = resolveEditionState("tracking", "unknown");
    assert.deepEqual(state, { intent: "tracking", status: "unknown" });
    assert.deepEqual(boardPlacement(state.intent, state.status), {
      column: "Tracking",
      openBadge: false,
    });
  });

  it("shows an open window on Tracking with a badge", () => {
    const state = resolveEditionState("tracking", "open");
    assert.equal(state.intent, "tracking");
    assert.equal(boardPlacement(state.intent, state.status).openBadge, true);
    assert.equal(boardPlacement(state.intent, state.status).column, "Tracking");
  });

  it("moves a future window to Tracking without the open badge", () => {
    const state = resolveEditionState("tracking", "not_open");
    assert.equal(boardPlacement(state.intent, state.status).column, "Tracking");
    assert.equal(boardPlacement(state.intent, state.status).openBadge, false);
  });

  it("marks a skip as passed and files it under Pass", () => {
    const state = resolveEditionState("skip", "unknown");
    assert.deepEqual(state, { intent: "skip", status: "passed" });
    assert.equal(boardPlacement(state.intent, state.status).column, "Pass");
  });

  it("keeps Pass when the status is passed and the intent was still applying", () => {
    const state = resolveEditionState("applying", "passed");
    assert.deepEqual(state, { intent: "skip", status: "passed" });
  });

  it("puts submitted, waitlist, accepted, attended, and rejected in their columns", () => {
    const cases = [
      ["submitted", "Applied"],
      ["waitlisted", "Waitlist"],
      ["accepted", "Accepted"],
      ["attended", "Attended"],
      ["rejected", "Rejected"],
    ] as const;
    for (const [status, column] of cases) {
      const state = resolveEditionState("tracking", status);
      assert.equal(state.intent, "applying");
      assert.equal(boardPlacement(state.intent, state.status).column, column);
    }
  });

  it("keeps withdrawn off the primary columns", () => {
    const state = resolveEditionState("applying", "withdrawn");
    assert.equal(state.intent, "applying");
    assert.equal(boardPlacement(state.intent, state.status).column, null);
  });

  it("treats a future application date as not open yet", () => {
    assert.equal(initialStatus("2026-11-08", "2026-11-04"), "not_open");
    assert.equal(initialStatus("2026-11-04", "2026-11-04"), "unknown");
    assert.equal(initialStatus(null, "2026-11-04"), "unknown");
  });

  it("does not change paid when status changes", () => {
    const before = { paid: true, ...resolveEditionState("applying", "accepted") };
    const after = resolveEditionState("skip", "passed");
    assert.equal(before.paid, true);
    assert.equal(after.status, "passed");
    assert.equal("paid" in after, false);
  });
});
