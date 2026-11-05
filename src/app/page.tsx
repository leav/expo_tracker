import Link from "next/link";
import { createConventionAction, markPassedAction, setPaidAction } from "./actions";
import { Button } from "../components/ui/button";
import { countConventions } from "../domain/conventions";
import { listBoard } from "../domain/editions";
import { openDatabase } from "../db";

export const instant = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; withdrawn?: string }>;
}) {
  const params = await searchParams;
  const db = openDatabase();
  const board = listBoard(db);
  const conventions = countConventions(db);
  const showWithdrawn = params.withdrawn === "1";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Artist-alley tracker</h1>
          <p className="text-sm text-muted-foreground">Editions grouped by where the application stands.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="underline-offset-4 hover:underline" href="/import">
            Import
          </Link>
          <Link className="underline-offset-4 hover:underline" href={showWithdrawn ? "/" : "/?withdrawn=1"}>
            {showWithdrawn ? "Hide withdrawn" : "Show withdrawn"}
          </Link>
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

      <form action={createConventionAction} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Convention" name="displayName" required placeholder="FanimeCon" />
        <Field label="Website" name="website" placeholder="https://" />
        <Button type="submit">Add convention</Button>
      </form>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {board.columns.map((column) => (
          <section key={column.name} className="flex w-64 shrink-0 flex-col gap-2">
            <h2 className="text-sm font-medium">
              {column.name} <span className="text-muted-foreground">{column.cards.length}</span>
            </h2>
            {column.cards.map((card) => (
              <article key={card.editionId} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <div>
                  <Link href={`/series/${card.conventionId}`} className="font-medium hover:underline">
                    {card.conventionName}
                  </Link>
                  <p className="text-sm text-muted-foreground">{card.cycleLabel}</p>
                </div>
                {card.applicationStartDate ? (
                  <p className="text-sm">Applications open {card.applicationStartDate}</p>
                ) : null}
                {card.city ? <p className="text-sm text-muted-foreground">{card.city}</p> : null}
                {card.openBadge ? (
                  <span className="w-fit rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Open</span>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {card.status !== "passed" ? (
                    <form action={markPassedAction}>
                      <input type="hidden" name="editionId" value={card.editionId} />
                      <input type="hidden" name="returnTo" value="/" />
                      <Button type="submit" variant="outline" size="sm">Skip</Button>
                    </form>
                  ) : null}
                  {card.status === "accepted" || card.status === "attended" ? (
                    <form action={setPaidAction}>
                      <input type="hidden" name="editionId" value={card.editionId} />
                      <input type="hidden" name="returnTo" value="/" />
                      <input type="hidden" name="paid" value={card.paid ? "off" : "on"} />
                      <Button type="submit" variant="outline" size="sm">{card.paid ? "Paid" : "Mark paid"}</Button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>

      {showWithdrawn ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium">Withdrawn</h2>
          {board.withdrawn.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing withdrawn.</p>
          ) : (
            board.withdrawn.map((card) => (
              <Link key={card.editionId} href={`/series/${card.conventionId}`} className="text-sm hover:underline">
                {card.conventionName} {card.cycleLabel}
              </Link>
            ))
          )}
        </section>
      ) : null}
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
