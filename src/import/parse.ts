import {
  completeCycleLabel,
  identityFromName,
  seriesDisplayName,
} from "../domain/names";
import { initialStatus, isDecisionStatus, todayInLosAngeles, type Status } from "../domain/status";
import { parseCsv } from "./csv";

export const sheetHeaders = [
  "名称",
  "地点",
  "开展日期",
  "申请日期",
  "申请结果",
  "状态",
  "预计总人流",
  "官方网页",
  "其他连接",
  "注释",
] as const;

export type LinkKind = "discord" | "gmail" | "google_form" | "eventeny" | "eventhub" | "other";

export type DateInterpretation =
  | { kind: "submitted"; submittedAt: string | null; resultDate: string | null }
  | {
      kind: "application_window";
      applicationStartDate: string | null;
      applicationEndDate: string | null;
    }
  | {
      kind: "ended_window";
      applicationStartDate: string | null;
      applicationEndDate: string | null;
    }
  | { kind: "unresolved"; rawDate: string }
  | { kind: "none" };

export type ParsedSheetRow = {
  sheetRowKey: string;
  rawName: string;
  identityKey: string;
  displayName: string;
  cycleLabel: string;
  aliasCandidates: string[];
  city: string | null;
  startDate: string | null;
  applyDate: string | null;
  resultDate: string | null;
  attendance: number | null;
  website: string | null;
  links: { url: string; kind: LinkKind }[];
  notes: string | null;
  sheetStatus: string;
  status: Status | null;
  dates: DateInterpretation;
  reviewReason: "ended_window" | "unresolved_date" | "unknown_status" | null;
};

const statusMap: Record<string, { status: Status; ended?: boolean }> = {
  留意中: { status: "unknown" },
  已申请: { status: "submitted" },
  Waitlist: { status: "waitlisted" },
  已通过: { status: "approved" },
  已拒绝: { status: "rejected" },
  Pass: { status: "passed" },
  申请已结束: { status: "unknown", ended: true },
};

export function parseSheet(csv: string, today = todayInLosAngeles()): ParsedSheetRow[] {
  const table = parseCsv(csv);
  if (table.length === 0) return [];
  const header = table[0].map((cell) => cell.trim());
  const index = Object.fromEntries(sheetHeaders.map((name) => [name, header.indexOf(name)])) as Record<
    (typeof sheetHeaders)[number],
    number
  >;
  if (index["名称"] < 0 || index["状态"] < 0) {
    throw new Error("That CSV does not look like the 摆摊 sheet.");
  }

  const rows: ParsedSheetRow[] = [];
  for (const cells of table.slice(1)) {
    const rawName = cell(cells, index["名称"]);
    if (!rawName) continue;
    const identity = identityFromName(rawName);
    if (!identity.key) continue;

    const applyDate = parseSheetDate(cell(cells, index["申请日期"]));
    const resultDate = parseSheetDate(cell(cells, index["申请结果"]));
    const startDate = parseSheetDate(cell(cells, index["开展日期"]));
    const notes = blank(cell(cells, index["注释"]));
    const sheetStatus = cell(cells, index["状态"]);
    const mapped = statusMap[sheetStatus] ?? null;
    const dates = interpretDates({
      applyDate,
      resultDate,
      rawApplyDate: cell(cells, index["申请日期"]),
      notes,
      mapped,
    });

    let status = mapped?.status ?? null;
    if (mapped && sheetStatus === "留意中") {
      const openDate = dates.kind === "application_window" ? dates.applicationStartDate : null;
      status = initialStatus(openDate, today);
    }

    const reviewReason = !mapped
      ? "unknown_status"
      : mapped.ended
        ? "ended_window"
        : dates.kind === "unresolved"
          ? "unresolved_date"
          : null;

    rows.push({
      sheetRowKey: rawName,
      rawName,
      identityKey: identity.key,
      displayName: seriesDisplayName(rawName),
      cycleLabel: completeCycleLabel(identity.cycleLabel, startDate),
      aliasCandidates: identity.aliasCandidates,
      city: blank(cell(cells, index["地点"])),
      startDate,
      applyDate,
      resultDate,
      attendance: parseSheetAttendance(cell(cells, index["预计总人流"])),
      website: parseWebsite(cell(cells, index["官方网页"])),
      links: parseLinks(cell(cells, index["其他连接"])),
      notes,
      sheetStatus,
      status,
      dates,
      reviewReason,
    });
  }
  return rows;
}

function interpretDates(input: {
  applyDate: string | null;
  resultDate: string | null;
  rawApplyDate: string;
  notes: string | null;
  mapped: { status: Status; ended?: boolean } | null;
}): DateInterpretation {
  const { applyDate, resultDate, rawApplyDate, notes, mapped } = input;
  if (mapped && resultDate && isDecisionStatus(mapped.status)) {
    return { kind: "submitted", submittedAt: applyDate, resultDate };
  }
  if (mapped && mapped.status !== "passed" && !mapped.ended && !isDecisionStatus(mapped.status) && applyDate) {
    return {
      kind: "application_window",
      applicationStartDate: applyDate,
      applicationEndDate: null,
    };
  }
  if (mapped?.ended && applyDate) {
    const range = rangeFromNote(notes, applyDate);
    if (range) {
      return { kind: "ended_window", applicationStartDate: range.start, applicationEndDate: range.end };
    }
  }
  if (mapped?.ended) {
    const range = rangeFromNote(notes, applyDate ?? resultDate);
    if (range) {
      return { kind: "ended_window", applicationStartDate: range.start, applicationEndDate: range.end };
    }
    return { kind: "ended_window", applicationStartDate: applyDate, applicationEndDate: null };
  }
  if (rawApplyDate) {
    return { kind: "unresolved", rawDate: rawApplyDate };
  }
  return { kind: "none" };
}

export function rangeFromNote(
  notes: string | null,
  yearHint: string | null,
): { start: string; end: string } | null {
  if (!notes) return null;
  const match = notes.match(
    /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})(?:\s*日)?\s*[-–—~至到]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})/,
  );
  if (!match) return null;
  const year = yearHint?.slice(0, 4) ?? null;
  const start = parseSheetDate(match[1], year);
  const end = parseSheetDate(match[2], year);
  if (!start || !end) return null;
  return { start, end };
}

export function parseSheetDate(value: string, yearHint?: string | null): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return validIso(trimmed);
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return validIso(`${us[3]}-${pad(us[1])}-${pad(us[2])}`);
  }
  const short = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (short && yearHint && /^\d{4}$/.test(yearHint)) {
    return validIso(`${yearHint}-${pad(short[1])}-${pad(short[2])}`);
  }
  return null;
}

export function parseSheetAttendance(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || /^unknown$/i.test(trimmed)) return null;
  const digits = trimmed.replace(/,/g, "").match(/\d+/);
  if (!digits) return null;
  return Number(digits[0]);
}

export function classifyLink(url: string): LinkKind {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "discord.com" || host === "discordapp.com") return "discord";
    if (host === "mail.google.com" || host === "gmail.com") return "gmail";
    if (host === "forms.gle" || (host === "docs.google.com" && url.includes("/forms/"))) return "google_form";
    if (host === "eventeny.com") return "eventeny";
    if (host === "eventhub.net") return "eventhub";
  } catch {
    return "other";
  }
  return "other";
}

function parseLinks(value: string): { url: string; kind: LinkKind }[] {
  const found = value.match(/https?:\/\/[^\s]+/g) ?? [];
  const seen = new Set<string>();
  const links: { url: string; kind: LinkKind }[] = [];
  for (const raw of found) {
    const url = raw.replace(/[),.;]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ url, kind: classifyLink(url) });
  }
  return links;
}

function parseWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = trimmed.match(/https?:\/\/[^\s]+/);
  if (url) return url[0];
  if (trimmed.includes(" ") || !trimmed.includes(".")) return null;
  return trimmed;
}

function validIso(value: string): string | null {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return value;
}

function pad(value: string): string {
  return value.padStart(2, "0");
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function blank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function editionDatesFromInterpretation(dates: DateInterpretation): {
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  submittedAt: string | null;
  resultDate: string | null;
} {
  switch (dates.kind) {
    case "submitted":
      return {
        applicationStartDate: null,
        applicationEndDate: null,
        submittedAt: dates.submittedAt,
        resultDate: dates.resultDate,
      };
    case "application_window":
    case "ended_window":
      return {
        applicationStartDate: dates.applicationStartDate,
        applicationEndDate: dates.applicationEndDate,
        submittedAt: null,
        resultDate: null,
      };
    default:
      return {
        applicationStartDate: null,
        applicationEndDate: null,
        submittedAt: null,
        resultDate: null,
      };
  }
}
