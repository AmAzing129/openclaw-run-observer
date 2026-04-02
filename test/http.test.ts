import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRunObserverHttpHandler } from "../src/http.js";
import { RunObserverRuntime } from "../src/observer.js";
import { PLUGIN_ROUTE_BASE } from "../src/constants.js";
import { isLoopbackRemoteAddress } from "../src/utils.js";

const cleanupDirs = new Set<string>();

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {},
  };
}

async function createObserver() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-http-"));
  cleanupDirs.add(rootDir);
  const observer = new RunObserverRuntime({
    logger: createLogger(),
    rootDir,
  });
  await observer.start();
  return observer;
}

async function withServer(
  observer: RunObserverRuntime,
  run: (params: { origin: string; token: string }) => Promise<void>,
) {
  const handler = createRunObserverHttpHandler({ observer });
  const server = http.createServer(async (req, res) => {
    const handled = await handler(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.end("missing");
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected a tcp address");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  const token = (await observer.getAccessState()).token;
  try {
    await run({ origin, token });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function waitForSseEvent(
  url: string,
  trigger: () => Promise<void>,
  matcher: (eventText: string) => boolean,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const req = http.request(url, {
      headers: {
        Accept: "text/event-stream",
      },
    });

    let response: http.IncomingMessage | undefined;
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error("Timed out waiting for SSE event"));
    }, 2_000);

    const finish = (error?: Error, eventText?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      req.destroy();
      response?.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve(eventText ?? "");
    };

    req.on("response", (res) => {
      response = res;
      if (res.statusCode !== 200) {
        finish(new Error(`Unexpected SSE status: ${res.statusCode ?? "unknown"}`));
        return;
      }

      res.setEncoding("utf8");
      let buffer = "";
      res.on("data", (chunk: string) => {
        buffer += chunk;
        for (;;) {
          const delimiterIndex = buffer.indexOf("\n\n");
          if (delimiterIndex === -1) {
            return;
          }
          const eventText = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + 2);
          if (matcher(eventText)) {
            finish(undefined, eventText);
            return;
          }
        }
      });
      res.on("error", (error) => {
        finish(error);
      });

      trigger().catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error(String(error)));
      });
    });

    req.on("error", (error) => {
      finish(error);
    });

    req.end();
  });
}

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.clear();
});

describe("run-observer HTTP", () => {
  it("serves the page and JSON APIs behind the plugin token", async () => {
    const observer = await createObserver();
    const runAttempt = await observer.recordLlmInput({
      runId: "run-http",
      sessionId: "session-http",
      provider: "openai",
      model: "gpt-5.4",
      prompt: "http",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await withServer(observer, async ({ origin, token }) => {
      const page = await fetch(`${origin}${PLUGIN_ROUTE_BASE}/?token=${encodeURIComponent(token)}`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("Run Observer");

      const recent = await fetch(`${origin}${PLUGIN_ROUTE_BASE}/api/recent?token=${encodeURIComponent(token)}`);
      expect(recent.status).toBe(200);
      const recentJson = (await recent.json()) as {
        ok: boolean;
        runs: Array<{ runAttemptId: string }>;
      };
      expect(recentJson.runs).toHaveLength(1);
      expect(recentJson.runs[0]?.runAttemptId).toBe(runAttempt.runAttemptId);

      const detail = await fetch(
        `${origin}${PLUGIN_ROUTE_BASE}/api/run-attempt/${encodeURIComponent(runAttempt.runAttemptId)}?token=${encodeURIComponent(token)}`,
      );
      expect(detail.status).toBe(200);
      const detailJson = (await detail.json()) as {
        ok: boolean;
        run: { runAttemptId: string };
      };
      expect(detailJson.run.runAttemptId).toBe(runAttempt.runAttemptId);
    });
  });

  it("rejects missing tokens and streams SSE updates", async () => {
    const observer = await createObserver();

    await withServer(observer, async ({ origin, token }) => {
      const unauthorized = await fetch(`${origin}${PLUGIN_ROUTE_BASE}/api/recent`);
      expect(unauthorized.status).toBe(401);

      const eventText = await waitForSseEvent(
        `${origin}${PLUGIN_ROUTE_BASE}/api/events?token=${encodeURIComponent(token)}`,
        async () => {
          await observer.recordLlmInput({
            runId: "run-sse",
            sessionId: "session-sse",
            provider: "anthropic",
            model: "claude",
            prompt: "watch",
            historyMessages: [],
            imagesCount: 0,
            ctx: {},
          });
        },
        (candidate) => candidate.includes("event: upsert"),
      );

      expect(eventText).toContain("event: upsert");
      expect(eventText).toContain("run-sse:1");
    });
  });

  it("detects loopback addresses conservatively", () => {
    expect(isLoopbackRemoteAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackRemoteAddress("::1")).toBe(true);
    expect(isLoopbackRemoteAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackRemoteAddress("10.0.0.2")).toBe(false);
    expect(isLoopbackRemoteAddress("192.168.1.8")).toBe(false);
  });
});
