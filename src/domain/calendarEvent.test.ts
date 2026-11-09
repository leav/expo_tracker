import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALENDAR_REMINDER_DAY_BEFORE_MINUTES,
  CALENDAR_REMINDER_NINE_AM_ON_DAY_MINUTES,
  calendarEventBody,
  calendarEventTitle,
} from "./calendarEvent";

describe("calendar event payload", () => {
  it("titles start and application-start events", () => {
    assert.equal(calendarEventTitle("start", "FanimeCon", "2027"), "FanimeCon 2027 starts");
    assert.equal(
      calendarEventTitle("application_start", "FanimeCon", "2027"),
      "FanimeCon 2027 artist alley opens",
    );
  });

  it("builds an all-day event with exclusive end and both reminders", () => {
    const event = calendarEventBody("FanimeCon 2027 starts", "2027-03-15");
    assert.deepEqual(event.start, { date: "2027-03-15" });
    assert.deepEqual(event.end, { date: "2027-03-16" });
    assert.equal(event.reminders.useDefault, false);
    assert.deepEqual(event.reminders.overrides, [
      { method: "popup", minutes: CALENDAR_REMINDER_DAY_BEFORE_MINUTES },
      { method: "popup", minutes: CALENDAR_REMINDER_NINE_AM_ON_DAY_MINUTES },
    ]);
  });

  it("rolls the exclusive end across a month boundary", () => {
    const event = calendarEventBody("Test 2027 starts", "2027-01-31");
    assert.equal(event.end.date, "2027-02-01");
  });
});
