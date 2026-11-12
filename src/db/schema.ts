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
