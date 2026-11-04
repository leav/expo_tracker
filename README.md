# Vendor Tracker

Local app for tracking artist-alley applications to recurring cons and expos. A convention is a stable series. Each year (or season, or Comiket number) is an edition. Automation only files items that need a decision: an opening date was announced, applications are open, or an email accepted, rejected, or waitlisted you. Nothing is written to the board until you approve it.

The app is not built yet. The design, module map, and implementation milestones are in [docs/DESIGN.md](docs/DESIGN.md). Start at the first milestone marked `not started`.

Intended checkout on the owner's Mac:

```text
/Users/songye/Development/vendor_tracker
```

After milestone M1, from that directory (or from the repo root in a cloud workspace):

```bash
pnpm install
pnpm dev
```

The UI listens on [http://127.0.0.1:4747](http://127.0.0.1:4747).

Google Gmail and Calendar stay off until you connect an OAuth client. Manual tracking works without them. See the design doc for scopes and the `.env.example` values milestone M1 adds.
