export const instant = false;

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground">
        Google connection and Calendar reminders are not wired yet. Cons, Lineups, and Import work without them.
      </p>
    </main>
  );
}
