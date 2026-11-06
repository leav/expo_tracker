"use client";

import type { ChangeEvent, FocusEvent } from "react";
import { fillEditionDates } from "../domain/editionDates";

type DateDefaults = {
  applicationStartDate?: string;
  applicationEndDate?: string;
  resultDate?: string;
  startDate?: string;
  endDate?: string;
};

export function EditionDateFields({ defaults = {} }: { defaults?: DateDefaults }) {
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
      />
      <DateField label="Application end" name="applicationEndDate" defaultValue={defaults.applicationEndDate} />
      <DateField
        label="Event start"
        name="startDate"
        defaultValue={defaults.startDate}
        onChange={onStartCommit}
        onBlur={onStartCommit}
      />
      <DateField label="Event end" name="endDate" defaultValue={defaults.endDate} />
      <DateField label="Result" name="resultDate" defaultValue={defaults.resultDate} />
    </>
  );
}

function DateField({
  label,
  name,
  defaultValue,
  onChange,
  onBlur,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        name={name}
        type="date"
        defaultValue={defaultValue ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        className="h-9 rounded-md border border-input bg-background px-2"
      />
    </label>
  );
}
