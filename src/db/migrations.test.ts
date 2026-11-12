import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generatedMigrationsPath, generatedMigrationsSource, loadMigrationsFromDrizzleFolder } from "./bundle-migrations";
import { bundledMigrations } from "./migrations.generated";

describe("bundled migrations", () => {
  it("matches the drizzle journal hashes and committed generated file", () => {
    const fromDisk = loadMigrationsFromDrizzleFolder();
    assert.deepEqual(
      bundledMigrations.map((row) => row.hash),
      fromDisk.map((row) => row.hash),
    );
    assert.equal(readFileSync(generatedMigrationsPath, "utf8"), generatedMigrationsSource(fromDisk));
  });
});
