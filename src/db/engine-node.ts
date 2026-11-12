import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";

const require = createRequire(import.meta.url);

let engine: Promise<SqlJsStatic> | undefined;

export function loadSqlJsNode(): Promise<SqlJsStatic> {
  if (!engine) {
    const wasmPath = join(dirname(require.resolve("sql.js")), "sql-wasm.wasm");
    const wasm = readFileSync(wasmPath);
    engine = initSqlJs({ wasmBinary: Uint8Array.from(wasm).buffer });
  }
  return engine;
}
