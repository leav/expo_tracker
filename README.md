# Expo Tracker

Local app for tracking artist-alley applications to recurring cons and expos. A convention is a stable series. Each year (or season, or Comiket number) is an edition.

The design, module map, and implementation notes are in [docs/DESIGN.md](docs/DESIGN.md).

## Run

From the repo root:

```bash
pnpm install
pnpm dev
```

The UI listens on [http://127.0.0.1:4747](http://127.0.0.1:4747). The first launch creates `data/vendor.sqlite`. Later launches reuse that file.

`pnpm mock:clean` deletes conventions whose names start with `[MOCK]` (also `MOCK:` / `MOCK -`) and any leftover editions whose cycle labels start with `mock-`. Use that before and after browser verification so test rows never mix with real data. Do not edit real conventions or editions while verifying UI milestones.

## Calendar files

Saving an edition date does not create a calendar event. When application start or event start is set, **Download .ics** and **Google Calendar** sit next to that date. Import the file into your calendar app, or open the Google Calendar web template. Re-download after a date change; some apps, including Google Calendar, may duplicate instead of updating.
