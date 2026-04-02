# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the TypeScript plugin runtime. `index.ts` wires OpenClaw hooks, services, HTTP routes, and CLI registration. Core persistence lives in `observer.ts`; viewer and transport logic live in `http.ts` and `html.ts`; shared constants, types, pricing, and helpers live in `constants.ts`, `types.ts`, `pricing.ts`, and `utils.ts`. `test/` mirrors the runtime with Vitest specs such as `observer.test.ts` and `http.test.ts`. Package metadata is split between `package.json` and `openclaw.plugin.json`. Build output is generated into `dist/`.

## Build, Test, and Development Commands
Use Node `>=22` and `pnpm`.

- `pnpm install`: install dependencies.
- `pnpm run typecheck`: run strict TypeScript checks with no emit.
- `pnpm test`: run the Vitest suite once in the Node test environment.
- `pnpm run build`: remove `dist/` and compile the package with `tsc -p tsconfig.build.json`.
- `pnpm run check`: run typecheck, tests, and build in the same order used for local verification.

For a quick contributor sanity check, run `pnpm run check` before opening a PR.

## Coding Style & Naming Conventions
Follow the existing style in `src/`: 2-space indentation, double quotes, semicolons, and ESM imports with explicit `.js` extensions for internal modules. Keep `strict` TypeScript expectations intact; prefer explicit types for public shapes and treat optional fields carefully. Use `PascalCase` for classes, `camelCase` for functions and variables, and descriptive filenames like `observer.ts` or `pricing.ts` that map to a single concern.

## Testing Guidelines
Tests use Vitest and live under `test/**/*.test.ts` as configured in `vitest.config.ts`. Add or update tests alongside any runtime change, especially around persistence, HTTP responses, CLI behavior, and pricing calculations. Prefer deterministic tests that create temporary directories and clean them up, following the pattern in `test/observer.test.ts`. There is no separate coverage gate in the repo, so changed behavior should be covered directly by targeted assertions.

## Commit & Pull Request Guidelines
Current history follows Conventional Commit style, for example `feat: import run observer plugin` and `chore(release): publish 0.0.1`. Keep commits focused and use prefixes such as `feat`, `fix`, `test`, or `chore`. PRs should include a short description of the behavior change, note any OpenClaw compatibility impact, and list the verification command you ran, usually `pnpm run check`. Include screenshots only when UI or viewer output changes.
