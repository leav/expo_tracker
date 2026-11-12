# Agent handoff

This repo is a local-first artist-alley vendor tracker. The product design is the live spec in [docs/DESIGN.md](docs/DESIGN.md). Read it before writing code. Do not reopen locked decisions, the domain model, or the inbox rules.

The repository root is the project root.

UI work is done only after the flow has been exercised in a browser (or, if no browser is available, against the running local server).

### Mock data for browser verification

Browser and manual checks run against the in-browser workspace (IndexedDB). Do not create, edit, drag, or delete real (non-mock) expos or editions.

- Name every test expo with a `[MOCK]` prefix, for example `[MOCK] Calendar Con`.
- Name every test edition cycle with a `mock-` prefix, for example `mock-2027`.
- Delete each `[MOCK]` expo from its expo detail page before and after browser verification so aborted runs do not leave mock rows behind.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
