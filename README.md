# Expo Tracker

Local app for tracking artist-alley applications to recurring cons and expos. A convention is a stable series. Each year (or season, or Comiket number) is an edition. Automation only files items that need a decision: an opening date was announced, applications are open, or an email accepted, rejected, or waitlisted you. Nothing is written to the board until you approve it.

The design, module map, and implementation milestones are in [docs/DESIGN.md](docs/DESIGN.md). Start at the first milestone marked `not started`.

## Run

From the repo root:

```bash
pnpm install
pnpm dev
```

The UI listens on [http://127.0.0.1:4747](http://127.0.0.1:4747). Open that address, not `localhost`. Google OAuth cookies only come back to `127.0.0.1`. The first launch creates `data/vendor.sqlite`. Later launches reuse that file.

`pnpm worker` runs the same worker loop outside the web server. It retries Google Calendar synchronization. Gmail and other collectors are not wired yet.

`pnpm mock:clean` deletes conventions whose names start with `[MOCK]` (also `MOCK:` / `MOCK -`) and any leftover editions whose cycle labels start with `mock-`. Use that before and after browser verification so test rows never mix with real data. Do not edit real conventions or editions while verifying UI milestones.

Copy `.env.example` to `.env.local` when you have optional keys. The app runs without them. `SESSION_SECRET` signs the OAuth state cookie. Google, the language-model extractor, and Discord stay off until their keys are set.

## Google Calendar

Reminders are opt-in. Saving an edition date does not create a Google event. On an edition, press **Add reminder** for event start or application start.

Use a personal Google Cloud project with the OAuth consent screen in **Testing**. Do not publish the app for verification. Add **your own Gmail** as a test user; Google OAuth will not let you sign in until that address is on the list. Put the Web client ID, client secret, and a `SESSION_SECRET` in `.env.local`. Optional: set `OWNER_EMAIL` so only that Google account can connect.

When those keys are missing, **Settings** shows the full walkthrough (enable Gmail and Calendar APIs, Testing consent, test user, Web client, redirect URI `http://127.0.0.1:4747/api/google/callback`). After you restart `pnpm dev`, open [http://127.0.0.1:4747/settings](http://127.0.0.1:4747/settings) — not localhost — and connect. Disconnect keeps local reminder flags and stored event ids and stops Calendar calls.
