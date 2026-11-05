import { and, eq } from "drizzle-orm";
import { aliases, conventions } from "../db/schema";
import type { DomainResult, TrackerDb } from "./db";
import { nameOwner } from "./conventions";
import { normalizeName } from "./names";

export function addAlias(
  db: TrackerDb,
  input: { conventionId: number; name: string },
): DomainResult<{ id: number }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "An alias needs a name." };
  const convention = db
    .select({ id: conventions.id, normalized: conventions.normalized, displayName: conventions.displayName })
    .from(conventions)
    .where(eq(conventions.id, input.conventionId))
    .get();
  if (!convention) return { ok: false, error: "That convention is gone." };

  const normalized = normalizeName(name);
  if (!normalized) return { ok: false, error: "That name has nothing left to match on." };
  if (normalized === convention.normalized) {
    return { ok: false, error: `That name is already ${convention.displayName}.` };
  }
  const taken = nameOwner(db, normalized);
  if (taken) return { ok: false, error: `That name is already used by ${taken}.` };

  const inserted = db
    .insert(aliases)
    .values({ conventionId: input.conventionId, name, normalized })
    .returning({ id: aliases.id })
    .get();
  return { ok: true, value: { id: inserted.id } };
}

export function removeAlias(db: TrackerDb, input: { conventionId: number; aliasId: number }): void {
  db.delete(aliases)
    .where(and(eq(aliases.id, input.aliasId), eq(aliases.conventionId, input.conventionId)))
    .run();
}
