import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BundledMigration } from "./migrations";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const drizzleDir = join(repoRoot, "drizzle");
export const generatedMigrationsPath = join(here, "migrations.generated.ts");

type Journal = {
  entries: { tag: string; breakpoints: boolean; when: number }[];
};

export function loadMigrationsFromDrizzleFolder(): BundledMigration[] {
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8")) as Journal;
  return journal.entries.map((entry) => {
    const query = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf8");
    return {
      sql: query.split("--> statement-breakpoint"),
      bps: entry.breakpoints,
      folderMillis: entry.when,
      hash: createHash("sha256").update(query).digest("hex"),
    };
  });
}

export function generatedMigrationsSource(migrations: BundledMigration[]): string {
  return `import type { BundledMigration } from "./migrations";

export const bundledMigrations: BundledMigration[] = ${JSON.stringify(migrations, null, 2)};
`;
}

export function writeGeneratedMigrations() {
  writeFileSync(generatedMigrationsPath, generatedMigrationsSource(loadMigrationsFromDrizzleFolder()));
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  writeGeneratedMigrations();
}
