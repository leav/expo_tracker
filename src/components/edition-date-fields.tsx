"use client";

import { ExternalLink } from "lucide-react";
import type { ChangeEvent, FocusEvent } from "react";
import { fillEditionDates } from "../domain/editionDates";

type DateDefaults = {
  applicationStartDate?: string;
  applicationEndDate?: string;
  resultDate?: string;
  startDate?: string;
  endDate?: string;
};

export type CalendarHrefs = {
  icsHref: string;
  googleHref: string;
};

export function EditionDateFields({
  defaults = {},
  calendar,
  fieldIdPrefix,
}: {
  defaults?: DateDefaults;
  calendar?: {
    applicationStart?: CalendarHrefs;
    eventStart?: CalendarHrefs;
  };
  fieldIdPrefix?: string;
}) {
  function blankToNull(value: string) {
    return value.trim() === "" ? null : value;
  }

  function applyFill(form: HTMLFormElement | null) {
    if (!form) return;
    const applicationStart = form.elements.namedItem("applicationStartDate");
    const applicationEnd = form.elements.namedItem("applicationEndDate");
    const result = form.elements.namedItem("resultDate");
    const eventStart = form.elements.namedItem("startDate");
    const eventEnd = form.elements.namedItem("endDate");
    if (
      !(applicationStart instanceof HTMLInputElement) ||
      !(applicationEnd instanceof HTMLInputElement) ||
      !(result instanceof HTMLInputElement) ||
      !(eventStart instanceof HTMLInputElement) ||
      !(eventEnd instanceof HTMLInputElement)
    ) {
      return;
    }

    const filled = fillEditionDates({
      applicationStartDate: blankToNull(applicationStart.value),
      applicationEndDate: blankToNull(applicationEnd.value),
      resultDate: blankToNull(result.value),
      startDate: blankToNull(eventStart.value),
      endDate: blankToNull(eventEnd.value),
    });

    applicationEnd.value = filled.applicationEndDate ?? "";
    result.value = filled.resultDate ?? "";
    eventEnd.value = filled.endDate ?? "";
  }

  function onStartCommit(event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) {
    applyFill(event.currentTarget.form);
  }

  return (
    <>
      <DateField
        label="Application start"
        name="applicationStartDate"
        defaultValue={defaults.applicationStartDate}
        onChange={onStartCommit}
        onBlur={onStartCommit}
        calendar={calendar?.applicationStart}
        fieldIdPrefix={fieldIdPrefix}
      />
      <DateField label="Application end" name="applicationEndDate" defaultValue={defaults.applicationEndDate} fieldIdPrefix={fieldIdPrefix} />
      <DateField
        label="Event start"
        name="startDate"
        defaultValue={defaults.startDate}
        onChange={onStartCommit}
        onBlur={onStartCommit}
        calendar={calendar?.eventStart}
        fieldIdPrefix={fieldIdPrefix}
      />
      <DateField label="Event end" name="endDate" defaultValue={defaults.endDate} fieldIdPrefix={fieldIdPrefix} />
      <DateField label="Result" name="resultDate" defaultValue={defaults.resultDate} fieldIdPrefix={fieldIdPrefix} />
    </>
  );
}

function DateField({
  label,
  name,
  defaultValue,
  onChange,
  onBlur,
  calendar,
  fieldIdPrefix,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  calendar?: CalendarHrefs;
  fieldIdPrefix?: string;
}) {
  const inputId = fieldIdPrefix ? `${fieldIdPrefix}-${name}` : name;
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <label htmlFor={inputId}>{label}</label>
        {calendar ? (
          <>
            <a href={calendar.icsHref} className="text-xs underline underline-offset-2">
              Download .ics
            </a>
            <a
              href={calendar.googleHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs underline underline-offset-2 hover:text-foreground"
            >
              Google Calendar
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">(opens Google Calendar)</span>
            </a>
          </>
        ) : null}
      </div>
      <input
        id={inputId}
        name={name}
        type="date"
        defaultValue={defaultValue ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        className="h-9 rounded-md border border-input bg-background px-2"
      />
    </div>
  );
}
