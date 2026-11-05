import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialStatus, isLineupStatus, isPaidStatus, normalizeLegacyStatus } from "./status";

describe("edition status", () => {
  it("treats a future application date as waiting to apply", () => {
    assert.equal(initialStatus("2026-11-08", "2026-11-04"), "waiting_to_apply");
    assert.equal(initialStatus("2026-11-04", "2026-11-04"), "unknown");
    assert.equal(initialStatus(null, "2026-11-04"), "unknown");
  });

  it("migrates legacy stored statuses", () => {
    assert.equal(normalizeLegacyStatus("accepted"), "approved");
    assert.equal(normalizeLegacyStatus("not_open"), "waiting_to_apply");
    assert.equal(normalizeLegacyStatus("submitted"), "submitted");
    assert.equal(normalizeLegacyStatus("nope"), null);
  });

  it("keeps unknown out of lineups and paid on approved or attended", () => {
    assert.equal(isLineupStatus("unknown"), false);
    assert.equal(isLineupStatus("waiting_to_apply"), true);
    assert.equal(isPaidStatus("approved"), true);
    assert.equal(isPaidStatus("submitted"), false);
  });
});
