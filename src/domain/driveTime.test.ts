import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDriveTime, seedDriveMinutes } from "./driveTime";

describe("drive time seed", () => {
  it("matches city names before a comma and ignores case", () => {
    assert.equal(seedDriveMinutes("San Jose"), 75);
    assert.equal(seedDriveMinutes("SAN JOSE, CA"), 75);
    assert.equal(seedDriveMinutes("Lancaster, PA"), null);
  });

  it("keeps a manual override when the city does not change", () => {
    const kept = resolveDriveTime({
      city: "Phoenix",
      currentMinutes: 12,
      currentSource: "manual",
      cityChanged: false,
    });
    assert.deepEqual(kept, { driveMinutes: 12, driveSource: "manual" });

    const refreshed = resolveDriveTime({
      city: "San Diego",
      currentMinutes: 12,
      currentSource: "manual",
      cityChanged: true,
    });
    assert.deepEqual(refreshed, { driveMinutes: 510, driveSource: "seed" });
  });
});
