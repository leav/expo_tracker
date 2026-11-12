import type { SqlJsStatic } from "sql.js";

let engine: Promise<SqlJsStatic> | undefined;

export function loadSqlJsBrowser(): Promise<SqlJsStatic> {
  if (!engine) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    engine = import("sql.js").then((mod) =>
      mod.default({
        locateFile: (file) => `${base}/${file}`,
      }),
    );
  }
  return engine;
}
