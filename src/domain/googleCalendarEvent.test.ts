import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hrefForGoogleCalendarEvent } from "./googleCalendarEvent";

describe("hrefForGoogleCalendarEvent", () => {
  it("encodes primary calendar events with the owner email", () => {
    const href = hrefForGoogleCalendarEvent({
      eventId: "abc123",
      calendarId: "primary",
      ownerEmail: "owner@example.com",
    });
    assert.equal(
      href,
      `https://calendar.google.com/calendar/event?eid=${Buffer.from("abc123 owner@example.com").toString("base64url")}`,
    );
  });

  it("uses a custom calendar id instead of the owner email", () => {
    const href = hrefForGoogleCalendarEvent({
      eventId: "evt-9",
      calendarId: "team@example.com",
      ownerEmail: "owner@example.com",
    });
    assert.equal(
      href,
      `https://calendar.google.com/calendar/event?eid=${Buffer.from("evt-9 team@example.com").toString("base64url")}`,
    );
  });

  it("returns null when the event id or calendar identity is missing", () => {
    assert.equal(hrefForGoogleCalendarEvent({ eventId: "", calendarId: "primary", ownerEmail: "a@b.c" }), null);
    assert.equal(hrefForGoogleCalendarEvent({ eventId: "evt", calendarId: "primary", ownerEmail: "" }), null);
    assert.equal(hrefForGoogleCalendarEvent({ eventId: "evt", calendarId: "  ", ownerEmail: null }), null);
    assert.equal(hrefForGoogleCalendarEvent({}), null);
  });

  it("treats blank calendar id as primary", () => {
    const href = hrefForGoogleCalendarEvent({
      eventId: "evt",
      calendarId: "  ",
      ownerEmail: "owner@example.com",
    });
    assert.equal(
      href,
      `https://calendar.google.com/calendar/event?eid=${Buffer.from("evt owner@example.com").toString("base64url")}`,
    );
  });
});
