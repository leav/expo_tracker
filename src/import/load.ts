import fs from "node:fs";
import path from "node:path";

export const sheetId = "1DBenfdO_Q0WZC5pKcRbgCyC94CCDoEyNK9uoJgElK_Q";
export const sheetCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

export async function loadSheetCsv(): Promise<{ csv: string; source: "file" | "google" }> {
  const localPath = path.join(process.cwd(), "data", "sheet.csv");
  if (fs.existsSync(localPath)) {
    return { csv: fs.readFileSync(localPath, "utf8"), source: "file" };
  }
  const response = await fetch(sheetCsvUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not fetch the 摆摊 sheet (${response.status}).`);
  }
  return { csv: await response.text(), source: "google" };
}
