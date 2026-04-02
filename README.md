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

From ClawHub:

```bash
openclaw plugins install clawhub:openclaw-run-observer
```

If the package is also published to npm:

```bash
openclaw plugins install openclaw-run-observer
```

## Usage

After the plugin is enabled and the gateway is running:

```bash
openclaw run-observer url
```

That command prints the local viewer URL, including the current access token. Open the URL in a
browser on the same machine that is running OpenClaw.

The viewer updates live as new run attempts are captured.

To rotate the token:

```bash
openclaw run-observer rotate-token
```

Rotating the token invalidates previously shared viewer links.

## Access model

- The viewer only accepts loopback connections
- Requests must include the current Run Observer access token
- The `url` command prints a tokenized local URL, and `rotate-token` replaces that token
- Viewer assets are self-contained and do not fetch third-party icons or telemetry

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

## ClawHub Publish

This directory is prepared for native OpenClaw plugin publishing. Depending on
your installed ClawHub CLI version, publish through either:

- the ClawHub web UI by uploading this folder, a `.zip`, or a `.tgz`
- a newer `clawhub package publish .` CLI flow when available

Before publishing, confirm that the package name and version in `package.json`
match the release you want to ship.
