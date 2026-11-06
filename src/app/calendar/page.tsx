import Link from "next/link";
import { connection } from "next/server";
import {
  buildMonthCells,
  formatMonthLabel,
  formatYearLabel,
  isYearEntirelyBefore,
  listScheduleMarkers,
  markersForMonth,
  parseYear,
  shiftYear,
  yearMonths,
  type ScheduleKind,
  type ScheduleMarker,
} from "../../domain/schedule";
import { todayInLosAngeles } from "../../domain/status";
import { openDatabase } from "../../db";

export const instant = false;

const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"] as const;

function chipClass(kind: ScheduleKind): string {
  if (kind === "application_start") {
    return "border-amber-300 bg-amber-100 text-amber-950 hover:border-amber-500";
  }
  return "border-emerald-300 bg-emerald-100 text-emerald-950 hover:border-emerald-500";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const today = todayInLosAngeles();
  const year = parseYear(params.year, today);
  const markers = listScheduleMarkers(openDatabase(), today);
  const previousYear = shiftYear(year, -1);
  const nextYear = shiftYear(year, 1);
  const previousDisabled = isYearEntirelyBefore(previousYear, today);
  const yearHasMarkers = markers.some((marker) => marker.date.startsWith(`${year}-`));
  const anyMarkers = markers.length > 0;
  const months = yearMonths(year);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Future application opens and event starts for conventions with interest above zero.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {previousDisabled ? (
            <span className="rounded-md border px-3 py-1.5 text-muted-foreground">Previous</span>
          ) : (
            <Link className="rounded-md border px-3 py-1.5 hover:border-foreground/40" href={`/calendar?year=${previousYear}`}>
              Previous
            </Link>
          )}
          <span className="min-w-[4rem] text-center font-medium">{formatYearLabel(year)}</span>
          <Link className="rounded-md border px-3 py-1.5 hover:border-foreground/40" href={`/calendar?year=${nextYear}`}>
            Next
          </Link>
        </div>
      </header>

      {!anyMarkers ? (
        <p className="text-muted-foreground">
          No future dates for interested conventions. Raise interest on Cons or add application and event dates.
        </p>
      ) : null}

      {anyMarkers && !yearHasMarkers ? (
        <p className="text-sm text-muted-foreground">No markers in this year. Use Next to find upcoming dates.</p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((yearMonth) => (
          <MonthCard key={yearMonth} yearMonth={yearMonth} markers={markers} today={today} />
        ))}
      </div>
    </main>
  );
}

function MonthCard({
  yearMonth,
  markers,
  today,
}: {
  yearMonth: string;
  markers: ScheduleMarker[];
  today: string;
}) {
  const byDay = markersForMonth(markers, yearMonth);
  const cells = buildMonthCells(yearMonth);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{formatMonthLabel(yearMonth)}</h2>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-[10px]">
        {weekdayLabels.map((label, index) => (
          <div key={`${label}-${index}`} className="bg-muted px-0.5 py-1 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.date) {
            return <div key={`empty-${yearMonth}-${index}`} className="min-h-14 bg-muted/40" />;
          }
          const dayMarkers = byDay.get(cell.date) ?? [];
          const isPast = cell.date < today;
          const isToday = cell.date === today;
          return (
            <div
              key={cell.date}
              className={`flex min-h-14 flex-col gap-0.5 bg-card p-0.5 ${isPast ? "opacity-55" : ""} ${
                isToday ? "ring-1 ring-inset ring-foreground/30" : ""
              }`}
            >
              <span className={`leading-none ${isToday ? "font-semibold" : "text-muted-foreground"}`}>{cell.day}</span>
              <div className="flex flex-col gap-0.5">
                {dayMarkers.map((marker) => (
                  <Link
                    key={`${marker.editionId}-${marker.kind}`}
                    href={`/cons/${marker.conventionId}`}
                    className={`rounded border px-0.5 py-0.5 leading-snug ${chipClass(marker.kind)}`}
                    title={`${marker.conventionName} ${marker.cycleLabel} · ${marker.kindLabel}`}
                  >
                    <span className="block truncate font-medium">
                      {marker.conventionName} {marker.cycleLabel}
                    </span>
                    <span className="block truncate">{marker.kindLabel}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
