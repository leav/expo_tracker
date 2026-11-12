import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import {
  addAliasAction,
  createEditionAction,
  deleteConventionAction,
  deleteEditionAction,
  removeAliasAction,
  updateConventionAction,
  updateEditionAction,
} from "../../actions";
import { ConfirmForm } from "../../../components/confirm-form";
import { ConventionTitle } from "../../../components/convention-title";
import { EditionDateFields, type CalendarHrefs } from "../../../components/edition-date-fields";
import { InterestGauge } from "../../../components/interest-gauge";
import { Button } from "../../../components/ui/button";
import { calendarEventTitle, type ReminderKind } from "../../../domain/calendarEvent";
import { getSeries } from "../../../domain/editions";
import { hrefForGoogleCalendarTemplate } from "../../../domain/ics";
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
  const db = openDatabase();
  const series = getSeries(db, conventionId);
  if (!series) notFound();
  const convention = series.convention;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="grid gap-2">
        <ConventionTitle as="h1" name={convention.displayName} website={convention.website} />
        <InterestGauge gauge={series.gauge} showSummary />
        <label className="flex flex-wrap items-center gap-2 text-sm">
          My interest
          <input
            form={`save-convention-${convention.id}`}
            name="manualInterest"
            type="text"
            inputMode="numeric"
            defaultValue={convention.manualInterest.toString()}
            aria-label="My interest"
            className="h-9 w-16 rounded-md border border-input bg-background px-2 text-center"
          />
        </label>
      </header>
      {query.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{query.error}</p>
      ) : null}

      <div className="grid gap-3 rounded-lg border bg-card p-4">
        <form
          id={`save-convention-${convention.id}`}
          action={updateConventionAction}
          className="grid gap-3"
        >
          <input type="hidden" name="conventionId" value={convention.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" name="displayName" defaultValue={convention.displayName} required />
            <Field label="Website" name="website" defaultValue={convention.website ?? ""} />
            <Field label="City" name="defaultCity" defaultValue={convention.defaultCity ?? ""} />
            <Field label="State" name="defaultRegion" defaultValue={convention.defaultRegion ?? ""} />
            <Field
              label="Estimated attendance"
              name="estimatedAttendance"
              defaultValue={convention.estimatedAttendance?.toString() ?? ""}
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
        </form>
        <div className="flex items-center justify-between">
          <Button type="submit" form={`save-convention-${convention.id}`}>
            Save convention
          </Button>
          <ConfirmForm
            action={deleteConventionAction}
            message="Delete this convention and all of its editions?"
          >
            <input type="hidden" name="conventionId" value={convention.id} />
            <Button
              type="submit"
              size="icon"
              variant="destructive"
              aria-label="Delete convention"
            >
              <Trash2 />
            </Button>
          </ConfirmForm>
        </div>
      </div>

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
          <p className="text-sm text-muted-foreground">No editions yet. Add the first cycle below.</p>
        ) : null}
        {series.editions.map((edition) => (
          <EditionForm key={edition.id} edition={edition} conventionName={convention.displayName} />
        ))}
        <form action={createEditionAction} className="grid gap-3 rounded-lg border border-dashed p-4">
          <h3 className="font-medium">Add edition</h3>
          <input type="hidden" name="conventionId" value={convention.id} />
          <input type="hidden" name="status" value="unknown" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cycle" name="cycleLabel" required placeholder="2027" />
            <EditionDateFields />
          </div>
          <Button type="submit" className="w-fit">Add edition</Button>
        </form>
      </section>
    </main>
  );
}

function EditionForm({
  edition,
  conventionName,
}: {
  edition: typeof editions.$inferSelect;
  conventionName: string;
}) {
  const status = isStatus(edition.status) ? edition.status : "unknown";
  const showPaid = isPaidStatus(status);
  const saveFormId = `save-edition-${edition.id}`;
  return (
    <div id={`edition-${edition.id}`} className="grid scroll-mt-6 gap-3 rounded-lg border bg-card p-4">
      <form id={saveFormId} action={updateEditionAction} className="grid gap-3">
        <input type="hidden" name="conventionId" value={edition.conventionId} />
        <input type="hidden" name="editionId" value={edition.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cycle" name="cycleLabel" defaultValue={edition.cycleLabel} required />
          <SelectField label="Status" name="status" value={status} />
          <EditionDateFields
            fieldIdPrefix={`edition-${edition.id}`}
            defaults={{
              applicationStartDate: edition.applicationStartDate ?? "",
              applicationEndDate: edition.applicationEndDate ?? "",
              resultDate: edition.resultDate ?? "",
              startDate: edition.startDate ?? "",
              endDate: edition.endDate ?? "",
            }}
            calendar={{
              applicationStart: calendarLinksForDate(
                edition.id,
                "application_start",
                edition.applicationStartDate,
                conventionName,
                edition.cycleLabel,
              ),
              eventStart: calendarLinksForDate(
                edition.id,
                "start",
                edition.startDate,
                conventionName,
                edition.cycleLabel,
              ),
            }}
          />
          <Field label="Submitted" name="submittedAt" type="date" defaultValue={edition.submittedAt ?? ""} />
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
      </form>
      <div className="flex items-center justify-between">
        <Button type="submit" form={saveFormId}>
          Save edition
        </Button>
        <ConfirmForm action={deleteEditionAction} message="Delete this edition?">
          <input type="hidden" name="conventionId" value={edition.conventionId} />
          <input type="hidden" name="editionId" value={edition.id} />
          <Button
            type="submit"
            size="icon"
            variant="destructive"
            aria-label="Delete edition"
          >
            <Trash2 />
          </Button>
        </ConfirmForm>
      </div>
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

function calendarLinksForDate(
  editionId: number,
  kind: ReminderKind,
  date: string | null,
  conventionName: string,
  cycleLabel: string,
): CalendarHrefs | undefined {
  const googleHref = hrefForGoogleCalendarTemplate({
    title: calendarEventTitle(kind, conventionName, cycleLabel),
    date,
  });
  if (!googleHref) return undefined;
  return {
    icsHref: `/api/ics/${editionId}?kind=${kind}`,
    googleHref,
  };
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
