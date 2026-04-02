import type { ModelPricing } from "./pricing.js";

export type RunObserverStatus = "inflight" | "completed" | "failed";
export type RunObserverUsageStatus = "pending" | "available" | "unavailable";

export type RunObserverContext = {
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  workspaceDir?: string;
  trigger?: string;
  channelId?: string;
  messageProvider?: string;
  provider: string;
  model: string;
};

export type RunObserverInput = {
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
};

export type RunObserverLlmInputEventSnapshot = {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
};

export type RunObserverLlmInputContextSnapshot = {
  runId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  workspaceDir?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
};

export type RunObserverLlmInputSnapshot = {
  event: RunObserverLlmInputEventSnapshot;
  ctx: RunObserverLlmInputContextSnapshot;
};

export type RunObserverOutput = {
  assistantTexts: string[];
  lastAssistant?: unknown;
  messages?: unknown[];
};

export type RunObserverUsage = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
  derivedTotalTokens?: number;
  latestPromptTokens?: number;
  reportedCostUsd?: number;
  estimatedCostUsd?: number;
  estimatedPricingUsdPerMillion?: ModelPricing;
};

export type RunObserverMeta = {
  status: RunObserverStatus;
  usageStatus: RunObserverUsageStatus;
  success?: boolean;
  error?: string;
  durationMs?: number;
  createdAt: number;
  updatedAt: number;
};

export type RunObserverRunAttempt = {
  runAttemptId: string;
  runId: string;
  attemptOrdinal: number;
  storageDay: string;
  llmInput?: RunObserverLlmInputSnapshot;
  context: RunObserverContext;
  input: RunObserverInput;
  output: RunObserverOutput;
  usage?: RunObserverUsage;
  meta: RunObserverMeta;
};

export type RunObserverRunSummary = {
  runAttemptId: string;
  runId: string;
  attemptOrdinal: number;
  storageDay: string;
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  promptPreview?: string;
  provider: string;
  model: string;
  trigger?: string;
  channelId?: string;
  messageProvider?: string;
  status: RunObserverStatus;
  usageStatus: RunObserverUsageStatus;
  totalTokens?: number;
  reportedCostUsd?: number;
  estimatedCostUsd?: number;
  latestPromptTokens?: number;
  durationMs?: number;
  createdAt: number;
  updatedAt: number;
  success?: boolean;
  error?: string;
};

export type RunObserverRecentRunsIndex = {
  updatedAt: number;
  runs: RunObserverRunSummary[];
};

export type RunObserverAccessState = {
  token: string;
  createdAt: number;
  updatedAt: number;
};

export type RunObserverSseEvent = {
  type: "upsert";
  run: RunObserverRunSummary;
};

export type RunObserverLlmInputPayload = {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
  ctx: {
    runId?: string;
    agentId?: string;
    sessionId?: string;
    sessionKey?: string;
    workspaceDir?: string;
    trigger?: string;
    channelId?: string;
    messageProvider?: string;
  };
};

export type RunObserverLlmOutputPayload = {
  runId: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

export type RunObserverAgentEndPayload = {
  runId: string;
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
};
