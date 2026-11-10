import Link from "next/link";
import { connection } from "next/server";
import {
  buildMonthCells,
  canShiftYear,
  formatMonthLabel,
  formatYearLabel,
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

function navButtonClass(disabled: boolean): string {
  if (disabled) return "rounded-md border px-3 py-1.5 text-muted-foreground";
  return "rounded-md border px-3 py-1.5 hover:border-foreground/40";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const today = todayInLosAngeles();
  const currentYear = today.slice(0, 4);
  const currentYearMonth = today.slice(0, 7);
  const year = parseYear(params.year, today);
  const markers = listScheduleMarkers(openDatabase());
  const previousYear = shiftYear(year, -1);
  const nextYear = shiftYear(year, 1);
  const previousDisabled = !canShiftYear(markers, year, -1);
  const nextDisabled = !canShiftYear(markers, year, 1);
  const yearHasMarkers = markers.some((marker) => marker.date.startsWith(`${year}-`));
  const anyMarkers = markers.length > 0;
  const isCurrentYear = year === currentYear;
  const months = yearMonths(year);

  let emptyYearHint = "No markers in this year.";
  if (previousDisabled && nextDisabled) {
    emptyYearHint = "No markers in this year.";
  } else if (!previousDisabled && !nextDisabled) {
    emptyYearHint = "No markers in this year. Use Previous or Next to find dates.";
  } else if (!previousDisabled) {
    emptyYearHint = "No markers in this year. Use Previous to find earlier dates.";
  } else {
    emptyYearHint = "No markers in this year. Use Next to find upcoming dates.";
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Application opens and event starts for conventions with interest above zero.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {previousDisabled ? (
            <span className={navButtonClass(true)}>Previous</span>
          ) : (
            <Link className={navButtonClass(false)} href={`/calendar?year=${previousYear}`}>
              Previous
            </Link>
          )}
          <span
            className={`min-w-[4rem] rounded-md px-2 py-1 text-center ${
              isCurrentYear
                ? "bg-foreground font-semibold text-background"
                : "font-medium text-foreground"
            }`}
          >
            {formatYearLabel(year)}
          </span>
          {nextDisabled ? (
            <span className={navButtonClass(true)}>Next</span>
          ) : (
            <Link className={navButtonClass(false)} href={`/calendar?year=${nextYear}`}>
              Next
            </Link>
          )}
          <Link
            className={navButtonClass(false)}
            href={`/calendar?year=${currentYear}#month-${currentYearMonth}`}
          >
            Today
          </Link>
        </div>
      </header>

      {!anyMarkers ? (
        <p className="text-muted-foreground">
          No dates for interested conventions. Raise interest on Expos or add application and event dates.
        </p>
      ) : null}

      {anyMarkers && !yearHasMarkers ? (
        <p className="text-sm text-muted-foreground">{emptyYearHint}</p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((yearMonth) => (
          <MonthCard
            key={yearMonth}
            yearMonth={yearMonth}
            markers={markers}
            today={today}
            isCurrentMonth={yearMonth === currentYearMonth}
          />
        ))}
      </div>
    </main>
  );
}

function MonthCard({
  yearMonth,
  markers,
  today,
  isCurrentMonth,
}: {
  yearMonth: string;
  markers: ScheduleMarker[];
  today: string;
  isCurrentMonth: boolean;
}) {
  const byDay = markersForMonth(markers, yearMonth);
  const cells = buildMonthCells(yearMonth);

  return (
    <section id={`month-${yearMonth}`} className="flex scroll-mt-6 flex-col gap-2">
      <h2 className={`text-sm ${isCurrentMonth ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
        {formatMonthLabel(yearMonth)}
        {isCurrentMonth ? <span className="ml-2 text-xs font-medium text-foreground">Today</span> : null}
      </h2>
      <div
        className={`grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-[10px] ${
          isCurrentMonth ? "border-foreground ring-2 ring-foreground/25" : ""
        }`}
      >
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
              className={`flex min-h-14 flex-col gap-0.5 bg-card p-0.5 ${isPast && !isToday ? "opacity-55" : ""} ${
                isToday ? "ring-2 ring-inset ring-foreground" : ""
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center leading-none ${
                  isToday
                    ? "rounded-full bg-foreground text-[9px] font-semibold text-background"
                    : "text-muted-foreground"
                }`}
              >
                {cell.day}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayMarkers.map((marker) => {
                  const title = `${marker.conventionName} ${marker.cycleLabel} · ${marker.kindLabel}`;
                  return (
                    <Link
                      key={`${marker.editionId}-${marker.kind}`}
                      href={`/cons/${marker.conventionId}`}
                      className={`block overflow-hidden rounded border px-0.5 py-0.5 leading-snug ${chipClass(marker.kind)}`}
                      title={title}
                    >
                      <span className="block truncate font-medium">
                        {marker.conventionName} {marker.cycleLabel}
                      </span>
                      <span className="block truncate">{marker.kindLabel}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
