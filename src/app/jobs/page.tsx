export const instant = false;

export default function JobsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
      <p className="text-muted-foreground">
        No jobs yet. Manual website and pasted-text jobs land in a later milestone. You can still track cons and
        lineups by hand.
      </p>
    </main>
  );
}
