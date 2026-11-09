import { addCalendarDays } from "./lineupBoard";

export const APPLICATION_TIMEZONE = "America/Los_Angeles";

export const reminderKinds = ["start", "application_start"] as const;
export type ReminderKind = (typeof reminderKinds)[number];

export function isReminderKind(value: string): value is ReminderKind {
  return (reminderKinds as readonly string[]).includes(value);
}

/** Minutes before an all-day start (midnight): the previous calendar day. */
export const CALENDAR_REMINDER_DAY_BEFORE_MINUTES = 24 * 60;

/**
 * Google Calendar all-day events start at 00:00. A 0-minute popup is the
 * "on the day" alarm; Calendar presents the default all-day on-the-day
 * reminder as 09:00 local time.
 */
export const CALENDAR_REMINDER_NINE_AM_ON_DAY_MINUTES = 0;

export function calendarEventTitle(
  kind: ReminderKind,
  conventionName: string,
  cycleLabel: string,
): string {
  if (kind === "start") return `${conventionName} ${cycleLabel} starts`;
  return `${conventionName} ${cycleLabel} artist alley opens`;
}

export type GoogleCalendarEventResource = {
  summary: string;
  start: { date: string };
  end: { date: string };
  reminders: {
    useDefault: false;
    overrides: { method: "popup"; minutes: number }[];
  };
};

export function calendarEventBody(summary: string, date: string): GoogleCalendarEventResource {
  return {
    summary,
    start: { date },
    end: { date: addCalendarDays(date, 1) },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: CALENDAR_REMINDER_DAY_BEFORE_MINUTES },
        { method: "popup", minutes: CALENDAR_REMINDER_NINE_AM_ON_DAY_MINUTES },
      ],
    },
  };
}
