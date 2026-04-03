# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the TypeScript plugin. `src/index.ts` wires OpenClaw hooks, services, HTTP routes, and CLI registration. Runtime state and persistence live in `observer.ts`; pricing logic is split across `pricing.ts`, `openclaw-local-pricing.ts`, and `openrouter-pricing.ts`; viewer rendering and browser assets live in `html.ts`, `http.ts`, and `src/viewer/`. Tests sit in `test/*.test.ts` and generally mirror runtime areas such as `observer`, `http`, `cli`, and `pricing`. Static SVG assets live in `viewer-icons/`. `dist/` is generated output and should not be edited by hand.

## Build, Test, and Development Commands
Use Node `>=22` with `pnpm`.

- `pnpm install` installs dependencies.
- `pnpm run typecheck` runs strict TypeScript checks without emitting files.
- `pnpm test` runs the Vitest suite once in the Node environment.
- `pnpm run build` deletes `dist/` and compiles the package with `tsc -p tsconfig.build.json`.
- `pnpm run check` is the main local gate and should pass before a PR.
- `pnpm run dev` watches TypeScript sources and restarts the OpenClaw gateway after successful rebuilds.

## Coding Style & Naming Conventions
Follow the existing TypeScript style: 2-space indentation, double quotes, semicolons, ESM syntax, and explicit `.js` extensions in internal imports. Keep modules single-purpose and prefer descriptive filenames such as `observer.ts` or `client-script.ts`. Use `PascalCase` for classes and exported types, `camelCase` for functions and variables, and preserve the repo’s strict compiler settings (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).

## Testing Guidelines
Vitest is configured in `vitest.config.ts` to pick up `test/**/*.test.ts`. Add or update tests with every behavior change, especially around persisted run attempts, HTTP responses, CLI output, and pricing calculations. Prefer deterministic tests that use temporary directories and explicit assertions, following `test/observer.test.ts`. There is no coverage threshold in CI, so target the changed path directly.

## Commit & Pull Request Guidelines
Recent history mostly uses Conventional Commit prefixes such as `feat:`, `docs:`, `chore(ci):`, and `chore(release):`; keep new commits focused and similarly named. PRs should include a short behavior summary, note any OpenClaw compatibility or release impact, and list the verification command you ran, usually `pnpm run check`. Include screenshots only when the local viewer UI changes.

## Security & Release Notes
Do not commit captured run data, tokens, or other local state. Tag-based releases are defined in `.github/workflows/release.yml`; tags must match the `package.json` version in the form `vX.Y.Z`.
