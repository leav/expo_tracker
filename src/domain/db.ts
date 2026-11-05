import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../db/schema";

export type TrackerDb = BetterSQLite3Database<typeof schema>;

export type DomainResult<T> = { ok: true; value: T } | { ok: false; error: string };
