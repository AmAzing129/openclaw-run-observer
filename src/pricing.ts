import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { modelKey, normalizeModelRef, normalizeProviderId } from "openclaw/plugin-sdk/agent-runtime";
import { asFiniteNumber } from "./utils.js";

export type ModelPricing = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

type ModelsJsonCostCache = {
  path: string;
  mtimeMs: number;
  providers: Record<string, unknown> | undefined;
  normalizedEntries: Map<string, ModelPricing> | null;
  rawEntries: Map<string, ModelPricing> | null;
};

type BuiltInFallbackPricingEntry = {
  aliases: readonly string[];
  pricing: ModelPricing;
};

let modelsJsonCostCache: ModelsJsonCostCache | null = null;

const BUILT_IN_FALLBACK_PRICING_BY_MODEL = buildBuiltInFallbackPricingIndex([
  {
    aliases: ["gpt-5.4"],
    pricing: {
      input: 2.5,
      output: 15,
      cacheRead: 0.25,
      cacheWrite: 0,
    },
  },
  {
    aliases: ["claude-opus-4-6", "claude-opus-4.6", "opus-4.6", "opus-4-6"],
    pricing: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite: 6.25,
    },
  },
  {
    aliases: ["claude-sonnet-4-6", "claude-sonnet-4.6", "sonnet-4.6", "sonnet-4-6"],
    pricing: {
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite: 3.75,
    },
  },
]);

export function extractCostFromLastAssistant(lastAssistant: unknown): number | undefined {
  if (!lastAssistant || typeof lastAssistant !== "object" || Array.isArray(lastAssistant)) {
    return undefined;
  }
  const usage = (lastAssistant as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return undefined;
  }
  const cost = (usage as { cost?: unknown }).cost;
  if (!cost || typeof cost !== "object" || Array.isArray(cost)) {
    return undefined;
  }
  const total = asFiniteNumber((cost as { total?: unknown }).total);
  if (total !== undefined && total >= 0) {
    return total;
  }
  const input = asFiniteNumber((cost as { input?: unknown }).input) ?? 0;
  const output = asFiniteNumber((cost as { output?: unknown }).output) ?? 0;
  const cacheRead = asFiniteNumber((cost as { cacheRead?: unknown }).cacheRead) ?? 0;
  const cacheWrite = asFiniteNumber((cost as { cacheWrite?: unknown }).cacheWrite) ?? 0;
  const sum = input + output + cacheRead + cacheWrite;
  return sum > 0 ? sum : undefined;
}

export function resolveModelPricingFromConfig(
  config: unknown,
  provider: string,
  model: string,
  options?: { allowPluginNormalization?: boolean },
): ModelPricing | undefined {
  const key = toResolvedModelKey(provider, model, options?.allowPluginNormalization);
  if (!key) {
    return undefined;
  }
  const pricing = lookupPricing(
    buildProviderCostIndex(
      resolveConfigProviders(config),
      options?.allowPluginNormalization !== undefined
        ? { allowPluginNormalization: options.allowPluginNormalization }
        : undefined,
    ),
    key,
  );
  return clonePricing(pricing);
}

export function resolveModelPricing(params: {
  config?: unknown;
  provider: string;
  model: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): ModelPricing | undefined {
  const rawKey = toDirectModelKey(params.provider, params.model);
  if (!rawKey) {
    return undefined;
  }

  const rawModelsJsonCost = lookupPricing(
    loadModelsJsonCostIndex({
      ...(params.stateDir !== undefined ? { stateDir: params.stateDir } : {}),
      ...(params.env !== undefined ? { env: params.env } : {}),
      allowPluginNormalization: false,
    }),
    rawKey,
  );
  if (rawModelsJsonCost) {
    return clonePricing(rawModelsJsonCost);
  }

  const rawConfiguredCost = resolveModelPricingFromConfig(params.config, params.provider, params.model, {
    allowPluginNormalization: false,
  });
  if (rawConfiguredCost) {
    return rawConfiguredCost;
  }

  if (shouldUseNormalizedCostLookup(params.provider, params.model)) {
    const normalizedKey = toResolvedModelKey(params.provider, params.model, true);
    if (normalizedKey && normalizedKey !== rawKey) {
      const modelsJsonCost = lookupPricing(
        loadModelsJsonCostIndex({
          ...(params.stateDir !== undefined ? { stateDir: params.stateDir } : {}),
          ...(params.env !== undefined ? { env: params.env } : {}),
        }),
        normalizedKey,
      );
      if (modelsJsonCost) {
        return clonePricing(modelsJsonCost);
      }

      const configuredCost = resolveModelPricingFromConfig(params.config, params.provider, params.model);
      if (configuredCost) {
        return configuredCost;
      }
    }
  }

  return resolveBuiltInFallbackPricing(params.provider, params.model);
}

export function estimateCostUsd(
  usage: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number },
  pricing: ModelPricing,
): number | undefined {
  const input = asFiniteNumber(usage.input) ?? 0;
  const output = asFiniteNumber(usage.output) ?? 0;
  const cacheRead = asFiniteNumber(usage.cacheRead) ?? 0;
  const cacheWrite = asFiniteNumber(usage.cacheWrite) ?? 0;
  const total =
    input * pricing.input +
    output * pricing.output +
    cacheRead * pricing.cacheRead +
    cacheWrite * pricing.cacheWrite;
  if (!Number.isFinite(total) || total <= 0) {
    return undefined;
  }
  return total / 1_000_000;
}

function clonePricing(pricing: ModelPricing | undefined): ModelPricing | undefined {
  return pricing ? { ...pricing } : undefined;
}

function lookupPricing(map: Map<string, ModelPricing>, key: string): ModelPricing | undefined {
  return map.get(key) ?? map.get(key.toLowerCase());
}

function buildBuiltInFallbackPricingIndex(
  entries: readonly BuiltInFallbackPricingEntry[],
): Map<string, ModelPricing> {
  const index = new Map<string, ModelPricing>();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const normalizedAlias = alias.trim().toLowerCase();
      if (!normalizedAlias) {
        continue;
      }
      index.set(normalizedAlias, entry.pricing);
    }
  }
  return index;
}

function resolveBuiltInFallbackPricing(provider: string, model: string): ModelPricing | undefined {
  for (const candidate of collectBuiltInFallbackModelCandidates(provider, model)) {
    const pricing = BUILT_IN_FALLBACK_PRICING_BY_MODEL.get(candidate.toLowerCase());
    if (pricing) {
      return clonePricing(pricing);
    }
  }
  return undefined;
}

function collectBuiltInFallbackModelCandidates(provider: string, model: string): string[] {
  const trimmedProvider = provider.trim();
  const trimmedModel = model.trim();
  if (!trimmedProvider || !trimmedModel) {
    return [];
  }
  const candidates = new Set<string>();
  addBuiltInFallbackModelCandidates(candidates, trimmedModel);
  const normalized = normalizeModelRef(trimmedProvider, trimmedModel);
  addBuiltInFallbackModelCandidates(candidates, normalized.model);
  return [...candidates];
}

function addBuiltInFallbackModelCandidates(candidates: Set<string>, model: string): void {
  let current = model.trim();
  while (current) {
    candidates.add(current);
    const slashIndex = current.indexOf("/");
    if (slashIndex === -1) {
      break;
    }
    current = current.slice(slashIndex + 1).trim();
  }
}

function toDirectModelKey(provider: string, model: string): string | null {
  const normalizedProvider = normalizeProviderId(provider.trim());
  const trimmedModel = model.trim();
  if (!normalizedProvider || !trimmedModel) {
    return null;
  }
  return modelKey(normalizedProvider, trimmedModel);
}

function toResolvedModelKey(
  provider: string,
  model: string,
  allowPluginNormalization = true,
): string | null {
  const trimmedProvider = provider.trim();
  const trimmedModel = model.trim();
  if (!trimmedProvider || !trimmedModel) {
    return null;
  }
  const normalized = normalizeModelRef(
    trimmedProvider,
    trimmedModel,
    allowPluginNormalization ? undefined : { allowPluginNormalization: false },
  );
  return modelKey(normalized.provider, normalized.model);
}

function shouldUseNormalizedCostLookup(provider: string, model: string): boolean {
  const normalizedProvider = normalizeProviderId(provider.trim());
  const trimmedModel = model.trim();
  if (!normalizedProvider || !trimmedModel) {
    return false;
  }
  return (
    normalizedProvider === "anthropic" ||
    normalizedProvider === "openrouter" ||
    normalizedProvider === "vercel-ai-gateway"
  );
}

function resolveConfigProviders(config: unknown): Record<string, unknown> | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }
  const models = (config as { models?: unknown }).models;
  if (!models || typeof models !== "object") {
    return undefined;
  }
  const providers = (models as { providers?: unknown }).providers;
  if (!providers || typeof providers !== "object") {
    return undefined;
  }
  return providers as Record<string, unknown>;
}

function buildProviderCostIndex(
  providers: Record<string, unknown> | undefined,
  options?: { allowPluginNormalization?: boolean },
): Map<string, ModelPricing> {
  const entries = new Map<string, ModelPricing>();
  if (!providers) {
    return entries;
  }
  for (const [providerKey, providerConfig] of Object.entries(providers)) {
    if (!providerConfig || typeof providerConfig !== "object") {
      continue;
    }
    const models = (providerConfig as { models?: unknown }).models;
    if (!Array.isArray(models)) {
      continue;
    }
    const normalizedProvider = normalizeProviderId(providerKey);
    if (!normalizedProvider) {
      continue;
    }
    for (const model of models) {
      if (!model || typeof model !== "object") {
        continue;
      }
      const id = (model as { id?: unknown }).id;
      if (typeof id !== "string" || !id.trim()) {
        continue;
      }
      const pricing = readModelPricing((model as { cost?: unknown }).cost);
      if (!pricing) {
        continue;
      }
      const normalized = normalizeModelRef(
        normalizedProvider,
        id,
        options?.allowPluginNormalization === false
          ? { allowPluginNormalization: false }
          : undefined,
      );
      entries.set(modelKey(normalized.provider, normalized.model), pricing);
    }
  }
  return entries;
}

function loadModelsJsonCostIndex(options: {
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  allowPluginNormalization?: boolean;
}): Map<string, ModelPricing> {
  const agentDir = resolveOpenClawAgentDir(options.stateDir, options.env);
  if (!agentDir) {
    return new Map();
  }
  const modelsPath = path.join(agentDir, "models.json");
  const useRawEntries = options.allowPluginNormalization === false;
  try {
    const stat = fs.statSync(modelsPath);
    if (
      !modelsJsonCostCache ||
      modelsJsonCostCache.path !== modelsPath ||
      modelsJsonCostCache.mtimeMs !== stat.mtimeMs
    ) {
      const parsed = JSON.parse(fs.readFileSync(modelsPath, "utf8")) as { providers?: unknown };
      modelsJsonCostCache = {
        path: modelsPath,
        mtimeMs: stat.mtimeMs,
        providers:
          parsed.providers && typeof parsed.providers === "object"
            ? (parsed.providers as Record<string, unknown>)
            : undefined,
        normalizedEntries: null,
        rawEntries: null,
      };
    }
    if (useRawEntries) {
      modelsJsonCostCache.rawEntries ??= buildProviderCostIndex(modelsJsonCostCache.providers, {
        allowPluginNormalization: false,
      });
      return modelsJsonCostCache.rawEntries;
    }
    modelsJsonCostCache.normalizedEntries ??= buildProviderCostIndex(modelsJsonCostCache.providers);
    return modelsJsonCostCache.normalizedEntries;
  } catch {
    const empty = new Map<string, ModelPricing>();
    modelsJsonCostCache = {
      path: modelsPath,
      mtimeMs: -1,
      providers: undefined,
      normalizedEntries: empty,
      rawEntries: empty,
    };
    return empty;
  }
}

function resolveOpenClawAgentDir(
  stateDir: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const override = env.OPENCLAW_AGENT_DIR?.trim() || env.PI_CODING_AGENT_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env);
  }
  const trimmedStateDir = stateDir?.trim();
  if (!trimmedStateDir) {
    return undefined;
  }
  return path.join(resolveUserPath(trimmedStateDir, env), "agents", "main", "agent");
}

function resolveUserPath(value: string, env: NodeJS.ProcessEnv): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  const homeDir = env.HOME?.trim() || os.homedir();
  if (trimmed === "~") {
    return homeDir;
  }
  if (trimmed.startsWith("~/")) {
    return path.join(homeDir, trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function readModelPricing(value: unknown): ModelPricing | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const input = asFiniteNumber((value as { input?: unknown }).input);
  const output = asFiniteNumber((value as { output?: unknown }).output);
  if (input === undefined || output === undefined) {
    return undefined;
  }
  return {
    input,
    output,
    cacheRead: asFiniteNumber((value as { cacheRead?: unknown }).cacheRead) ?? 0,
    cacheWrite: asFiniteNumber((value as { cacheWrite?: unknown }).cacheWrite) ?? 0,
  };
}
