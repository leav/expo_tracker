import { addCalendarDays } from "./lineupBoard";
import { APPLICATION_TIMEZONE, calendarEventTitle, type ReminderKind } from "./calendarEvent";

const ICS_LINE_OCTETS = 75;

export function icsForReminder(input: {
  kind: ReminderKind;
  conventionName: string;
  cycleLabel: string;
  date?: string | null;
  editionId: number;
  now?: Date;
}): string | null {
  const date = input.date?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const summary = calendarEventTitle(input.kind, input.conventionName, input.cycleLabel);
  const uid = `expo-tracker-${input.editionId}-${input.kind}@localhost`;
  const start = date.replaceAll("-", "");
  const end = addCalendarDays(date, 1).replaceAll("-", "");
  const stamp = icsTimestamp(input.now ?? new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Expo Tracker//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${APPLICATION_TIMEZONE}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(summary)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(summary)}`,
    "TRIGGER:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function hrefForGoogleCalendarTemplate(input: {
  title: string;
  date?: string | null;
}): string | null {
  const date = input.date?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = date.replaceAll("-", "");
  const end = addCalendarDays(date, 1).replaceAll("-", "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${start}/${end}`,
    ctz: APPLICATION_TIMEZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFilename(input: {
  kind: ReminderKind;
  conventionName: string;
  cycleLabel: string;
}): string {
  const suffix = input.kind === "start" ? "starts" : "artist-alley-opens";
  const base = `${input.conventionName} ${input.cycleLabel} ${suffix}`
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "reminder"}.ics`;
}

function icsTimestamp(now: Date): string {
  const iso = now.toISOString().replace(/[-:]/g, "");
  return `${iso.slice(0, 8)}T${iso.slice(9, 15)}Z`;
}

export function escapeIcsText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= ICS_LINE_OCTETS) return line;

  const decoder = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;
  let limit = ICS_LINE_OCTETS;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    while (end > offset && (bytes[end] & 0xc0) === 0x80) end -= 1;
    if (end === offset) end = Math.min(offset + limit, bytes.length);
    parts.push(decoder.decode(bytes.subarray(offset, end)));
    offset = end;
    limit = ICS_LINE_OCTETS - 1;
  }
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}
