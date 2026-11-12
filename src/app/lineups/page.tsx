"use client";

import Link from "next/link";
import { listLineups } from "../../domain/lineups";
import { todayInLosAngeles } from "../../domain/status";
import { useReadyWorkspace } from "../workspace-provider";
import { LineupsBoard } from "./lineups-board";

export default function LineupsPage() {
  const workspace = useReadyWorkspace();
  if (!workspace) return null;
  const today = todayInLosAngeles();
  const board = listLineups(workspace.db, today);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Lineups</h1>
        <p className="text-sm text-muted-foreground">
          Active editions grouped by status, ordered by the next date that might need action.
        </p>
      </header>

      {board.total === 0 ? (
        <p className="text-muted-foreground">
          No active editions. Add an expo on{" "}
          <Link href="/" className="underline underline-offset-4">
            Expos
          </Link>
          .
        </p>
      ) : null}

      <LineupsBoard board={board} today={today} />
    </main>
  );
}
