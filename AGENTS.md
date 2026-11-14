<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Application conventions

This is the authorized Kestrel application repository. Preserve the existing root-level `app/`; shared code belongs in `lib/`, UI features in `features/`, and controls in `components/`. Do not create a duplicate `src/app/`.

Use strict TypeScript, Zod 4 validation, Decimal.js for deterministic financial arithmetic, and server-only provider adapters. Deep Agents uses Gemini primarily with the configured OpenRouter fallback. Never import server credentials or sponsor adapters into client code. Shared DTOs and the browser client are authoritative; do not duplicate schemas or calculate canonical financial values in components.

Use npm and the committed lockfile. Run typecheck, lint, relevant tests and production build for shared changes. Keep credentials, restricted data and local authority documents untracked and out of deployment artifacts. Never force-add ignored paths.

## Git workflow

Use clean, descriptive branch names such as `dashboard`, `agent-integration`, or `property-data`. Do not use a `codex/` prefix for any future branch. Preserve existing worktrees and commit history when renaming branches; never reset, recreate, or force-push them to change a name.
