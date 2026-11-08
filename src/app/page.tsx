import Link from "next/link";
import { connection } from "next/server";
import { createConventionAction } from "./actions";
import { ConventionTitle } from "../components/convention-title";
import { Button } from "../components/ui/button";
import { interestBackground, listCons, parseConsSort, type ConsSortKey } from "../domain/cons";
import { countConventions } from "../domain/conventions";
import { todayInLosAngeles } from "../domain/status";
import { openDatabase } from "../db";

export const instant = false;

const sorts: { key: ConsSortKey; label: string }[] = [
  { key: "interest", label: "Interest" },
  { key: "distance", label: "Distance" },
  { key: "time", label: "Time of year" },
  { key: "name", label: "Name" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sort?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const sort = parseConsSort(params.sort);
  const db = openDatabase();
  const tiles = listCons(db, sort, todayInLosAngeles());
  const conventions = countConventions(db);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expos</h1>
          <p className="text-sm text-muted-foreground">
            List of all tracked expos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {sorts.map((item) => (
            <Link
              key={item.key}
              href={item.key === "interest" ? "/" : `/?sort=${item.key}`}
              className={
                item.key === sort
                  ? "rounded-md bg-foreground px-2 py-1 text-background"
                  : "rounded-md border px-2 py-1 hover:bg-muted"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {params.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{params.error}</p>
      ) : null}

      {conventions === 0 ? (
        <p className="text-muted-foreground">
          No conventions yet. Import the 摆摊 sheet, or add one here and give it an edition such as 2027.
        </p>
      ) : null}

      <form action={createConventionAction} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Convention" name="displayName" required placeholder="FanimeCon" />
        <Field label="Website" name="website" placeholder="https://" />
        <Field label="City" name="defaultCity" placeholder="San Jose" />
        <Field label="State" name="defaultRegion" placeholder="CA" />
        <Button type="submit">Add convention</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const detailHref = `/cons/${tile.conventionId}`;
          const summary = [
            tile.displayName,
            tile.eventDate ?? "no event date",
            tile.statusLabel ?? (tile.hasEditions ? "unknown status" : "no editions"),
            tile.locationLabel ?? "no city",
            `interest ${tile.interest}`,
          ].join(", ");
          return (
            <article
              key={tile.conventionId}
              className="flex flex-col gap-1 rounded-lg border p-3 hover:border-foreground/40"
              style={{ backgroundColor: interestBackground(tile.interest) }}
            >
              <ConventionTitle
                name={tile.displayName}
                website={tile.website}
                fallbackHref={detailHref}
              />
              <Link href={detailHref} aria-label={summary} className="grid gap-1">
                <span className="text-sm text-muted-foreground">{tile.eventDate ?? "No event date"}</span>
                <span className="text-sm">{tile.hasEditions ? tile.statusLabel ?? "Unknown" : "No editions"}</span>
                <span className="text-sm text-muted-foreground">{tile.locationLabel ?? "City unknown"}</span>
              </Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="h-9 rounded-md border border-input bg-background px-2"
      />
    </label>
  );
}
