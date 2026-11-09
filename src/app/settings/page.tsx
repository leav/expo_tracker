import { Button, buttonVariants } from "../../components/ui/button";
import { openDatabase } from "../../db";
import { getGoogleConnection, getSettings } from "../../domain/settings";
import {
  googleConnectHref,
  googleOAuthConfig,
  googleSettingsHref,
  ownerEmailEnv,
} from "../../google/config";
import { disconnectGoogleAction, updateSettingsAction } from "./actions";
import { GoogleOAuthSetup } from "./google-setup";

export const instant = false;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const db = openDatabase();
  const current = getSettings(db);
  const connection = getGoogleConnection(db);
  const oauth = googleOAuthConfig();
  const owner = ownerEmailEnv() ?? current.ownerEmail;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Google Calendar reminders are opt-in. Connecting Google does not create events until you press Add reminder
          on an edition date.
        </p>
      </header>
      {query.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{query.error}</p>
      ) : null}

      <section className="grid gap-3 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Google</h2>
        {connection ? (
          <>
            <p>Connected as {connection.email}</p>
            <form action={disconnectGoogleAction}>
              <Button type="submit" variant="outline">
                Disconnect
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Google not connected. Cons, Lineups, Calendar, and Import still work. Connect to sync opt-in reminders
              to Google Calendar.
            </p>
            {oauth.ready ? (
              <>
                <a href={googleConnectHref(oauth.redirectUri)} className={`${buttonVariants()} w-fit`}>
                  Connect Google
                </a>
                <p className="text-sm text-muted-foreground">
                  Open {googleSettingsHref(oauth.redirectUri)} in this tab, not localhost. Google will not send
                  the login cookie back from localhost. Your Gmail must also be a test user on the OAuth consent
                  screen, or Google will block the sign-in.
                </p>
              </>
            ) : (
              <GoogleOAuthSetup missing={oauth.missing} reason={oauth.reason} />
            )}
          </>
        )}
        {owner ? (
          <p className="text-sm text-muted-foreground">Owner {owner}</p>
        ) : (
          <p className="text-sm text-muted-foreground">The first connected Google account becomes the owner.</p>
        )}
      </section>

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
          <label className="grid gap-1 text-sm">
            Calendar id
            <input
              name="calendarId"
              defaultValue={current.calendarId}
              placeholder="primary"
              className="h-9 rounded-md border border-input bg-background px-2"
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
