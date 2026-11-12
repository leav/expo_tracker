import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const distDir = dirname(require.resolve("sql.js"));
const publicDir = join(process.cwd(), "public");
mkdirSync(publicDir, { recursive: true });
for (const name of ["sql-wasm.wasm", "sql-wasm-browser.wasm"]) {
  copyFileSync(join(distDir, name), join(publicDir, name));
}
