import type { GoogleCalendarEventResource } from "../domain/calendarEvent";
import { CalendarNotFoundError, type CalendarClient } from "./calendar";

export type FakeCalendarCall =
  | { op: "create"; summary: string; date: string }
  | { op: "patch"; eventId: string; summary: string; date: string }
  | { op: "delete"; eventId: string };

export function createFakeCalendarClient(options?: {
  failuresRemaining?: number;
  missingEventIds?: Iterable<string>;
}) {
  const calls: FakeCalendarCall[] = [];
  let nextId = 1;
  let failuresRemaining = options?.failuresRemaining ?? 0;
  const missing = new Set(options?.missingEventIds ?? []);

  function maybeFail() {
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      throw new Error("fake Calendar failure");
    }
  }

  const client: CalendarClient = {
    async createEvent(_calendarId: string, event: GoogleCalendarEventResource) {
      maybeFail();
      const id = `fake-event-${nextId}`;
      nextId += 1;
      calls.push({ op: "create", summary: event.summary, date: event.start.date });
      return { id };
    },
    async patchEvent(_calendarId: string, eventId: string, event: GoogleCalendarEventResource) {
      maybeFail();
      if (missing.has(eventId)) throw new CalendarNotFoundError("missing");
      calls.push({ op: "patch", eventId, summary: event.summary, date: event.start.date });
    },
    async deleteEvent(_calendarId: string, eventId: string) {
      maybeFail();
      if (missing.has(eventId)) throw new CalendarNotFoundError("missing");
      calls.push({ op: "delete", eventId });
    },
  };

  return {
    client,
    calls,
    setFailures(count: number) {
      failuresRemaining = count;
    },
  };
}
