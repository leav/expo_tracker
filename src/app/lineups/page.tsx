import Link from "next/link";
import { listLineups } from "../../domain/lineups";
import { openDatabase } from "../../db";

export const instant = false;

export default async function LineupsPage() {
  const { dated, needsDates } = listLineups(openDatabase());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Lineups</h1>
        <p className="text-sm text-muted-foreground">
          Active editions ordered by the next date that might need action.
        </p>
      </header>

      {dated.length === 0 && needsDates.length === 0 ? (
        <p className="text-muted-foreground">No active editions. Add a convention or import the sheet.</p>
      ) : null}

      {dated.length > 0 ? (
        <section className="grid gap-2">
          {dated.map((item) => (
            <LineupRow key={item.editionId} item={item} />
          ))}
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Needs dates</h2>
        {needsDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every active edition has an action date.</p>
        ) : (
          needsDates.map((item) => <LineupRow key={item.editionId} item={item} />)
        )}
      </section>
    </main>
  );
}

function LineupRow({
  item,
}: {
  item: {
    editionId: number;
    conventionId: number;
    conventionName: string;
    cycleLabel: string;
    statusLabel: string;
    actionDate: string | null;
    city: string | null;
  };
}) {
  return (
    <Link
      href={`/cons/${item.conventionId}`}
      className="grid gap-1 rounded-lg border bg-card p-3 hover:border-foreground/40"
    >
      <span className="font-medium">
        {item.conventionName} {item.cycleLabel}
      </span>
      <span className="text-sm text-muted-foreground">
        {item.statusLabel}
        {item.actionDate ? ` · ${item.actionDate}` : ""}
        {item.city ? ` · ${item.city}` : ""}
      </span>
    </Link>
  );
}
