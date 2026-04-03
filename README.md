# Run Observer

> 🔍 Native OpenClaw observability plugin — track every token dollar precisely, and pinpoint exactly why your agent went silent.

## Why Run Observer?

### 💰 Know Exactly What Every Run Costs

Ever wonder how much that agent run actually cost you? Run Observer shows **two cost perspectives** side by side so you never have to guess:

- **Reported Cost** — the billing amount your model provider returns in `usage.cost`. This is the closest number to what actually shows up on your invoice.
- **Estimated Cost** — computed locally from token usage buckets (`input`, `output`, `cacheRead`, `cacheWrite`) multiplied by the best available pricing table. When your provider doesn't report billing data, this keeps cost visibility alive.

The viewer displays both in a compact `$0.0042($0.0040)` badge, letting you cross-check and catch billing anomalies at a glance. Why might they differ? Providers can round, bundle, or discount charges in ways raw token counts alone can't capture, and the local estimate depends on the pricing catalog available at capture time.

### 🔧 Pinpoint Why Your Agent Stopped Responding

Sometimes OpenClaw just... stops. No error, no output, just silence. Instead of guessing, you need to see exactly what happened inside the engine.

Run Observer captures the full input/output chain for every run: system prompt → user messages → model response (or the absence of one). When your agent goes silent, you can immediately see:

- Did the request actually get sent?
- What did the model return — or did it return nothing at all?
- Error details, completion status, duration, and all run metadata

Stop guessing. Start debugging with full visibility.

## Install

Assumes OpenClaw is already installed.

### From ClawHub (recommended)

```bash
openclaw plugins install clawhub:openclaw-run-observer
```

### From npm

```bash
openclaw plugins install npm:openclaw-run-observer
```

> **Note:** On newer OpenClaw versions, a bare package name is checked against ClawHub first and falls back to npm if not found. Use the `clawhub:` or `npm:` prefix if you want the source to be unambiguous.

## Quick Start

1. **Verify the plugin is installed:**

   ```bash
   openclaw plugins inspect run-observer
   ```

2. **Start the gateway:**

   ```bash
   openclaw gateway run --bind loopback --allow-unconfigured
   ```

   If the gateway is already running, restart it instead:

   ```bash
   openclaw gateway restart
   ```

3. **Open the local viewer:**

   ```bash
   openclaw run-observer url
   ```

   Open the printed URL in a browser on the same machine running OpenClaw. The viewer updates live as new runs arrive.

4. **(Optional) Quick health check:**

   ```bash
   URL="$(openclaw run-observer url)"
   curl --max-time 5 -s -o /tmp/run-observer.html -w 'HTTP %{http_code}\n' "$URL"
   ```

   `HTTP 200` means everything is working.

## Usage

Once installed and the gateway is running, the viewer automatically captures all runs. In the browser you get:

- **Sidebar** — all runs listed in reverse chronological order with model, agent, channel icons, and cost badges
- **Detail panel** — expand any run to see the full prompt chain, model response, token usage, duration, and error details
- **Live updates** — new runs are pushed to the page in real time, no manual refresh needed

### Rotate the access token

```bash
openclaw run-observer rotate-token
```

Rotating the token invalidates any previously shared viewer links.

## Updating

```bash
openclaw plugins update run-observer
```

Or update all plugins at once:

```bash
openclaw plugins update --all
```

## Cost Model Details

### Why two cost numbers?

| | Reported Cost | Estimated Cost |
|---|---|---|
| Source | Provider-returned `usage.cost` | Local token counts × pricing table |
| Accuracy | Closest to your actual invoice | Best-effort approximation |
| Use case | Day-to-day cost tracking | Fallback when provider omits billing data |

### Estimated pricing lookup order

1. OpenClaw's local `models.json` cost data in the state directory
2. Plugin/runtime config model pricing
3. Cached OpenRouter pricing catalog (with best-effort remote refresh when needed)

If no matching pricing entry is found for the token buckets used by the run, estimated cost shows as `n/a`.

## Security & Privacy

- The viewer only accepts loopback connections — not reachable from outside your machine
- All requests must include the current Run Observer access token
- Captured prompts, outputs, and context stay on the local machine under the OpenClaw state directory
- The session list may fetch channel icons from `https://cdn.simpleicons.org` and provider icons from `https://unpkg.com/@lobehub/icons-static-png@latest/light`; the viewer does not send telemetry
- This repository contains source code only — no runtime data, access tokens, or local state

## Compatibility

This package declares compatibility through the `openclaw.compat` metadata in `package.json`. The published package should track the OpenClaw plugin API and minimum gateway version listed there.

## Development

```bash
pnpm install
pnpm run check
```

Build output is emitted to `dist/`:

```bash
pnpm run build
```

For local plugin development, a watch loop rebuilds on TypeScript changes and restarts the gateway after each successful build:

```bash
pnpm run dev
```

## Release

1. Update the version in `package.json`
2. Run `pnpm run check`
3. Commit:

   ```bash
   git add .
   git commit -m "chore(release): prepare vX.Y.Z"
   ```

4. Create and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --follow-tags
   ```

Pushing `vX.Y.Z` triggers CI to publish to both npm and ClawHub.
