# Vendor Tracker

Local app for tracking artist-alley applications to recurring cons and expos. A convention is a stable series. Each year (or season, or Comiket number) is an edition. Automation only files items that need a decision: an opening date was announced, applications are open, or an email accepted, rejected, or waitlisted you. Nothing is written to the board until you approve it.

The design, module map, and implementation milestones are in [docs/DESIGN.md](docs/DESIGN.md). Start at the first milestone marked `not started`.

## Run

From the repo root:

```bash
pnpm install
pnpm dev
```

The UI listens on [http://127.0.0.1:4747](http://127.0.0.1:4747). The first launch creates `data/vendor.sqlite`. Later launches reuse that file.

`pnpm worker` runs the same worker loop outside the web server. In this milestone the loop starts and does not poll anything.

Copy `.env.example` to `.env.local` when you have optional keys. The app runs without them. `SESSION_SECRET` will sign the local session cookie once a session exists. Google, the language-model extractor, and Discord stay off until their keys are set.

Intended checkout on the owner's Mac:

```text
/Users/songye/Development/vendor_tracker
```
