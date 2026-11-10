import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarEventTitle, isReminderKind } from "./calendarEvent";

describe("calendar event titles", () => {
  it("titles start and application-start events", () => {
    assert.equal(calendarEventTitle("start", "FanimeCon", "2027"), "FanimeCon 2027 starts");
    assert.equal(
      calendarEventTitle("application_start", "FanimeCon", "2027"),
      "FanimeCon 2027 artist alley opens",
    );
  });

  it("accepts reminder kinds", () => {
    assert.equal(isReminderKind("start"), true);
    assert.equal(isReminderKind("application_start"), true);
    assert.equal(isReminderKind("end"), false);
  });
});
