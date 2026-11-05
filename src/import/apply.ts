import { and, eq } from "drizzle-orm";
import { conventions, editionLinks, editions, importProposals } from "../db/schema";
import { addAlias } from "../domain/aliases";
import { createConvention, findNameMatch } from "../domain/conventions";
import type { DomainResult, TrackerDb } from "../domain/db";
import { importEdition } from "../domain/editions";
import { normalizeName } from "../domain/names";
import type { Intent, Status } from "../domain/status";
import {
  editionDatesFromInterpretation,
  type ParsedSheetRow,
} from "./parse";

export type MergePayload = {
  identityKey: string;
  displayName: string;
  website: string | null;
  rows: ParsedSheetRow[];
};

export type AliasPayload = {
  identityKey: string;
  conventionName: string;
  name: string;
};

export type UnresolvedPayload = {
  row: ParsedSheetRow;
};

export type ImportProposal = {
  id: number;
  kind: "merge" | "alias" | "unresolved";
  dedupeKey: string;
  state: string;
  payload: MergePayload | AliasPayload | UnresolvedPayload;
};

export type ImportSummary = {
  editionsUpserted: number;
  conventionsCreated: number;
  mergesProposed: number;
  aliasesProposed: number;
  unresolvedProposed: number;
};

export function applyParsedRows(db: TrackerDb, rows: ParsedSheetRow[]): ImportSummary {
  const summary: ImportSummary = {
    editionsUpserted: 0,
    conventionsCreated: 0,
    mergesProposed: 0,
    aliasesProposed: 0,
    unresolvedProposed: 0,
  };

  const groups = new Map<string, ParsedSheetRow[]>();
  for (const row of rows) {
    const list = groups.get(row.identityKey) ?? [];
    list.push(row);
    groups.set(row.identityKey, list);
  }

  for (const [identityKey, group] of groups) {
    const existing = findNameMatch(db, identityKey);
    const isNewMerge = !existing && group.length > 1;
    if (isNewMerge) {
      upsertProposal(db, {
        kind: "merge",
        dedupeKey: `merge:${identityKey}`,
        payload: {
          identityKey,
          displayName: pickDisplayName(group),
          website: group.find((row) => row.website)?.website ?? null,
          rows: group,
        },
      });
      summary.mergesProposed += 1;
    } else {
      for (const row of group) {
        const alreadyImported = db
          .select({ id: editions.id })
          .from(editions)
          .where(eq(editions.sheetRowKey, row.sheetRowKey))
          .get();
        if (row.reviewReason && !alreadyImported) {
          upsertProposal(db, {
            kind: "unresolved",
            dedupeKey: `unresolved:${row.sheetRowKey}`,
            payload: { row },
          });
          summary.unresolvedProposed += 1;
          continue;
        }
        const written = writeRow(db, row, existing?.id ?? null);
        if (written.createdConvention) summary.conventionsCreated += 1;
        if (written.editionId) summary.editionsUpserted += 1;
      }
    }

    const conventionName = existing?.displayName ?? pickDisplayName(group);
    for (const row of group) {
      for (const name of row.aliasCandidates) {
        const aliasKey = normalizeName(name);
        if (!aliasKey || aliasKey === identityKey) continue;
        if (findNameMatch(db, aliasKey)) continue;
        upsertProposal(db, {
          kind: "alias",
          dedupeKey: `alias:${identityKey}:${aliasKey}`,
          payload: { identityKey, conventionName, name },
        });
        summary.aliasesProposed += 1;
      }
    }
  }

  return summary;
}

export function listPendingProposals(db: TrackerDb): ImportProposal[] {
  return db
    .select()
    .from(importProposals)
    .where(eq(importProposals.state, "pending"))
    .all()
    .map(readProposal)
    .sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.dedupeKey.localeCompare(b.dedupeKey));
}

export function acceptMerge(db: TrackerDb, proposalId: number): DomainResult<{ conventionId: number }> {
  const proposal = pending(db, proposalId, "merge");
  if (!proposal.ok) return proposal;
  const payload = proposal.value.payload as MergePayload;
  const conventionId = ensureConvention(db, payload.displayName, payload.website, payload.identityKey);
  if (!conventionId.ok) return conventionId;
  for (const row of payload.rows) {
    writeRow(db, row, conventionId.value);
  }
  markAccepted(db, proposalId);
  return { ok: true, value: { conventionId: conventionId.value } };
}

export function acceptAlias(db: TrackerDb, proposalId: number): DomainResult<{ id: number }> {
  const proposal = pending(db, proposalId, "alias");
  if (!proposal.ok) return proposal;
  const payload = proposal.value.payload as AliasPayload;
  const match = findNameMatch(db, payload.identityKey);
  if (!match) return { ok: false, error: "Accept the series first, then this alias." };
  const result = addAlias(db, { conventionId: match.id, name: payload.name });
  if (!result.ok) return result;
  markAccepted(db, proposalId);
  return result;
}

export function acceptUnresolved(
  db: TrackerDb,
  proposalId: number,
  override?: {
    dateField?: "application_start" | "submitted_at" | "ignore";
    applicationStartDate?: string | null;
    applicationEndDate?: string | null;
    submittedAt?: string | null;
    resultAt?: string | null;
    status?: Status;
    intent?: Intent;
  },
): DomainResult<{ editionId: number }> {
  const proposal = pending(db, proposalId, "unresolved");
  if (!proposal.ok) return proposal;
  const row = { ...(proposal.value.payload as UnresolvedPayload).row };
  if (override?.intent) row.intent = override.intent;
  if (override?.status) row.status = override.status;
  if (override?.applicationStartDate !== undefined || override?.dateField) {
    row.dates = applyDateOverride(row, override);
  }
  if (!row.intent || !row.status) {
    return { ok: false, error: "This row still needs a status." };
  }
  const written = writeRow(db, row, findNameMatch(db, row.identityKey)?.id ?? null);
  if (!written.editionId) return { ok: false, error: "Could not save that row." };
  markAccepted(db, proposalId);
  return { ok: true, value: { editionId: written.editionId } };
}

export function dismissProposal(db: TrackerDb, proposalId: number): DomainResult<{ id: number }> {
  const current = db.select().from(importProposals).where(eq(importProposals.id, proposalId)).get();
  if (!current || current.state !== "pending") {
    return { ok: false, error: "That review item is gone." };
  }
  db.update(importProposals).set({ state: "dismissed" }).where(eq(importProposals.id, proposalId)).run();
  return { ok: true, value: { id: proposalId } };
}

function applyDateOverride(
  row: ParsedSheetRow,
  override: {
    dateField?: "application_start" | "submitted_at" | "ignore";
    applicationStartDate?: string | null;
    applicationEndDate?: string | null;
    submittedAt?: string | null;
    resultAt?: string | null;
  },
): ParsedSheetRow["dates"] {
  if (override.dateField === "ignore") return { kind: "none" };
  if (override.dateField === "submitted_at") {
    return {
      kind: "submitted",
      submittedAt: override.submittedAt ?? row.applyDate,
      resultAt: override.resultAt ?? row.resultDate,
    };
  }
  if (override.dateField === "application_start") {
    return {
      kind: row.dates.kind === "ended_window" ? "ended_window" : "application_window",
      applicationStartDate: override.applicationStartDate ?? row.applyDate,
      applicationEndDate: override.applicationEndDate ?? null,
    };
  }
  return row.dates;
}

function writeRow(
  db: TrackerDb,
  row: ParsedSheetRow,
  conventionId: number | null,
): { conventionId: number | null; editionId: number | null; createdConvention: boolean } {
  if (!row.intent || !row.status) {
    return { conventionId, editionId: null, createdConvention: false };
  }
  let createdConvention = false;
  let id = conventionId;
  if (id == null) {
    const before = findNameMatch(db, row.identityKey);
    const created = ensureConvention(db, row.displayName, row.website, row.identityKey);
    if (!created.ok) return { conventionId: null, editionId: null, createdConvention: false };
    id = created.value;
    createdConvention = !before;
  } else {
    const current = db.select().from(conventions).where(eq(conventions.id, id)).get();
    if (current && !current.website && row.website) {
      db.update(conventions).set({ website: row.website }).where(eq(conventions.id, id)).run();
    }
  }

  const dates = editionDatesFromInterpretation(row.dates);
  const result = importEdition(db, {
    conventionId: id,
    cycleLabel: row.cycleLabel,
    startDate: row.startDate,
    endDate: null,
    applicationStartDate: dates.applicationStartDate,
    applicationEndDate: dates.applicationEndDate,
    venue: null,
    city: row.city,
    region: null,
    country: null,
    attendance: row.attendance,
    intent: row.intent,
    status: row.status,
    submittedAt: dates.submittedAt,
    resultAt: dates.resultAt,
    paid: false,
    notes: row.notes,
    applicationConfirmed: false,
    inferInitialStatus: false,
    sheetRowKey: row.sheetRowKey,
  });
  if (!result.ok) return { conventionId: id, editionId: null, createdConvention };

  for (const link of row.links) {
    const already = db
      .select({ id: editionLinks.id })
      .from(editionLinks)
      .where(and(eq(editionLinks.editionId, result.value.id), eq(editionLinks.url, link.url)))
      .get();
    if (already) continue;
    db.insert(editionLinks)
      .values({ editionId: result.value.id, url: link.url, kind: link.kind })
      .run();
  }

  return { conventionId: id, editionId: result.value.id, createdConvention };
}

function ensureConvention(
  db: TrackerDb,
  displayName: string,
  website: string | null,
  identityKey: string,
): DomainResult<number> {
  const existing = findNameMatch(db, identityKey);
  if (existing) return { ok: true, value: existing.id };
  const created = createConvention(db, { displayName, website, notes: null });
  if (!created.ok) return created;
  const stored = db.select().from(conventions).where(eq(conventions.id, created.value.id)).get();
  if (stored && stored.pollingEnabled) {
    db.update(conventions).set({ pollingEnabled: false }).where(eq(conventions.id, created.value.id)).run();
  }
  return { ok: true, value: created.value.id };
}

function upsertProposal(
  db: TrackerDb,
  input: { kind: ImportProposal["kind"]; dedupeKey: string; payload: MergePayload | AliasPayload | UnresolvedPayload },
) {
  const current = db.select().from(importProposals).where(eq(importProposals.dedupeKey, input.dedupeKey)).get();
  const payloadJson = JSON.stringify(input.payload);
  if (!current) {
    db.insert(importProposals)
      .values({ kind: input.kind, dedupeKey: input.dedupeKey, payloadJson, state: "pending" })
      .run();
    return;
  }
  if (current.state === "pending") {
    db.update(importProposals)
      .set({ payloadJson, kind: input.kind })
      .where(eq(importProposals.id, current.id))
      .run();
  }
}

function pending(
  db: TrackerDb,
  proposalId: number,
  kind: ImportProposal["kind"],
): DomainResult<ImportProposal> {
  const current = db.select().from(importProposals).where(eq(importProposals.id, proposalId)).get();
  if (!current || current.state !== "pending") {
    return { ok: false, error: "That review item is gone." };
  }
  const proposal = readProposal(current);
  if (proposal.kind !== kind) return { ok: false, error: "That review item is a different kind." };
  return { ok: true, value: proposal };
}

function markAccepted(db: TrackerDb, proposalId: number) {
  db.update(importProposals).set({ state: "accepted" }).where(eq(importProposals.id, proposalId)).run();
}

function readProposal(row: typeof importProposals.$inferSelect): ImportProposal {
  return {
    id: row.id,
    kind: row.kind as ImportProposal["kind"],
    dedupeKey: row.dedupeKey,
    state: row.state,
    payload: JSON.parse(row.payloadJson) as ImportProposal["payload"],
  };
}

function pickDisplayName(group: ParsedSheetRow[]): string {
  const names = [...new Set(group.map((row) => row.displayName))];
  names.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return names[0];
}

function kindOrder(kind: ImportProposal["kind"]): number {
  if (kind === "merge") return 0;
  if (kind === "unresolved") return 1;
  return 2;
}

export function countPendingProposals(db: TrackerDb): number {
  return db.select({ id: importProposals.id }).from(importProposals).where(eq(importProposals.state, "pending")).all()
    .length;
}
