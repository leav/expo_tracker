import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarEventTitle } from "./calendarEvent";
import { escapeIcsText, foldIcsLine, hrefForGoogleCalendarTemplate, icsFilename, icsForReminder } from "./ics";

describe("icsForReminder", () => {
  const now = new Date("2026-11-10T05:00:00.000Z");

  it("builds an application-start event with exclusive end and both alarms", () => {
    const ics = icsForReminder({
      kind: "application_start",
      conventionName: "FanimeCon",
      cycleLabel: "2027",
      date: "2026-12-01",
      editionId: 12,
      now,
    });
    assert.ok(ics);
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /SUMMARY:FanimeCon 2027 artist alley opens/);
    assert.match(ics, /UID:expo-tracker-12-application_start@localhost/);
    assert.match(ics, /DTSTART;VALUE=DATE:20261201/);
    assert.match(ics, /DTEND;VALUE=DATE:20261202/);
    assert.match(ics, /DTSTAMP:20261110T050000Z/);
    assert.match(ics, /TRIGGER:-P1D/);
    assert.match(ics, /TRIGGER:PT9H/);
    assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 2);
  });

  it("builds an event-start file and rolls the exclusive end across a month boundary", () => {
    const ics = icsForReminder({
      kind: "start",
      conventionName: "Test",
      cycleLabel: "2027",
      date: "2027-01-31",
      editionId: 3,
      now,
    });
    assert.ok(ics);
    assert.match(ics, /SUMMARY:Test 2027 starts/);
    assert.match(ics, /DTSTART;VALUE=DATE:20270131/);
    assert.match(ics, /DTEND;VALUE=DATE:20270201/);
    assert.equal(calendarEventTitle("start", "Test", "2027"), "Test 2027 starts");
  });

  it("returns null when the date is missing or blank", () => {
    assert.equal(
      icsForReminder({
        kind: "start",
        conventionName: "FanimeCon",
        cycleLabel: "2027",
        date: "",
        editionId: 1,
        now,
      }),
      null,
    );
    assert.equal(
      icsForReminder({
        kind: "start",
        conventionName: "FanimeCon",
        cycleLabel: "2027",
        date: null,
        editionId: 1,
        now,
      }),
      null,
    );
  });

  it("folds a long summary at 75 octets", () => {
    const name = "Very Long Convention Name That Should Fold In The ICS Summary Line";
    const ics = icsForReminder({
      kind: "start",
      conventionName: name,
      cycleLabel: "2027",
      date: "2027-03-15",
      editionId: 9,
      now,
    });
    assert.ok(ics);
    const summary = ics
      .split("\r\n")
      .filter((line, index, lines) => line.startsWith("SUMMARY:") || (lines[index - 1]?.startsWith("SUMMARY:") && line.startsWith(" ")));
    assert.ok(summary[0] && Buffer.from(summary[0], "utf8").length <= 75);
    assert.ok(summary.some((line) => line.startsWith(" ")));
  });

  it("escapes commas and semicolons in text", () => {
    assert.equal(escapeIcsText("A, B; C"), "A\\, B\\; C");
  });

  it("builds a download filename", () => {
    assert.equal(icsFilename({ kind: "start", conventionName: "FanimeCon", cycleLabel: "2027" }), "FanimeCon-2027-starts.ics");
    assert.equal(
      icsFilename({ kind: "application_start", conventionName: "FanimeCon", cycleLabel: "2027" }),
      "FanimeCon-2027-artist-alley-opens.ics",
    );
  });
});

describe("hrefForGoogleCalendarTemplate", () => {
  it("builds a template URL for an application-start title", () => {
    const href = hrefForGoogleCalendarTemplate({
      title: calendarEventTitle("application_start", "FanimeCon", "2027"),
      date: "2026-12-01",
    });
    assert.equal(
      href,
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=FanimeCon+2027+artist+alley+opens&dates=20261201%2F20261202&ctz=America%2FLos_Angeles",
    );
  });

  it("builds a template URL for an event-start title and rolls the exclusive end", () => {
    const href = hrefForGoogleCalendarTemplate({
      title: calendarEventTitle("start", "Test", "2027"),
      date: "2027-01-31",
    });
    assert.equal(
      href,
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Test+2027+starts&dates=20270131%2F20270201&ctz=America%2FLos_Angeles",
    );
  });

  it("returns null when the date is missing or blank", () => {
    assert.equal(hrefForGoogleCalendarTemplate({ title: "Test 2027 starts", date: "" }), null);
    assert.equal(hrefForGoogleCalendarTemplate({ title: "Test 2027 starts", date: null }), null);
  });

  it("encodes commas and other reserved characters in the title", () => {
    const href = hrefForGoogleCalendarTemplate({
      title: "A, B & C 2027 starts",
      date: "2027-03-15",
    });
    assert.ok(href);
    assert.match(href, /text=A%2C\+B\+%26\+C\+2027\+starts/);
  });
});

describe("foldIcsLine", () => {
  it("keeps continuation lines at 75 octets including the leading space", () => {
    const folded = foldIcsLine(`SUMMARY:${"A".repeat(90)}`);
    const lines = folded.split("\r\n");
    assert.equal(Buffer.from(lines[0] ?? "", "utf8").length, 75);
    assert.equal((lines[1] ?? "").startsWith(" "), true);
    assert.ok(Buffer.from(lines[1] ?? "", "utf8").length <= 75);
  });
});
