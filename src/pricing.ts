import {
  __resetOpenClawLocalPricingCachesForTest,
  resolveModelPricingFromConfig,
  resolveModelPricingFromOpenClawLocal,
} from "./openclaw-local-pricing.js";
import {
  __resetOpenRouterPricingCachesForTest,
  resolveModelPricingFromOpenRouter,
} from "./openrouter-pricing.js";
import { asFiniteNumber } from "./utils.js";

export type ModelPricing = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export { resolveModelPricingFromConfig };

export function extractCostFromLastAssistant(lastAssistant: unknown): number | undefined {
  if (!lastAssistant || typeof lastAssistant !== "object" || Array.isArray(lastAssistant)) {
    return undefined;
  }
  return extractCostFromUsage((lastAssistant as { usage?: unknown }).usage);
}

export function extractCostFromAssistantMessages(
  messages: unknown,
  options?: { startIndex?: number },
): number | undefined {
  if (!Array.isArray(messages)) {
    return undefined;
  }
  const startIndex = Math.max(0, Math.trunc(options?.startIndex ?? 0));
  let total = 0;
  let found = false;
  for (const message of messages.slice(startIndex)) {
    const cost = extractCostFromAssistantMessage(message);
    if (cost === undefined) {
      continue;
    }
    total += cost;
    found = true;
  }
  return found ? total : undefined;
}

function extractCostFromAssistantMessage(message: unknown): number | undefined {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return undefined;
  }
  const role = (message as { role?: unknown }).role;
  if (role !== undefined && role !== "assistant") {
    return undefined;
  }
  return extractCostFromUsage((message as { usage?: unknown }).usage);
}

function extractCostFromUsage(usage: unknown): number | undefined {
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

export async function resolveModelPricing(params: {
  config?: unknown;
  provider: string;
  model: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  cacheFilePath?: string;
  fetchImpl?: typeof fetch;
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  allowRemoteRefresh?: boolean;
}): Promise<ModelPricing | undefined> {
  const localPricing = resolveModelPricingFromOpenClawLocal(params);
  if (localPricing) {
    return localPricing;
  }
  return await resolveModelPricingFromOpenRouter(params);
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

export function __resetPricingCachesForTest(): void {
  __resetOpenClawLocalPricingCachesForTest();
  __resetOpenRouterPricingCachesForTest();
}
