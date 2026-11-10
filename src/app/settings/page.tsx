import { Button } from "../../components/ui/button";
import { openDatabase } from "../../db";
import { getSettings } from "../../domain/settings";
import { updateSettingsAction } from "./actions";

export const instant = false;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const current = getSettings(openDatabase());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Drive-limit hours split discovery into within a day versus farther. Calendar files are downloaded from each
          edition date; saving a date does not create a file.
        </p>
      </header>
      {query.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{query.error}</p>
      ) : null}

      <section className="grid gap-3 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Planning</h2>
        <form action={updateSettingsAction} className="grid gap-3">
          <label className="grid gap-1 text-sm">
            Drive-limit hours
            <input
              name="driveLimitHours"
              type="number"
              min={1}
              defaultValue={current.driveLimitHours}
              className="h-9 w-32 rounded-md border border-input bg-background px-2"
            />
          </label>
          <Button type="submit" className="w-fit">
            Save settings
          </Button>
        </form>
      </section>
    </main>
  );
}
