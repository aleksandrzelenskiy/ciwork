# Repository Guidelines

## Project Structure & Module Organization
Next.js 15 routes live in `src/app`, grouped by feature folder; older API handlers stay under `src/pages/api` until they are migrated. Shared config for Mongo, Clerk, AWS, and other providers belongs in `src/config`, while `src/server-actions` wraps data mutations or long-running jobs consumed by components. Utilities and types live in `src/utils` and `src/types`, static assets in `public`, and design tokens in `tailwind.config.ts`.

## Build, Test, and Development Commands
- `npm run dev` – local Next.js server on :3000 with hot reload.
- `npm run build` – production compile; treat TypeScript or lint failures as blockers.
- `npm run start` – serve the build to reproduce production-only issues.
- `npm run lint` – ESLint per `eslint.config.mjs`; append `-- --fix` for autofixes.
- `npm run clean:duplicates` – executes `scripts/clean-duplicates.ts` via ts-node to dedupe imported data after bulk uploads.

## Coding Style & Naming Conventions
Write TypeScript function components with four-space indentation (see `src/app/layout.tsx`). Name components/providers in PascalCase, hooks and helpers in camelCase, and constants or env keys in SCREAMING_SNAKE_CASE. Keep server-only logic in server actions or config clients, and keep UI-only logic in components; prefer Tailwind utilities or MUI props over ad-hoc inline styles. Run `npm run lint -- --fix` before committing.

## Testing Guidelines
Automated tests are not yet checked in, but new work should ship with Jest + React Testing Library (unit/component) or Playwright (flows). Place specs next to the subject as `*.spec.ts(x)` or inside `src/__tests__`, mirror the module path, and seed fixtures under `templates/` when mocking exports. Until CI lands, list the manual test steps and expected result in your PR checklist.

## Commit & Pull Request Guidelines
Follow the history of concise imperative messages with optional scope, e.g., `feat(TaskDetailPage): add Masonry layout` or `TaskDetailsPage - show assignment events`. Reference task IDs in parentheses when available and keep commits atomic (no mixing lint noise with feature changes). Pull requests must summarize the change, list affected routes/config, attach UI screenshots for visible updates, and state the commands/tests you ran.

## Security & Configuration Tips
Store secrets only in `.env.local` or the deployment vault; never commit credentials. When touching Clerk, AWS S3, or email integrations, document new environment variables in both `README.md` and your PR. Generated reports, uploads, and logs belong in `public/` or temporary storage (S3, `/tmp`) and must stay out of Git; rerun `npm run clean:duplicates` after bulk data jobs to prevent orphaned Mongo records.
