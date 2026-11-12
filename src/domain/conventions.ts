import { eq } from "drizzle-orm";
import { aliases, conventions } from "../db/schema";
import type { DomainResult, TrackerDb } from "./db";
import { normalizeName } from "./names";

export type ConventionInput = {
  displayName: string;
  website: string | null;
  notes: string | null;
  defaultCity?: string | null;
  defaultRegion?: string | null;
  estimatedAttendance?: number | null;
  manualInterest?: number;
};

export function createConvention(db: TrackerDb, input: ConventionInput): DomainResult<{ id: number }> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "An expo needs a name." };
  const normalized = normalizeName(displayName);
  if (!normalized) return { ok: false, error: "That name has nothing left to match on." };
  const taken = nameOwner(db, normalized);
  if (taken) return { ok: false, error: `That name is already used by ${taken}.` };

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
  if (!displayName) return { ok: false, error: "An expo needs a name." };
  const normalized = normalizeName(displayName);
  if (!normalized) return { ok: false, error: "That name has nothing left to match on." };
  const taken = nameOwner(db, normalized, input.id);
  if (taken) return { ok: false, error: `That name is already used by ${taken}.` };

  const current = db.select().from(conventions).where(eq(conventions.id, input.id)).get();
  if (!current) return { ok: false, error: "That expo is gone." };

  const updated = db
    .update(conventions)
    .set({
      displayName,
      normalized,
      website: input.website,
      notes: input.notes,
      defaultCity: input.defaultCity ?? null,
      defaultRegion: input.defaultRegion ?? null,
      estimatedAttendance: input.estimatedAttendance ?? null,
      manualInterest: input.manualInterest ?? 0,
    })
    .where(eq(conventions.id, input.id))
    .returning({ id: conventions.id })
    .get();

  if (!updated) return { ok: false, error: "That expo is gone." };
  return { ok: true, value: { id: updated.id } };
}

export function deleteConvention(db: TrackerDb, id: number): DomainResult<{ id: number }> {
  const current = db.select({ id: conventions.id }).from(conventions).where(eq(conventions.id, id)).get();
  if (!current) return { ok: false, error: "That expo is gone." };
  db.delete(conventions).where(eq(conventions.id, id)).run();
  return { ok: true, value: { id } };
}

export function countConventions(db: TrackerDb): number {
  return db.select({ id: conventions.id }).from(conventions).all().length;
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
