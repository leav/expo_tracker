export function hrefForGoogleCalendarEvent(input: {
  eventId?: string | null;
  calendarId?: string | null;
  ownerEmail?: string | null;
}): string | null {
  const eventId = input.eventId?.trim() ?? "";
  if (!eventId) return null;

  const calendarId = input.calendarId?.trim() || "primary";
  const calendar = calendarId.toLowerCase() === "primary" ? (input.ownerEmail?.trim() ?? "") : calendarId;
  if (!calendar) return null;

  const eid = Buffer.from(`${eventId} ${calendar}`, "utf8")
    .toString("base64url")
    .replace(/=+$/, "");
  return `https://calendar.google.com/calendar/event?eid=${eid}`;
}
