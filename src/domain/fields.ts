export function blankToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseDate(value: string | null, label: string): string | null | { error: string } {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `${label} must be a date.` };
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: `${label} must be a real date.` };
  }
  return value;
}

export function parseAttendance(value: string | null): number | null | { error: string } {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return { error: "Attendance must be a whole number." };
  return Number(value);
}

export function parseSignedInteger(value: string | null, label: string): number | { error: string } {
  if (value === null) return 0;
  if (!/^-?\d+$/.test(value)) return { error: `${label} must be a whole number.` };
  return Number(value);
}

export function parseOptionalMinutes(value: string | null, label: string): number | null | { error: string } {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return { error: `${label} must be a whole number of minutes.` };
  return Number(value);
}

export function parsePositiveInteger(value: string | null, label: string): number | { error: string } {
  if (value === null) return { error: `${label} is required.` };
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    return { error: `${label} must be a whole number of at least 1.` };
  }
  return Number(value);
}

export function isError<T>(value: T | { error: string }): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}
