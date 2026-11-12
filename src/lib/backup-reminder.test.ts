import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addBackupReminderDays,
  backupReminderCopy,
  BACKUP_REMINDER_DAYS,
  BACKUP_REMINDER_STORAGE_KEY,
  lastExportSentence,
  markExported,
  markModified,
  parseBackupReminderState,
  readBackupReminderState,
  shouldShowBackupReminder,
  snoozeBackupReminder,
} from "./backup-reminder";

function memoryStorage(initial?: string): { getItem(key: string): string | null; setItem(key: string, value: string): void } {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(BACKUP_REMINDER_STORAGE_KEY, initial);
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

const shown = {
  today: "2026-11-12",
  hasExpos: true,
  persistOk: true,
};

describe("backup reminder state", () => {
  it("parses stored dates and ignores junk", () => {
    assert.deepEqual(parseBackupReminderState(null), {});
    assert.deepEqual(parseBackupReminderState("nope"), {});
    assert.deepEqual(
      parseBackupReminderState(
        JSON.stringify({ staleSince: "2026-11-01", lastExported: "bad", snoozedUntil: "2026-11-10" }),
      ),
      { staleSince: "2026-11-01", snoozedUntil: "2026-11-10" },
    );
  });

  it("treats a legacy stale lastModified as staleSince", () => {
    assert.deepEqual(
      parseBackupReminderState(
        JSON.stringify({ lastModified: "2026-11-01", lastExported: "2026-10-20", stale: true }),
      ),
      { staleSince: "2026-11-01", lastExported: "2026-10-20" },
    );
    assert.deepEqual(
      parseBackupReminderState(JSON.stringify({ lastModified: "2026-11-01", lastExported: "2026-11-01", stale: false })),
      { lastExported: "2026-11-01" },
    );
  });

  it("adds calendar days across month ends", () => {
    assert.equal(addBackupReminderDays("2026-11-09", BACKUP_REMINDER_DAYS), "2026-11-12");
    assert.equal(addBackupReminderDays("2026-01-30", 3), "2026-02-02");
  });
});

describe("shouldShowBackupReminder", () => {
  const due = { ...shown, state: { staleSince: "2026-11-09" } };

  it("hides when there are no expos, persist failed, or staleSince is missing", () => {
    assert.equal(shouldShowBackupReminder({ ...due, hasExpos: false }), false);
    assert.equal(shouldShowBackupReminder({ ...due, persistOk: false }), false);
    assert.equal(shouldShowBackupReminder({ ...shown, state: {} }), false);
    assert.equal(shouldShowBackupReminder({ ...shown, state: { lastExported: "2026-11-01" } }), false);
  });

  it("hides until three days after staleSince", () => {
    assert.equal(
      shouldShowBackupReminder({ ...shown, today: "2026-11-11", state: { staleSince: "2026-11-09" } }),
      false,
    );
    assert.equal(shouldShowBackupReminder(due), true);
  });

  it("hides while snoozed and returns after snooze ends", () => {
    assert.equal(
      shouldShowBackupReminder({ ...due, state: { ...due.state, snoozedUntil: "2026-11-13" } }),
      false,
    );
    assert.equal(
      shouldShowBackupReminder({ ...due, today: "2026-11-13", state: { ...due.state, snoozedUntil: "2026-11-13" } }),
      true,
    );
  });
});

describe("backup reminder copy", () => {
  const prefix =
    "Your data lives only in this browser. Accidentally clearing this site's data will erase the workspace, so export a backup often.";

  it("names days since the last export", () => {
    assert.equal(lastExportSentence(undefined, "2026-11-12"), "You have not exported a backup yet.");
    assert.equal(lastExportSentence("2026-11-12", "2026-11-12"), "You last exported today.");
    assert.equal(lastExportSentence("2026-11-11", "2026-11-12"), "You last exported yesterday.");
    assert.equal(lastExportSentence("2026-11-07", "2026-11-12"), "You last exported 5 days ago.");
    assert.equal(
      backupReminderCopy({ lastExported: "2026-11-07" }, "2026-11-12"),
      `${prefix} You last exported 5 days ago.`,
    );
    assert.equal(backupReminderCopy({}, "2026-11-12"), `${prefix} You have not exported a backup yet.`);
  });
});

describe("backup reminder writes", () => {
  it("starts the clock on the first write after an export and does not reset it", () => {
    const storage = memoryStorage();
    assert.deepEqual(markExported(storage, "2026-11-09"), { lastExported: "2026-11-09" });
    assert.equal(shouldShowBackupReminder({ ...shown, today: "2026-11-12", state: readBackupReminderState(storage) }), false);

    assert.deepEqual(markModified(storage, "2026-11-09"), { lastExported: "2026-11-09", staleSince: "2026-11-09" });
    assert.deepEqual(markModified(storage, "2026-11-11"), { lastExported: "2026-11-09", staleSince: "2026-11-09" });
    assert.equal(
      shouldShowBackupReminder({ ...shown, today: "2026-11-11", state: readBackupReminderState(storage) }),
      false,
    );
    assert.equal(
      shouldShowBackupReminder({ ...shown, today: "2026-11-12", state: readBackupReminderState(storage) }),
      true,
    );
  });

  it("starts the clock on the first write when they have never exported", () => {
    const storage = memoryStorage();
    assert.equal(shouldShowBackupReminder({ ...shown, state: readBackupReminderState(storage) }), false);
    assert.deepEqual(markModified(storage, "2026-11-09"), { staleSince: "2026-11-09" });
    assert.equal(
      shouldShowBackupReminder({ ...shown, today: "2026-11-12", state: readBackupReminderState(storage) }),
      true,
    );
  });

  it("clears staleSince on export and snoozes independently", () => {
    const storage = memoryStorage();
    markModified(storage, "2026-11-09");
    assert.deepEqual(markExported(storage, "2026-11-12"), { lastExported: "2026-11-12" });
    markModified(storage, "2026-11-12");
    assert.deepEqual(snoozeBackupReminder(storage, "2026-11-12"), {
      lastExported: "2026-11-12",
      staleSince: "2026-11-12",
      snoozedUntil: "2026-11-15",
    });
    assert.equal(readBackupReminderState(storage).snoozedUntil, "2026-11-15");
  });
});
