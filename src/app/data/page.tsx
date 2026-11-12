"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useFruitMask } from "../../components/fruit-mask";
import { Button } from "../../components/ui/button";
import {
  applyDataFile,
  dataFileDownloadName,
  exportDataFile,
  listExportConventions,
  previewDataFile,
  type DataFile,
  type DataFilePreview,
} from "../../domain/dataFile";
import { useReadyWorkspace } from "../workspace-provider";

export default function DataPage() {
  const workspace = useReadyWorkspace();
  if (!workspace) return null;
  return <DataPageBody workspace={workspace} />;
}

function DataPageBody({
  workspace,
}: {
  workspace: NonNullable<ReturnType<typeof useReadyWorkspace>>;
}) {
  const { mask } = useFruitMask();
  const fileRef = useRef<HTMLInputElement>(null);
  const [includeApplicationStatus, setIncludeApplicationStatus] = useState(true);
  const [exportAll, setExportAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [replace, setReplace] = useState(false);
  const [importDocument, setImportDocument] = useState<DataFile | null>(null);
  const [source, setSource] = useState<"json" | "sqlite" | null>(null);
  const [preview, setPreview] = useState<DataFilePreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expos = useMemo(
    () => listExportConventions(workspace.db),
    [workspace.db, workspace.revision],
  );
  const expoCount = expos.length;
  const canExport = expoCount > 0 && (exportAll || selectedIds.size > 0);

  function downloadExport() {
    const conventionIds = exportAll ? undefined : [...selectedIds];
    const file = exportDataFile(workspace.db, { includeApplicationStatus, conventionIds });
    const body = `${JSON.stringify(file, null, 2)}\n`;
    const blob = new Blob([body], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = dataFileDownloadName();
    window.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("JSON downloaded.");
  }

  function recomputePreview(nextDocument: DataFile, nextReplace: boolean) {
    const next = previewDataFile(workspace.db, nextDocument, { replace: nextReplace });
    if (!next.ok) {
      setPreview(null);
      setImportError(next.error);
      return;
    }
    setImportError(null);
    setPreview(next.value);
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loaded = workspace.readImportBytes(bytes);
      if (!loaded.ok) {
        setImportDocument(null);
        setSource(null);
        setPreview(null);
        setImportError(loaded.error);
        return;
      }
      setImportDocument(loaded.value.document);
      setSource(loaded.value.source);
      recomputePreview(loaded.value.document, replace);
    } catch {
      setImportDocument(null);
      setSource(null);
      setPreview(null);
      setImportError("Could not read that file.");
    }
  }

  async function onCommit() {
    if (!importDocument) return;
    if (
      replace &&
      !window.confirm("Replace this workspace with the imported file? Expos that are not in the file will be deleted.")
    ) {
      return;
    }
    const result = applyDataFile(workspace.db, importDocument, { replace });
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    await workspace.persist();
    setImportDocument(null);
    setSource(null);
    setPreview(null);
    setImportError(null);
    setMessage(
      `Imported ${result.value.added} added, ${result.value.updated} updated, ${result.value.removed} removed.`,
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Data</h1>
      </header>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {expoCount > 0 ? (
        <section className="grid gap-4 rounded-lg border bg-card p-4">
          <h2 className="text-lg font-medium">Export</h2>
          <p className="text-sm text-muted-foreground">
            Download a JSON file of the expos in this browser. Use it as a backup, or share it with someone else.
          </p>
          <label className="grid gap-1 text-sm">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeApplicationStatus}
                onChange={(event) => setIncludeApplicationStatus(event.target.checked)}
              />
              Include application status
            </span>
            <span className="text-muted-foreground">
              Turn this off if you plan to share this file with someone else.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={exportAll}
              onChange={(event) => {
                setExportAll(event.target.checked);
                if (!event.target.checked) setSelectedIds(new Set());
              }}
            />
            Export all {expoCount} expos
          </label>
          {exportAll ? null : (
            <ul className="grid max-h-80 gap-2 overflow-auto rounded-md border p-3">
              {expos.map((expo) => (
                <li key={expo.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(expo.id)}
                      onChange={(event) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(expo.id);
                          else next.delete(expo.id);
                          return next;
                        });
                      }}
                    />
                    {mask(expo.name)}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button type="button" onClick={downloadExport} disabled={!canExport}>
              Download JSON
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Import</h2>
        <p className="text-sm text-muted-foreground">Load a JSON file from a local copy.</p>
        <div>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            Choose file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.sqlite,.db,application/json,application/octet-stream"
            className="hidden"
            onChange={(event) => void onPickFile(event)}
          />
        </div>
        {importError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{importError}</p>
        ) : null}
        {preview ? (
          <div className="grid gap-3">
            {source === "sqlite" ? (
              <p className="text-sm text-muted-foreground">This SQLite file includes application status.</p>
            ) : null}
            <p className="text-sm">
              {preview.added} added, {preview.updated} updated, {preview.removed} removed
            </p>
            {preview.warnings.length > 0 ? (
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(event) => {
                    const nextReplace = event.target.checked;
                    setReplace(nextReplace);
                    if (importDocument) recomputePreview(importDocument, nextReplace);
                  }}
                />
                Replace this workspace with the file
              </span>
              <span className="text-muted-foreground">Deletes expos that are not in the file.</span>
            </label>
            <div>
              <Button type="button" onClick={() => void onCommit()}>
                Commit import
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
