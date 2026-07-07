# Repository Guidelines
开发基于feat/rag分支

## Project Structure & Module Organization

This is a Bun + Hono TypeScript backend using Prisma and PostgreSQL. Runtime source lives in `src/`: `app.ts` builds the Hono app, `index.ts` starts the Bun server, and `worker.ts` exports the Cloudflare Workers handler. Routes belong in `src/routes/`, business logic in `src/services/`, database setup in `src/db/`, shared response/error helpers in `src/core/`, middleware in `src/middleware/`, and utilities in `src/utils/`. Prisma schema and migrations live under `prisma/`. Deployment assets include `wrangler.jsonc`, `s.yaml`, `bootstrap`, and `scripts/build-bun-layer.sh`.

## Build, Test, and Development Commands

- `bun install`: install dependencies from `bun.lock`.
- `cp .env.example .env`: create local environment configuration.
- `bun run db:generate`: generate the Prisma client.
- `bun run db:push`: sync the Prisma schema to a development database.
- `bun run db:migrate:dev`: create and apply local migrations.
- `bun run dev`: run the local Bun server with hot reload.
- `bun run dev:cf`: run the Cloudflare Worker locally with Wrangler.
- `bun test`: run Bun tests in `src/**/*.test.ts`.
- `bun run build:fc` or `bun run build:serverless`: build `dist/index.js` for deployment targets.

## Coding Style & Naming Conventions

Use TypeScript ES modules with strict compiler settings. Follow the existing style: two-space indentation, single quotes, no semicolons, and named exports for shared helpers where practical. Keep filenames descriptive and role-based, such as `user.route.ts`, `user.service.ts`, `password.test.ts`, and `httpLogger.middleware.ts`. Keep route handlers thin; validation, persistence, and business rules should live in services or utilities.

## Testing Guidelines

Tests use Bun's built-in `bun:test` APIs. Place tests beside the code they cover using the `*.test.ts` suffix. Prefer focused utility tests and import-safety tests for deployment entry points, as shown in `src/utils/password.test.ts` and `src/worker.test.ts`. Run `bun test` before submitting changes. For database behavior, use isolated test data and avoid production-like `.env` values.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, sometimes in English and sometimes Chinese, for example `use prisma replace drizzle` and `兼容部署到Cloudflare的Workers`. Keep commits concise, action-oriented, and scoped to one change. Pull requests should describe the change, list verification commands, note database or deployment impacts, and link related issues. Include API examples or screenshots only when visible behavior changes.

## Security & Configuration Tips

Do not commit `.env`, database URLs, cloud credentials, generated `dist/`, `node_modules/`, `.wrangler/`, or `bun-layer.zip`. Keep `DATABASE_URL`, `BUN_LAYER_ARN`, and provider credentials in the shell or deployment platform. Run Prisma migrations before deploying runtime code that depends on schema changes.
