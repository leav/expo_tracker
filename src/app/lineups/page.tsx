import { connection } from "next/server";
import { listLineups } from "../../domain/lineups";
import { todayInLosAngeles } from "../../domain/status";
import { openDatabase } from "../../db";
import { LineupsBoard } from "./lineups-board";

export const instant = false;

export default async function LineupsPage() {
  await connection();
  const today = todayInLosAngeles();
  const board = listLineups(openDatabase(), today);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Lineups</h1>
        <p className="text-sm text-muted-foreground">
          Active editions grouped by status, ordered by the next date that might need action.
        </p>
      </header>

      {board.total === 0 ? (
        <p className="text-muted-foreground">No active editions. Add a convention or import the sheet.</p>
      ) : null}

      <LineupsBoard board={board} today={today} />
    </main>
  );
}
