export const BACKUP_REMINDER_DAYS = 3;
export const BACKUP_REMINDER_STORAGE_KEY = "expo-tracker-backup";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type BackupReminderState = {
  staleSince?: string;
  lastExported?: string;
  snoozedUntil?: string;
};

export type BackupReminderStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const PREFIX =
  "Your data lives only in this browser. Accidentally clearing this site's data will erase the workspace, so export a backup often.";

function isDate(value: unknown): value is string {
  return typeof value === "string" && DATE.test(value);
}

export function parseBackupReminderState(raw: string | null | undefined): BackupReminderState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    const state: BackupReminderState = {};
    if (isDate(record.lastExported)) state.lastExported = record.lastExported;
    if (isDate(record.snoozedUntil)) state.snoozedUntil = record.snoozedUntil;
    if (isDate(record.staleSince)) {
      state.staleSince = record.staleSince;
    } else if (record.stale === true && isDate(record.lastModified)) {
      state.staleSince = record.lastModified;
    }
    return state;
  } catch {
    return {};
  }
}

export function browserBackupStorage(): BackupReminderStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readBackupReminderState(storage: BackupReminderStorage): BackupReminderState {
  try {
    return parseBackupReminderState(storage.getItem(BACKUP_REMINDER_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writeBackupReminderState(storage: BackupReminderStorage, state: BackupReminderState): void {
  try {
    storage.setItem(BACKUP_REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can throw in private mode; skip the reminder rather than breaking writes.
  }
}

export function addBackupReminderDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function backupReminderDaysAgo(from: string, today: string): number {
  const [year, month, day] = from.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const then = Date.UTC(year, month - 1, day);
  const now = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

export function shouldShowBackupReminder(input: {
  today: string;
  hasExpos: boolean;
  persistOk: boolean;
  state: BackupReminderState;
}): boolean {
  if (!input.hasExpos || !input.persistOk) return false;
  const staleSince = input.state.staleSince;
  if (!staleSince) return false;
  if (input.today < addBackupReminderDays(staleSince, BACKUP_REMINDER_DAYS)) return false;
  if (input.state.snoozedUntil && input.today < input.state.snoozedUntil) return false;
  return true;
}

export function lastExportSentence(lastExported: string | undefined, today: string): string {
  if (!lastExported) return "You have not exported a backup yet.";
  const daysAgo = backupReminderDaysAgo(lastExported, today);
  if (daysAgo === 0) return "You last exported today.";
  if (daysAgo === 1) return "You last exported yesterday.";
  return `You last exported ${daysAgo} days ago.`;
}

export function backupReminderCopy(state: BackupReminderState, today: string): string {
  return `${PREFIX} ${lastExportSentence(state.lastExported, today)}`;
}

export function markModified(storage: BackupReminderStorage, today: string): BackupReminderState {
  const current = readBackupReminderState(storage);
  if (current.staleSince) return current;
  const next: BackupReminderState = { ...current, staleSince: today };
  writeBackupReminderState(storage, next);
  return next;
}

export function markExported(storage: BackupReminderStorage, today: string): BackupReminderState {
  const current = readBackupReminderState(storage);
  const next: BackupReminderState = { ...current, lastExported: today };
  delete next.staleSince;
  writeBackupReminderState(storage, next);
  return next;
}

export function snoozeBackupReminder(storage: BackupReminderStorage, today: string): BackupReminderState {
  const next: BackupReminderState = {
    ...readBackupReminderState(storage),
    snoozedUntil: addBackupReminderDays(today, BACKUP_REMINDER_DAYS),
  };
  writeBackupReminderState(storage, next);
  return next;
}
