import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INTERRUPTED_RUN_ERROR } from "../src/constants.js";
import { RunObserverRuntime } from "../src/observer.js";
import { __resetPricingCachesForTest } from "../src/pricing.js";

const cleanupDirs = new Set<string>();
const observersToStop = new Set<RunObserverRuntime>();

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {},
  };
}

async function createObserver(options?: { config?: unknown }) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-"));
  cleanupDirs.add(rootDir);
  const observer = new RunObserverRuntime({
    logger: createLogger(),
    rootDir,
    config: options?.config,
  });
  await observer.start();
  observersToStop.add(observer);
  return { observer, rootDir };
}

afterEach(async () => {
  for (const observer of observersToStop) {
    await observer.stop();
  }
  observersToStop.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  __resetPricingCachesForTest();
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.clear();
});

describe("RunObserverRuntime", () => {
  it("increments attempt ordinals per run and keeps concurrent runs isolated", async () => {
    const { observer } = await createObserver();

    await Promise.all([
      observer.recordLlmInput({
        runId: "run-a",
        sessionId: "session-a",
        provider: "openai",
        model: "gpt-5.4",
        prompt: "first",
        historyMessages: [],
        imagesCount: 0,
        ctx: {},
      }),
      observer.recordLlmInput({
        runId: "run-b",
        sessionId: "session-b",
        provider: "anthropic",
        model: "claude-sonnet",
        prompt: "other",
        historyMessages: [],
        imagesCount: 0,
        ctx: {},
      }),
    ]);

    const second = await observer.recordLlmInput({
      runId: "run-a",
      sessionId: "session-a",
      provider: "openai",
      model: "gpt-5.4",
      prompt: "second",
      historyMessages: [],
      imagesCount: 1,
      ctx: {},
    });

    expect(second.runAttemptId).toBe("run-a:2");
    const recent = await observer.getRecentRuns();
    expect(recent[0]?.runAttemptId).toBe("run-a:2");
    expect(recent.map((entry) => entry.runAttemptId).sort()).toEqual(["run-a:1", "run-a:2", "run-b:1"]);
  });

  it("merges llm_input, llm_output, and agent_end into a persisted run attempt", async () => {
    const { observer, rootDir } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-1",
      sessionId: "session-1-event",
      provider: "openai",
      model: "gpt-5.4",
      systemPrompt: "system",
      prompt: "hello",
      historyMessages: [{ role: "user", content: "hi" }],
      imagesCount: 2,
      ctx: {
        runId: "run-1",
        agentId: "agent:main",
        sessionId: "session-1-ctx",
        sessionKey: "agent:main:main",
        workspaceDir: "/tmp/workspace-a",
        trigger: "user",
        messageProvider: "discord",
        channelId: "discord",
      },
    });

    await observer.recordLlmOutput({
      runId: "run-1",
      assistantTexts: ["hello back"],
      lastAssistant: {
        usage: {
          input: 50,
          cacheRead: 5,
          cacheWrite: 3,
        },
      },
      usage: {
        input: 120,
        output: 40,
        cacheRead: 20,
        cacheWrite: 10,
      },
    });

    await observer.recordAgentEnd({
      runId: "run-1",
      messages: [{ role: "assistant", content: "done" }],
      success: true,
      durationMs: 987,
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    const summary = (await observer.getRecentRuns())[0];
    expect(loaded?.meta.status).toBe("completed");
    expect(loaded?.meta.usageStatus).toBe("available");
    expect(loaded?.usage?.derivedTotalTokens).toBe(190);
    expect(loaded?.usage?.latestPromptTokens).toBe(58);
    expect(loaded?.output.assistantTexts).toEqual(["hello back"]);
    expect(loaded?.llmInput?.event.runId).toBe("run-1");
    expect(loaded?.llmInput?.event.sessionId).toBe("session-1-event");
    expect(loaded?.llmInput?.event.imagesCount).toBe(2);
    expect(loaded?.llmInput?.ctx.runId).toBe("run-1");
    expect(loaded?.llmInput?.ctx.sessionId).toBe("session-1-ctx");
    expect(loaded?.llmInput?.ctx.sessionKey).toBe("agent:main:main");
    expect(loaded?.llmInput?.ctx.workspaceDir).toBe("/tmp/workspace-a");
    expect(loaded?.llmInput?.ctx.messageProvider).toBe("discord");
    expect(loaded?.llmInput?.ctx.channelId).toBe("discord");
    expect(loaded?.context.sessionId).toBe("session-1-ctx");
    expect(summary?.agentId).toBe("agent:main");

    const storedPath = path.join(rootDir, "run-attempts", loaded?.storageDay ?? "", `${created.runAttemptId}.json`);
    const stored = JSON.parse(await fs.readFile(storedPath, "utf8"));
    expect(stored.meta.status).toBe("completed");
  });

  it("marks usage unavailable without inventing totals", async () => {
    const { observer } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-2",
      sessionId: "session-2",
      provider: "provider-x",
      model: "model-y",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-2",
      assistantTexts: [],
      lastAssistant: {
        usage: {
          input: 11,
          cacheRead: 7,
        },
      },
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    expect(loaded?.meta.usageStatus).toBe("unavailable");
    expect(loaded?.usage?.total).toBeUndefined();
    expect(loaded?.usage?.derivedTotalTokens).toBeUndefined();
    expect(loaded?.usage?.latestPromptTokens).toBe(18);

    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.usageStatus).toBe("unavailable");
    expect(summary?.totalTokens).toBeUndefined();
  });

  it("marks stale inflight runs as interrupted across restarts", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-restart-"));
    cleanupDirs.add(rootDir);

    const first = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await first.start();
    const initialAccess = await first.getAccessState();
    await first.recordLlmInput({
      runId: "run-restart",
      sessionId: "session-restart",
      provider: "openai",
      model: "gpt-5.4",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });
    await first.stop();

    const second = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await second.start();
    const nextAccess = await second.getAccessState();
    const recent = await second.getRecentRuns();
    const loaded = await second.getRunAttempt("run-restart:1");

    expect(nextAccess.token).toBe(initialAccess.token);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.runAttemptId).toBe("run-restart:1");
    expect(recent[0]?.status).toBe("interrupted");
    expect(recent[0]?.error).toBe(INTERRUPTED_RUN_ERROR);
    expect(loaded?.meta.status).toBe("interrupted");
    expect(loaded?.meta.success).toBe(false);
    expect(loaded?.meta.error).toBe(INTERRUPTED_RUN_ERROR);
  });

  it("does not interrupt inflight runs while another runtime is still active", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-runtime-lease-"));
    cleanupDirs.add(rootDir);

    const writer = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await writer.start();
    await writer.recordLlmInput({
      runId: "run-active",
      sessionId: "session-active",
      provider: "openai",
      model: "gpt-5.4",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    const reader = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await reader.start();

    const recent = await reader.getRecentRuns();
    const loaded = await reader.getRunAttempt("run-active:1");

    expect(recent[0]?.status).toBe("inflight");
    expect(recent[0]?.error).toBeUndefined();
    expect(loaded?.meta.status).toBe("inflight");
    expect(loaded?.meta.error).toBeUndefined();

    await reader.stop();
    await writer.stop();
  });

  it("clears stored history when the storage schema version is missing", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-schema-"));
    cleanupDirs.add(rootDir);

    await fs.mkdir(path.join(rootDir, "indexes"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "run-attempts", "2026-04-02"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "indexes", "recent.json"),
      JSON.stringify({
        updatedAt: Date.now(),
        runs: [
          {
            runAttemptId: "legacy-run:1",
            runId: "legacy-run",
            attemptOrdinal: 1,
            storageDay: "2026-04-02",
            provider: "openai",
            model: "gpt-5.4",
            status: "completed",
            usageStatus: "available",
            costUsd: 0.1234,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }),
    );
    await fs.writeFile(
      path.join(rootDir, "run-attempts", "2026-04-02", "legacy-run:1.json"),
      JSON.stringify({
        runAttemptId: "legacy-run:1",
        runId: "legacy-run",
      }),
    );

    const observer = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await observer.start();

    expect(await observer.getRecentRuns()).toEqual([]);
    await expect(
      fs.access(path.join(rootDir, "run-attempts", "2026-04-02", "legacy-run:1.json")),
    ).rejects.toThrow();

    const schemaVersion = JSON.parse(
      await fs.readFile(path.join(rootDir, "schema-version.json"), "utf8"),
    ) as { version: number };
    expect(schemaVersion.version).toBe(2);
  });

  it("stores a compact single-line prompt preview in recent summaries", async () => {
    const { observer } = await createObserver();

    await observer.recordLlmInput({
      runId: "run-preview",
      sessionId: "session-preview",
      provider: "openai",
      model: "gpt-5.4",
      prompt:
        "  First line of the run prompt.\n\nSecond line keeps going with extra detail so the preview needs to be trimmed safely.  ",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.promptPreview).toBe(
      "First line of the run prompt. Second line keeps going with extra detail so the previe...",
    );
  });

  it("refreshes recent summaries and run-attempt detail across runtime instances", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-shared-"));
    cleanupDirs.add(rootDir);

    const reader = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    const writer = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await reader.start();
    await writer.start();

    const created = await writer.recordLlmInput({
      runId: "run-shared",
      sessionId: "session-shared",
      provider: "openai",
      model: "gpt-5.4",
      prompt: "shared",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await writer.recordLlmOutput({
      runId: "run-shared",
      assistantTexts: ["shared response"],
      usage: {
        input: 12,
        output: 4,
      },
    });

    const recent = await reader.getRecentRuns();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.runAttemptId).toBe(created.runAttemptId);
    expect(recent[0]?.totalTokens).toBe(16);

    const detail = await reader.getRunAttempt(created.runAttemptId);
    expect(detail?.output.assistantTexts).toEqual(["shared response"]);
    expect(detail?.usage?.derivedTotalTokens).toBe(16);
  });

  it("stores both reported and estimated costs when both are available", async () => {
    const config = {
      models: {
        providers: {
          google: {
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                cost: { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 0 },
              },
            ],
          },
        },
      },
    };
    const { observer } = await createObserver({ config });

    const created = await observer.recordLlmInput({
      runId: "run-cost-direct",
      sessionId: "session-cost",
      provider: "google",
      model: "gemini-2.5-pro",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-cost-direct",
      assistantTexts: ["hi"],
      lastAssistant: {
        usage: {
          input: 100,
          output: 50,
          cost: { total: 0.0042 },
        },
      },
      usage: { input: 100, output: 50 },
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    expect(loaded?.usage?.reportedCostUsd).toBe(0.0042);
    expect(loaded?.usage?.estimatedCostUsd).toBeCloseTo(0.000625);
    expect(loaded?.usage?.estimatedPricingUsdPerMillion).toEqual({
      input: 1.25,
      output: 10,
      cacheRead: 0.31,
      cacheWrite: 0,
    });
    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.reportedCostUsd).toBe(0.0042);
    expect(summary?.estimatedCostUsd).toBeCloseTo(0.000625);
  });

  it("replaces last-call reported cost with current-run cumulative reported cost after agent_end", async () => {
    const config = {
      models: {
        providers: {
          google: {
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                cost: { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 0 },
              },
            ],
          },
        },
      },
    };
    const { observer } = await createObserver({ config });

    const created = await observer.recordLlmInput({
      runId: "run-cost-cumulative",
      sessionId: "session-cost",
      provider: "google",
      model: "gemini-2.5-pro",
      prompt: "hello",
      historyMessages: [
        {
          role: "assistant",
          usage: {
            input: 200,
            output: 20,
            cost: { total: 0.0063 },
          },
        },
        {
          role: "toolResult",
        },
      ],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-cost-cumulative",
      assistantTexts: ["hi"],
      lastAssistant: {
        usage: {
          input: 100,
          output: 50,
          cost: { total: 0.0042 },
        },
      },
      usage: { input: 300, output: 70 },
    });

    expect((await observer.getRunAttempt(created.runAttemptId))?.usage?.reportedCostUsd).toBe(0.0042);

    await observer.recordAgentEnd({
      runId: "run-cost-cumulative",
      messages: [
        {
          role: "assistant",
          usage: {
            input: 200,
            output: 20,
            cost: { total: 0.0063 },
          },
        },
        {
          role: "tool",
          content: "history tool result",
        },
        {
          role: "user",
          content: "current turn",
        },
        {
          role: "assistant",
          usage: {
            input: 120,
            output: 15,
            cost: { total: 0.00285 },
          },
        },
        {
          role: "tool",
          content: "ignored",
        },
        {
          role: "assistant",
          usage: {
            input: 100,
            output: 50,
            cost: { total: 0.0042 },
          },
        },
      ],
      success: true,
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    expect(loaded?.usage?.reportedCostUsd).toBeCloseTo(0.00705);
    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.reportedCostUsd).toBeCloseTo(0.00705);
  });

  it("stores only estimated cost when no direct cost is available", async () => {
    const config = {
      models: {
        providers: {
          anthropic: {
            models: [
              {
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
                cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
              },
            ],
          },
        },
      },
    };
    const { observer } = await createObserver({ config });

    const created = await observer.recordLlmInput({
      runId: "run-cost-config",
      sessionId: "session-cost",
      provider: "anthropic",
      model: "claude-sonnet-4",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-cost-config",
      assistantTexts: ["hi"],
      usage: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100 },
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    // (1000*3 + 500*15 + 200*0.3 + 100*3.75) / 1_000_000
    expect(loaded?.usage?.reportedCostUsd).toBeUndefined();
    expect(loaded?.usage?.estimatedCostUsd).toBeCloseTo(0.010935);
    expect(loaded?.usage?.estimatedPricingUsdPerMillion).toEqual({
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite: 3.75,
    });
    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.reportedCostUsd).toBeUndefined();
    expect(summary?.estimatedCostUsd).toBeCloseTo(0.010935);
  });

  it("estimates OpenRouter pricing when OpenClaw local sources omit model costs", async () => {
    const fetchSpy = vi.fn(
      createOpenRouterFetch([
        {
          id: "openai/gpt-5.4",
          pricing: {
            prompt: "0.0000025",
            completion: "0.000015",
            input_cache_read: "0.00000025",
          },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { observer } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-cost-codex",
      sessionId: "session-cost",
      provider: "openai-codex",
      model: "gpt-5.4",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-cost-codex",
      assistantTexts: ["hi"],
      usage: { input: 1000, output: 500, cacheRead: 200 },
    });

    await pollFor(async () => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const loaded = await observer.getRunAttempt(created.runAttemptId);
      expect(loaded?.usage?.reportedCostUsd).toBeUndefined();
      expect(loaded?.usage?.estimatedCostUsd).toBeCloseTo(0.01005);
      expect(loaded?.usage?.estimatedPricingUsdPerMillion).toEqual({
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
        cacheWrite: 0,
      });
      const summary = (await observer.getRecentRuns())[0];
      expect(summary?.estimatedCostUsd).toBeCloseTo(0.01005);
    });
  });

  it("persists run updates before async remote pricing refresh completes", async () => {
    const deferredFetch = createDeferred<Response>();
    const fetchSpy = vi.fn(async () => await deferredFetch.promise);
    vi.stubGlobal("fetch", fetchSpy);

    const { observer, rootDir } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-cost-async",
      sessionId: "session-cost",
      provider: "openai-codex",
      model: "gpt-5.4",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    const llmOutputResult = await raceWithTimeout(
      observer.recordLlmOutput({
        runId: "run-cost-async",
        assistantTexts: ["hi"],
        usage: { input: 1000, output: 500 },
      }),
      1_000,
    );
    expect(llmOutputResult.status).toBe("resolved");

    const persistedBeforeRefresh = JSON.parse(
      await fs.readFile(
        path.join(rootDir, "run-attempts", created.storageDay, `${created.runAttemptId}.json`),
        "utf8",
      ),
    ) as {
      meta?: { status?: string };
      usage?: { estimatedCostUsd?: number };
    };
    expect(persistedBeforeRefresh.meta?.status).toBe("inflight");
    expect(persistedBeforeRefresh.usage?.estimatedCostUsd).toBeUndefined();

    const agentEndResult = await raceWithTimeout(
      observer.recordAgentEnd({
        runId: "run-cost-async",
        messages: [{ role: "assistant", content: "done" }],
        success: true,
      }),
      1_000,
    );
    expect(agentEndResult.status).toBe("resolved");

    const completedBeforeRefresh = await observer.getRunAttempt(created.runAttemptId);
    expect(completedBeforeRefresh?.meta.status).toBe("completed");
    expect(completedBeforeRefresh?.usage?.estimatedCostUsd).toBeUndefined();

    deferredFetch.resolve(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "openai/gpt-5.4",
              pricing: {
                prompt: "0.0000025",
                completion: "0.000015",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await pollFor(async () => {
      const loaded = await observer.getRunAttempt(created.runAttemptId);
      expect(loaded?.meta.status).toBe("completed");
      expect(loaded?.usage?.estimatedCostUsd).toBeCloseTo(0.01);
      expect(loaded?.usage?.estimatedPricingUsdPerMillion).toEqual({
        input: 2.5,
        output: 15,
        cacheRead: 0,
        cacheWrite: 0,
      });
      const summary = (await observer.getRecentRuns())[0];
      expect(summary?.estimatedCostUsd).toBeCloseTo(0.01);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("estimates OpenRouter pricing for claude-cli provider aliases", async () => {
    const fetchSpy = vi.fn(
      createOpenRouterFetch([
        {
          id: "anthropic/claude-opus-4.6",
          pricing: {
            prompt: "0.000005",
            completion: "0.000025",
            input_cache_read: "0.0000005",
            input_cache_write: "0.00000625",
          },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { observer } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-cost-opus",
      sessionId: "session-opus",
      provider: "claude-cli",
      model: "opus-4.6",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-cost-opus",
      assistantTexts: ["hi"],
      usage: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100 },
    });

    await pollFor(async () => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const loaded = await observer.getRunAttempt(created.runAttemptId);
      expect(loaded?.usage?.reportedCostUsd).toBeUndefined();
      expect(loaded?.usage?.estimatedCostUsd).toBeCloseTo(0.018225);
      expect(loaded?.usage?.estimatedPricingUsdPerMillion).toEqual({
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      });
      const summary = (await observer.getRecentRuns())[0];
      expect(summary?.estimatedCostUsd).toBeCloseTo(0.018225);
    });
  });

  it("omits estimated cost when OpenRouter pricing is missing a used cacheWrite field", async () => {
    const fetchSpy = vi.fn(
      createOpenRouterFetch([
        {
          id: "anthropic/claude-sonnet-4.6",
          pricing: {
            prompt: "0.000003",
            completion: "0.000015",
            input_cache_read: "0.0000003",
          },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { observer } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-cost-sonnet",
      sessionId: "session-sonnet",
      provider: "claude-cli",
      model: "sonnet-4.6",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-cost-sonnet",
      assistantTexts: ["hi"],
      usage: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100 },
    });

    await pollFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    expect(loaded?.usage?.reportedCostUsd).toBeUndefined();
    expect(loaded?.usage?.estimatedCostUsd).toBeUndefined();
    expect(loaded?.usage?.estimatedPricingUsdPerMillion).toBeUndefined();
    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.estimatedCostUsd).toBeUndefined();
  });

  it("backfills cumulative reported cost and estimated cost data on startup", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-backfill-"));
    cleanupDirs.add(rootDir);
    const storageDay = "2026-04-02";
    const createdAt = Date.now();
    const runAttempt = {
      runAttemptId: "run-backfill:1",
      runId: "run-backfill",
      attemptOrdinal: 1,
      storageDay,
      context: {
        sessionId: "session-backfill",
        provider: "openai-codex",
        model: "gpt-5.4",
      },
      input: {
        prompt: "hello",
        historyMessages: [],
        imagesCount: 0,
      },
      output: {
        assistantTexts: ["hi"],
        lastAssistant: {
          usage: {
            input: 100,
            output: 50,
            cost: { total: 0.0042 },
          },
        },
        messages: [
          {
            role: "assistant",
            usage: {
              input: 200,
              output: 20,
              cost: { total: 0.0063 },
            },
          },
          {
            role: "assistant",
            usage: {
              input: 100,
              output: 50,
              cost: { total: 0.0042 },
            },
          },
        ],
      },
      usage: {
        input: 1000,
        output: 500,
        cacheRead: 200,
        derivedTotalTokens: 1700,
        reportedCostUsd: 0.0042,
        estimatedCostUsd: 0.01005,
        estimatedPricingUsdPerMillion: {
          input: 2.5,
          output: 15,
          cacheRead: 0.25,
          cacheWrite: 0,
        },
      },
      meta: {
        status: "completed",
        usageStatus: "available",
        createdAt,
        updatedAt: createdAt,
      },
    };

    await fs.mkdir(path.join(rootDir, "indexes"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "run-attempts", storageDay), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "schema-version.json"),
      JSON.stringify({ version: 2, updatedAt: createdAt }),
    );
    await fs.writeFile(
      path.join(rootDir, "indexes", "recent.json"),
      JSON.stringify({
        updatedAt: createdAt,
        runs: [
          {
            runAttemptId: "run-backfill:1",
            runId: "run-backfill",
            attemptOrdinal: 1,
            storageDay,
            provider: "openai-codex",
            model: "gpt-5.4",
            status: "completed",
            usageStatus: "available",
            totalTokens: 1700,
            reportedCostUsd: 0.0042,
            estimatedCostUsd: 0.01005,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      }),
    );
    await fs.writeFile(
      path.join(rootDir, "indexes", "openrouter-pricing.json"),
      JSON.stringify({
        cachedAt: Date.now(),
        models: {
          "openai/gpt-5.4": {
            input: 2.5,
            output: 15,
            cacheRead: 0.25,
          },
        },
      }),
    );
    await fs.writeFile(
      path.join(rootDir, "run-attempts", storageDay, "run-backfill:1.json"),
      JSON.stringify(runAttempt),
    );

    const observer = new RunObserverRuntime({
      logger: createLogger(),
      rootDir,
    });
    await observer.start();

    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.reportedCostUsd).toBeCloseTo(0.0105);
    expect(summary?.estimatedCostUsd).toBeCloseTo(0.01005);
    const loaded = await observer.getRunAttempt("run-backfill:1");
    expect(loaded?.usage?.reportedCostUsd).toBeCloseTo(0.0105);
    expect(loaded?.usage?.estimatedCostUsd).toBeCloseTo(0.01005);
    expect(loaded?.usage?.estimatedPricingUsdPerMillion).toEqual({
      input: 2.5,
      output: 15,
      cacheRead: 0.25,
      cacheWrite: 0,
    });
  });

  it("omits both costs when neither direct cost nor config pricing is available", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const { observer } = await createObserver();

    const created = await observer.recordLlmInput({
      runId: "run-no-cost",
      sessionId: "session-no-cost",
      provider: "unknown-provider",
      model: "unknown-model",
      prompt: "hello",
      historyMessages: [],
      imagesCount: 0,
      ctx: {},
    });

    await observer.recordLlmOutput({
      runId: "run-no-cost",
      assistantTexts: ["hi"],
      usage: { input: 100, output: 50 },
    });

    const loaded = await observer.getRunAttempt(created.runAttemptId);
    expect(loaded?.usage?.reportedCostUsd).toBeUndefined();
    expect(loaded?.usage?.estimatedCostUsd).toBeUndefined();
    expect(loaded?.usage?.estimatedPricingUsdPerMillion).toBeUndefined();
    const summary = (await observer.getRecentRuns())[0];
    expect(summary?.reportedCostUsd).toBeUndefined();
    expect(summary?.estimatedCostUsd).toBeUndefined();
  });
});

function createOpenRouterFetch(
  entries: Array<{
    id: string;
    pricing: Record<string, string>;
  }>,
): typeof fetch {
  return async () =>
    new Response(JSON.stringify({ data: entries }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ status: "resolved"; value: T } | { status: "timeout" }> {
  return await Promise.race([
    promise.then((value) => ({ status: "resolved" as const, value })),
    new Promise<{ status: "timeout" }>((resolve) => {
      setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
    }),
  ]);
}

async function pollFor(
  assertion: () => Promise<void> | void,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 1_000;
  const intervalMs = options?.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = new Error("Timed out while waiting for assertion");
  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw lastError;
}
