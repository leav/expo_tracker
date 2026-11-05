import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const conventions = sqliteTable("convention", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  normalized: text("normalized").notNull().unique(),
  website: text("website"),
  pollingEnabled: integer("polling_enabled", { mode: "boolean" }).notNull().default(false),
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
    applicationConfirmed: integer("application_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    startDateCalendarEventId: text("start_date_calendar_event_id"),
    applicationStartDateCalendarEventId: text("application_start_date_calendar_event_id"),
    venue: text("venue"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    attendance: integer("attendance"),
    intent: text("intent").notNull(),
    status: text("status").notNull(),
    submittedAt: text("submitted_at"),
    resultAt: text("result_at"),
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
  },
  (table) => [unique("edition_convention_cycle").on(table.conventionId, table.cycleLabel)],
);
