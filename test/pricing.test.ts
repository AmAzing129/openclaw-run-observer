import { describe, expect, it } from "vitest";
import {
  extractCostFromLastAssistant,
  estimateCostUsd,
  resolveModelPricing,
  resolveModelPricingFromConfig,
} from "../src/pricing.js";

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
    // (1000*3 + 500*15 + 200*0.3 + 100*3.75) / 1_000_000
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
  it("uses built-in gpt-5.4 fallback pricing regardless of provider", () => {
    const pricing = resolveModelPricing({ provider: "openai", model: "gpt-5.4" });
    expect(pricing).toEqual({ input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 });
  });

  it("uses built-in Opus 4.6 fallback pricing for provider-specific aliases", () => {
    const cliPricing = resolveModelPricing({ provider: "claude-cli", model: "opus-4.6" });
    expect(cliPricing).toEqual({ input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });

    const gatewayPricing = resolveModelPricing({
      provider: "vercel-ai-gateway",
      model: "anthropic/claude-opus-4.6",
    });
    expect(gatewayPricing).toEqual({ input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });
  });

  it("uses built-in Sonnet 4.6 fallback pricing for provider-specific aliases", () => {
    const cliPricing = resolveModelPricing({ provider: "claude-cli", model: "sonnet-4.6" });
    expect(cliPricing).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });

    const gatewayPricing = resolveModelPricing({
      provider: "vercel-ai-gateway",
      model: "anthropic/claude-sonnet-4.6",
    });
    expect(gatewayPricing).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
  });

  it("prefers configured pricing over built-in fallback aliases", () => {
    const config = {
      models: {
        providers: {
          anthropic: {
            models: [
              {
                id: "claude-opus-4-6",
                name: "Claude Opus 4.6",
                cost: { input: 8, output: 40, cacheRead: 0.8, cacheWrite: 10 },
              },
            ],
          },
        },
      },
    };

    const pricing = resolveModelPricing({
      config,
      provider: "anthropic",
      model: "opus-4.6",
    });
    expect(pricing).toEqual({ input: 8, output: 40, cacheRead: 0.8, cacheWrite: 10 });
  });
});
