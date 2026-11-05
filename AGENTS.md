# Agent handoff

This repo is a local artist-alley vendor tracker. The product design is settled. Start at the first milestone marked `not started`.

Read [docs/DESIGN.md](docs/DESIGN.md) before writing code. Use it in this order:

1. The milestone status table at the top.
2. The milestone section for the first row whose status is `not started`.
3. Locked decisions, the domain model, and the inbox rules. Do not reopen those.

One milestone per session. Do not start the next milestone in the same change. When a milestone is finished, set its status to `done` in the table and add one line under the milestone: what landed, and anything the next agent must know.

The owner's Mac checkout path is `/Users/songye/Development/vendor_tracker`. In a cloud workspace, the repository root is the project root. Do not create `/Users/songye` on the remote machine.

UI milestones are done only after the flow has been exercised in a browser (or, if no browser is available, against the running local server) and the result is described in the milestone note.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
