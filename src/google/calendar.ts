import type { GoogleCalendarEventResource } from "../domain/calendarEvent";
import type { TrackerDb } from "../domain/db";
import { googleCredentialRow, updateGoogleTokens } from "../domain/settings";
import { refreshAccessToken } from "./oauth";

export class CalendarNotFoundError extends Error {
  override name = "CalendarNotFoundError";
}

export type CalendarClient = {
  createEvent(calendarId: string, event: GoogleCalendarEventResource): Promise<{ id: string }>;
  patchEvent(calendarId: string, eventId: string, event: GoogleCalendarEventResource): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
};

export function createGoogleCalendarClient(db: TrackerDb): CalendarClient | null {
  if (!googleCredentialRow(db)) return null;
  return new GoogleCalendarClient(db);
}

class GoogleCalendarClient implements CalendarClient {
  constructor(private readonly db: TrackerDb) {}

  async createEvent(calendarId: string, event: GoogleCalendarEventResource): Promise<{ id: string }> {
    const payload = await this.request("POST", eventsUrl(calendarId), event);
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!id) throw new Error("Google Calendar did not return an event id.");
    return { id };
  }

  async patchEvent(calendarId: string, eventId: string, event: GoogleCalendarEventResource): Promise<void> {
    await this.request("PATCH", eventsUrl(calendarId, eventId), event);
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.request("DELETE", eventsUrl(calendarId, eventId));
  }

  private async request(
    method: "POST" | "PATCH" | "DELETE",
    url: string,
    body?: GoogleCalendarEventResource,
  ): Promise<Record<string, unknown>> {
    const send = async (accessToken: string) =>
      fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

    let token = await this.accessToken();
    let response = await send(token);
    if (response.status === 401) {
      token = await this.accessToken(true);
      response = await send(token);
    }
    if (response.status === 404) throw new CalendarNotFoundError("Google Calendar event was not found.");
    if (response.status === 204) return {};
    const payload = response.headers.get("content-type")?.includes("json")
      ? ((await response.json()) as Record<string, unknown>)
      : {};
    if (!response.ok) {
      const message =
        typeof payload.error === "object" &&
        payload.error &&
        "message" in payload.error &&
        typeof payload.error.message === "string"
          ? payload.error.message
          : `Google Calendar ${method} failed (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    const credential = googleCredentialRow(this.db);
    if (!credential) throw new Error("Google is not connected.");
    const freshEnough =
      !forceRefresh &&
      credential.accessToken &&
      credential.expiry != null &&
      credential.expiry > Date.now() + 60_000;
    if (freshEnough && credential.accessToken) return credential.accessToken;

    const refreshed = await refreshAccessToken(credential.refreshToken);
    updateGoogleTokens(this.db, refreshed);
    return refreshed.accessToken;
  }
}

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}
