import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetPricingCachesForTest,
  estimateCostUsd,
  extractCostFromAssistantMessages,
  extractCostFromLastAssistant,
  resolveModelPricing,
  resolveModelPricingFromConfig,
} from "../src/pricing.js";

const cleanupDirs = new Set<string>();

afterEach(async () => {
  __resetPricingCachesForTest();
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.clear();
});

describe("extractCostFromLastAssistant", () => {
  it("returns total when present", () => {
    expect(extractCostFromLastAssistant({ usage: { cost: { total: 0.0042 } } })).toBe(0.0042);
  });

  it("sums individual cost fields when total is absent", () => {
    const result = extractCostFromLastAssistant({
      usage: { cost: { input: 0.001, output: 0.002, cacheRead: 0.0005 } },
    });
    expect(result).toBeCloseTo(0.0035);
  });

  it("returns undefined for missing cost", () => {
    expect(extractCostFromLastAssistant({ usage: { input: 100 } })).toBeUndefined();
  });

  it("returns undefined for non-object input", () => {
    expect(extractCostFromLastAssistant(null)).toBeUndefined();
    expect(extractCostFromLastAssistant("string")).toBeUndefined();
    expect(extractCostFromLastAssistant(undefined)).toBeUndefined();
  });

  it("ignores negative total", () => {
    expect(extractCostFromLastAssistant({ usage: { cost: { total: -1 } } })).toBeUndefined();
  });
});

describe("extractCostFromAssistantMessages", () => {
  it("sums reported costs across assistant messages", () => {
    const result = extractCostFromAssistantMessages([
      { role: "assistant", usage: { cost: { total: 0.0063 } } },
      { role: "tool", usage: { cost: { total: 99 } } },
      { role: "assistant", usage: { cost: { input: 0.001, output: 0.0025 } } },
    ]);

    expect(result).toBeCloseTo(0.0098);
  });

  it("can skip earlier transcript messages", () => {
    const result = extractCostFromAssistantMessages(
      [
        { role: "assistant", usage: { cost: { total: 0.0558425 } } },
        { role: "toolResult" },
        { role: "user" },
        { role: "assistant", usage: { cost: { total: 0.0093375 } } },
      ],
      { startIndex: 2 },
    );

    expect(result).toBeCloseTo(0.0093375);
  });

  it("returns undefined when no assistant message includes reported cost", () => {
    expect(
      extractCostFromAssistantMessages([
        { role: "user", usage: { cost: { total: 1 } } },
        { role: "assistant", usage: { input: 100 } },
      ]),
    ).toBeUndefined();
  });
});

describe("resolveModelPricingFromConfig", () => {
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
        openai: {
          models: [
            {
              id: "gpt-5.4",
              name: "GPT 5.4",
              cost: { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 0 },
            },
          ],
        },
      },
    },
  };

  it("finds pricing for a known model", () => {
    const pricing = resolveModelPricingFromConfig(config, "anthropic", "claude-sonnet-4");
    expect(pricing).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
  });

  it("matches case-insensitively", () => {
    const pricing = resolveModelPricingFromConfig(config, "OpenAI", "GPT-5.4");
    expect(pricing).toEqual({ input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 0 });
  });

  it("returns undefined for unknown model", () => {
    expect(resolveModelPricingFromConfig(config, "anthropic", "unknown-model")).toBeUndefined();
  });

  it("returns undefined for unknown provider", () => {
    expect(resolveModelPricingFromConfig(config, "cohere", "command-r")).toBeUndefined();
  });

  it("returns undefined for null config", () => {
    expect(resolveModelPricingFromConfig(null, "anthropic", "claude-sonnet-4")).toBeUndefined();
  });

  it("returns undefined when cost fields are missing", () => {
    const badConfig = {
      models: {
        providers: {
          test: { models: [{ id: "m", name: "M", cost: {} }] },
        },
      },
    };
    expect(resolveModelPricingFromConfig(badConfig, "test", "m")).toBeUndefined();
  });
});

describe("estimateCostUsd", () => {
  const pricing = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };

  it("calculates cost per million tokens", () => {
    const result = estimateCostUsd(
      { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100 },
      pricing,
    );
    expect(result).toBeCloseTo(0.010935);
  });

  it("returns undefined when all usage is zero", () => {
    expect(estimateCostUsd({ input: 0, output: 0 }, pricing)).toBeUndefined();
  });

  it("handles missing usage fields as zero", () => {
    const result = estimateCostUsd({ output: 1_000_000 }, pricing);
    expect(result).toBeCloseTo(15);
  });
});

describe("resolveModelPricing", () => {
  it("prefers models.json pricing over config and openrouter fallback", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-pricing-state-"));
    cleanupDirs.add(stateDir);
    const cacheFilePath = path.join(stateDir, "indexes", "openrouter-pricing.json");
    await fs.mkdir(path.join(stateDir, "agents", "main", "agent"), { recursive: true });
    await fs.writeFile(
      path.join(stateDir, "agents", "main", "agent", "models.json"),
      JSON.stringify({
        providers: {
          openai: {
            models: [
              {
                id: "gpt-5.4",
                cost: { input: 7, output: 8, cacheRead: 0.7, cacheWrite: 0.8 },
              },
            ],
          },
        },
      }),
    );

    let fetchCalls = 0;
    const pricing = await resolveModelPricing({
      stateDir,
      cacheFilePath,
      config: {
        models: {
          providers: {
            openai: {
              models: [
                {
                  id: "gpt-5.4",
                  cost: { input: 3, output: 4, cacheRead: 0.3, cacheWrite: 0.4 },
                },
              ],
            },
          },
        },
      },
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 1, output: 1 },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("should not fetch when local pricing exists");
      },
    });

    expect(pricing).toEqual({ input: 7, output: 8, cacheRead: 0.7, cacheWrite: 0.8 });
    expect(fetchCalls).toBe(0);
  });

  it("uses openrouter pricing when local sources omit model cost", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-openrouter-"));
    cleanupDirs.add(rootDir);
    const pricing = await resolveModelPricing({
      provider: "openai-codex",
      model: "gpt-5.4",
      cacheFilePath: path.join(rootDir, "indexes", "openrouter-pricing.json"),
      usage: { input: 1000, output: 500, cacheRead: 200 },
      fetchImpl: createOpenRouterFetch([
        {
          id: "openai/gpt-5.4",
          pricing: {
            prompt: "0.0000025",
            completion: "0.000015",
            input_cache_read: "0.00000025",
          },
        },
      ]),
    });

    expect(pricing).toEqual({
      input: 2.5,
      output: 15,
      cacheRead: 0.25,
      cacheWrite: 0,
    });
  });

  it("matches wrapper provider refs against openrouter pricing", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-wrapper-"));
    cleanupDirs.add(rootDir);
    const pricing = await resolveModelPricing({
      provider: "vercel-ai-gateway",
      model: "anthropic/claude-opus-4.6",
      cacheFilePath: path.join(rootDir, "indexes", "openrouter-pricing.json"),
      usage: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100 },
      fetchImpl: createOpenRouterFetch([
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
    });

    expect(pricing).toEqual({
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite: 6.25,
    });
  });

  it("reads fresh openrouter pricing from cache without fetching", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-cache-fresh-"));
    cleanupDirs.add(rootDir);
    const cacheFilePath = path.join(rootDir, "indexes", "openrouter-pricing.json");
    await writeOpenRouterCache(cacheFilePath, {
      cachedAt: Date.now(),
      models: {
        "openai/gpt-5.4": { input: 2.5, output: 15, cacheRead: 0.25 },
      },
    });

    let fetchCalls = 0;
    const pricing = await resolveModelPricing({
      provider: "openai",
      model: "gpt-5.4",
      cacheFilePath,
      usage: { input: 1, output: 1, cacheRead: 1 },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("should not fetch while cache is fresh");
      },
    });

    expect(pricing).toEqual({
      input: 2.5,
      output: 15,
      cacheRead: 0.25,
      cacheWrite: 0,
    });
    expect(fetchCalls).toBe(0);
  });

  it("refreshes stale openrouter cache and persists the updated pricing", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-cache-stale-"));
    cleanupDirs.add(rootDir);
    const cacheFilePath = path.join(rootDir, "indexes", "openrouter-pricing.json");
    await writeOpenRouterCache(cacheFilePath, {
      cachedAt: 1,
      models: {
        "openai/gpt-5.4": { input: 1, output: 2 },
      },
    });

    const pricing = await resolveModelPricing({
      provider: "openai",
      model: "gpt-5.4",
      cacheFilePath,
      usage: { input: 1, output: 1 },
      fetchImpl: createOpenRouterFetch([
        {
          id: "openai/gpt-5.4",
          pricing: {
            prompt: "0.0000025",
            completion: "0.000015",
          },
        },
      ]),
    });

    expect(pricing).toEqual({
      input: 2.5,
      output: 15,
      cacheRead: 0,
      cacheWrite: 0,
    });

    const stored = JSON.parse(await fs.readFile(cacheFilePath, "utf8")) as {
      cachedAt: number;
      models: Record<string, { input: number; output: number }>;
    };
    expect(stored.cachedAt).toBeGreaterThan(1);
    expect(stored.models["openai/gpt-5.4"]).toEqual({
      input: 2.5,
      output: 15,
    });
  });

  it("falls back to stale cache when the openrouter refresh fails", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-cache-fallback-"));
    cleanupDirs.add(rootDir);
    const cacheFilePath = path.join(rootDir, "indexes", "openrouter-pricing.json");
    await writeOpenRouterCache(cacheFilePath, {
      cachedAt: 1,
      models: {
        "openai/gpt-5.4": { input: 2.5, output: 15, cacheRead: 0.25 },
      },
    });

    const pricing = await resolveModelPricing({
      provider: "openai-codex",
      model: "gpt-5.4",
      cacheFilePath,
      usage: { input: 1, output: 1, cacheRead: 1 },
      fetchImpl: async () => {
        throw new Error("openrouter down");
      },
    });

    expect(pricing).toEqual({
      input: 2.5,
      output: 15,
      cacheRead: 0.25,
      cacheWrite: 0,
    });
  });

  it("returns undefined when openrouter refresh fails and no cache exists", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-cache-miss-"));
    cleanupDirs.add(rootDir);
    const pricing = await resolveModelPricing({
      provider: "openai",
      model: "gpt-5.4",
      cacheFilePath: path.join(rootDir, "indexes", "openrouter-pricing.json"),
      usage: { input: 1, output: 1 },
      fetchImpl: async () => {
        throw new Error("openrouter down");
      },
    });

    expect(pricing).toBeUndefined();
  });

  it("skips openrouter refresh when remote refresh is disabled", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-cache-local-only-"));
    cleanupDirs.add(rootDir);
    let fetchCalls = 0;
    const pricing = await resolveModelPricing({
      provider: "openai",
      model: "gpt-5.4",
      cacheFilePath: path.join(rootDir, "indexes", "openrouter-pricing.json"),
      usage: { input: 1, output: 1 },
      allowRemoteRefresh: false,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("should not fetch when remote refresh is disabled");
      },
    });

    expect(pricing).toBeUndefined();
    expect(fetchCalls).toBe(0);
  });

  it("requires cache write pricing when the usage includes cache write tokens", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-observer-cache-write-"));
    cleanupDirs.add(rootDir);
    const pricing = await resolveModelPricing({
      provider: "openai",
      model: "gpt-5.4",
      cacheFilePath: path.join(rootDir, "indexes", "openrouter-pricing.json"),
      usage: { input: 1, output: 1, cacheWrite: 1 },
      fetchImpl: createOpenRouterFetch([
        {
          id: "openai/gpt-5.4",
          pricing: {
            prompt: "0.0000025",
            completion: "0.000015",
          },
        },
      ]),
    });

    expect(pricing).toBeUndefined();
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

async function writeOpenRouterCache(
  cacheFilePath: string,
  value: {
    cachedAt: number;
    models: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }>;
  },
): Promise<void> {
  await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
  await fs.writeFile(cacheFilePath, JSON.stringify(value));
}
