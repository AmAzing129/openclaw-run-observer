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
