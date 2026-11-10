export const APPLICATION_TIMEZONE = "America/Los_Angeles";

export const reminderKinds = ["start", "application_start"] as const;
export type ReminderKind = (typeof reminderKinds)[number];

export function isReminderKind(value: string): value is ReminderKind {
  return (reminderKinds as readonly string[]).includes(value);
}

export function calendarEventTitle(
  kind: ReminderKind,
  conventionName: string,
  cycleLabel: string,
): string {
  if (kind === "start") return `${conventionName} ${cycleLabel} starts`;
  return `${conventionName} ${cycleLabel} artist alley opens`;
}
