import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import type { BundledMigration } from "./migrations";
import { bundledMigrations } from "./migrations.generated";
import type * as schema from "./schema";

type Migratable = {
  dialect: {
    migrate: (migrations: BundledMigration[], session: unknown, config: Record<string, never>) => void;
  };
  session: unknown;
};

export function applyMigrations(db: SQLJsDatabase<typeof schema>) {
  const internal = db as unknown as Migratable;
  internal.dialect.migrate(bundledMigrations, internal.session, {});
}
