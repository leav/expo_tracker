import { notFound } from "next/navigation";
import {
  addAliasAction,
  createEditionAction,
  deleteConventionAction,
  deleteEditionAction,
  markPassedAction,
  removeAliasAction,
  updateConventionAction,
  updateEditionAction,
} from "../../actions";
import { ConfirmForm } from "../../../components/confirm-form";
import { Button } from "../../../components/ui/button";
import { getSeries } from "../../../domain/editions";
import { isPaidStatus, isStatus, statusLabels, statuses } from "../../../domain/status";
import { openDatabase } from "../../../db";
import type { editions } from "../../../db/schema";

export const instant = false;

export default async function ConsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const conventionId = Number(id);
  if (!Number.isInteger(conventionId)) notFound();
  const series = getSeries(openDatabase(), conventionId);
  if (!series) notFound();
  const returnTo = `/cons/${series.convention.id}`;
  const convention = series.convention;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{convention.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          Interest {series.interest} from manual {convention.manualInterest} plus attended editions. Defaults copy into
          new editions.
        </p>
      </header>
      {query.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{query.error}</p>
      ) : null}

      <form action={updateConventionAction} className="grid gap-3 rounded-lg border bg-card p-4">
        <input type="hidden" name="conventionId" value={convention.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" name="displayName" defaultValue={convention.displayName} required />
          <Field label="Website" name="website" defaultValue={convention.website ?? ""} />
          <Field label="Default city" name="defaultCity" defaultValue={convention.defaultCity ?? ""} />
          <Field label="Default state" name="defaultRegion" defaultValue={convention.defaultRegion ?? ""} />
          <Field
            label="Estimated attendance"
            name="estimatedAttendance"
            defaultValue={convention.estimatedAttendance?.toString() ?? ""}
          />
          <Field label="Manual interest" name="manualInterest" defaultValue={convention.manualInterest.toString()} />
          <Field
            label="Manual drive minutes"
            name="driveMinutes"
            defaultValue={convention.driveSource === "manual" ? (convention.driveMinutes?.toString() ?? "") : ""}
            placeholder={
              convention.driveSource === "seed" && convention.driveMinutes != null
                ? `Seeded ${convention.driveMinutes}`
                : "City estimate"
            }
          />
        </div>
        <label className="grid gap-1 text-sm">
          Notes
          <textarea
            name="notes"
            defaultValue={convention.notes ?? ""}
            rows={3}
            className="rounded-md border border-input bg-background px-2 py-1"
          />
        </label>
        <Button type="submit" className="w-fit">Save convention</Button>
      </form>
      <ConfirmForm
        action={deleteConventionAction}
        message="Delete this convention and all of its editions?"
        className="w-fit"
      >
        <input type="hidden" name="conventionId" value={convention.id} />
        <Button
          type="submit"
          variant="destructive"
          className="bg-destructive text-white hover:bg-destructive/90"
        >
          Delete convention
        </Button>
      </ConfirmForm>

      <section className="grid gap-3">
        <h2 className="text-lg font-medium">Aliases</h2>
        {series.aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No aliases. Add a name that does not already match this convention.</p>
        ) : (
          <ul className="grid gap-2">
            {series.aliases.map((alias) => (
              <li key={alias.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{alias.name}</span>
                <form action={removeAliasAction}>
                  <input type="hidden" name="conventionId" value={convention.id} />
                  <input type="hidden" name="aliasId" value={alias.id} />
                  <Button type="submit" variant="outline" size="sm">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addAliasAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="conventionId" value={convention.id} />
          <Field label="Alias" name="name" required placeholder="ALA" />
          <Button type="submit" variant="outline">Add alias</Button>
        </form>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-medium">Editions</h2>
        {series.editions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No editions yet. Add the first cycle below. Location defaults copy in.</p>
        ) : null}
        {series.editions.map((edition) => (
          <EditionForm key={edition.id} edition={edition} returnTo={returnTo} />
        ))}
        <form action={createEditionAction} className="grid gap-3 rounded-lg border border-dashed p-4">
          <h3 className="font-medium">Add edition</h3>
          <input type="hidden" name="conventionId" value={convention.id} />
          <input type="hidden" name="status" value="unknown" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cycle" name="cycleLabel" required placeholder="2027" />
            <Field label="Application start" name="applicationStartDate" type="date" />
            <Field label="Application end" name="applicationEndDate" type="date" />
            <Field label="Event start" name="startDate" type="date" />
            <Field label="Event end" name="endDate" type="date" />
          </div>
          <Button type="submit" className="w-fit">Add edition</Button>
        </form>
      </section>
    </main>
  );
}

function EditionForm({
  edition,
  returnTo,
}: {
  edition: typeof editions.$inferSelect;
  returnTo: string;
}) {
  const status = isStatus(edition.status) ? edition.status : "unknown";
  const showPaid = isPaidStatus(status);
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <form action={updateEditionAction} className="grid gap-3">
        <input type="hidden" name="conventionId" value={edition.conventionId} />
        <input type="hidden" name="editionId" value={edition.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cycle" name="cycleLabel" defaultValue={edition.cycleLabel} required />
          <SelectField label="Status" name="status" value={status} />
          <Field label="Application start" name="applicationStartDate" type="date" defaultValue={edition.applicationStartDate ?? ""} />
          <Field label="Application end" name="applicationEndDate" type="date" defaultValue={edition.applicationEndDate ?? ""} />
          <Field label="Event start" name="startDate" type="date" defaultValue={edition.startDate ?? ""} />
          <Field label="Event end" name="endDate" type="date" defaultValue={edition.endDate ?? ""} />
          <Field label="Submitted" name="submittedAt" type="date" defaultValue={edition.submittedAt ?? ""} />
          <Field label="Result" name="resultDate" type="date" defaultValue={edition.resultDate ?? ""} />
          <Field label="City" name="city" defaultValue={edition.city ?? ""} />
          <Field label="State" name="region" defaultValue={edition.region ?? ""} />
        </div>
        <label className="grid gap-1 text-sm">
          Notes
          <textarea
            name="notes"
            defaultValue={edition.notes ?? ""}
            rows={3}
            className="rounded-md border border-input bg-background px-2 py-1"
          />
        </label>
        {showPaid ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paid" defaultChecked={edition.paid} />
            Paid
          </label>
        ) : null}
        <Button type="submit" className="w-fit">Save edition</Button>
      </form>
      {status === "passed" ? (
        <p className="text-sm text-muted-foreground">This edition is passed.</p>
      ) : (
        <form action={markPassedAction}>
          <input type="hidden" name="editionId" value={edition.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" variant="outline">Skip</Button>
        </form>
      )}
      <ConfirmForm
        action={deleteEditionAction}
        message="Delete this edition?"
        className="w-fit"
      >
        <input type="hidden" name="conventionId" value={edition.conventionId} />
        <input type="hidden" name="editionId" value={edition.id} />
        <Button
          type="submit"
          variant="destructive"
          className="bg-destructive text-white hover:bg-destructive/90"
        >
          Delete edition
        </Button>
      </ConfirmForm>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="h-9 rounded-md border border-input bg-background px-2"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select name={name} defaultValue={value} className="h-9 rounded-md border border-input bg-background px-2">
        {statuses.map((option) => (
          <option key={option} value={option}>{statusLabels[option]}</option>
        ))}
      </select>
    </label>
  );
}
