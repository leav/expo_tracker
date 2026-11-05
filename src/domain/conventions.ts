import { eq } from "drizzle-orm";
import { aliases, conventions } from "../db/schema";
import type { DomainResult, TrackerDb } from "./db";
import { normalizeName } from "./names";

export function createConvention(
  db: TrackerDb,
  input: { displayName: string; website: string | null; notes: string | null },
): DomainResult<{ id: number }> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "A convention needs a name." };
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
      pollingEnabled: false,
    })
    .returning({ id: conventions.id })
    .get();

  return { ok: true, value: { id: inserted.id } };
}

export function updateConvention(
  db: TrackerDb,
  input: {
    id: number;
    displayName: string;
    website: string | null;
    notes: string | null;
    pollingEnabled: boolean;
  },
): DomainResult<{ id: number }> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "A convention needs a name." };
  const normalized = normalizeName(displayName);
  if (!normalized) return { ok: false, error: "That name has nothing left to match on." };
  const taken = nameOwner(db, normalized, input.id);
  if (taken) return { ok: false, error: `That name is already used by ${taken}.` };

  const updated = db
    .update(conventions)
    .set({
      displayName,
      normalized,
      website: input.website,
      notes: input.notes,
      pollingEnabled: input.pollingEnabled,
    })
    .where(eq(conventions.id, input.id))
    .returning({ id: conventions.id })
    .get();

  if (!updated) return { ok: false, error: "That convention is gone." };
  return { ok: true, value: { id: updated.id } };
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
    .where(
      exceptConventionId === undefined
        ? eq(conventions.normalized, normalized)
        : eq(conventions.normalized, normalized),
    )
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
