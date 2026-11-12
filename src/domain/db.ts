import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import type * as schema from "../db/schema";

export type TrackerDb = SQLJsDatabase<typeof schema>;

export type DomainResult<T> = { ok: true; value: T } | { ok: false; error: string };
