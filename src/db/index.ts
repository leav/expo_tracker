import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const databaseFile = path.join(process.cwd(), "data", "vendor.sqlite");

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
};

export function databasePath() {
  return databaseFile;
}

export function openDatabase() {
  if (!globalForDb.sqlite) {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
    const sqlite = new Database(databaseFile);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    globalForDb.sqlite = sqlite;
  }

  return drizzle(globalForDb.sqlite, { schema });
}
