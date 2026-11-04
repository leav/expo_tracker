# Agent handoff

This repo is a local artist-alley vendor tracker. The product design is settled. Implementation has not started.

Read [docs/DESIGN.md](docs/DESIGN.md) before writing code. Use it in this order:

1. The milestone status table at the top.
2. The milestone section for the first row whose status is `not started`.
3. Locked decisions, the domain model, and the inbox rules. Do not reopen those.

One milestone per session. Do not start the next milestone in the same change. When a milestone is finished, set its status to `done` in the table and add one line under the milestone: what landed, and anything the next agent must know.

UI milestones are done only after the flow has been exercised in a browser (or, if no browser is available, against the running local server) and the result is described in the milestone note.
