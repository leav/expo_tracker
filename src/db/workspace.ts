import { drizzle } from "drizzle-orm/sql-js";
import type { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";
import type { TrackerDb } from "../domain/db";
import { applyMigrations } from "./migrate";
import * as schema from "./schema";

export type Workspace = {
  sqlite: SqlJsDatabase;
  db: TrackerDb;
};

const SQLITE_MAGIC = "SQLite format 3";

export function isSqliteBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 16) return false;
  return new TextDecoder().decode(bytes.subarray(0, 15)) === SQLITE_MAGIC;
}

export function createWorkspace(SQL: SqlJsStatic, bytes?: Uint8Array): Workspace {
  const sqlite = bytes ? new SQL.Database(bytes) : new SQL.Database();
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  applyMigrations(db);
  return { sqlite, db };
}
