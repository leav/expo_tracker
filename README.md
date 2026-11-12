# Expo Tracker

Local-first app for tracking artist-alley applications to recurring cons and expos. An expo is a stable series. Each year (or season, or Comiket number) is an edition. Data stays in this browser on this device.

The design, module map, and implementation notes are in [docs/DESIGN.md](docs/DESIGN.md).

## For artists

Open the [GitHub Pages URL](https://leav.github.io/expo_tracker/) for this repository. Nothing to install.

The first visit is an empty workspace. Add expos from the home page. Use **Data** to export JSON or import a JSON package. Switching computers, browsers, or clearing site data will lose the workspace unless you import a backup. Uncheck **Include application status** before sharing a file with someone else.

## For contributors

From the repo root:

```bash
pnpm install
pnpm dev
```

The UI listens on [http://127.0.0.1:4747](http://127.0.0.1:4747). The first launch creates an empty workspace in IndexedDB. Later launches reuse it.

`pnpm test` runs unit tests. `pnpm build` writes a static site to `out/`. `pnpm start` serves that folder on the same host and port.

To move an existing desktop `vendor.sqlite` into the browser app, open **Data**, choose the file under Import, review the added/updated/removed summary, then **Commit import**.

Browser verification should name test expos with a `[MOCK]` prefix and edition cycles with a `mock-` prefix. Delete those expos from each expo’s detail page before and after a run so test rows never mix with real data.

Enable GitHub Pages (Source: GitHub Actions) so pushes to `main` publish `out/`.

## Calendar files

Saving an edition date does not create a calendar event. When application start or event start is set, **Download .ics** and **Google Calendar** sit next to that date. Import the file into your calendar app, or open the Google Calendar web template. Re-download after a date change; some apps, including Google Calendar, may duplicate instead of updating.
