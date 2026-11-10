import { eq } from "drizzle-orm";
import { settings } from "../db/schema";
import type { DomainResult, TrackerDb } from "./db";

const SETTING_ID = 1;
const DEFAULT_DRIVE_LIMIT_HOURS = 12;
const DEFAULT_TIMEZONE = "America/Los_Angeles";

export type Settings = typeof settings.$inferSelect;

export function getSettings(db: TrackerDb): Settings {
  const existing = db.select().from(settings).where(eq(settings.id, SETTING_ID)).get();
  if (existing) return existing;
  db.insert(settings)
    .values({
      id: SETTING_ID,
      timezone: DEFAULT_TIMEZONE,
      driveLimitHours: DEFAULT_DRIVE_LIMIT_HOURS,
    })
    .run();
  const created = db.select().from(settings).where(eq(settings.id, SETTING_ID)).get();
  if (!created) {
    return {
      id: SETTING_ID,
      timezone: DEFAULT_TIMEZONE,
      driveLimitHours: DEFAULT_DRIVE_LIMIT_HOURS,
    };
  }
  return created;
}

export function updateSettings(
  db: TrackerDb,
  input: { driveLimitHours: number },
): DomainResult<Settings> {
  if (!Number.isInteger(input.driveLimitHours) || input.driveLimitHours < 1) {
    return { ok: false, error: "Drive-limit hours must be a whole number of at least 1." };
  }
  getSettings(db);
  db.update(settings)
    .set({ driveLimitHours: input.driveLimitHours })
    .where(eq(settings.id, SETTING_ID))
    .run();
  return { ok: true, value: getSettings(db) };
}
