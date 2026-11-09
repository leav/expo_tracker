import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const conventions = sqliteTable("convention", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  normalized: text("normalized").notNull().unique(),
  website: text("website"),
  defaultCity: text("default_city"),
  defaultRegion: text("default_region"),
  estimatedAttendance: integer("estimated_attendance"),
  manualInterest: integer("manual_interest").notNull().default(0),
  driveMinutes: integer("drive_minutes"),
  driveSource: text("drive_source"),
  notes: text("notes"),
});

export const aliases = sqliteTable("alias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conventionId: integer("convention_id")
    .notNull()
    .references(() => conventions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalized: text("normalized").notNull().unique(),
});

export const editions = sqliteTable(
  "edition",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conventionId: integer("convention_id")
      .notNull()
      .references(() => conventions.id, { onDelete: "cascade" }),
    cycleLabel: text("cycle_label").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    applicationStartDate: text("application_start_date"),
    applicationEndDate: text("application_end_date"),
    startDateCalendarEventId: text("start_date_calendar_event_id"),
    applicationStartDateCalendarEventId: text("application_start_date_calendar_event_id"),
    startReminderEnabled: integer("start_reminder_enabled", { mode: "boolean" }).notNull().default(false),
    applicationStartReminderEnabled: integer("application_start_reminder_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull(),
    submittedAt: text("submitted_at"),
    resultDate: text("result_date"),
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
    sheetRowKey: text("sheet_row_key").unique(),
  },
  (table) => [unique("edition_convention_cycle").on(table.conventionId, table.cycleLabel)],
);

export const editionLinks = sqliteTable("edition_link", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  editionId: integer("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: text("kind").notNull(),
});

export const importProposals = sqliteTable("import_proposal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  payloadJson: text("payload_json").notNull(),
  state: text("state").notNull().default("pending"),
});

export const settings = sqliteTable("setting", {
  id: integer("id").primaryKey(),
  ownerEmail: text("owner_email"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  driveLimitHours: integer("drive_limit_hours").notNull().default(12),
  calendarId: text("calendar_id").notNull().default("primary"),
});

export const googleCredentials = sqliteTable("google_credential", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiry: integer("expiry"),
  scopes: text("scopes").notNull(),
  historyId: text("history_id"),
});

export const calendarSync = sqliteTable("calendar_sync", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  editionId: integer("edition_id").references(() => editions.id, { onDelete: "set null" }),
  reminderKind: text("reminder_kind").notNull(),
  action: text("action").notNull(),
  googleEventId: text("google_event_id"),
  state: text("state").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
