"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ConventionTitle } from "../components/convention-title";
import { InterestGauge } from "../components/interest-gauge";
import { Button } from "../components/ui/button";
import { listCons, parseConsSort, type ConsSortKey } from "../domain/cons";
import { countConventions } from "../domain/conventions";
import { todayInLosAngeles } from "../domain/status";
import { consPath } from "../lib/routes";
import { submitCreateConvention } from "./mutations";
import { useReadyWorkspace } from "./workspace-provider";

const sorts: { key: ConsSortKey; label: string; title: string }[] = [
  { key: "name", label: "Name", title: "Sort by names" },
  { key: "interest", label: "Interest", title: "Sort by interest gauge (attended counts as two)" },
  { key: "time", label: "Time of year", title: "Sort by time of year" },
  { key: "state", label: "State", title: "Sort by state names" },
];

export default function Home() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  );
}

function HomePage() {
  const workspace = useReadyWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!workspace) return null;

  const sort = parseConsSort(params.get("sort") ?? undefined);
  const tiles = listCons(workspace.db, sort, todayInLosAngeles());
  const conventions = countConventions(workspace.db);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = submitCreateConvention(workspace!.db, new FormData(form));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    form.reset();
    await workspace!.persist();
    router.push(consPath(result.value.id));
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expos</h1>
          <p className="text-sm text-muted-foreground">List of all tracked expos.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {sorts.map((item) => (
            <Link
              key={item.key}
              href={item.key === "name" ? "/" : `/?sort=${item.key}`}
              title={item.title}
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

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p>
      ) : null}

      {conventions === 0 ? (
        <p className="text-muted-foreground">
          No expos yet. Add one here and give it an edition such as 2027. This app saves on this device only — use
          Data to export a backup.
        </p>
      ) : null}

      <form
        onSubmit={(event) => void onCreate(event)}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end"
      >
        <Field label="Expo" name="displayName" required placeholder="FanimeCon" />
        <Field label="Website" name="website" placeholder="https://" />
        <Field label="City" name="defaultCity" placeholder="San Jose" />
        <Field label="State" name="defaultRegion" placeholder="CA" />
        <Button type="submit">Add expo</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const detailHref = consPath(tile.conventionId);
          const summary = [
            tile.displayName,
            tile.eventDate ?? "no event date",
            tile.statusLabel ?? (tile.hasEditions ? "unknown status" : "no editions"),
            tile.locationLabel ?? "no city",
            tile.gauge.summary || "no gauge",
          ].join(", ");
          return (
            <article
              key={tile.conventionId}
              className="flex flex-col gap-1 rounded-lg border bg-card p-3 hover:border-foreground/40"
            >
              <ConventionTitle
                name={tile.displayName}
                website={tile.website}
                fallbackHref={detailHref}
              />
              <Link href={detailHref} aria-label={summary} className="grid gap-1">
                <InterestGauge gauge={tile.gauge} />
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
