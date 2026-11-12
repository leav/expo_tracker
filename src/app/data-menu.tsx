"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { cleanMockData } from "../domain/mock";
import { Button } from "../components/ui/button";
import { useReadyWorkspace } from "./workspace-provider";

export function DataMenu() {
  const workspace = useReadyWorkspace();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!workspace) return null;

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  function downloadBackup() {
    const bytes = workspace!.exportBytes();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: "application/vnd.sqlite3" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "expo-tracker-backup.sqlite";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("Backup downloaded.");
    closeMenu();
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("Replace this workspace with the imported file? Current data will be overwritten.")) {
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await workspace!.replaceWorkspace(bytes);
      setMessage("Backup imported.");
      closeMenu();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not import that file.");
    }
  }

  async function onRemoveMocks() {
    if (!window.confirm("Remove mock conventions and editions from this workspace?")) return;
    const summary = cleanMockData(workspace!.db);
    await workspace!.persist();
    const removed = summary.deletedConventions.length + summary.deletedEditions.length;
    setMessage(removed === 0 ? "No mock rows to remove." : `Removed ${removed} mock rows.`);
    closeMenu();
  }

  return (
    <details ref={detailsRef} className="relative z-50">
      <summary className="cursor-pointer text-sm underline-offset-4 hover:underline">Data</summary>
      <div className="absolute right-0 z-50 mt-2 grid w-56 gap-2 rounded-md border bg-background p-3 shadow-md">
        <Button type="button" variant="outline" size="sm" onClick={downloadBackup}>
          Export backup
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Import backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".sqlite,.db,application/octet-stream"
          className="hidden"
          onChange={(event) => void onImport(event)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void onRemoveMocks()}>
          Remove mock rows
        </Button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </details>
  );
}
