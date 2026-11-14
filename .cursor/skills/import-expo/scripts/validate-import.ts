import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDataFile } from "../../../../src/domain/dataFile";

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: pnpm exec tsx .cursor/skills/import-expo/scripts/validate-import.ts <path-to-json>");
  process.exit(1);
}

const fullPath = resolve(process.cwd(), fileArg);
const raw = readFileSync(fullPath, "utf8");
const result = parseDataFile(raw);

if (!result.ok) {
  console.error(`INVALID: ${result.error}`);
  process.exit(1);
}

for (const convention of result.value.conventions) {
  const cycles = (convention.editions ?? []).map((edition) => edition.cycle).join(" ") || "(no editions)";
  console.log(`OK: ${convention.name} -> ${cycles}`);
}
