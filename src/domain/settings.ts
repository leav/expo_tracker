import { eq } from "drizzle-orm";
import { googleCredentials, settings } from "../db/schema";
import type { DomainResult, TrackerDb } from "./db";

const SETTING_ID = 1;
const DEFAULT_DRIVE_LIMIT_HOURS = 12;
const DEFAULT_CALENDAR_ID = "primary";
const DEFAULT_TIMEZONE = "America/Los_Angeles";

export type Settings = typeof settings.$inferSelect;

export type GoogleConnection = {
  email: string;
  scopes: string;
  historyId: string | null;
};

export function getSettings(db: TrackerDb): Settings {
  const existing = db.select().from(settings).where(eq(settings.id, SETTING_ID)).get();
  if (existing) return existing;
  db.insert(settings)
    .values({
      id: SETTING_ID,
      timezone: DEFAULT_TIMEZONE,
      driveLimitHours: DEFAULT_DRIVE_LIMIT_HOURS,
      calendarId: DEFAULT_CALENDAR_ID,
    })
    .run();
  const created = db.select().from(settings).where(eq(settings.id, SETTING_ID)).get();
  if (!created) {
    return {
      id: SETTING_ID,
      ownerEmail: null,
      timezone: DEFAULT_TIMEZONE,
      driveLimitHours: DEFAULT_DRIVE_LIMIT_HOURS,
      calendarId: DEFAULT_CALENDAR_ID,
    };
  }
  return created;
}

export function updateSettings(
  db: TrackerDb,
  input: { driveLimitHours: number; calendarId: string },
): DomainResult<Settings> {
  if (!Number.isInteger(input.driveLimitHours) || input.driveLimitHours < 1) {
    return { ok: false, error: "Drive-limit hours must be a whole number of at least 1." };
  }
  const calendarId = input.calendarId.trim() || DEFAULT_CALENDAR_ID;
  getSettings(db);
  db.update(settings)
    .set({ driveLimitHours: input.driveLimitHours, calendarId })
    .where(eq(settings.id, SETTING_ID))
    .run();
  return { ok: true, value: getSettings(db) };
}

export function getGoogleConnection(db: TrackerDb): GoogleConnection | null {
  const row = db.select().from(googleCredentials).where(eq(googleCredentials.id, SETTING_ID)).get();
  if (!row) return null;
  return { email: row.email, scopes: row.scopes, historyId: row.historyId };
}

export function disconnectGoogle(db: TrackerDb): void {
  db.delete(googleCredentials).where(eq(googleCredentials.id, SETTING_ID)).run();
}

export function saveGoogleConnection(
  db: TrackerDb,
  input: {
    email: string;
    refreshToken: string;
    accessToken: string | null;
    expiry: number | null;
    scopes: string;
    ownerEmailEnv: string | null;
  },
): DomainResult<{ email: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Google did not return an email address." };

  const required = input.ownerEmailEnv?.trim().toLowerCase() || null;
  if (required && required !== email) {
    return { ok: false, error: `Connect the Google account for ${required}.` };
  }

  const current = getSettings(db);
  if (current.ownerEmail && current.ownerEmail.toLowerCase() !== email) {
    return { ok: false, error: `This app is owned by ${current.ownerEmail}.` };
  }

  if (!current.ownerEmail) {
    db.update(settings).set({ ownerEmail: email }).where(eq(settings.id, SETTING_ID)).run();
  }

  const existing = db.select().from(googleCredentials).where(eq(googleCredentials.id, SETTING_ID)).get();
  const values = {
    id: SETTING_ID,
    email,
    refreshToken: input.refreshToken,
    accessToken: input.accessToken,
    expiry: input.expiry,
    scopes: input.scopes,
    historyId: existing?.historyId ?? null,
  };
  if (existing) {
    db.update(googleCredentials).set(values).where(eq(googleCredentials.id, SETTING_ID)).run();
  } else {
    db.insert(googleCredentials).values(values).run();
  }
  return { ok: true, value: { email } };
}

export function googleCredentialRow(db: TrackerDb) {
  return db.select().from(googleCredentials).where(eq(googleCredentials.id, SETTING_ID)).get() ?? null;
}

export function updateGoogleTokens(
  db: TrackerDb,
  input: { accessToken: string; expiry: number; refreshToken?: string },
): void {
  const current = googleCredentialRow(db);
  if (!current) return;
  db.update(googleCredentials)
    .set({
      accessToken: input.accessToken,
      expiry: input.expiry,
      refreshToken: input.refreshToken ?? current.refreshToken,
    })
    .where(eq(googleCredentials.id, SETTING_ID))
    .run();
}
