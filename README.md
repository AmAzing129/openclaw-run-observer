# Run Observer

Run Observer is a native OpenClaw observability plugin for debugging and inspecting agent runs. It
records `llm_input`, `llm_output`, and `agent_end` events, persists recent run attempts, and
exposes a local viewer for inspecting the full request and response trail for each run.

## What it does

- Captures LLM inputs, outputs, and final run status for each attempt
- Persists recent attempts with agent, session, trigger, channel, workspace, and model context
- Tracks token usage, reported cost, and estimated cost when usage data is available
- Streams new runs into a local browser UI for live inspection
- Serves a loopback-only, token-protected viewer backed by plugin-owned HTTP routes
- Exposes CLI helpers to print or rotate the viewer access token

## What you can inspect

- System prompts, prompts, history messages, and assistant output
- Run metadata such as provider, model, agent, session, trigger, and channel context
- Token usage, duration, completion status, and error details
- Stored run-attempt snapshots for recent runs, including live updates as new attempts arrive

## Cost model

The viewer intentionally shows two cost values for the same run. They are not
duplicates, and they answer different questions:

- `reported cost` is the cost reported by the model provider in assistant
  message `usage.cost` fields. Run Observer prefers summing assistant-message
  costs for the current run slice, and falls back to the last assistant payload
  when that is the only place the provider exposed cost.
- `estimated cost` is computed locally from token usage buckets
  (`input`, `output`, `cacheRead`, and `cacheWrite`) multiplied by the plugin's
  best available per-million-token pricing table.

Use the reported value as the closest approximation of the provider's billed
amount. Use the estimated value as a local fallback, a debugging aid, and a way
to keep cost visibility when the provider does not report billing data.

### Why the numbers can differ

- Providers can round, bundle, discount, or otherwise post-process billing in
  ways that are not visible from raw token counts alone.
- The estimate depends on the pricing catalog available on the local machine at
  capture time.
- Some providers expose token counts but omit cost, or expose cost on only part
  of the message trail.
- Cache-read and cache-write billing can vary by provider, and missing pricing
  data for a used bucket suppresses the estimate instead of guessing.

### Estimated pricing lookup order

When the plugin computes `estimated cost`, it resolves model pricing in this
order:

1. OpenClaw's local `models.json` cost data in the state directory.
2. The plugin/runtime config model pricing.
3. A cached OpenRouter pricing catalog, with a best-effort remote refresh when
   needed.

If no complete pricing entry is found for the token buckets used by the run, the
viewer leaves `estimated cost` as `n/a`.

### How the UI reads

- The compact cost badge uses `reported(estimated)` format.
  Example: `$0.0042($0.0040)`.
- The run detail panel breaks the pair into `Run reported cost` and
  `Run estimated cost`.
- If only `reported cost` exists, treat it as authoritative and assume the
  plugin could not resolve a matching price table.
- If only `estimated cost` exists, treat it as a best-effort approximation and
  assume the provider did not report billing data for that run.

## Install

This guide assumes OpenClaw is already installed.

### Install from ClawHub

```bash
openclaw plugins install clawhub:openclaw-run-observer
```

This is the recommended install path when you want the registry-published
ClawHub package explicitly.

### Install from npm

```bash
openclaw plugins install npm:openclaw-run-observer
```

Use the explicit `npm:` prefix when you want to force npm resolution.

Note: on newer OpenClaw versions, a bare package name such as
`openclaw-run-observer` is checked against ClawHub first and only falls back to
npm if ClawHub does not have that package or version. If you want the install
source to be unambiguous, prefer either `clawhub:openclaw-run-observer` or
`npm:openclaw-run-observer`.

## First Run

After installing the plugin:

1. Verify that the plugin is installed:

   ```bash
   openclaw plugins inspect run-observer
   ```

   If your OpenClaw build shows install metadata, it should reflect the source
   you used:
   - `clawhub:openclaw-run-observer` for a ClawHub install
   - `npm:openclaw-run-observer` for an npm install

2. Start the gateway:

   ```bash
   openclaw gateway run --bind loopback --allow-unconfigured
   ```

   If you already have the gateway running elsewhere, restart that existing
   instance instead:

   ```bash
   openclaw gateway restart
   ```

3. Print the local viewer URL:

   ```bash
   openclaw run-observer url
   ```

4. Optional quick verification from the same machine:

   ```bash
   URL="$(openclaw run-observer url)"
   curl --max-time 5 -s -o /tmp/run-observer.html -w 'HTTP %{http_code}\n' "$URL"
   ```

   A healthy local viewer should return `HTTP 200`.

Note: if you are testing from a repository checkout that also contains a local
folder named `openclaw-run-observer`, prefer the explicit
`clawhub:openclaw-run-observer` or `npm:openclaw-run-observer` install spec so
OpenClaw does not confuse it with a local path.

## Updating

To update just this plugin:

```bash
openclaw plugins update run-observer
```

OpenClaw reuses the recorded install source. A plugin installed from ClawHub
continues updating from ClawHub, and a plugin installed from npm continues
updating from npm unless you reinstall it from a different source.

To update all tracked plugins:

```bash
openclaw plugins update --all
```

## Usage

Once the plugin is installed and the gateway is running, use
`openclaw run-observer url` to print the local viewer URL with the current
access token. Open that URL in a browser on the same machine that is running
OpenClaw.

The viewer updates live as new run attempts are captured.

Use this command to rotate the token:

```bash
openclaw run-observer rotate-token
```

Rotating the token invalidates previously shared viewer links.

## Access model

- The viewer only accepts loopback connections
- Requests must include the current Run Observer access token
- The `url` command prints a tokenized local URL, and `rotate-token` replaces that token
- The session list may fetch channel icons from `https://cdn.simpleicons.org` and provider icons from `https://unpkg.com/@lobehub/icons-static-png@latest/light`; the viewer does not send telemetry

## Privacy notes

- This repository contains source code only; it does not include captured run data, access tokens, or local state
- At runtime, captured prompts, outputs, and context stay on the local machine under the OpenClaw state directory
- The startup log omits the access token; use `openclaw run-observer url` when you explicitly want the tokenized local viewer link

## Compatibility

This package declares compatibility through the `openclaw.compat` metadata in
`package.json`. The published package should track the OpenClaw plugin API and
minimum gateway version listed there.

## Development

```bash
pnpm install
pnpm run check
```

Build output is emitted to `dist/`:

```bash
pnpm run build
```

For local plugin development, this repo also includes a watch loop that rebuilds
on TypeScript changes and restarts the configured OpenClaw gateway service after
each successful build:

```bash
pnpm run dev
```

This expects `openclaw gateway restart` to work on your machine.

## Release

This repository is set up to publish the package to both npm and ClawHub from a
GitHub tag.

Before the first automated release, configure:

- npm trusted publishing for this repository and the workflow file
  `.github/workflows/release.yml`
- a GitHub Actions secret named `CLAWHUB_TOKEN`

Typical release flow:

1. Update the version in `package.json`.
2. Run:

   ```bash
   pnpm run check
   ```

3. Commit the release:

   ```bash
   git add .
   git commit -m "chore(release): prepare vX.Y.Z"
   ```

4. Create and push the matching tag:

   ```bash
   git tag vX.Y.Z
   git push origin main --follow-tags
   ```

Pushing `vX.Y.Z` triggers `.github/workflows/release.yml`, which:

- runs `pnpm run check`
- verifies the tag matches `package.json`
- publishes to npm with trusted publishing
- publishes the same version to ClawHub
