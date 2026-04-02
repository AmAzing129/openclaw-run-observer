# Repository Guidelines

## Project Structure & Module Organization
This package is a small TypeScript OpenClaw plugin. Source lives in `src/`, with the entrypoint in `src/index.ts`, CLI wiring in `src/cli.ts`, HTTP viewer code in `src/http.ts`, and runtime/state handling in `src/observer.ts`. Tests live beside the code as `src/*.test.ts`. Repository metadata is split between `package.json`, `tsconfig.json`, `vitest.config.ts`, and the plugin manifest `openclaw.plugin.json`.

## Build, Test, and Development Commands
Use Node 22+ and `pnpm`.

- `pnpm install`: install dependencies.
- `pnpm run typecheck`: run strict TypeScript checks with `tsc --noEmit`.
- `pnpm test`: run the Vitest suite in Node.
- `pnpm run check`: run the full local gate: typecheck plus tests.

There is no separate build script in this package; OpenClaw loads `./src/index.ts` directly from the extension config in `package.json`.

## Coding Style & Naming Conventions
Follow the existing TypeScript style: 2-space indentation, double quotes, trailing semicolons, and ESM imports with explicit `.js` suffixes for local modules. Keep `strict`-safe types intact; this repo enables `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Use `camelCase` for functions and variables, `PascalCase` for types/classes, and `UPPER_SNAKE_CASE` for exported constants such as plugin IDs and route bases. Match the current file naming pattern: short lowercase module names like `http.ts` and `observer.ts`.

## Testing Guidelines
Vitest is configured in `vitest.config.ts` with `src/**/*.test.ts` as the test glob. Name tests after the module they cover, for example `observer.test.ts` and `http.test.ts`. Prefer focused unit tests around persisted state, CLI URL generation, and HTTP auth/response behavior. Note that the HTTP tests bind a loopback port, so sandboxed environments may block them even when the code is correct.

## Commit & Pull Request Guidelines
This directory does not include its own `.git` metadata, so follow the surrounding workspace convention visible in adjacent history: concise Conventional Commit subjects such as `fix(http): handle token rotation`, `perf(test): reduce fixture setup`, or `chore: bump SDK version`. Keep PRs small, describe the behavior change, list the commands you ran, link the relevant issue, and include screenshots or sample output when changing the viewer or CLI surface.
