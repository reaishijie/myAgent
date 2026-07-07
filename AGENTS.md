# Repository Guidelines
开发基于feat/rag分支

## Project Structure & Module Organization

This repository follows the Moments-style split layout with separate `backend/` and `frontend/` projects. The Bun + Hono + Prisma backend lives in `backend/`: runtime source is under `backend/src/`, Prisma schema and migrations are under `backend/prisma/`, and backend deployment assets include `backend/wrangler.jsonc`, `backend/s.yaml`, `backend/bootstrap`, and `backend/scripts/build-bun-layer.sh`. Backend routes belong in `backend/src/routes/`, business logic in `backend/src/services/`, database setup in `backend/src/db/`, response/error helpers in `backend/src/core/`, middleware in `backend/src/middleware/`, and utilities in `backend/src/utils/`. The React + Vite console and widget assets live in `frontend/`.

## Build, Test, and Development Commands

Backend commands should be run from `backend/`:

- `cd backend && bun install`: install backend dependencies from `backend/bun.lock`.
- `cd backend && cp .env.example .env`: create local backend environment configuration.
- `cd backend && bun run db:generate`: generate the Prisma client.
- `cd backend && bun run db:push`: sync the Prisma schema to a development database.
- `cd backend && bun run db:migrate:dev`: create and apply local migrations.
- `cd backend && bun run dev`: run the local Bun server with hot reload.
- `cd backend && bun run dev:cf`: run the Cloudflare Worker locally with Wrangler.
- `cd backend && bun test`: run Bun backend tests in `backend/src/**/*.test.ts`.
- `cd backend && bun run build:fc` or `cd backend && bun run build:serverless`: build `backend/dist/index.js` for deployment targets.

Frontend commands should be run from `frontend/`:

- `cd frontend && bun install`: install frontend dependencies.
- `cd frontend && bun run dev`: run the Vite development server.
- `cd frontend && bun run lint`: lint frontend source.
- `cd frontend && bun run build`: build the frontend.
- `cd frontend && bun test`: run frontend unit tests.
- `cd frontend && bun run test:e2e`: run browser e2e verification with the real backend and mock OpenAI provider.

## Coding Style & Naming Conventions

Use TypeScript ES modules with strict compiler settings. Follow the existing style: two-space indentation, single quotes, no semicolons, and named exports for shared helpers where practical. Keep filenames descriptive and role-based, such as `user.route.ts`, `user.service.ts`, `password.test.ts`, and `httpLogger.middleware.ts`. Keep route handlers thin; validation, persistence, and business rules should live in services or utilities.

## Testing Guidelines

Tests use Bun's built-in `bun:test` APIs. Place tests beside the code they cover using the `*.test.ts` or `*.test.tsx` suffix. Prefer focused utility tests and import-safety tests for deployment entry points, as shown in `backend/src/utils/password.test.ts` and `backend/src/worker.test.ts`. Run `cd backend && bun test` before backend submissions, and run the relevant frontend checks for UI changes. For database behavior, use isolated test data and avoid production-like `.env` values.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, sometimes in English and sometimes Chinese, for example `use prisma replace drizzle` and `兼容部署到Cloudflare的Workers`. Keep commits concise, action-oriented, and scoped to one change. Pull requests should describe the change, list verification commands, note database or deployment impacts, and link related issues. Include API examples or screenshots only when visible behavior changes.

## Security & Configuration Tips

Do not commit `.env`, database URLs, cloud credentials, generated `dist/`, `node_modules/`, `.wrangler/`, or `bun-layer.zip`. Keep `DATABASE_URL`, `BUN_LAYER_ARN`, and provider credentials in the shell or deployment platform. Run Prisma migrations before deploying runtime code that depends on schema changes.
