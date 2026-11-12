"use client";

import { useCallback, useEffect, useState } from "react";
import { useReadyWorkspace } from "../app/workspace-provider";
import { countConventions } from "../domain/conventions";
import { exportDataFile } from "../domain/dataFile";
import { todayInLosAngeles } from "../domain/status";
import {
  backupReminderCopy,
  browserBackupStorage,
  markExported,
  readBackupReminderState,
  shouldShowBackupReminder,
  snoozeBackupReminder,
  type BackupReminderState,
} from "../lib/backup-reminder";
import { downloadDataFile } from "../lib/data-file-download";
import { Button } from "./ui/button";

export function BackupReminder() {
  const workspace = useReadyWorkspace();
  const today = todayInLosAngeles();
  const [state, setState] = useState<BackupReminderState>({});
  const hasExpos = workspace ? countConventions(workspace.db) > 0 : false;
  const revision = workspace?.revision ?? 0;

  useEffect(() => {
    const storage = browserBackupStorage();
    if (!storage) return;
    setState(readBackupReminderState(storage));
  }, [revision]);

  const onExport = useCallback(() => {
    const storage = browserBackupStorage();
    if (!workspace || !storage) return;
    downloadDataFile(exportDataFile(workspace.db));
    setState(markExported(storage, today));
  }, [today, workspace]);

  const onDismiss = useCallback(() => {
    const storage = browserBackupStorage();
    if (!storage) return;
    setState(snoozeBackupReminder(storage, today));
  }, [today]);

  if (
    !workspace ||
    !shouldShowBackupReminder({
      today,
      hasExpos,
      persistOk: workspace.persistOk,
      state,
    })
  ) {
    return null;
  }

  return (
    <div className="border-b bg-muted/40 px-4 py-2 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{backupReminderCopy(state, today)}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onExport}>
            Export JSON
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
