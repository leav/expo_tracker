import { cleanMockData } from "../domain/mock";
import { databasePath, openDatabase } from "./index";

const db = openDatabase();
const summary = cleanMockData(db);

console.log(`Cleaned mock data from ${databasePath()}`);

if (summary.deletedConventions.length === 0 && summary.deletedEditions.length === 0) {
  console.log("No mock conventions or editions found.");
} else {
  if (summary.deletedConventions.length > 0) {
    console.log(`Deleted ${summary.deletedConventions.length} mock convention(s):`);
    for (const row of summary.deletedConventions) {
      console.log(`  - #${row.id} ${row.displayName}`);
    }
  }
  if (summary.deletedEditions.length > 0) {
    console.log(`Deleted ${summary.deletedEditions.length} standalone mock edition(s):`);
    for (const row of summary.deletedEditions) {
      console.log(`  - #${row.id} convention ${row.conventionId} cycle ${row.cycleLabel}`);
    }
  }
}
