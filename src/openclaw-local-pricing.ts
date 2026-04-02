import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { modelKey, normalizeModelRef, normalizeProviderId } from "openclaw/plugin-sdk/agent-runtime";
import { asFiniteNumber } from "./utils.js";
import type { ModelPricing } from "./pricing.js";

type ModelsJsonCostCache = {
  path: string;
  mtimeMs: number;
  providers: Record<string, unknown> | undefined;
  normalizedEntries: Map<string, ModelPricing> | null;
  rawEntries: Map<string, ModelPricing> | null;
};

let modelsJsonCostCache: ModelsJsonCostCache | null = null;

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

export function resolveModelPricingFromOpenClawLocal(params: {
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

  return undefined;
}

export function __resetOpenClawLocalPricingCachesForTest(): void {
  modelsJsonCostCache = null;
}

function clonePricing(pricing: ModelPricing | undefined): ModelPricing | undefined {
  return pricing ? { ...pricing } : undefined;
}

function lookupPricing(map: Map<string, ModelPricing>, key: string): ModelPricing | undefined {
  return map.get(key) ?? map.get(key.toLowerCase());
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
