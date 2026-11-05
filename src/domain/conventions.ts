import { eq } from "drizzle-orm";
import { aliases, conventions, editions } from "../db/schema";
import { pickAttendanceValue, pickRepresentativeEdition } from "./cons";
import type { DomainResult, TrackerDb } from "./db";
import { resolveDriveTime, seedDriveMinutes } from "./driveTime";
import { normalizeName } from "./names";
import { todayInLosAngeles } from "./status";

export type ConventionInput = {
  displayName: string;
  website: string | null;
  notes: string | null;
  defaultCity?: string | null;
  defaultRegion?: string | null;
  estimatedAttendance?: number | null;
  manualInterest?: number;
  driveMinutes?: number | null;
};

export function createConvention(db: TrackerDb, input: ConventionInput): DomainResult<{ id: number }> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "A convention needs a name." };
  const normalized = normalizeName(displayName);
  if (!normalized) return { ok: false, error: "That name has nothing left to match on." };
  const taken = nameOwner(db, normalized);
  if (taken) return { ok: false, error: `That name is already used by ${taken}.` };

  const drive = resolveDriveTime({
    city: input.defaultCity ?? null,
    currentMinutes: null,
    currentSource: null,
    manualMinutes: input.driveMinutes ?? null,
  });

  const inserted = db
    .insert(conventions)
    .values({
      displayName,
      normalized,
      website: input.website,
      notes: input.notes,
      defaultCity: input.defaultCity ?? null,
      defaultRegion: input.defaultRegion ?? null,
      estimatedAttendance: input.estimatedAttendance ?? null,
      manualInterest: input.manualInterest ?? 0,
      driveMinutes: drive.driveMinutes,
      driveSource: drive.driveSource,
    })
    .returning({ id: conventions.id })
    .get();

  return { ok: true, value: { id: inserted.id } };
}

export function updateConvention(
  db: TrackerDb,
  input: ConventionInput & { id: number },
): DomainResult<{ id: number }> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "A convention needs a name." };
  const normalized = normalizeName(displayName);
  if (!normalized) return { ok: false, error: "That name has nothing left to match on." };
  const taken = nameOwner(db, normalized, input.id);
  if (taken) return { ok: false, error: `That name is already used by ${taken}.` };

  const current = db.select().from(conventions).where(eq(conventions.id, input.id)).get();
  if (!current) return { ok: false, error: "That convention is gone." };

  const nextCity = input.defaultCity ?? null;
  const cityChanged = (current.defaultCity ?? null) !== nextCity;
  const drive = resolveDriveTime({
    city: nextCity,
    currentMinutes: current.driveMinutes,
    currentSource: current.driveSource,
    manualMinutes: input.driveMinutes ?? null,
    cityChanged,
  });

  const updated = db
    .update(conventions)
    .set({
      displayName,
      normalized,
      website: input.website,
      notes: input.notes,
      defaultCity: nextCity,
      defaultRegion: input.defaultRegion ?? null,
      estimatedAttendance: input.estimatedAttendance ?? null,
      manualInterest: input.manualInterest ?? 0,
      driveMinutes: drive.driveMinutes,
      driveSource: drive.driveSource,
    })
    .where(eq(conventions.id, input.id))
    .returning({ id: conventions.id })
    .get();

  if (!updated) return { ok: false, error: "That convention is gone." };
  return { ok: true, value: { id: updated.id } };
}

export function deleteConvention(db: TrackerDb, id: number): DomainResult<{ id: number }> {
  const current = db.select({ id: conventions.id }).from(conventions).where(eq(conventions.id, id)).get();
  if (!current) return { ok: false, error: "That convention is gone." };
  db.delete(conventions).where(eq(conventions.id, id)).run();
  return { ok: true, value: { id } };
}

export function countConventions(db: TrackerDb): number {
  return db.select({ id: conventions.id }).from(conventions).all().length;
}

export function findConventionByNormalized(db: TrackerDb, normalized: string) {
  return db.select().from(conventions).where(eq(conventions.normalized, normalized)).get();
}

export function findNameMatch(
  db: TrackerDb,
  normalized: string,
): { id: number; displayName: string } | null {
  const convention = findConventionByNormalized(db, normalized);
  if (convention) return { id: convention.id, displayName: convention.displayName };
  const alias = db
    .select({ id: conventions.id, displayName: conventions.displayName })
    .from(aliases)
    .innerJoin(conventions, eq(aliases.conventionId, conventions.id))
    .where(eq(aliases.normalized, normalized))
    .get();
  return alias ?? null;
}

export function listConventions(db: TrackerDb) {
  return db.select().from(conventions).all();
}

export function nameOwner(db: TrackerDb, normalized: string, exceptConventionId?: number): string | null {
  const convention = db
    .select({ id: conventions.id, displayName: conventions.displayName })
    .from(conventions)
    .where(eq(conventions.normalized, normalized))
    .all()
    .find((row) => row.id !== exceptConventionId);
  if (convention) return convention.displayName;

  const alias = db
    .select({ conventionId: aliases.conventionId, displayName: conventions.displayName })
    .from(aliases)
    .innerJoin(conventions, eq(aliases.conventionId, conventions.id))
    .where(eq(aliases.normalized, normalized))
    .all()
    .find((row) => row.conventionId !== exceptConventionId);
  return alias?.displayName ?? null;
}

export function fillConventionFromImport(
  db: TrackerDb,
  conventionId: number,
  rows: { startDate: string | null; cycleLabel: string; attendance: number | null; city: string | null }[],
  today = todayInLosAngeles(),
): void {
  const current = db.select().from(conventions).where(eq(conventions.id, conventionId)).get();
  if (!current) return;
  const representative = pickRepresentativeEdition(rows, today);
  const updates: Partial<typeof conventions.$inferInsert> = {};
  if (!current.defaultCity) {
    const city = representative?.city ?? rows.find((row) => row.city)?.city ?? null;
    if (city) updates.defaultCity = city;
  }
  if (current.estimatedAttendance == null) {
    const attendance = pickAttendanceValue(rows, today);
    if (attendance != null) updates.estimatedAttendance = attendance;
  }
  const nextCity = (updates.defaultCity ?? current.defaultCity) as string | null;
  if (current.driveSource !== "manual" && current.driveMinutes == null) {
    const seeded = seedDriveMinutes(nextCity);
    if (seeded != null) {
      updates.driveMinutes = seeded;
      updates.driveSource = "seed";
    }
  }
  if (Object.keys(updates).length === 0) return;
  db.update(conventions).set(updates).where(eq(conventions.id, conventionId)).run();
}

export function seedEmptyConventionDefaults(db: TrackerDb, conventionId: number, today = todayInLosAngeles()): void {
  const current = db.select().from(conventions).where(eq(conventions.id, conventionId)).get();
  if (!current) return;
  const editionRows = db.select().from(editions).where(eq(editions.conventionId, conventionId)).all();
  const representative = pickRepresentativeEdition(editionRows, today);
  if (!representative) return;
  const updates: Partial<typeof conventions.$inferInsert> = {};
  if (!current.defaultCity && representative.city) updates.defaultCity = representative.city;
  if (!current.defaultRegion && representative.region) updates.defaultRegion = representative.region;
  if (current.driveSource !== "manual" && current.driveMinutes == null) {
    const seeded = seedDriveMinutes((updates.defaultCity ?? current.defaultCity) as string | null);
    if (seeded != null) {
      updates.driveMinutes = seeded;
      updates.driveSource = "seed";
    }
  }
  if (Object.keys(updates).length === 0) return;
  db.update(conventions).set(updates).where(eq(conventions.id, conventionId)).run();
}
