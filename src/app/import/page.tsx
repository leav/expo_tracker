import {
  acceptAliasAction,
  acceptMergeAction,
  acceptUnresolvedAction,
  dismissProposalAction,
  importSheetAction,
} from "./actions";
import { Button } from "../../components/ui/button";
import { openDatabase } from "../../db";
import { listPendingProposals, type AliasPayload, type MergePayload, type UnresolvedPayload } from "../../import/apply";
import { isDecisionStatus, normalizeLegacyStatus } from "../../domain/status";
import { editionDatesFromInterpretation } from "../../import/parse";

export const instant = false;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const pending = listPendingProposals(openDatabase());
  const merges = pending.filter((item) => item.kind === "merge");
  const unresolved = pending.filter((item) => item.kind === "unresolved");
  const aliases = pending.filter((item) => item.kind === "alias");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
          <p className="text-sm text-muted-foreground">
            Review proposed series merges, aliases, and rows the sheet could not place.
          </p>
        </div>
        <form action={importSheetAction}>
          <Button type="submit">Import 摆摊 sheet</Button>
        </form>
      </header>

      {params.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{params.error}</p>
      ) : null}

      {pending.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing to review. Import the 摆摊 sheet, or everything from the last import already landed.
        </p>
      ) : null}

      {merges.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">Proposed series merges</h2>
          <p className="text-sm text-muted-foreground">
            These names already collapse under the edition identity rules. Confirming creates one series. It does not
            insert an alias.
          </p>
          {merges.map((item) => {
            const payload = item.payload as MergePayload;
            return (
              <article key={item.id} className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="font-medium">{payload.displayName}</h3>
                <ul className="grid gap-1 text-sm">
                  {payload.rows.map((row) => (
                    <li key={row.sheetRowKey}>
                      {row.rawName} → cycle {row.cycleLabel}, {row.sheetStatus}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <form action={acceptMergeAction}>
                    <input type="hidden" name="proposalId" value={item.id} />
                    <Button type="submit">Accept merge</Button>
                  </form>
                  <DismissButton proposalId={item.id} />
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {unresolved.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">Unresolved rows</h2>
          {unresolved.map((item) => {
            const { row } = item.payload as UnresolvedPayload;
            const dates = editionDatesFromInterpretation(row.dates);
            const status = normalizeLegacyStatus(row.status);
            const defaultField =
              row.reviewReason === "ended_window"
                ? "application_start"
                : status === "passed"
                  ? "ignore"
                  : status && isDecisionStatus(status)
                    ? "submitted_at"
                    : "application_start";
            return (
              <article key={item.id} className="grid gap-3 rounded-lg border bg-card p-4">
                <div>
                  <h3 className="font-medium">{row.rawName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {row.sheetStatus}
                    {row.reviewReason ? ` · ${row.reviewReason.replaceAll("_", " ")}` : ""}
                    {row.city ? ` · ${row.city}` : ""}
                  </p>
                </div>
                {row.notes ? <p className="text-sm">{row.notes}</p> : null}
                {row.links.length > 0 ? (
                  <ul className="grid gap-1 text-sm">
                    {row.links.map((link) => (
                      <li key={link.url}>
                        <span className="text-muted-foreground">{link.kind}</span> {link.url}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <form action={acceptUnresolvedAction} className="grid gap-3">
                  <input type="hidden" name="proposalId" value={item.id} />
                  <label className="grid gap-1 text-sm">
                    Use the sheet date as
                    <select name="dateField" defaultValue={defaultField} className="h-9 rounded-md border border-input bg-background px-2">
                      <option value="application_start">Application start</option>
                      <option value="submitted_at">Submitted date</option>
                      <option value="ignore">Ignore the date</option>
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Application start" name="applicationStartDate" type="date" defaultValue={dates.applicationStartDate ?? row.applyDate ?? ""} />
                    <Field label="Application end" name="applicationEndDate" type="date" defaultValue={dates.applicationEndDate ?? ""} />
                    <Field label="Submitted" name="submittedAt" type="date" defaultValue={dates.submittedAt ?? ""} />
                    <Field label="Result" name="resultDate" type="date" defaultValue={dates.resultDate ?? row.resultDate ?? ""} />
                    <Field label="Status" name="status" defaultValue={status ?? "unknown"} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">Accept row</Button>
                  </div>
                </form>
                <DismissButton proposalId={item.id} />
              </article>
            );
          })}
        </section>
      ) : null}

      {aliases.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">Proposed aliases</h2>
          {aliases.map((item) => {
            const payload = item.payload as AliasPayload;
            return (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <p className="text-sm">
                  <span className="font-medium">{payload.name}</span>
                  <span className="text-muted-foreground"> → {payload.conventionName}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={acceptAliasAction}>
                    <input type="hidden" name="proposalId" value={item.id} />
                    <Button type="submit">Add alias</Button>
                  </form>
                  <DismissButton proposalId={item.id} />
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

function DismissButton({ proposalId }: { proposalId: number }) {
  return (
    <form action={dismissProposalAction}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <Button type="submit" variant="outline">
        Dismiss
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="h-9 rounded-md border border-input bg-background px-2"
      />
    </label>
  );
}
