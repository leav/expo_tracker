import { eq } from "drizzle-orm";
import type { SqlJsStatic } from "sql.js";
import { aliases, conventions, editionLinks, editions } from "../db/schema";
import { createWorkspace, isSqliteBytes } from "../db/workspace";
import { addAlias } from "./aliases";
import { createConvention, deleteConvention, nameOwner, updateConvention } from "./conventions";
import type { DomainResult, TrackerDb } from "./db";
import { createEdition, getSeries, updateEdition } from "./editions";
import { isError, parseAttendance, parseDate, parseSignedInteger } from "./fields";
import { normalizeName } from "./names";
import { isStatus, todayInLosAngeles, type Status } from "./status";

export const DATA_FILE_FORMAT = "expo-tracker";
export const DATA_FILE_VERSION = 1;

export const dataFileLinkKinds = ["discord", "gmail", "google_form", "eventeny", "eventhub", "other"] as const;
export type DataFileLinkKind = (typeof dataFileLinkKinds)[number];

export type DataFileLink = {
  url: string;
  kind: DataFileLinkKind;
};

export type DataFileEdition = {
  cycle: string;
  eventStart?: string | null;
  eventEnd?: string | null;
  applicationStart?: string | null;
  applicationEnd?: string | null;
  status?: Status;
  submittedAt?: string | null;
  resultDate?: string | null;
  paid?: boolean;
  notes?: string | null;
  links?: DataFileLink[];
};

export type DataFileConvention = {
  name: string;
  aliases?: string[];
  website?: string | null;
  city?: string | null;
  state?: string | null;
  estimatedAttendance?: number | null;
  interest?: number;
  notes?: string | null;
  editions?: DataFileEdition[];
};

export type DataFile = {
  format: typeof DATA_FILE_FORMAT;
  version: typeof DATA_FILE_VERSION;
  conventions: DataFileConvention[];
};

export type DataFilePreviewEdition = {
  cycle: string;
  change: "added" | "modified";
};

export type DataFilePreviewRow = {
  expoName: string;
  expoChange: "added" | "removed" | null;
  editions: DataFilePreviewEdition[];
};

export type DataFilePreview = {
  added: number;
  updated: number;
  removed: number;
  warnings: string[];
  rows: DataFilePreviewRow[];
};

export type ExportConvention = {
  id: number;
  name: string;
};

export function listExportConventions(db: TrackerDb): ExportConvention[] {
  return db
    .select({ id: conventions.id, name: conventions.displayName })
    .from(conventions)
    .all()
    .map((row) => ({ id: row.id, name: row.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function dataFileDownloadName(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `expo-tracker-${year}-${month}-${day}.json`;
}

export function exportDataFile(
  db: TrackerDb,
  options?: { includeApplicationStatus?: boolean; conventionIds?: number[] },
): DataFile {
  const includeApplicationStatus = options?.includeApplicationStatus ?? true;
  const selected = options?.conventionIds ? new Set(options.conventionIds) : null;
  const rows = listExportConventions(db).filter((row) => (selected ? selected.has(row.id) : true));

  return {
    format: DATA_FILE_FORMAT,
    version: DATA_FILE_VERSION,
    conventions: rows.map((row) => exportConvention(db, row.id, includeApplicationStatus)),
  };
}

export function dataFileFromBytes(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
): DomainResult<{ document: DataFile; source: "json" | "sqlite" }> {
  if (isSqliteBytes(bytes)) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    let workspace: ReturnType<typeof createWorkspace> | undefined;
    try {
      workspace = createWorkspace(SQL, copy);
      return {
        ok: true,
        value: {
          document: exportDataFile(workspace.db, { includeApplicationStatus: true }),
          source: "sqlite",
        },
      };
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof Error ? cause.message : "Could not read that SQLite file.",
      };
    } finally {
      workspace?.sqlite.close();
    }
  }
  const parsed = parseDataFile(new TextDecoder().decode(bytes));
  if (!parsed.ok) return parsed;
  return { ok: true, value: { document: parsed.value, source: "json" } };
}

export function parseDataFile(text: string): DomainResult<DataFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isRecord(raw)) return { ok: false, error: "That file is not an Expo Tracker document." };
  if (raw.format !== DATA_FILE_FORMAT) {
    return { ok: false, error: "That file is not an Expo Tracker document." };
  }
  if (raw.version !== DATA_FILE_VERSION) {
    return { ok: false, error: "That file uses an unsupported Expo Tracker version." };
  }
  if (!Array.isArray(raw.conventions)) {
    return { ok: false, error: "That file is missing a conventions list." };
  }

  const conventions: DataFileConvention[] = [];
  const seenKeys = new Map<string, string>();
  for (const [index, entry] of raw.conventions.entries()) {
    const parsed = parseConvention(entry, index);
    if (!parsed.ok) return parsed;
    for (const key of conventionKeys(parsed.value)) {
      const owner = seenKeys.get(key);
      if (owner) {
        return { ok: false, error: `${parsed.value.name} and ${owner} share the same name in that file.` };
      }
      seenKeys.set(key, parsed.value.name);
    }
    conventions.push(parsed.value);
  }

  return { ok: true, value: { format: DATA_FILE_FORMAT, version: DATA_FILE_VERSION, conventions } };
}

export function previewDataFile(
  db: TrackerDb,
  doc: DataFile,
  options?: { replace?: boolean },
): DomainResult<DataFilePreview> {
  const plan = planImport(db, doc, options?.replace === true);
  if (!plan.ok) return plan;
  return { ok: true, value: previewFromPlan(db, plan.value) };
}

export function applyDataFile(
  db: TrackerDb,
  doc: DataFile,
  options?: { replace?: boolean },
): DomainResult<DataFilePreview> {
  const planned = planImport(db, doc, options?.replace === true);
  if (!planned.ok) return planned;
  const plan = planned.value;
  const preview = previewFromPlan(db, plan);

  for (const id of plan.removedIds) {
    const deleted = deleteConvention(db, id);
    if (!deleted.ok) return deleted;
  }

  for (const row of plan.updated) {
    const written = writeConvention(db, row.incoming, row.id);
    if (!written.ok) return written;
  }

  for (const row of plan.added) {
    const written = writeConvention(db, row.incoming, null);
    if (!written.ok) return written;
  }

  return { ok: true, value: preview };
}

type PlannedExpo =
  | { kind: "added"; incoming: DataFileConvention }
  | { kind: "updated"; incoming: DataFileConvention; id: number };

type ImportPlan = {
  added: { incoming: DataFileConvention }[];
  updated: { incoming: DataFileConvention; id: number }[];
  sequence: PlannedExpo[];
  removedIds: number[];
  warnings: string[];
};

function previewFromPlan(db: TrackerDb, plan: ImportPlan): DataFilePreview {
  const rows: DataFilePreviewRow[] = [];
  for (const item of plan.sequence) {
    if (item.kind === "added") {
      rows.push({
        expoName: item.incoming.name,
        expoChange: "added",
        editions: (item.incoming.editions ?? []).map((edition) => ({
          cycle: edition.cycle,
          change: "added",
        })),
      });
      continue;
    }
    const local = db
      .select({ displayName: conventions.displayName })
      .from(conventions)
      .where(eq(conventions.id, item.id))
      .get();
    const existing = new Set(
      db
        .select({ cycle: editions.cycleLabel })
        .from(editions)
        .where(eq(editions.conventionId, item.id))
        .all()
        .map((row) => row.cycle),
    );
    rows.push({
      expoName: local?.displayName ?? item.incoming.name,
      expoChange: null,
      editions: (item.incoming.editions ?? []).map((edition) => ({
        cycle: edition.cycle,
        change: existing.has(edition.cycle) ? "modified" : "added",
      })),
    });
  }
  const removed = plan.removedIds
    .map((id) => {
      const local = db
        .select({ displayName: conventions.displayName })
        .from(conventions)
        .where(eq(conventions.id, id))
        .get();
      return { id, name: local?.displayName ?? `Expo ${id}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  for (const row of removed) {
    rows.push({ expoName: row.name, expoChange: "removed", editions: [] });
  }
  return {
    added: plan.added.length,
    updated: plan.updated.length,
    removed: plan.removedIds.length,
    warnings: plan.warnings,
    rows,
  };
}

function planImport(db: TrackerDb, doc: DataFile, replace: boolean): DomainResult<ImportPlan> {
  const added: ImportPlan["added"] = [];
  const updated: ImportPlan["updated"] = [];
  const sequence: PlannedExpo[] = [];
  const matched = new Set<number>();
  const warnings: string[] = [];

  for (const incoming of doc.conventions) {
    const match = matchConvention(db, incoming);
    if (!match.ok) return match;
    if (match.value) {
      if (matched.has(match.value)) {
        const local = db
          .select({ displayName: conventions.displayName })
          .from(conventions)
          .where(eq(conventions.id, match.value))
          .get();
        return {
          ok: false,
          error: `Two expos in the file match ${local?.displayName ?? incoming.name}.`,
        };
      }
      matched.add(match.value);
      const item: PlannedExpo = { kind: "updated", incoming, id: match.value };
      updated.push(item);
      sequence.push(item);
    } else {
      const item: PlannedExpo = { kind: "added", incoming };
      added.push(item);
      sequence.push(item);
    }
    warnings.push(...aliasWarnings(db, incoming, match.value));
  }

  const removedIds = replace
    ? db
        .select({ id: conventions.id })
        .from(conventions)
        .all()
        .filter((row) => !matched.has(row.id))
        .map((row) => row.id)
    : [];

  return { ok: true, value: { added, updated, sequence, removedIds, warnings } };
}

function matchConvention(db: TrackerDb, incoming: DataFileConvention): DomainResult<number | null> {
  const nameKey = normalizeName(incoming.name);
  if (!nameKey) return { ok: false, error: `${incoming.name} has nothing left to match on.` };
  const byName = conventionIdForKey(db, nameKey);
  if (byName != null) return { ok: true, value: byName };

  const aliasIds = new Set<number>();
  for (const alias of incoming.aliases ?? []) {
    const key = normalizeName(alias);
    if (!key) continue;
    const id = conventionIdForKey(db, key);
    if (id != null) aliasIds.add(id);
  }
  if (aliasIds.size > 1) {
    return { ok: false, error: `${incoming.name} matches more than one expo in this workspace.` };
  }
  if (aliasIds.size === 1) return { ok: true, value: [...aliasIds][0] };
  return { ok: true, value: null };
}

function conventionIdForKey(db: TrackerDb, normalized: string): number | null {
  const row = db
    .select({ id: conventions.id })
    .from(conventions)
    .where(eq(conventions.normalized, normalized))
    .get();
  if (row) return row.id;
  const alias = db
    .select({ conventionId: aliases.conventionId })
    .from(aliases)
    .where(eq(aliases.normalized, normalized))
    .get();
  return alias?.conventionId ?? null;
}

function aliasWarnings(db: TrackerDb, incoming: DataFileConvention, matchedId: number | null): string[] {
  const warnings: string[] = [];
  const incomingNameKey = normalizeName(incoming.name);
  for (const alias of incoming.aliases ?? []) {
    const key = normalizeName(alias);
    if (!key || key === incomingNameKey) continue;
    const owner = nameOwner(db, key, matchedId ?? undefined);
    if (owner) warnings.push(`Skipped alias ${alias} (already used by ${owner}).`);
  }
  return warnings;
}

function mergedDisplayName(
  db: TrackerDb,
  incomingName: string,
  current: { id: number; displayName: string; normalized: string } | null,
): string {
  if (!current) return incomingName;
  const incomingKey = normalizeName(incomingName);
  if (!incomingKey || incomingKey === current.normalized) return incomingName;
  if (conventionIdForKey(db, incomingKey) === current.id) return current.displayName;
  return incomingName;
}

function conventionKeys(incoming: DataFileConvention): string[] {
  const keys = [normalizeName(incoming.name)];
  for (const alias of incoming.aliases ?? []) {
    const key = normalizeName(alias);
    if (key) keys.push(key);
  }
  return keys.filter((key): key is string => Boolean(key));
}

function exportConvention(db: TrackerDb, id: number, includeApplicationStatus: boolean): DataFileConvention {
  const series = getSeries(db, id);
  if (!series) return { name: "" };
  const record: DataFileConvention = { name: series.convention.displayName };
  if (series.aliases.length > 0) record.aliases = series.aliases.map((row) => row.name);
  assignOptional(record, "website", series.convention.website);
  assignOptional(record, "city", series.convention.defaultCity);
  assignOptional(record, "state", series.convention.defaultRegion);
  if (series.convention.estimatedAttendance != null) {
    record.estimatedAttendance = series.convention.estimatedAttendance;
  }
  if (includeApplicationStatus) {
    if (series.convention.manualInterest !== 0) record.interest = series.convention.manualInterest;
    assignOptional(record, "notes", series.convention.notes);
  }
  const exportedEditions = series.editions.map((edition) =>
    exportEdition(db, edition, includeApplicationStatus),
  );
  if (exportedEditions.length > 0) record.editions = exportedEditions;
  return record;
}

function exportEdition(
  db: TrackerDb,
  edition: NonNullable<ReturnType<typeof getSeries>>["editions"][number],
  includeApplicationStatus: boolean,
): DataFileEdition {
  const record: DataFileEdition = { cycle: edition.cycleLabel };
  assignOptional(record, "eventStart", edition.startDate);
  assignOptional(record, "eventEnd", edition.endDate);
  assignOptional(record, "applicationStart", edition.applicationStartDate);
  assignOptional(record, "applicationEnd", edition.applicationEndDate);
  if (includeApplicationStatus) {
    record.status = isStatus(edition.status) ? edition.status : "unknown";
    assignOptional(record, "submittedAt", edition.submittedAt);
    assignOptional(record, "resultDate", edition.resultDate);
    record.paid = edition.paid;
    assignOptional(record, "notes", edition.notes);
  }
  const links = db
    .select({ url: editionLinks.url, kind: editionLinks.kind })
    .from(editionLinks)
    .where(eq(editionLinks.editionId, edition.id))
    .all()
    .filter((link): link is DataFileLink => isLinkKind(link.kind));
  if (links.length > 0) record.links = links;
  return record;
}

function writeConvention(
  db: TrackerDb,
  incoming: DataFileConvention,
  existingId: number | null,
): DomainResult<{ id: number }> {
  const current =
    existingId == null
      ? null
      : db.select().from(conventions).where(eq(conventions.id, existingId)).get() ?? null;
  if (existingId != null && !current) return { ok: false, error: "That expo is gone." };

  const displayName = mergedDisplayName(db, incoming.name, current);
  const saved =
    current == null
      ? createConvention(db, {
          displayName,
          website: incoming.website ?? null,
          notes: incoming.notes ?? null,
          defaultCity: incoming.city ?? null,
          defaultRegion: incoming.state ?? null,
          estimatedAttendance: incoming.estimatedAttendance ?? null,
          manualInterest: incoming.interest ?? 0,
        })
      : updateConvention(db, {
          id: current.id,
          displayName,
          website: incoming.website !== undefined ? incoming.website : current.website,
          notes: incoming.notes !== undefined ? incoming.notes : current.notes,
          defaultCity: incoming.city !== undefined ? incoming.city : current.defaultCity,
          defaultRegion: incoming.state !== undefined ? incoming.state : current.defaultRegion,
          estimatedAttendance:
            incoming.estimatedAttendance !== undefined
              ? incoming.estimatedAttendance
              : current.estimatedAttendance,
          manualInterest: incoming.interest !== undefined ? incoming.interest : current.manualInterest,
        });
  if (!saved.ok) return saved;
  const conventionId = saved.value.id;

  for (const alias of incoming.aliases ?? []) {
    const added = addAlias(db, { conventionId, name: alias });
    if (added.ok) continue;
    if (added.error.startsWith("That name is already")) continue;
  }

  for (const edition of incoming.editions ?? []) {
    const written = writeEdition(db, conventionId, edition);
    if (!written.ok) return written;
  }

  return { ok: true, value: { id: conventionId } };
}

function writeEdition(
  db: TrackerDb,
  conventionId: number,
  incoming: DataFileEdition,
): DomainResult<{ id: number }> {
  const current = db
    .select()
    .from(editions)
    .where(eq(editions.conventionId, conventionId))
    .all()
    .find((row) => row.cycleLabel === incoming.cycle);

  if (!current) {
    const status = incoming.status ?? "unknown";
    const created = createEdition(db, {
      conventionId,
      cycleLabel: incoming.cycle,
      startDate: incoming.eventStart ?? null,
      endDate: incoming.eventEnd ?? null,
      applicationStartDate: incoming.applicationStart ?? null,
      applicationEndDate: incoming.applicationEnd ?? null,
      status,
      submittedAt: incoming.submittedAt ?? null,
      resultDate: incoming.resultDate ?? null,
      paid: incoming.paid ?? false,
      notes: incoming.notes ?? null,
      inferInitialStatus: incoming.status === undefined,
    });
    if (!created.ok) return created;
    if (incoming.links) replaceLinks(db, created.value.id, incoming.links);
    return created;
  }

  const status =
    incoming.status !== undefined
      ? incoming.status
      : isStatus(current.status)
        ? current.status
        : "unknown";
  const updated = updateEdition(
    db,
    current.id,
    {
      conventionId,
      cycleLabel: incoming.cycle,
      startDate: incoming.eventStart !== undefined ? incoming.eventStart : current.startDate,
      endDate: incoming.eventEnd !== undefined ? incoming.eventEnd : current.endDate,
      applicationStartDate:
        incoming.applicationStart !== undefined ? incoming.applicationStart : current.applicationStartDate,
      applicationEndDate:
        incoming.applicationEnd !== undefined ? incoming.applicationEnd : current.applicationEndDate,
      status,
      submittedAt: incoming.submittedAt !== undefined ? incoming.submittedAt : current.submittedAt,
      resultDate: incoming.resultDate !== undefined ? incoming.resultDate : current.resultDate,
      paid: incoming.paid !== undefined ? incoming.paid : current.paid,
      notes: incoming.notes !== undefined ? incoming.notes : current.notes,
    },
    todayInLosAngeles(),
  );
  if (!updated.ok) return updated;
  if (incoming.links) replaceLinks(db, current.id, incoming.links);
  return updated;
}

function replaceLinks(db: TrackerDb, editionId: number, links: DataFileLink[]): void {
  db.delete(editionLinks).where(eq(editionLinks.editionId, editionId)).run();
  for (const link of links) {
    db.insert(editionLinks).values({ editionId, url: link.url, kind: link.kind }).run();
  }
}

function parseConvention(raw: unknown, index: number): DomainResult<DataFileConvention> {
  if (!isRecord(raw)) return { ok: false, error: `Expo ${index + 1} is not an object.` };
  const name = requiredString(raw.name, "name");
  if (!name.ok) return name;
  if (!normalizeName(name.value)) {
    return { ok: false, error: `${name.value} has nothing left to match on.` };
  }

  const aliases = optionalStringList(raw.aliases, "aliases");
  if (!aliases.ok) return aliases;
  const website = optionalString(raw, "website", "website");
  if (!website.ok) return website;
  const city = optionalString(raw, "city", "city");
  if (!city.ok) return city;
  const state = optionalString(raw, "state", "state");
  if (!state.ok) return state;
  const notes = optionalString(raw, "notes", "notes");
  if (!notes.ok) return notes;

  let estimatedAttendance: number | null | undefined;
  if ("estimatedAttendance" in raw) {
    if (raw.estimatedAttendance === null) {
      estimatedAttendance = null;
    } else if (typeof raw.estimatedAttendance === "number" && Number.isInteger(raw.estimatedAttendance)) {
      const parsed = parseAttendance(String(raw.estimatedAttendance));
      if (isError(parsed)) return { ok: false, error: parsed.error };
      estimatedAttendance = parsed;
    } else {
      return { ok: false, error: "Attendance must be a whole number." };
    }
  }

  let interest: number | undefined;
  if ("interest" in raw) {
    if (typeof raw.interest !== "number" || !Number.isInteger(raw.interest)) {
      const parsed = parseSignedInteger(
        typeof raw.interest === "string" ? raw.interest : null,
        "My interest",
      );
      if (isError(parsed)) return { ok: false, error: "Interest must be a whole number." };
      interest = parsed;
    } else {
      interest = raw.interest;
    }
  }

  let parsedEditions: DataFileEdition[] | undefined;
  if ("editions" in raw) {
    if (!Array.isArray(raw.editions)) return { ok: false, error: `Editions for ${name.value} must be a list.` };
    parsedEditions = [];
    const cycles = new Set<string>();
    for (const [editionIndex, entry] of raw.editions.entries()) {
      const edition = parseEdition(entry, name.value, editionIndex);
      if (!edition.ok) return edition;
      if (cycles.has(edition.value.cycle)) {
        return { ok: false, error: `Cycle ${edition.value.cycle} is listed twice on ${name.value}.` };
      }
      cycles.add(edition.value.cycle);
      parsedEditions.push(edition.value);
    }
  }

  const value: DataFileConvention = { name: name.value };
  if (aliases.value) value.aliases = aliases.value;
  if (website.value !== undefined) value.website = website.value;
  if (city.value !== undefined) value.city = city.value;
  if (state.value !== undefined) value.state = state.value;
  if (estimatedAttendance !== undefined) value.estimatedAttendance = estimatedAttendance;
  if (interest !== undefined) value.interest = interest;
  if (notes.value !== undefined) value.notes = notes.value;
  if (parsedEditions) value.editions = parsedEditions;
  return { ok: true, value };
}

function parseEdition(raw: unknown, conventionName: string, index: number): DomainResult<DataFileEdition> {
  if (!isRecord(raw)) {
    return { ok: false, error: `Edition ${index + 1} on ${conventionName} is not an object.` };
  }
  const cycle = requiredString(raw.cycle, "cycle");
  if (!cycle.ok) return cycle;

  const eventStart = optionalDate(raw, "eventStart", "Event start");
  if (!eventStart.ok) return eventStart;
  const eventEnd = optionalDate(raw, "eventEnd", "Event end");
  if (!eventEnd.ok) return eventEnd;
  const applicationStart = optionalDate(raw, "applicationStart", "Application start");
  if (!applicationStart.ok) return applicationStart;
  const applicationEnd = optionalDate(raw, "applicationEnd", "Application end");
  if (!applicationEnd.ok) return applicationEnd;
  const submittedAt = optionalDate(raw, "submittedAt", "Submitted");
  if (!submittedAt.ok) return submittedAt;
  const resultDate = optionalDate(raw, "resultDate", "Result");
  if (!resultDate.ok) return resultDate;
  const notes = optionalString(raw, "notes", "notes");
  if (!notes.ok) return notes;

  let status: Status | undefined;
  if ("status" in raw) {
    if (typeof raw.status !== "string" || !isStatus(raw.status)) {
      return { ok: false, error: `Edition ${cycle.value} on ${conventionName} has an unknown status.` };
    }
    status = raw.status;
  }

  let paid: boolean | undefined;
  if ("paid" in raw) {
    if (typeof raw.paid !== "boolean") {
      return { ok: false, error: `Paid for ${cycle.value} on ${conventionName} must be true or false.` };
    }
    paid = raw.paid;
  }

  let links: DataFileLink[] | undefined;
  if ("links" in raw) {
    if (!Array.isArray(raw.links)) {
      return { ok: false, error: `Links for ${cycle.value} on ${conventionName} must be a list.` };
    }
    links = [];
    for (const entry of raw.links) {
      if (!isRecord(entry) || typeof entry.url !== "string" || !entry.url.trim()) {
        return { ok: false, error: `A link on ${conventionName} ${cycle.value} needs a url.` };
      }
      if (typeof entry.kind !== "string" || !isLinkKind(entry.kind)) {
        return { ok: false, error: `A link on ${conventionName} ${cycle.value} has an unknown kind.` };
      }
      links.push({ url: entry.url.trim(), kind: entry.kind });
    }
  }

  const value: DataFileEdition = { cycle: cycle.value };
  if (eventStart.value !== undefined) value.eventStart = eventStart.value;
  if (eventEnd.value !== undefined) value.eventEnd = eventEnd.value;
  if (applicationStart.value !== undefined) value.applicationStart = applicationStart.value;
  if (applicationEnd.value !== undefined) value.applicationEnd = applicationEnd.value;
  if (status !== undefined) value.status = status;
  if (submittedAt.value !== undefined) value.submittedAt = submittedAt.value;
  if (resultDate.value !== undefined) value.resultDate = resultDate.value;
  if (paid !== undefined) value.paid = paid;
  if (notes.value !== undefined) value.notes = notes.value;
  if (links) value.links = links;
  return { ok: true, value };
}

function optionalDate(
  record: Record<string, unknown>,
  key: string,
  label: string,
): DomainResult<string | null | undefined> {
  if (!(key in record)) return { ok: true, value: undefined };
  if (record[key] === null || record[key] === "") return { ok: true, value: null };
  if (typeof record[key] !== "string") return { ok: false, error: `${label} must be a date.` };
  const parsed = parseDate(record[key], label);
  if (isError(parsed)) return { ok: false, error: parsed.error };
  return { ok: true, value: parsed };
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): DomainResult<string | null | undefined> {
  if (!(key in record)) return { ok: true, value: undefined };
  if (record[key] === null) return { ok: true, value: null };
  if (typeof record[key] !== "string") return { ok: false, error: `${label} must be text.` };
  const trimmed = record[key].trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

function optionalStringList(raw: unknown, label: string): DomainResult<string[] | undefined> {
  if (raw === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string")) {
    return { ok: false, error: `${label} must be a list of names.` };
  }
  const values = raw.map((entry) => entry.trim()).filter(Boolean);
  return { ok: true, value: values };
}

function requiredString(raw: unknown, label: string): DomainResult<string> {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: `An expo needs a ${label}.` };
  }
  return { ok: true, value: raw.trim() };
}

function assignOptional<T extends object>(record: T, key: keyof T, value: string | null): void {
  if (value) (record as Record<string, unknown>)[key as string] = value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLinkKind(value: string): value is DataFileLinkKind {
  return (dataFileLinkKinds as readonly string[]).includes(value);
}
