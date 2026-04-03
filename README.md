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

```bash
openclaw plugins install openclaw-run-observer
```

Run Observer is currently published through npm. ClawHub packaging can be
added later, but the normal user install flow today is the npm command above.

## First Run

After installing the plugin:

1. Verify that the installed plugin was recorded as an npm install:

   ```bash
   openclaw plugins info run-observer
   ```

   You should see an install block similar to:
   - `Source: npm`
   - `Spec: openclaw-run-observer`

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
folder named `openclaw-run-observer`, run the install command from a different
directory so OpenClaw resolves the npm package instead of a local path.

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

## ClawHub Publish

This directory is prepared for native OpenClaw plugin publishing. Depending on
your installed ClawHub CLI version, publish through either:

- the ClawHub web UI by uploading this folder, a `.zip`, or a `.tgz`
- a newer `clawhub package publish .` CLI flow when available

Before publishing, confirm that the package name and version in `package.json`
match the release you want to ship.
