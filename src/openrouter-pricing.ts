import fsPromises from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PROVIDER,
  normalizeModelRef,
  normalizeProviderId,
  parseModelRef,
} from "openclaw/plugin-sdk/agent-runtime";
import {
  readJsonFileWithFallback,
  writeJsonFileAtomically,
} from "openclaw/plugin-sdk/json-store";
import { asFiniteNumber } from "./utils.js";
import type { ModelPricing } from "./pricing.js";

type OpenRouterModelPricing = {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
};

type OpenRouterPricingCacheFile = {
  cachedAt: number;
  models: Record<string, OpenRouterModelPricing>;
};

type OpenRouterPricingCacheState = {
  path: string;
  mtimeMs: number;
  value: OpenRouterPricingCacheFile | null;
};

const openRouterPricingCacheByPath = new Map<string, OpenRouterPricingCacheState>();
const openRouterRefreshByPath = new Map<string, Promise<OpenRouterPricingCacheFile | null>>();

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_CACHE_TTL_MS = 24 * 60 * 60_000;
const OPENROUTER_FETCH_TIMEOUT_MS = 15_000;
const WRAPPER_PROVIDERS = new Set([
  "cloudflare-ai-gateway",
  "kilocode",
  "openrouter",
  "vercel-ai-gateway",
]);
const PROVIDER_ALIAS_TO_OPENROUTER: Record<string, string> = {
  "claude-cli": "anthropic",
  "google-gemini-cli": "google",
  kimi: "moonshotai",
  "kimi-coding": "moonshotai",
  moonshot: "moonshotai",
  moonshotai: "moonshotai",
  "openai-codex": "openai",
  xai: "x-ai",
  zai: "z-ai",
};

export async function resolveModelPricingFromOpenRouter(params: {
  provider: string;
  model: string;
  cacheFilePath?: string;
  fetchImpl?: typeof fetch;
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  allowRemoteRefresh?: boolean;
}): Promise<ModelPricing | undefined> {
  const cacheFilePath = trimOptionalPath(params.cacheFilePath);
  if (!cacheFilePath) {
    return undefined;
  }

  const cached = await loadOpenRouterPricingCacheFile(cacheFilePath);
  if (cached && !isOpenRouterCacheExpired(cached.cachedAt)) {
    return resolveModelPricingFromOpenRouterCache(cached.models, params.provider, params.model, params.usage);
  }

  if (params.allowRemoteRefresh === false) {
    return cached
      ? resolveModelPricingFromOpenRouterCache(cached.models, params.provider, params.model, params.usage)
      : undefined;
  }

  const refreshed = await refreshOpenRouterPricingCache({
    cacheFilePath,
    ...(params.fetchImpl !== undefined ? { fetchImpl: params.fetchImpl } : {}),
  });
  if (refreshed) {
    const refreshedPricing = resolveModelPricingFromOpenRouterCache(
      refreshed.models,
      params.provider,
      params.model,
      params.usage,
    );
    if (refreshedPricing) {
      return refreshedPricing;
    }
  }

  return cached
    ? resolveModelPricingFromOpenRouterCache(cached.models, params.provider, params.model, params.usage)
    : undefined;
}

export function __resetOpenRouterPricingCachesForTest(): void {
  openRouterPricingCacheByPath.clear();
  openRouterRefreshByPath.clear();
}

function resolveModelPricingFromOpenRouterCache(
  models: Record<string, OpenRouterModelPricing>,
  provider: string,
  model: string,
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number },
): ModelPricing | undefined {
  for (const candidate of buildOpenRouterLookupCandidates(provider, model)) {
    const pricing = models[candidate];
    if (!pricing) {
      continue;
    }
    const resolved = finalizeOpenRouterPricing(pricing, usage);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function finalizeOpenRouterPricing(
  pricing: OpenRouterModelPricing,
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number },
): ModelPricing | undefined {
  if (usesTokenBucket(usage?.input) && !Number.isFinite(pricing.input)) {
    return undefined;
  }
  if (usesTokenBucket(usage?.output) && !Number.isFinite(pricing.output)) {
    return undefined;
  }
  if (usesTokenBucket(usage?.cacheRead) && pricing.cacheRead === undefined) {
    return undefined;
  }
  if (usesTokenBucket(usage?.cacheWrite) && pricing.cacheWrite === undefined) {
    return undefined;
  }
  return {
    input: pricing.input,
    output: pricing.output,
    cacheRead: pricing.cacheRead ?? 0,
    cacheWrite: pricing.cacheWrite ?? 0,
  };
}

function usesTokenBucket(value: number | undefined): boolean {
  return (asFiniteNumber(value) ?? 0) > 0;
}

function isOpenRouterCacheExpired(cachedAt: number): boolean {
  return !Number.isFinite(cachedAt) || Date.now() - cachedAt >= OPENROUTER_CACHE_TTL_MS;
}

async function refreshOpenRouterPricingCache(params: {
  cacheFilePath: string;
  fetchImpl?: typeof fetch;
}): Promise<OpenRouterPricingCacheFile | null> {
  const existing = openRouterRefreshByPath.get(params.cacheFilePath);
  if (existing) {
    return await existing;
  }

  const refreshPromise = (async () => {
    try {
      const models = await fetchOpenRouterPricingCatalog(params.fetchImpl ?? fetch);
      const next = {
        cachedAt: Date.now(),
        models,
      } satisfies OpenRouterPricingCacheFile;
      await fsPromises.mkdir(path.dirname(params.cacheFilePath), { recursive: true, mode: 0o700 });
      await writeJsonFileAtomically(params.cacheFilePath, next);
      const stat = await fsPromises.stat(params.cacheFilePath);
      openRouterPricingCacheByPath.set(params.cacheFilePath, {
        path: params.cacheFilePath,
        mtimeMs: stat.mtimeMs,
        value: next,
      });
      return next;
    } catch {
      return null;
    }
  })();

  openRouterRefreshByPath.set(params.cacheFilePath, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    openRouterRefreshByPath.delete(params.cacheFilePath);
  }
}

async function loadOpenRouterPricingCacheFile(cacheFilePath: string): Promise<OpenRouterPricingCacheFile | null> {
  try {
    const stat = await fsPromises.stat(cacheFilePath);
    const cached = openRouterPricingCacheByPath.get(cacheFilePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.value;
    }
    const loaded = await readJsonFileWithFallback<unknown | null>(cacheFilePath, null);
    const parsed = readOpenRouterPricingCacheFile(loaded.value);
    openRouterPricingCacheByPath.set(cacheFilePath, {
      path: cacheFilePath,
      mtimeMs: stat.mtimeMs,
      value: parsed,
    });
    return parsed;
  } catch {
    openRouterPricingCacheByPath.delete(cacheFilePath);
    return null;
  }
}

async function fetchOpenRouterPricingCatalog(
  fetchImpl: typeof fetch,
): Promise<Record<string, OpenRouterModelPricing>> {
  const response = await fetchImpl(OPENROUTER_MODELS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(OPENROUTER_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter /models failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: unknown };
  const entries = Array.isArray(payload.data) ? payload.data : [];
  const models: Record<string, OpenRouterModelPricing> = {};
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const id = trimString((entry as { id?: unknown }).id);
    if (!id) {
      continue;
    }
    const pricing = readOpenRouterModelPricing((entry as { pricing?: unknown }).pricing);
    if (!pricing) {
      continue;
    }
    for (const key of collectOpenRouterCacheKeys(id)) {
      models[key] = pricing;
    }
  }
  return models;
}

function readOpenRouterPricingCacheFile(value: unknown): OpenRouterPricingCacheFile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const cachedAt = asFiniteNumber((value as { cachedAt?: unknown }).cachedAt);
  const rawModels = (value as { models?: unknown }).models;
  if (cachedAt === undefined || !rawModels || typeof rawModels !== "object" || Array.isArray(rawModels)) {
    return null;
  }
  const models: Record<string, OpenRouterModelPricing> = {};
  for (const [key, entry] of Object.entries(rawModels)) {
    const pricing = readCachedOpenRouterModelPricing(entry);
    if (!pricing) {
      continue;
    }
    models[key.toLowerCase()] = pricing;
  }
  return {
    cachedAt,
    models,
  };
}

function readCachedOpenRouterModelPricing(value: unknown): OpenRouterModelPricing | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const input = asFiniteNumber((value as { input?: unknown }).input);
  const output = asFiniteNumber((value as { output?: unknown }).output);
  if (input === undefined || output === undefined) {
    return undefined;
  }
  const cacheRead = asFiniteNumber((value as { cacheRead?: unknown }).cacheRead);
  const cacheWrite = asFiniteNumber((value as { cacheWrite?: unknown }).cacheWrite);
  return {
    input,
    output,
    ...(cacheRead !== undefined ? { cacheRead } : {}),
    ...(cacheWrite !== undefined ? { cacheWrite } : {}),
  };
}

function readOpenRouterModelPricing(value: unknown): OpenRouterModelPricing | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const pricing = value as Record<string, unknown>;
  const input = toPricePerMillion(parseNumberString(pricing.prompt));
  const output = toPricePerMillion(parseNumberString(pricing.completion));
  if (input === undefined || output === undefined) {
    return undefined;
  }
  const cacheRead = toPricePerMillion(parseNumberString(pricing.input_cache_read));
  const cacheWrite = toPricePerMillion(parseNumberString(pricing.input_cache_write));
  return {
    input,
    output,
    ...(cacheRead !== undefined ? { cacheRead } : {}),
    ...(cacheWrite !== undefined ? { cacheWrite } : {}),
  };
}

function collectOpenRouterCacheKeys(id: string): string[] {
  const keys = new Set<string>();
  const trimmed = id.trim();
  if (!trimmed) {
    return [];
  }
  keys.add(trimmed.toLowerCase());
  const canonical = canonicalizeOpenRouterLookupId(trimmed);
  if (canonical) {
    keys.add(canonical.toLowerCase());
  }
  return [...keys];
}

function buildOpenRouterLookupCandidates(provider: string, model: string): string[] {
  const candidates = new Set<string>();
  collectOpenRouterLookupCandidates(candidates, provider, model, new Set<string>());
  return [...candidates];
}

function collectOpenRouterLookupCandidates(
  candidates: Set<string>,
  provider: string,
  model: string,
  seen: Set<string>,
): void {
  const trimmedProvider = provider.trim();
  const trimmedModel = model.trim();
  if (!trimmedProvider || !trimmedModel) {
    return;
  }
  const seenKey = `${trimmedProvider.toLowerCase()}:${trimmedModel.toLowerCase()}`;
  if (seen.has(seenKey)) {
    return;
  }
  seen.add(seenKey);

  addOpenRouterProviderModelCandidates(candidates, trimmedProvider, trimmedModel);
  const normalized = normalizeModelRef(trimmedProvider, trimmedModel);
  if (normalized.provider !== trimmedProvider || normalized.model !== trimmedModel) {
    addOpenRouterProviderModelCandidates(candidates, normalized.provider, normalized.model);
  }

  const normalizedProvider = normalizeProviderId(trimmedProvider);
  if (normalizedProvider && WRAPPER_PROVIDERS.has(normalizedProvider) && trimmedModel.includes("/")) {
    const nested = parseModelRef(trimmedModel, DEFAULT_PROVIDER);
    if (nested) {
      collectOpenRouterLookupCandidates(candidates, nested.provider, nested.model, seen);
    }
  }
}

function addOpenRouterProviderModelCandidates(
  candidates: Set<string>,
  provider: string,
  model: string,
): void {
  const canonicalProvider = canonicalizeOpenRouterProvider(provider);
  for (const candidateModel of collectOpenRouterModelCandidates(canonicalProvider, model)) {
    candidates.add(`${canonicalProvider}/${candidateModel}`.toLowerCase());
  }
}

function collectOpenRouterModelCandidates(provider: string, model: string): string[] {
  const candidates = new Set<string>();
  addModelCandidateWithVersionVariants(candidates, model);
  const normalized = normalizeModelRef(provider, model);
  addModelCandidateWithVersionVariants(candidates, normalized.model);
  if (provider === "anthropic") {
    for (const candidate of [...candidates]) {
      if (candidate.startsWith("claude-")) {
        continue;
      }
      addModelCandidateWithVersionVariants(candidates, `claude-${candidate}`);
    }
  }
  return [...candidates].filter(Boolean);
}

function addModelCandidateWithVersionVariants(candidates: Set<string>, model: string): void {
  const trimmed = model.trim();
  if (!trimmed) {
    return;
  }
  candidates.add(trimmed);
  candidates.add(trimmed.replaceAll(/(\d+)\.(\d+)/gu, "$1-$2"));
  candidates.add(trimmed.replaceAll(/(\d+)-(\d+)/gu, "$1.$2"));
}

function canonicalizeOpenRouterProvider(provider: string): string {
  const normalized = normalizeModelRef(provider, "placeholder").provider;
  return PROVIDER_ALIAS_TO_OPENROUTER[normalized] ?? normalized;
}

function canonicalizeOpenRouterLookupId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) {
    return "";
  }
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    return trimmed;
  }
  const provider = canonicalizeOpenRouterProvider(trimmed.slice(0, slashIndex));
  const model = trimmed.slice(slashIndex + 1).trim();
  if (!model) {
    return provider;
  }
  for (const candidate of collectOpenRouterModelCandidates(provider, model)) {
    if (candidate) {
      return `${provider}/${candidate}`;
    }
  }
  return `${provider}/${model}`;
}

function trimOptionalPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseNumberString(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPricePerMillion(value: number | null): number | undefined {
  if (value === null || value < 0 || !Number.isFinite(value)) {
    return undefined;
  }
  return value * 1_000_000;
}
