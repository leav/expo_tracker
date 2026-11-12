import type { Database, SqlValue } from "sql.js";

type Params = SqlValue[];

export function runSql(sqlite: Database, sql: string, params: Params = []) {
  sqlite.run(sql, params);
}

export function execSql(sqlite: Database, sql: string) {
  sqlite.exec(sql);
}

export function allRows<T>(sqlite: Database, sql: string, params: Params = []): T[] {
  const stmt = sqlite.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function getRow<T>(sqlite: Database, sql: string, params: Params = []): T | undefined {
  return allRows<T>(sqlite, sql, params)[0];
}
