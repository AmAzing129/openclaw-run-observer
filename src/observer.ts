import fs from "node:fs/promises";
import path from "node:path";
import type { ServerResponse } from "node:http";
import { KeyedAsyncQueue, type PluginLogger } from "openclaw/plugin-sdk/core";
import {
  readJsonFileWithFallback,
  writeJsonFileAtomically,
} from "openclaw/plugin-sdk/json-store";
import {
  DEFAULT_RECENT_RUN_LIMIT,
  PLUGIN_ID,
  RUN_OBSERVER_STORAGE_SCHEMA_VERSION,
  SSE_RETRY_MS,
} from "./constants.js";
import type {
  RunObserverAccessState,
  RunObserverAgentEndPayload,
  RunObserverLlmInputPayload,
  RunObserverLlmOutputPayload,
  RunObserverRecentRunsIndex,
  RunObserverRunAttempt,
  RunObserverRunSummary,
  RunObserverSseEvent,
  RunObserverUsage,
} from "./types.js";
import {
  extractCostFromLastAssistant,
  estimateCostUsd,
  resolveModelPricing,
} from "./pricing.js";
import {
  buildPromptPreview,
  cloneValue,
  createAccessToken,
  deriveLatestPromptTokens,
  deriveUsageTotal,
  formatStorageDay,
  trimOptionalString,
} from "./utils.js";

type RunState = {
  nextAttemptOrdinal: number;
  currentRunAttemptId?: string;
};

type RunObserverRuntimeOptions = {
  logger: PluginLogger;
  rootDir: string;
  stateDir?: string;
  config?: unknown;
  maxRecentRuns?: number;
};

export class RunObserverRuntime {
  private readonly logger: PluginLogger;
  private readonly rootDir: string;
  private readonly stateDir: string | undefined;
  private readonly config: unknown;
  private readonly maxRecentRuns: number;
  private readonly queue = new KeyedAsyncQueue();
  private readonly runStates = new Map<string, RunState>();
  private readonly runAttemptCache = new Map<string, RunObserverRunAttempt>();
  private readonly runSummaryCache = new Map<string, RunObserverRunSummary>();
  private readonly subscribers = new Set<ServerResponse>();
  private readonly readyPromiseByRoot = new Map<string, Promise<void>>();

  private accessState: RunObserverAccessState | null = null;
  private recent: RunObserverRunSummary[] = [];

  constructor(options: RunObserverRuntimeOptions) {
    this.logger = options.logger;
    this.rootDir = options.rootDir;
    this.stateDir = options.stateDir;
    this.config = options.config;
    this.maxRecentRuns = options.maxRecentRuns ?? DEFAULT_RECENT_RUN_LIMIT;
  }

  async start(): Promise<void> {
    await this.ensureReady();
  }

  async stop(): Promise<void> {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.end();
      } catch {
        // Ignore SSE close failures during shutdown.
      }
    }
    this.subscribers.clear();
  }

  async getAccessState(): Promise<RunObserverAccessState> {
    await this.ensureReady();
    if (!this.accessState) {
      throw new Error("run-observer access state not initialized");
    }
    return this.accessState;
  }

  async rotateAccessToken(): Promise<RunObserverAccessState> {
    await this.ensureReady();
    const now = Date.now();
    const next: RunObserverAccessState = {
      token: createAccessToken(),
      createdAt: this.accessState?.createdAt ?? now,
      updatedAt: now,
    };
    this.accessState = next;
    await writeJsonFileAtomically(this.accessFilePath(), next);
    return next;
  }

  async getRecentRuns(): Promise<RunObserverRunSummary[]> {
    await this.ensureReady();
    await this.loadRecentIndex();
    return this.recent.map((summary) => cloneValue(summary));
  }

  async getRunAttempt(runAttemptId: string): Promise<RunObserverRunAttempt | null> {
    await this.ensureReady();
    await this.loadRecentIndex();
    const summary = this.runSummaryCache.get(runAttemptId);
    if (!summary) {
      const cached = this.runAttemptCache.get(runAttemptId);
      return cached ? cloneValue(cached) : null;
    }
    const filePath = this.runAttemptFilePath(summary.storageDay, runAttemptId);
    const loaded = await readJsonFileWithFallback<RunObserverRunAttempt | null>(filePath, null);
    if (!loaded.value) {
      return null;
    }
    this.runAttemptCache.set(runAttemptId, loaded.value);
    return cloneValue(loaded.value);
  }

  async subscribe(res: ServerResponse): Promise<void> {
    await this.ensureReady();
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.flushHeaders?.();
    res.write(`retry: ${SSE_RETRY_MS}\n\n`);
    this.subscribers.add(res);
    const cleanup = () => {
      this.subscribers.delete(res);
    };
    res.on("close", cleanup);
    res.on("error", cleanup);
  }

  async recordLlmInput(payload: RunObserverLlmInputPayload): Promise<RunObserverRunAttempt> {
    return this.queue.enqueue(payload.runId, async () => {
      await this.ensureReady();
      const previousState = this.runStates.get(payload.runId) ?? { nextAttemptOrdinal: 0 };
      const attemptOrdinal = previousState.nextAttemptOrdinal + 1;
      const createdAt = Date.now();
      const runAttemptId = `${payload.runId}:${attemptOrdinal}`;
      const agentId = trimOptionalString(payload.ctx.agentId);
      const ctxSessionId = trimOptionalString(payload.ctx.sessionId);
      const ctxRunId = trimOptionalString(payload.ctx.runId);
      const sessionId = ctxSessionId ?? payload.sessionId;
      const sessionKey = trimOptionalString(payload.ctx.sessionKey);
      const workspaceDir = trimOptionalString(payload.ctx.workspaceDir);
      const trigger = trimOptionalString(payload.ctx.trigger);
      const channelId = trimOptionalString(payload.ctx.channelId);
      const messageProvider = trimOptionalString(payload.ctx.messageProvider);
      const systemPrompt = trimOptionalString(payload.systemPrompt);
      const llmInputEvent = {
        runId: payload.runId,
        sessionId: payload.sessionId,
        provider: payload.provider,
        model: payload.model,
        ...(payload.systemPrompt !== undefined ? { systemPrompt: payload.systemPrompt } : {}),
        prompt: payload.prompt,
        historyMessages: cloneValue(payload.historyMessages),
        imagesCount: payload.imagesCount,
      };
      const llmInputCtx = {
        ...(ctxRunId !== undefined ? { runId: ctxRunId } : {}),
        ...(agentId !== undefined ? { agentId } : {}),
        ...(sessionKey !== undefined ? { sessionKey } : {}),
        ...(ctxSessionId !== undefined ? { sessionId: ctxSessionId } : {}),
        ...(workspaceDir !== undefined ? { workspaceDir } : {}),
        ...(messageProvider !== undefined ? { messageProvider } : {}),
        ...(trigger !== undefined ? { trigger } : {}),
        ...(channelId !== undefined ? { channelId } : {}),
      };
      const runAttempt: RunObserverRunAttempt = {
        runAttemptId,
        runId: payload.runId,
        attemptOrdinal,
        storageDay: formatStorageDay(createdAt),
        llmInput: {
          event: llmInputEvent,
          ctx: llmInputCtx,
        },
        context: {
          ...(agentId !== undefined ? { agentId } : {}),
          sessionId,
          ...(sessionKey !== undefined ? { sessionKey } : {}),
          ...(workspaceDir !== undefined ? { workspaceDir } : {}),
          ...(trigger !== undefined ? { trigger } : {}),
          ...(channelId !== undefined ? { channelId } : {}),
          ...(messageProvider !== undefined ? { messageProvider } : {}),
          provider: payload.provider,
          model: payload.model,
        },
        input: {
          ...(systemPrompt !== undefined ? { systemPrompt } : {}),
          prompt: payload.prompt,
          historyMessages: cloneValue(payload.historyMessages),
          imagesCount: payload.imagesCount,
        },
        output: {
          assistantTexts: [],
        },
        meta: {
          status: "inflight",
          usageStatus: "pending",
          createdAt,
          updatedAt: createdAt,
        },
      };
      this.runStates.set(payload.runId, {
        nextAttemptOrdinal: attemptOrdinal,
        currentRunAttemptId: runAttemptId,
      });
      await this.persistRunAttempt(runAttempt);
      return cloneValue(runAttempt);
    });
  }

  async recordLlmOutput(payload: RunObserverLlmOutputPayload): Promise<RunObserverRunAttempt | null> {
    return this.queue.enqueue(payload.runId, async () => {
      await this.ensureReady();
      const runAttempt = await this.loadCurrentRecordForRun(payload.runId);
      if (!runAttempt) {
        this.logger.warn(`[${PLUGIN_ID}] llm_output received without matching llm_input for ${payload.runId}`);
        return null;
      }

      runAttempt.output.assistantTexts = cloneValue(payload.assistantTexts);
      if (payload.lastAssistant !== undefined) {
        runAttempt.output.lastAssistant = cloneValue(payload.lastAssistant);
      } else {
        delete runAttempt.output.lastAssistant;
      }
      const latestPromptTokens = deriveLatestPromptTokens(payload.lastAssistant);
      const usage = this.normalizeUsage(payload.usage, latestPromptTokens);
      if (usage) {
        runAttempt.usage = usage;
        this.hydrateUsageCosts(runAttempt, {
          lastAssistant: payload.lastAssistant,
          usage,
        });
        runAttempt.meta.usageStatus = payload.usage ? "available" : "unavailable";
      } else {
        delete runAttempt.usage;
        runAttempt.meta.usageStatus = payload.usage ? "available" : "unavailable";
      }
      runAttempt.meta.updatedAt = Date.now();
      await this.persistRunAttempt(runAttempt);
      return cloneValue(runAttempt);
    });
  }

  async recordAgentEnd(payload: RunObserverAgentEndPayload): Promise<RunObserverRunAttempt | null> {
    return this.queue.enqueue(payload.runId, async () => {
      await this.ensureReady();
      const runAttempt = await this.loadCurrentRecordForRun(payload.runId);
      if (!runAttempt) {
        this.logger.warn(`[${PLUGIN_ID}] agent_end received without matching llm_input for ${payload.runId}`);
        return null;
      }

      runAttempt.output.messages = cloneValue(payload.messages);
      runAttempt.meta.success = payload.success;
      const error = trimOptionalString(payload.error);
      if (error !== undefined) {
        runAttempt.meta.error = error;
      } else {
        delete runAttempt.meta.error;
      }
      if (payload.durationMs !== undefined) {
        runAttempt.meta.durationMs = payload.durationMs;
      } else {
        delete runAttempt.meta.durationMs;
      }
      runAttempt.meta.status = payload.success ? "completed" : "failed";
      runAttempt.meta.updatedAt = Date.now();
      await this.persistRunAttempt(runAttempt);
      return cloneValue(runAttempt);
    });
  }

  private async ensureReady(): Promise<void> {
    const existing = this.readyPromiseByRoot.get(this.rootDir);
    if (existing) {
      await existing;
      return;
    }
    const created = this.initialize();
    this.readyPromiseByRoot.set(this.rootDir, created);
    await created;
  }

  private async initialize(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    await this.ensureStorageSchema();
    await fs.mkdir(this.runAttemptsRootDir(), { recursive: true, mode: 0o700 });
    await fs.mkdir(this.indexDir(), { recursive: true, mode: 0o700 });
    await this.loadRecentIndex();
    await this.refreshRecentUsageCosts();
    await this.loadAccessState();
  }

  private async ensureStorageSchema(): Promise<void> {
    const loaded = await readJsonFileWithFallback<{ version?: unknown } | null>(
      this.schemaVersionFilePath(),
      null,
    );
    const version =
      loaded.value && typeof loaded.value === "object" ? loaded.value.version : undefined;
    if (version === RUN_OBSERVER_STORAGE_SCHEMA_VERSION) {
      return;
    }
    await fs.rm(this.runAttemptsRootDir(), { recursive: true, force: true });
    await fs.rm(this.indexDir(), { recursive: true, force: true });
    this.runStates.clear();
    this.runAttemptCache.clear();
    this.runSummaryCache.clear();
    this.recent = [];
    await writeJsonFileAtomically(this.schemaVersionFilePath(), {
      version: RUN_OBSERVER_STORAGE_SCHEMA_VERSION,
      updatedAt: Date.now(),
    });
  }

  private async loadRecentIndex(): Promise<void> {
    const loaded = await readJsonFileWithFallback<RunObserverRecentRunsIndex>(this.recentIndexPath(), {
      updatedAt: 0,
      runs: [],
    });
    const deduped = new Map<string, RunObserverRunSummary>();
    for (const run of loaded.value.runs) {
      deduped.set(run.runAttemptId, run);
    }
    this.recent = Array.from(deduped.values())
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, this.maxRecentRuns);
    this.runSummaryCache.clear();
    for (const summary of this.recent) {
      this.runSummaryCache.set(summary.runAttemptId, summary);
    }
  }

  private async loadAccessState(): Promise<void> {
    const now = Date.now();
    const loaded = await readJsonFileWithFallback<RunObserverAccessState | null>(
      this.accessFilePath(),
      null,
    );
    const next =
      loaded.value ??
      ({
        token: createAccessToken(),
        createdAt: now,
        updatedAt: now,
      } satisfies RunObserverAccessState);
    this.accessState = next;
    if (!loaded.exists) {
      await writeJsonFileAtomically(this.accessFilePath(), next);
    }
  }

  private resolveReportedCostUsd(lastAssistant: unknown): number | undefined {
    return extractCostFromLastAssistant(lastAssistant);
  }

  private resolveEstimatedCost(
    usage:
      | RunObserverLlmOutputPayload["usage"]
      | Pick<RunObserverUsage, "input" | "output" | "cacheRead" | "cacheWrite">,
    provider: string,
    model: string,
  ):
    | {
        costUsd: number;
        pricing: NonNullable<RunObserverUsage["estimatedPricingUsdPerMillion"]>;
      }
    | undefined {
    if (!usage) {
      return undefined;
    }
    const pricing = resolveModelPricing({
      config: this.config,
      provider,
      model,
      ...(this.stateDir !== undefined ? { stateDir: this.stateDir } : {}),
    });
    if (!pricing) {
      return undefined;
    }
    const costUsd = estimateCostUsd(usage, pricing);
    if (costUsd === undefined) {
      return undefined;
    }
    return {
      costUsd,
      pricing: { ...pricing },
    };
  }

  private normalizeUsage(
    usage: RunObserverLlmOutputPayload["usage"],
    latestPromptTokens: number | undefined,
  ): RunObserverUsage | undefined {
    if (!usage && latestPromptTokens === undefined) {
      return undefined;
    }
    const normalized: RunObserverUsage = {
      ...(typeof usage?.input === "number" ? { input: usage.input } : {}),
      ...(typeof usage?.output === "number" ? { output: usage.output } : {}),
      ...(typeof usage?.cacheRead === "number" ? { cacheRead: usage.cacheRead } : {}),
      ...(typeof usage?.cacheWrite === "number" ? { cacheWrite: usage.cacheWrite } : {}),
      ...(typeof usage?.total === "number" ? { total: usage.total } : {}),
      ...(latestPromptTokens !== undefined ? { latestPromptTokens } : {}),
    };
    const derivedTotalTokens = deriveUsageTotal(usage);
    if (derivedTotalTokens !== undefined) {
      normalized.derivedTotalTokens = derivedTotalTokens;
    }
    return normalized;
  }

  private hydrateUsageCosts(
    runAttempt: RunObserverRunAttempt,
    options?: {
      lastAssistant?: unknown;
      usage?: Pick<RunObserverUsage, "input" | "output" | "cacheRead" | "cacheWrite">;
    },
  ): boolean {
    const usage = runAttempt.usage;
    if (!usage) {
      return false;
    }

    let changed = false;
    if (usage.reportedCostUsd === undefined) {
      const reportedCostUsd = this.resolveReportedCostUsd(
        options?.lastAssistant ?? runAttempt.output.lastAssistant,
      );
      if (reportedCostUsd !== undefined) {
        usage.reportedCostUsd = reportedCostUsd;
        changed = true;
      }
    }

    if (usage.estimatedCostUsd === undefined || usage.estimatedPricingUsdPerMillion === undefined) {
      const estimatedCost = this.resolveEstimatedCost(
        options?.usage ?? usage,
        runAttempt.context.provider,
        runAttempt.context.model,
      );
      if (estimatedCost) {
        if (usage.estimatedCostUsd !== estimatedCost.costUsd) {
          usage.estimatedCostUsd = estimatedCost.costUsd;
          changed = true;
        }
        if (!this.isSamePricing(usage.estimatedPricingUsdPerMillion, estimatedCost.pricing)) {
          usage.estimatedPricingUsdPerMillion = estimatedCost.pricing;
          changed = true;
        }
      }
    }

    return changed;
  }

  private isSamePricing(
    left: RunObserverUsage["estimatedPricingUsdPerMillion"],
    right: NonNullable<RunObserverUsage["estimatedPricingUsdPerMillion"]>,
  ): boolean {
    return (
      left?.input === right.input &&
      left?.output === right.output &&
      left?.cacheRead === right.cacheRead &&
      left?.cacheWrite === right.cacheWrite
    );
  }

  private async refreshRecentUsageCosts(): Promise<void> {
    for (const summary of [...this.recent]) {
      if (summary.usageStatus !== "available") {
        continue;
      }
      if (summary.reportedCostUsd !== undefined && summary.estimatedCostUsd !== undefined) {
        continue;
      }

      const loaded = await readJsonFileWithFallback<RunObserverRunAttempt | null>(
        this.runAttemptFilePath(summary.storageDay, summary.runAttemptId),
        null,
      );
      if (!loaded.value) {
        continue;
      }
      this.runAttemptCache.set(loaded.value.runAttemptId, loaded.value);
      if (!this.hydrateUsageCosts(loaded.value)) {
        continue;
      }
      await this.persistRunAttempt(loaded.value);
    }
  }

  private async loadCurrentRecordForRun(runId: string): Promise<RunObserverRunAttempt | null> {
    const currentRunAttemptId = this.runStates.get(runId)?.currentRunAttemptId;
    if (!currentRunAttemptId) {
      return null;
    }
    const cached = this.runAttemptCache.get(currentRunAttemptId);
    if (cached) {
      return cached;
    }
    const summary = this.runSummaryCache.get(currentRunAttemptId);
    if (!summary) {
      return null;
    }
    const loaded = await readJsonFileWithFallback<RunObserverRunAttempt | null>(
      this.runAttemptFilePath(summary.storageDay, summary.runAttemptId),
      null,
    );
    if (!loaded.value) {
      return null;
    }
    this.runAttemptCache.set(loaded.value.runAttemptId, loaded.value);
    return loaded.value;
  }

  private async persistRunAttempt(runAttempt: RunObserverRunAttempt): Promise<void> {
    this.runAttemptCache.set(runAttempt.runAttemptId, runAttempt);
    await fs.mkdir(path.dirname(this.runAttemptFilePath(runAttempt.storageDay, runAttempt.runAttemptId)), {
      recursive: true,
      mode: 0o700,
    });
    await writeJsonFileAtomically(
      this.runAttemptFilePath(runAttempt.storageDay, runAttempt.runAttemptId),
      runAttempt,
    );
    const run = this.buildRunSummary(runAttempt);
    this.runSummaryCache.set(run.runAttemptId, run);
    this.recent = [run, ...this.recent.filter((entry) => entry.runAttemptId !== run.runAttemptId)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, this.maxRecentRuns);
    await writeJsonFileAtomically(this.recentIndexPath(), {
      updatedAt: Date.now(),
      runs: this.recent,
    } satisfies RunObserverRecentRunsIndex);
    this.publish({ type: "upsert", run });
  }

  private buildRunSummary(runAttempt: RunObserverRunAttempt): RunObserverRunSummary {
    const totalTokens = runAttempt.usage?.total ?? runAttempt.usage?.derivedTotalTokens;
    const promptPreview = buildPromptPreview(runAttempt.input.prompt);
    return {
      runAttemptId: runAttempt.runAttemptId,
      runId: runAttempt.runId,
      attemptOrdinal: runAttempt.attemptOrdinal,
      storageDay: runAttempt.storageDay,
      ...(runAttempt.context.agentId !== undefined ? { agentId: runAttempt.context.agentId } : {}),
      ...(runAttempt.context.sessionId !== undefined ? { sessionId: runAttempt.context.sessionId } : {}),
      ...(runAttempt.context.sessionKey !== undefined ? { sessionKey: runAttempt.context.sessionKey } : {}),
      ...(promptPreview !== undefined ? { promptPreview } : {}),
      provider: runAttempt.context.provider,
      model: runAttempt.context.model,
      ...(runAttempt.context.trigger !== undefined ? { trigger: runAttempt.context.trigger } : {}),
      ...(runAttempt.context.channelId !== undefined ? { channelId: runAttempt.context.channelId } : {}),
      ...(runAttempt.context.messageProvider !== undefined
        ? { messageProvider: runAttempt.context.messageProvider }
        : {}),
      status: runAttempt.meta.status,
      usageStatus: runAttempt.meta.usageStatus,
      ...(totalTokens !== undefined ? { totalTokens } : {}),
      ...(runAttempt.usage?.reportedCostUsd !== undefined
        ? { reportedCostUsd: runAttempt.usage.reportedCostUsd }
        : {}),
      ...(runAttempt.usage?.estimatedCostUsd !== undefined
        ? { estimatedCostUsd: runAttempt.usage.estimatedCostUsd }
        : {}),
      ...(runAttempt.usage?.latestPromptTokens !== undefined
        ? { latestPromptTokens: runAttempt.usage.latestPromptTokens }
        : {}),
      ...(runAttempt.meta.durationMs !== undefined ? { durationMs: runAttempt.meta.durationMs } : {}),
      createdAt: runAttempt.meta.createdAt,
      updatedAt: runAttempt.meta.updatedAt,
      ...(runAttempt.meta.success !== undefined ? { success: runAttempt.meta.success } : {}),
      ...(runAttempt.meta.error !== undefined ? { error: runAttempt.meta.error } : {}),
    };
  }

  private publish(event: RunObserverSseEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const subscriber of this.subscribers) {
      try {
        if (subscriber.writableEnded || subscriber.destroyed) {
          this.subscribers.delete(subscriber);
          continue;
        }
        subscriber.write(payload);
      } catch {
        this.subscribers.delete(subscriber);
      }
    }
  }

  private runAttemptsRootDir(): string {
    return path.join(this.rootDir, "run-attempts");
  }

  private indexDir(): string {
    return path.join(this.rootDir, "indexes");
  }

  private recentIndexPath(): string {
    return path.join(this.indexDir(), "recent.json");
  }

  private accessFilePath(): string {
    return path.join(this.rootDir, "access.json");
  }

  private schemaVersionFilePath(): string {
    return path.join(this.rootDir, "schema-version.json");
  }

  private runAttemptFilePath(storageDay: string, runAttemptId: string): string {
    return path.join(this.runAttemptsRootDir(), storageDay, `${runAttemptId}.json`);
  }
}
