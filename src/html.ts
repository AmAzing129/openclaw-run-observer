import type { RunObserverRunSummary } from "./types.js";
import { escapeHtml } from "./utils.js";

const SIMPLE_ICONS_CDN_BASE = "https://cdn.simpleicons.org";
const LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE =
  "https://unpkg.com/@lobehub/icons-static-png@latest/light";

const CHANNEL_ICON_MAP: Record<string, string> = {
  discord: "discord",
  telegram: "telegram",
  whatsapp: "whatsapp",
  slack: "slack",
  signal: "signal",
  googlechat: "googlechat",
  "google chat": "googlechat",
  imessage: "imessage",
  irc: "irc",
  line: "line",
};

const PROVIDER_ICON_MAP: Record<string, string> = {
  vercel: "vercel",
  openrouter: "openrouter",
  "azure-openai": "azure-color",
  azure: "azure-color",
  openai: "openai",
  anthropic: "anthropic",
  claude: "anthropic",
  google: "google-color",
  gemini: "google-color",
  vertex: "google-color",
  deepseek: "deepseek-color",
  mistral: "mistral-color",
  meta: "meta-color",
  llama: "meta-color",
  cohere: "cohere-color",
  perplexity: "perplexity-color",
  groq: "groq",
  together: "together-color",
  togetherai: "together-color",
  fireworks: "fireworks-color",
  amazon: "aws-color",
  aws: "aws-color",
  bedrock: "aws-color",
  zhipu: "zhipu-color",
  moonshot: "moonshot",
  qwen: "qwen-color",
  alibaba: "alibaba-color",
  baichuan: "baichuan-color",
  minimax: "minimax-color",
  yi: "zeroone",
  "01": "zeroone",
  ai21: "ai21-brand-color",
  bytedance: "bytedance-color",
  doubao: "bytedance-color",
  spark: "spark-color",
  ollama: "ollama",
  huggingface: "huggingface-color",
  replicate: "replicate-brand",
  xai: "xai",
  grok: "xai",
  siliconflow: "siliconcloud-color",
  siliconcloud: "siliconcloud-color",
  stepfun: "stepfun-color",
  nvidia: "nvidia-color",
  cloudflare: "cloudflare-color",
  "workers-ai": "cloudflare-color",
  workersai: "cloudflare-color",
  sambanova: "sambanova-color",
  cerebras: "cerebras-brand-color",
};

export type RunObserverSidebarRunGroup = {
  id: string;
  runId: string;
  updatedAt: number;
  attempts: RunObserverRunSummary[];
};

export type RunObserverSidebarSessionInstanceGroup = {
  id: string;
  routingLabel: string;
  updatedAt: number;
  sessionId?: string;
  reportedCostUsd?: number;
  estimatedCostUsd?: number;
  runs: RunObserverSidebarRunGroup[];
};

export type RunObserverSidebarSessionGroup = {
  id: string;
  label: string;
  routingLabel: string;
  updatedAt: number;
  provider: string;
  model: string;
  channelLabel: string;
  sessionKey?: string;
  sessionId?: string;
  reportedCostUsd?: number;
  estimatedCostUsd?: number;
  instances: RunObserverSidebarSessionInstanceGroup[];
};

export function buildSessionSidebarGroupId(
  run: Pick<
    RunObserverRunSummary,
    "sessionKey" | "sessionId" | "runId" | "runAttemptId"
  >,
): string {
  const normalizeText = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const sessionKey = normalizeText(run.sessionKey);
  if (sessionKey) return "session-key:" + sessionKey;
  const sessionId = normalizeText(run.sessionId);
  if (sessionId) return "session-id:" + sessionId;
  return "run:" + normalizeText(run.runId || run.runAttemptId || "");
}

export function buildSessionSidebarInstanceId(
  sessionGroupId: string,
  run: Pick<RunObserverRunSummary, "sessionId" | "runId" | "runAttemptId">,
): string {
  const normalizeText = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const sessionId = normalizeText(run.sessionId);
  if (sessionId) return sessionGroupId + "::session:" + sessionId;
  return (
    sessionGroupId +
    "::session:" +
    normalizeText(run.runId || run.runAttemptId || "detached")
  );
}

export function buildSidebarRunGroupId(
  sessionInstanceId: string,
  run: Pick<RunObserverRunSummary, "runId" | "runAttemptId">,
): string {
  const normalizeText = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  return (
    sessionInstanceId +
    "::run:" +
    normalizeText(run.runId || run.runAttemptId || "detached")
  );
}

export function buildSessionSidebarGroups(
  runs: RunObserverRunSummary[],
): RunObserverSidebarSessionGroup[] {
  const normalizeText = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const readKnownUsd = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const readCostValues = (
    record: Pick<RunObserverRunSummary, "reportedCostUsd" | "estimatedCostUsd">,
  ) => ({
    reportedCostUsd: readKnownUsd(record.reportedCostUsd),
    estimatedCostUsd: readKnownUsd(record.estimatedCostUsd),
  });
  const deriveAgentLabelFromSessionKey = (sessionKey: string): string => {
    const normalized = normalizeText(sessionKey);
    if (!normalized.startsWith("agent:")) return "";
    const parts = normalized.split(":").filter(Boolean);
    return parts.length >= 2 ? parts.slice(0, 2).join(":") : normalized;
  };
  const getAgentLabel = (
    run: Pick<RunObserverRunSummary, "agentId" | "sessionKey">,
  ): string =>
    normalizeText(run.agentId) ||
    deriveAgentLabelFromSessionKey(run.sessionKey || "");
  const getChannelLabel = (
    run: Pick<RunObserverRunSummary, "messageProvider" | "channelId">,
  ): string => {
    const provider = normalizeText(run.messageProvider);
    const channel = normalizeText(run.channelId);
    if (provider && channel && channel !== provider) {
      return /^[a-z0-9._:-]{1,24}$/i.test(channel)
        ? provider + " / " + channel
        : provider;
    }
    return provider || channel;
  };
  const getSessionLabel = (
    run: Pick<RunObserverRunSummary, "agentId" | "sessionKey">,
  ): string => getAgentLabel(run) || "Agent session";

  const grouped = new Map<
    string,
    {
      id: string;
      label: string;
      routingLabel: string;
      updatedAt: number;
      provider: string;
      model: string;
      channelLabel: string;
      sessionKey?: string;
      sessionId?: string;
      reportedCostUsd: number;
      estimatedCostUsd: number;
      hasReportedCost: boolean;
      hasEstimatedCost: boolean;
      instancesById: Map<
        string,
        {
          id: string;
          routingLabel: string;
          updatedAt: number;
          sessionId?: string;
          reportedCostUsd: number;
          estimatedCostUsd: number;
          hasReportedCost: boolean;
          hasEstimatedCost: boolean;
          runsById: Map<string, RunObserverSidebarRunGroup>;
        }
      >;
    }
  >();

  for (const run of runs) {
    const sessionGroupId = buildSessionSidebarGroupId(run);
    const sessionInstanceId = buildSessionSidebarInstanceId(
      sessionGroupId,
      run,
    );
    const runGroupId = buildSidebarRunGroupId(sessionInstanceId, run);
    const sessionKey = normalizeText(run.sessionKey);
    const sessionId = normalizeText(run.sessionId);
    const routingLabel = sessionKey || sessionId || normalizeText(run.runId);
    const existing = grouped.get(sessionGroupId) || {
      id: sessionGroupId,
      label: getSessionLabel(run),
      routingLabel,
      updatedAt: run.updatedAt,
      provider: normalizeText(run.provider),
      model: normalizeText(run.model),
      channelLabel: getChannelLabel(run),
      ...(sessionKey ? { sessionKey } : {}),
      ...(sessionId ? { sessionId } : {}),
      reportedCostUsd: 0,
      estimatedCostUsd: 0,
      hasReportedCost: false,
      hasEstimatedCost: false,
      instancesById: new Map(),
    };
    if (run.updatedAt >= existing.updatedAt) {
      existing.updatedAt = run.updatedAt;
      existing.label = getSessionLabel(run);
      existing.routingLabel = routingLabel || existing.routingLabel;
      existing.provider = normalizeText(run.provider) || existing.provider;
      existing.model = normalizeText(run.model) || existing.model;
      existing.channelLabel = getChannelLabel(run) || existing.channelLabel;
      if (sessionKey) {
        existing.sessionKey = sessionKey;
      }
      if (sessionId) {
        existing.sessionId = sessionId;
      }
    }

    const runCosts = readCostValues(run);
    if (runCosts.reportedCostUsd !== undefined) {
      existing.reportedCostUsd += runCosts.reportedCostUsd;
      existing.hasReportedCost = true;
    }
    if (runCosts.estimatedCostUsd !== undefined) {
      existing.estimatedCostUsd += runCosts.estimatedCostUsd;
      existing.hasEstimatedCost = true;
    }

    const existingInstance = existing.instancesById.get(sessionInstanceId) || {
      id: sessionInstanceId,
      routingLabel:
        sessionId ||
        normalizeText(run.runId) ||
        normalizeText(run.runAttemptId) ||
        "Detached run",
      updatedAt: run.updatedAt,
      ...(sessionId ? { sessionId } : {}),
      reportedCostUsd: 0,
      estimatedCostUsd: 0,
      hasReportedCost: false,
      hasEstimatedCost: false,
      runsById: new Map(),
    };
    if (run.updatedAt >= existingInstance.updatedAt) {
      existingInstance.updatedAt = run.updatedAt;
      existingInstance.routingLabel =
        sessionId ||
        normalizeText(run.runId) ||
        normalizeText(run.runAttemptId) ||
        existingInstance.routingLabel;
      if (sessionId) {
        existingInstance.sessionId = sessionId;
      }
    }
    if (runCosts.reportedCostUsd !== undefined) {
      existingInstance.reportedCostUsd += runCosts.reportedCostUsd;
      existingInstance.hasReportedCost = true;
    }
    if (runCosts.estimatedCostUsd !== undefined) {
      existingInstance.estimatedCostUsd += runCosts.estimatedCostUsd;
      existingInstance.hasEstimatedCost = true;
    }

    const existingRunGroup = existingInstance.runsById.get(runGroupId) || {
      id: runGroupId,
      runId: normalizeText(run.runId),
      updatedAt: run.updatedAt,
      attempts: [],
    };
    existingRunGroup.attempts.push(run);
    if (run.updatedAt >= existingRunGroup.updatedAt) {
      existingRunGroup.updatedAt = run.updatedAt;
      existingRunGroup.runId =
        normalizeText(run.runId) || existingRunGroup.runId;
    }

    existingInstance.runsById.set(runGroupId, existingRunGroup);
    existing.instancesById.set(sessionInstanceId, existingInstance);
    grouped.set(sessionGroupId, existing);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      id: group.id,
      label: group.label,
      routingLabel: group.routingLabel,
      updatedAt: group.updatedAt,
      provider: group.provider,
      model: group.model,
      channelLabel: group.channelLabel,
      ...(group.sessionKey ? { sessionKey: group.sessionKey } : {}),
      ...(group.sessionId ? { sessionId: group.sessionId } : {}),
      ...(group.hasReportedCost
        ? { reportedCostUsd: group.reportedCostUsd }
        : {}),
      ...(group.hasEstimatedCost
        ? { estimatedCostUsd: group.estimatedCostUsd }
        : {}),
      instances: Array.from(group.instancesById.values())
        .map((instance) => ({
          id: instance.id,
          routingLabel: instance.routingLabel,
          updatedAt: instance.updatedAt,
          ...(instance.sessionId ? { sessionId: instance.sessionId } : {}),
          ...(instance.hasReportedCost
            ? { reportedCostUsd: instance.reportedCostUsd }
            : {}),
          ...(instance.hasEstimatedCost
            ? { estimatedCostUsd: instance.estimatedCostUsd }
            : {}),
          runs: Array.from(instance.runsById.values())
            .map((runGroup) => ({
              ...runGroup,
              attempts: runGroup.attempts.sort(
                (left, right) => right.updatedAt - left.updatedAt,
              ),
            }))
            .sort((left, right) => right.updatedAt - left.updatedAt),
        }))
        .sort((left, right) => right.updatedAt - left.updatedAt),
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function pickOpenClawUsageFields(usage: unknown): {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
} {
  const record =
    usage && typeof usage === "object" && !Array.isArray(usage)
      ? (usage as Record<string, unknown>)
      : {};
  const picked: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  } = {};
  for (const key of [
    "input",
    "output",
    "cacheRead",
    "cacheWrite",
    "total",
  ] as const) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      picked[key] = value;
    }
  }
  return picked;
}

export function renderRunObserverHtml(params: {
  basePath: string;
  pluginName: string;
}): string {
  const basePath = escapeHtml(params.basePath.replace(/\/$/, ""));
  const pluginName = escapeHtml(params.pluginName);
  const pickOpenClawUsageFieldsSource = pickOpenClawUsageFields.toString();
  const buildSessionSidebarGroupIdSource =
    buildSessionSidebarGroupId.toString();
  const buildSessionSidebarInstanceIdSource =
    buildSessionSidebarInstanceId.toString();
  const buildSidebarRunGroupIdSource = buildSidebarRunGroupId.toString();
  const buildSessionSidebarGroupsSource = buildSessionSidebarGroups.toString();
  const simpleIconsCdnBaseSource = JSON.stringify(SIMPLE_ICONS_CDN_BASE);
  const lobehubIconsPngLightCdnBaseSource = JSON.stringify(
    LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE,
  );
  const channelIconMapSource = JSON.stringify(CHANNEL_ICON_MAP);
  const providerIconMapSource = JSON.stringify(PROVIDER_ICON_MAP);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pluginName}</title>
    <style>
      :root {
        --bg: #f6f1e8;
        --panel: rgba(255, 252, 246, 0.92);
        --panel-strong: rgba(252, 246, 235, 0.98);
        --line: rgba(104, 78, 47, 0.18);
        --text: #1f1a14;
        --muted: #6c6256;
        --accent: #94612d;
        --accent-soft: rgba(148, 97, 45, 0.12);
        --danger: #a33e2c;
        --ok: #2a7752;
        --shadow: 0 24px 70px rgba(53, 38, 22, 0.14);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(236, 213, 177, 0.42), transparent 34%),
          radial-gradient(circle at top right, rgba(165, 119, 71, 0.18), transparent 26%),
          linear-gradient(180deg, #fbf7ef 0%, #f3ede4 100%);
      }

      .page {
        min-height: 100vh;
        padding: 28px;
      }

      .shell {
        display: grid;
        grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 22px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }

      .panel-header {
        padding: 22px 22px 16px;
        border-bottom: 1px solid var(--line);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }

      h1,
      h2,
      h3,
      summary {
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
      }

      h1 {
        margin: 10px 0 0;
        font-size: 32px;
        line-height: 1.05;
      }

      .subtitle {
        margin-top: 10px;
        color: var(--muted);
        line-height: 1.5;
      }

      .runs {
        max-height: calc(100vh - 180px);
        overflow: auto;
        padding: 6px 10px 10px;
      }

      .session-browser {
        display: grid;
        grid-template-columns: 148px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }

      .session-tabs {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .session-tab,
      .session-instance-toggle,
      .run-toggle,
      .record {
        width: 100%;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;
        font: inherit;
      }

      .session-tab {
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(148, 97, 45, 0.12);
        background: rgba(255, 255, 255, 0.44);
        transition:
          transform 140ms ease,
          border-color 140ms ease,
          background 140ms ease,
          box-shadow 140ms ease;
      }

      .session-tab:hover {
        transform: translateY(-1px);
        border-color: rgba(148, 97, 45, 0.24);
        background: rgba(255, 255, 255, 0.58);
      }

      .session-tab.active {
        background: linear-gradient(180deg, rgba(255, 249, 240, 0.96), rgba(248, 238, 224, 0.94));
        border-color: rgba(148, 97, 45, 0.3);
        box-shadow: 0 10px 24px rgba(53, 38, 22, 0.08);
      }

      .session-tab-row {
        display: grid;
        gap: 4px;
      }

      .session-panel {
        min-width: 0;
      }

      .session-panel-header {
        border: 1px solid rgba(148, 97, 45, 0.14);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.5);
        padding: 12px 14px;
      }

      .session-tab-title,
      .session-panel-title {
        font-weight: 700;
        font-size: 13px;
        line-height: 1.3;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .session-panel-title {
        font-size: 14px;
      }

      .session-subtitle,
      .session-tab-subtitle,
      .session-panel-subtitle,
      .record-subtitle,
      .empty,
      .callout,
      .detail-prelude {
        color: var(--muted);
      }

      .callout {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.64);
        line-height: 1.5;
        font-size: 13px;
      }

      .callout + .callout {
        margin-top: 8px;
      }

      .callout strong {
        color: var(--text);
      }

      .callout.cost-callout {
        color: var(--text);
        background: rgba(148, 97, 45, 0.08);
        border-color: rgba(148, 97, 45, 0.22);
      }

      .callout-meta {
        margin-top: 6px;
        font-size: 12px;
        color: var(--muted);
      }

      .session-icons {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .session-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        opacity: 0.7;
      }

      .session-subtitle,
      .session-tab-title,
      .session-tab-subtitle,
      .session-panel-title,
      .record-title,
      .record-subtitle {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .session-tab-subtitle,
      .session-subtitle {
        margin-top: 2px;
        font-size: 11px;
        line-height: 1.3;
      }

      .session-panel-subtitle {
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.45;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .session-panel-body {
        margin-top: 8px;
      }

      .session-instance-group {
        margin-top: 4px;
        border: 1px solid rgba(148, 97, 45, 0.1);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.34);
        overflow: hidden;
      }

      .session-instance-group.expanded {
        background: rgba(255, 255, 255, 0.48);
        border-color: rgba(148, 97, 45, 0.18);
      }

      .session-instance-toggle {
        padding: 8px 12px;
        transition: background 140ms ease;
      }

      .session-instance-toggle:hover {
        background: rgba(255, 255, 255, 0.28);
      }

      .session-instance-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }

      .session-instance-caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        color: var(--muted);
        transition: transform 140ms ease;
      }

      .session-instance-toggle[aria-expanded="true"] .session-instance-caret {
        transform: rotate(90deg);
      }

      .session-instance-title {
        font-weight: 700;
        font-size: 12px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .session-instance-subtitle {
        margin-top: 2px;
        font-size: 11px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-instance-cost {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--accent);
      }

      .session-instance-body {
        margin: 0 10px 6px 18px;
        padding-left: 10px;
        border-left: 1px solid rgba(148, 97, 45, 0.12);
      }

      .run-group {
        margin-top: 4px;
        border: 1px solid rgba(148, 97, 45, 0.1);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.34);
        overflow: hidden;
      }

      .run-group.expanded {
        background: rgba(255, 255, 255, 0.48);
        border-color: rgba(148, 97, 45, 0.18);
      }

      .run-toggle {
        padding: 8px 12px;
        transition: background 140ms ease;
      }

      .run-toggle:hover {
        background: rgba(255, 255, 255, 0.28);
      }

      .run-toggle-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }

      .run-caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        color: var(--muted);
        transition: transform 140ms ease;
      }

      .run-toggle[aria-expanded="true"] .run-caret {
        transform: rotate(90deg);
      }

      .run-title {
        font-weight: 700;
        font-size: 12px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .run-subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .run-body {
        margin: 0 10px 6px 18px;
        padding-left: 10px;
        border-left: 1px solid rgba(148, 97, 45, 0.12);
      }

      .record {
        display: grid;
        gap: 4px;
        margin-top: 4px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid transparent;
        transition:
          transform 140ms ease,
          border-color 140ms ease,
          background 140ms ease;
      }

      .record:hover {
        transform: translateY(-1px);
        border-color: rgba(148, 97, 45, 0.24);
        background: rgba(255, 255, 255, 0.62);
      }

      .record.active {
        border-color: rgba(148, 97, 45, 0.3);
        background: linear-gradient(180deg, rgba(255, 249, 240, 0.96), rgba(248, 238, 224, 0.94));
      }

      .record-head,
      .detail-grid {
        display: grid;
        gap: 4px;
      }

      .record-head {
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
      }

      .record-title {
        font-weight: 700;
        font-size: 12px;
      }

      .record-subtitle {
        margin-top: 2px;
        font-size: 11px;
        white-space: nowrap;
      }

      .detail-item strong {
        display: block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 5px;
      }

      .detail {
        min-height: calc(100vh - 56px);
        display: flex;
        flex-direction: column;
      }

      .detail-stats {
        padding: 12px 22px 0;
      }

      .detail-stats:empty {
        display: none;
      }

      .detail-tabs {
        display: flex;
        gap: 0;
        padding: 0 22px;
        border-bottom: 1px solid var(--line);
      }

      .detail-tab {
        padding: 10px 18px;
        border: 0;
        background: transparent;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
        cursor: pointer;
        position: relative;
        transition: color 140ms ease;
      }

      .detail-tab:hover {
        color: var(--text);
      }

      .detail-tab.active {
        color: var(--accent);
      }

      .detail-tab.active::after {
        content: "";
        position: absolute;
        bottom: -1px;
        left: 12px;
        right: 12px;
        height: 2px;
        background: var(--accent);
        border-radius: 2px 2px 0 0;
      }

      .detail-body {
        display: grid;
        gap: 18px;
        padding: 22px;
      }

      .detail-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .detail-item {
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--panel-strong);
        border: 1px solid var(--line);
      }

      .detail-item strong {
        margin-bottom: 2px;
      }

      .detail-item .value {
        font-size: 13px;
        font-weight: 600;
        word-break: break-word;
      }

      details {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--panel-strong);
        overflow: hidden;
      }

      details.raw-debug {
        opacity: 0.7;
        border-style: dashed;
      }

      details.raw-debug summary {
        font-size: 13px;
        color: var(--muted);
      }

      summary {
        padding: 14px 16px;
        font-size: 18px;
        cursor: pointer;
      }

      pre {
        margin: 0;
        padding: 0 16px 16px;
        overflow: auto;
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .section-label {
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        font-size: 15px;
        font-weight: 700;
        color: var(--accent);
        margin: 0 0 8px;
      }

      .prompt-block {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--panel-strong);
        overflow: hidden;
      }

      .prompt-block pre {
        padding: 16px;
        max-height: 400px;
      }

      .prompt-block.collapsed pre {
        max-height: 120px;
        overflow: hidden;
        mask-image: linear-gradient(to bottom, #000 60%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent 100%);
      }

      .prompt-expand-btn {
        display: block;
        width: 100%;
        padding: 8px 16px;
        border: 0;
        border-top: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.5);
        color: var(--accent);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        text-align: center;
      }

      .prompt-expand-btn:hover {
        background: rgba(255, 255, 255, 0.8);
      }

      .chat-list {
        display: grid;
        gap: 8px;
      }

      .chat-msg {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel-strong);
        overflow: hidden;
        max-width: 85%;
      }

      .chat-msg.role-system {
        border-left: 3px solid var(--accent);
        justify-self: start;
      }

      .chat-msg.role-user {
        border: 1px solid rgba(42, 119, 82, 0.22);
        background: rgba(42, 119, 82, 0.06);
        border-radius: 14px 14px 4px 14px;
        justify-self: end;
      }

      .chat-msg.role-assistant {
        border-left: 3px solid var(--muted);
        justify-self: start;
      }

      .chat-msg.role-tool,
      .chat-msg.role-function {
        border-left: 3px solid #7c6cb0;
        justify-self: start;
        background: rgba(124, 108, 176, 0.05);
      }

      .chat-msg.has-tool-calls {
        border-left: 3px solid #7c6cb0;
      }

      .chat-role {
        display: inline-block;
        padding: 8px 14px 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .chat-role-badge {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 7px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        vertical-align: middle;
      }

      .chat-role-badge.badge-tool-call {
        background: rgba(124, 108, 176, 0.15);
        color: #7c6cb0;
      }

      .chat-role-badge.badge-tool-result {
        background: rgba(124, 108, 176, 0.10);
        color: #7c6cb0;
      }

      .chat-content {
        padding: 6px 14px 12px;
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 200px;
        overflow: auto;
      }

      .tool-calls-list {
        padding: 0 14px 10px;
        display: grid;
        gap: 6px;
      }

      .tool-call-item {
        border: 1px solid rgba(124, 108, 176, 0.18);
        border-radius: 10px;
        background: rgba(124, 108, 176, 0.05);
        padding: 8px 12px;
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.45;
      }

      .tool-call-name {
        font-weight: 700;
        color: #7c6cb0;
        margin-bottom: 4px;
      }

      .tool-call-detail {
        font-weight: 400;
        color: var(--muted);
        font-size: 11px;
      }

      .tool-call-args-toggle {
        font-size: 11px;
        color: var(--muted);
        cursor: pointer;
        padding: 2px 0;
        list-style: none;
      }

      .tool-call-args-toggle::before {
        content: "▸ ";
      }

      details[open] > .tool-call-args-toggle::before {
        content: "▾ ";
      }

      .tool-call-args {
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 120px;
        overflow: auto;
        color: var(--muted);
      }

      .tool-result-summary {
        padding: 4px 14px 0;
      }

      .tool-result-detail {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .tool-result-size {
        font-size: 11px;
        color: var(--muted);
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .chat-msg.role-tool > details {
        border: 0;
        border-radius: 0;
        background: transparent;
      }

      .chat-msg.role-tool > details > summary {
        font-size: 12px;
        padding: 4px 14px 2px;
        color: var(--muted);
      }

      .section-divider {
        border: 0;
        border-top: 1px dashed var(--line);
        margin: 6px 0;
      }

      .debug-group-label {
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 0 0 8px;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .toolbar .right {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .mono {
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--line);
        color: var(--muted);
      }

      .action-button {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 8px 14px;
        background: rgba(255, 255, 255, 0.82);
        color: var(--text);
        font: inherit;
        cursor: pointer;
        transition:
          transform 140ms ease,
          background 140ms ease,
          border-color 140ms ease;
      }

      .action-button:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.96);
        border-color: rgba(148, 97, 45, 0.24);
      }

      .action-button:disabled {
        cursor: wait;
        opacity: 0.7;
        transform: none;
      }

      .status-chip.status-inflight {
        background: rgba(148, 97, 45, 0.12);
        border-color: rgba(148, 97, 45, 0.3);
        color: var(--accent);
      }

      .status-chip.status-completed {
        background: rgba(42, 119, 82, 0.1);
        border-color: rgba(42, 119, 82, 0.28);
        color: var(--ok);
      }

      .status-chip.status-failed {
        background: rgba(163, 62, 44, 0.1);
        border-color: rgba(163, 62, 44, 0.28);
        color: var(--danger);
      }

      .status-chip.status-interrupted {
        background: rgba(102, 76, 148, 0.12);
        border-color: rgba(102, 76, 148, 0.3);
        color: #5f4aa5;
      }

      .error {
        color: var(--danger);
      }

      @media (max-width: 1080px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .runs {
          max-height: none;
        }

        .session-browser {
          grid-template-columns: 1fr;
        }

        .session-tabs {
          flex-direction: row;
          overflow: auto;
          padding-bottom: 4px;
        }

        .session-tab {
          min-width: 180px;
        }

        .detail {
          min-height: auto;
        }

        .detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

      }

      @media (max-width: 640px) {
        .page {
          padding: 14px;
        }

        .detail-body,
        .panel-header {
          padding-left: 16px;
          padding-right: 16px;
        }

        .detail-grid {
          grid-template-columns: 1fr;
        }

        .toolbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .session-tab {
          min-width: 160px;
        }

        .session-instance-body {
          margin-left: 14px;
          margin-right: 10px;
        }

        .run-body {
          margin-left: 14px;
          margin-right: 10px;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="shell">
        <section class="panel">
          <div class="panel-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="eyebrow">OpenClaw Plugin</div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span class="chip mono" id="connection-state" style="padding:4px 10px;font-size:11px;">connecting</span>
                <button class="action-button mono" id="refresh-button" type="button" style="padding:5px 12px;font-size:12px;">Refresh</button>
              </div>
            </div>
            <h1>${pluginName}</h1>
          </div>

          <div class="runs" id="runs"></div>
        </section>

        <section class="panel detail">
          <div class="panel-header">
            <div class="toolbar">
              <div>
                <div class="eyebrow">Live Detail</div>
                <h2 id="detail-title" style="margin: 10px 0 0;">Waiting for data</h2>
                <div class="subtitle mono" id="detail-subtitle">Select an attempt from the left pane.</div>
              </div>
              <div class="right">
                <span class="chip mono status-chip" id="status-chip" style="display:none;"></span>
                <span class="chip mono" id="cost-chip" style="display:none;"></span>
                <span class="chip mono" id="duration-chip" style="display:none;"></span>
              </div>
            </div>
          </div>
          <div class="detail-stats" id="detail-stats"></div>
          <div class="detail-tabs" id="detail-tabs">
            <button class="detail-tab active" type="button" data-tab="input">Input</button>
            <button class="detail-tab" type="button" data-tab="output">Output</button>
          </div>
          <div class="detail-body" id="detail-body">
            <div class="empty">No runs yet.</div>
          </div>
        </section>
      </div>
    </div>

    <script>
      const BASE_PATH = ${JSON.stringify(basePath)};
      const params = new URLSearchParams(window.location.search);
      const TOKEN = params.get("token") || "";
      const pickOpenClawUsageFields = ${pickOpenClawUsageFieldsSource};
      const buildSessionSidebarGroupId = ${buildSessionSidebarGroupIdSource};
      const buildSessionSidebarInstanceId = ${buildSessionSidebarInstanceIdSource};
      const buildSidebarRunGroupId = ${buildSidebarRunGroupIdSource};
      const buildSessionGroupId = buildSessionSidebarGroupId;
      const buildSessionInstanceGroupId = buildSessionSidebarInstanceId;
      const buildRunGroupId = buildSidebarRunGroupId;
      const buildSessionGroups = ${buildSessionSidebarGroupsSource};
      const state = {
        runs: [],
        detail: null,
        selectedRunAttemptId: null,
        loadingDetail: false,
        refreshingRecent: false,
        activeSessionGroupId: null,
        expandedSessionInstances: [],
        expandedRuns: [],
        renderedSessionTabsSignature: "",
        renderedSessionHeaderSignature: "",
        activeTab: "input",
      };

      const nodes = {
        runs: document.getElementById("runs"),
        detailBody: document.getElementById("detail-body"),
        detailTitle: document.getElementById("detail-title"),
        detailSubtitle: document.getElementById("detail-subtitle"),
        statusChip: document.getElementById("status-chip"),
        costChip: document.getElementById("cost-chip"),
        durationChip: document.getElementById("duration-chip"),
        detailStats: document.getElementById("detail-stats"),
        detailTabs: document.getElementById("detail-tabs"),
        connectionState: document.getElementById("connection-state"),
        refreshButton: document.getElementById("refresh-button"),
      };

      function switchTab(tab) {
        state.activeTab = tab;
        for (const btn of nodes.detailTabs.querySelectorAll(".detail-tab")) {
          btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
        }
        renderDetail();
      }

      for (const btn of nodes.detailTabs.querySelectorAll(".detail-tab")) {
        btn.addEventListener("click", function () {
          switchTab(this.getAttribute("data-tab") || "input");
        });
      }

      nodes.runs.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target.closest("button") : null;
        if (!(target instanceof HTMLButtonElement) || !nodes.runs.contains(target)) {
          return;
        }

        if (target.classList.contains("session-tab")) {
          const sessionId = target.getAttribute("data-session-tab-id");
          if (!sessionId) return;
          const sessions = buildSessionGroups(getFilteredRuns());
          const session = sessions.find((entry) => entry.id === sessionId);
          if (!session) return;
          const nextAttemptId = findFirstAttemptIdForSessionGroup(session);
          setActiveSessionGroup(session.id);
          if (nextAttemptId && nextAttemptId !== state.selectedRunAttemptId) {
            await selectRunAttempt(nextAttemptId);
            return;
          }
          renderRuns();
          return;
        }

        if (target.classList.contains("session-instance-toggle")) {
          const sessionInstanceId = target.getAttribute("data-session-instance-id");
          if (!sessionInstanceId) return;
          const sessions = buildSessionGroups(getFilteredRuns());
          const nextExpanded = !isSessionInstanceExpanded(sessionInstanceId);
          setSessionInstanceExpanded(sessionInstanceId, nextExpanded);
          if (nextExpanded) {
            const sessionInstance = sessions
              .flatMap((session) => session.instances)
              .find((entry) => entry.id === sessionInstanceId);
            if (sessionInstance) {
              const firstMultiAttemptRun = sessionInstance.runs.find((runGroup) => runGroup.attempts.length > 1);
              if (firstMultiAttemptRun) {
                setRunExpanded(firstMultiAttemptRun.id, true);
              }
            }
          }
          renderRuns();
          return;
        }

        if (target.classList.contains("run-toggle")) {
          const runGroupId = target.getAttribute("data-run-group-id");
          if (!runGroupId) return;
          setRunExpanded(runGroupId, !isRunExpanded(runGroupId));
          renderRuns();
          return;
        }

        if (target.classList.contains("record")) {
          const nextId = target.getAttribute("data-run-attempt-id");
          if (!nextId) return;
          await selectRunAttempt(nextId);
        }
      });

      function withToken(path) {
        const url = new URL(path, window.location.origin);
        if (TOKEN) {
          url.searchParams.set("token", TOKEN);
        }
        return url.toString();
      }

      async function fetchJson(path) {
        const res = await fetch(withToken(path), {
          headers: {
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || ("Request failed: " + res.status));
        }
        return await res.json();
      }

      function formatTime(value) {
        if (!value) return "n/a";
        return new Date(value).toLocaleString();
      }

      function formatSidebarTime(value) {
        if (!value) return "n/a";
        const date = new Date(value);
        return new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      }

      function formatRunStatusIcon(status) {
        if (status === "completed") return "✅";
        if (status === "failed") return "❌";
        if (status === "interrupted") return "⛔";
        if (status === "inflight") return "⏳";
        return "";
      }

      function formatSidebarTimeWithStatus(value, status) {
        const label = formatSidebarTime(value);
        const icon = formatRunStatusIcon(status);
        return icon ? label + " " + icon : label;
      }

      function formatDuration(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
        if (value < 1000) return value + " ms";
        const seconds = value / 1000;
        if (seconds < 60) return seconds.toFixed(seconds < 10 ? 1 : 0) + " s";
        const minutes = Math.floor(seconds / 60);
        const rest = Math.round(seconds % 60);
        return minutes + "m " + rest + "s";
      }

      function formatTokens(value, usageStatus) {
        if (usageStatus === "unavailable") return "usage unavailable";
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return usageStatus === "pending" ? "pending" : "n/a";
        }
        return value.toLocaleString() + " tok";
      }

      function formatUsd(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "";
        if (value >= 1) return "$" + value.toFixed(2);
        if (value >= 0.01) return "$" + value.toFixed(2);
        return "$" + value.toFixed(4);
      }

      function formatPricingRates(pricing) {
        if (!pricing || typeof pricing !== "object") return "";
        const parts = [];
        if (typeof pricing.input === "number" && Number.isFinite(pricing.input)) {
          parts.push("in " + formatUsd(pricing.input) + "/1M");
        }
        if (typeof pricing.output === "number" && Number.isFinite(pricing.output)) {
          parts.push("out " + formatUsd(pricing.output) + "/1M");
        }
        if (typeof pricing.cacheRead === "number" && Number.isFinite(pricing.cacheRead)) {
          parts.push("cache read " + formatUsd(pricing.cacheRead) + "/1M");
        }
        if (typeof pricing.cacheWrite === "number" && Number.isFinite(pricing.cacheWrite)) {
          parts.push("cache write " + formatUsd(pricing.cacheWrite) + "/1M");
        }
        return parts.join(" | ");
      }

      function readCostValues(record) {
        const reportedCostUsd = readKnownUsd(record && record.reportedCostUsd);
        const estimatedCostUsd = readKnownUsd(record && record.estimatedCostUsd);
        return {
          reportedCostUsd: reportedCostUsd,
          estimatedCostUsd: estimatedCostUsd,
        };
      }

      function formatCostValueOrNa(value) {
        return typeof value === "number" && Number.isFinite(value) ? formatUsd(value) : "n/a";
      }

      function formatCostPairInline(record) {
        const costs = readCostValues(record);
        return formatCostValueOrNa(costs.reportedCostUsd) + "(" + formatCostValueOrNa(costs.estimatedCostUsd) + ")";
      }

      function formatRunCostTitle(record) {
        const costs = readCostValues(record);
        if (costs.reportedCostUsd === undefined && costs.estimatedCostUsd === undefined) {
          return "";
        }
        return "Current run only. Reported: " +
          formatCostValueOrNa(costs.reportedCostUsd) +
          " | Estimated: " +
          formatCostValueOrNa(costs.estimatedCostUsd);
      }

      function renderCostBreakdownCallout(run) {
        const usage = run && run.usage ? run.usage : {};
        const costs = readCostValues(usage);
        const lines = [
          '<div><strong>Run reported cost:</strong> ' + escapeInline(formatCostValueOrNa(costs.reportedCostUsd)) + "</div>",
          '<div><strong>Run estimated cost:</strong> ' + escapeInline(formatCostValueOrNa(costs.estimatedCostUsd)) + "</div>",
          "<div><strong>Scope:</strong> current run only</div>",
        ];
        const pricingRates =
          costs.estimatedCostUsd !== undefined
            ? formatPricingRates(usage.estimatedPricingUsdPerMillion)
            : "";
        return '<div class="callout cost-callout">' +
          lines.join("") +
          (pricingRates
            ? '<div class="callout-meta mono">' + escapeInline(pricingRates) + '</div>'
            : '') +
        '</div>';
      }

      function syncFilterOptions() {}

      function escapeInline(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      }

      var LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE = ${lobehubIconsPngLightCdnBaseSource};
      var PROVIDER_ICON_MAP = ${providerIconMapSource};

      function resolveProviderSlug(provider, model) {
        var p = (provider || "").toLowerCase().trim();
        var m = (model || "").toLowerCase().trim();
        if (PROVIDER_ICON_MAP[p]) return PROVIDER_ICON_MAP[p];
        for (var key in PROVIDER_ICON_MAP) {
          if (p.indexOf(key) !== -1) return PROVIDER_ICON_MAP[key];
        }
        for (var key in PROVIDER_ICON_MAP) {
          if (m.indexOf(key) !== -1) return PROVIDER_ICON_MAP[key];
        }
        return "";
      }

      function providerIconUrl(slug) {
        if (!slug) return "";
        return lobehubPngIconUrl(slug);
      }

      var SIMPLE_ICONS_CDN_BASE = ${simpleIconsCdnBaseSource};
      var CHANNEL_ICON_MAP = ${channelIconMapSource};

      function simpleIconUrl(slug) {
        if (!slug) return "";
        return SIMPLE_ICONS_CDN_BASE + "/" + encodeURIComponent(slug);
      }

      function lobehubPngIconUrl(slug) {
        if (!slug) return "";
        return LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE + "/" + encodeURIComponent(slug) + ".png";
      }

      function channelIconUrl(channelLabel) {
        var normalized = (channelLabel || "").toLowerCase().trim();
        for (var key in CHANNEL_ICON_MAP) {
          if (normalized.indexOf(key) !== -1) {
            return simpleIconUrl(CHANNEL_ICON_MAP[key]);
          }
        }
        return "";
      }

      function formatAttemptLabel(run) {
        return typeof run.attemptOrdinal === "number" ? "Attempt " + run.attemptOrdinal : "Attempt";
      }

      function readKnownUsd(value) {
        return typeof value === "number" && Number.isFinite(value) ? value : undefined;
      }

      function isSessionActive(sessionId) {
        return state.activeSessionGroupId === sessionId;
      }

      function setActiveSessionGroup(sessionId) {
        state.activeSessionGroupId = sessionId;
      }

      function isSessionInstanceExpanded(sessionInstanceId) {
        return state.expandedSessionInstances.includes(sessionInstanceId);
      }

      function setSessionInstanceExpanded(sessionInstanceId, expanded) {
        const next = state.expandedSessionInstances.filter((value) => value !== sessionInstanceId);
        if (expanded) {
          next.unshift(sessionInstanceId);
        }
        state.expandedSessionInstances = next;
      }

      function isRunExpanded(runGroupId) {
        return state.expandedRuns.includes(runGroupId);
      }

      function setRunExpanded(runGroupId, expanded) {
        const next = state.expandedRuns.filter((value) => value !== runGroupId);
        if (expanded) {
          next.unshift(runGroupId);
        }
        state.expandedRuns = next;
      }

      function findFirstAttemptIdForSessionGroup(session) {
        for (const instance of session.instances) {
          for (const runGroup of instance.runs) {
            if (runGroup.attempts.length > 0) {
              return runGroup.attempts[0].runAttemptId;
            }
          }
        }
        return "";
      }

      function ensureExpandedGroups(groups) {
        const validSessionIds = new Set(groups.map((group) => group.id));
        const validSessionInstanceIds = new Set();
        const validRunIds = new Set();
        for (const group of groups) {
          for (const instance of group.instances) {
            validSessionInstanceIds.add(instance.id);
            for (const runGroup of instance.runs) {
              if (runGroup.attempts.length > 1) {
                validRunIds.add(runGroup.id);
              }
            }
          }
        }
        if (!state.activeSessionGroupId || !validSessionIds.has(state.activeSessionGroupId)) {
          state.activeSessionGroupId = null;
        }
        state.expandedSessionInstances = state.expandedSessionInstances.filter((sessionInstanceId) => validSessionInstanceIds.has(sessionInstanceId));
        state.expandedRuns = state.expandedRuns.filter((runGroupId) => validRunIds.has(runGroupId));

        const selectedRun = state.runs.find((run) => run.runAttemptId === state.selectedRunAttemptId);
        if (selectedRun) {
          const selectedSessionId = buildSessionGroupId(selectedRun);
          if (validSessionIds.has(selectedSessionId)) {
            setActiveSessionGroup(selectedSessionId);
          }
          const selectedSessionInstanceId = buildSessionInstanceGroupId(selectedSessionId, selectedRun);
          if (validSessionInstanceIds.has(selectedSessionInstanceId) && !isSessionInstanceExpanded(selectedSessionInstanceId)) {
            setSessionInstanceExpanded(selectedSessionInstanceId, true);
          }
          const selectedRunGroupId = buildRunGroupId(selectedSessionInstanceId, selectedRun);
          if (validRunIds.has(selectedRunGroupId) && !isRunExpanded(selectedRunGroupId)) {
            setRunExpanded(selectedRunGroupId, true);
          }
        }

        if (!state.activeSessionGroupId && groups.length > 0) {
          state.activeSessionGroupId = groups[0].id;
        }
        const activeSession = groups.find((group) => group.id === state.activeSessionGroupId) || groups[0];
        const hasExpandedVisibleSessionInstance = activeSession
          ? activeSession.instances.some((instance) => isSessionInstanceExpanded(instance.id))
          : false;
        if (!hasExpandedVisibleSessionInstance) {
          const firstExpandedSessionInstance = activeSession ? activeSession.instances[0] : undefined;
          if (firstExpandedSessionInstance) {
            setSessionInstanceExpanded(firstExpandedSessionInstance.id, true);
          }
        }
        const hasExpandedVisibleRun = activeSession
          ? activeSession.instances.some((instance) =>
            instance.runs.some((runGroup) => runGroup.attempts.length > 1 && isRunExpanded(runGroup.id)))
          : false;
        if (!hasExpandedVisibleRun) {
          const firstExpandedRun = (activeSession ? activeSession.instances : groups.flatMap((group) => group.instances))
            .flatMap((instance) => instance.runs)
            .find((runGroup) => runGroup.attempts.length > 1);
          if (firstExpandedRun) {
            setRunExpanded(firstExpandedRun.id, true);
          }
        }
      }

      function getFilteredRuns() {
        return state.runs;
      }

      function buildSessionTabsSignature(sessions) {
        return sessions
          .map((session) => [session.id, session.label, session.channelLabel].join("|"))
          .join("::");
      }

      function buildSessionHeaderSignature(session) {
        return [
          session.id,
          session.label,
          session.routingLabel,
          session.channelLabel,
        ].join("|");
      }

      function ensureRunBrowserLayout() {
        if (!nodes.runs.querySelector(".session-browser")) {
          nodes.runs.innerHTML =
            '<div class="session-browser">' +
              '<div class="session-tabs" role="tablist" aria-orientation="vertical"></div>' +
              '<div class="session-panel" role="tabpanel">' +
                '<div class="session-panel-header"></div>' +
                '<div class="session-panel-body"></div>' +
              '</div>' +
            '</div>';
        }
        return {
          tabs: nodes.runs.querySelector(".session-tabs"),
          panel: nodes.runs.querySelector(".session-panel"),
          panelHeader: nodes.runs.querySelector(".session-panel-header"),
          panelBody: nodes.runs.querySelector(".session-panel-body"),
        };
      }

      function updateSessionTabSelection(activeSessionId) {
        for (const button of nodes.runs.querySelectorAll(".session-tab")) {
          const active = button.getAttribute("data-session-tab-id") === activeSessionId;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
        }
      }

      function renderSessionTabs(layout, sessions, activeSession) {
        if (!(layout.tabs instanceof HTMLElement)) {
          return;
        }
        const signature = buildSessionTabsSignature(sessions);
        if (signature !== state.renderedSessionTabsSignature) {
          layout.tabs.innerHTML = sessions
            .map((session) => {
              const active = session.id === activeSession.id;
              var tabIconsHtml = "";
              var tabChannelIconSrc = channelIconUrl(session.channelLabel);
              if (tabChannelIconSrc) {
                tabIconsHtml += '<img class="session-icon" src="' + escapeInline(tabChannelIconSrc) + '" alt="' + escapeInline(session.channelLabel) + '" title="' + escapeInline(session.channelLabel) + '" referrerpolicy="no-referrer" onerror="this.remove()" />';
              }
              var tabIconsPrefix = tabIconsHtml ? '<span class="session-icons">' + tabIconsHtml + '</span>' : "";
              return '<button class="session-tab' + (active ? " active" : "") + '" type="button" role="tab" aria-selected="' + String(active) + '" data-session-tab-id="' + escapeInline(session.id) + '">' +
                '<div class="session-tab-row">' +
                  '<div class="session-tab-title" title="' + escapeInline(session.label) + '">' + tabIconsPrefix + escapeInline(session.label) + '</div>' +
                '</div>' +
              '</button>';
            })
            .join("");
          state.renderedSessionTabsSignature = signature;
        }
        updateSessionTabSelection(activeSession.id);
      }

      function renderSessionPanelHeader(layout, activeSession) {
        if (!(layout.panel instanceof HTMLElement) || !(layout.panelHeader instanceof HTMLElement)) {
          return;
        }
        layout.panel.setAttribute("data-session-panel-id", activeSession.id);
        const signature = buildSessionHeaderSignature(activeSession);
        if (signature === state.renderedSessionHeaderSignature) {
          return;
        }

        var iconsHtml = "";
        var chIconSrc = channelIconUrl(activeSession.channelLabel);
        if (chIconSrc) {
          iconsHtml += '<img class="session-icon" src="' + escapeInline(chIconSrc) + '" alt="' + escapeInline(activeSession.channelLabel) + '" title="' + escapeInline(activeSession.channelLabel) + '" referrerpolicy="no-referrer" onerror="this.remove()" />';
        }
        var titleIconsPrefix = iconsHtml ? '<span class="session-icons">' + iconsHtml + '</span>' : '';
        var routingSubtitle = activeSession.routingLabel
          ? '<div class="session-panel-subtitle mono" title="' + escapeInline(activeSession.routingLabel) + '">' + escapeInline(activeSession.routingLabel) + '</div>'
          : '';

        layout.panelHeader.innerHTML =
          '<div class="session-panel-title" title="' + escapeInline(activeSession.label) + '">' + titleIconsPrefix + escapeInline(activeSession.label) + '</div>' +
          routingSubtitle;
        state.renderedSessionHeaderSignature = signature;
      }

      function renderSessionPanelBody(layout, activeSession) {
        if (!(layout.panelBody instanceof HTMLElement)) {
          return;
        }
        const body = activeSession.instances
          .map((instance) => {
            const instanceExpanded = isSessionInstanceExpanded(instance.id);
            const instanceBody = instance.runs
              .map((runGroup) => {
                if (runGroup.attempts.length <= 1) {
                  const attempt = runGroup.attempts[0];
                  const selected = attempt.runAttemptId === state.selectedRunAttemptId ? " active" : "";
                  const recordTitle = formatSidebarTimeWithStatus(runGroup.updatedAt, attempt.status);
                  return '<button class="record' + selected + '" type="button" data-run-attempt-id="' + escapeInline(attempt.runAttemptId) + '">' +
                    '<div class="record-head">' +
                      '<div>' +
                        '<div class="record-title" title="' + escapeInline(recordTitle) + '">' + escapeInline(recordTitle) + '</div>' +
                      '</div>' +
                    '</div>' +
                  '</button>';
                }

                const runExpanded = isRunExpanded(runGroup.id);
                const attempts = runGroup.attempts
                  .map((attempt) => {
                    const selected = attempt.runAttemptId === state.selectedRunAttemptId ? " active" : "";
                    const title = formatAttemptLabel(attempt);
                    const subtitle = formatSidebarTimeWithStatus(attempt.updatedAt, attempt.status);
                    return '<button class="record' + selected + '" type="button" data-run-attempt-id="' + escapeInline(attempt.runAttemptId) + '">' +
                      '<div class="record-head">' +
                        '<div>' +
                          '<div class="record-title" title="' + escapeInline(title) + '">' + escapeInline(title) + '</div>' +
                          '<div class="record-subtitle mono" title="' + escapeInline(subtitle) + '">' + escapeInline(subtitle) + '</div>' +
                        '</div>' +
                      '</div>' +
                    '</button>';
                  })
                  .join("");
                const latestAttempt = runGroup.attempts[0];
                const runTitle = formatSidebarTimeWithStatus(runGroup.updatedAt, latestAttempt && latestAttempt.status);

                return '<section class="run-group' + (runExpanded ? " expanded" : "") + '">' +
                  '<button class="run-toggle" type="button" data-run-group-id="' + escapeInline(runGroup.id) + '" aria-expanded="' + String(runExpanded) + '">' +
                    '<div class="run-toggle-row">' +
                      '<span class="run-caret mono" aria-hidden="true">&gt;</span>' +
                      '<div>' +
                        '<div class="run-title" title="' + escapeInline(runTitle) + '">' + escapeInline(runTitle) + '</div>' +
                      '</div>' +
                    '</div>' +
                  '</button>' +
                  (runExpanded ? '<div class="run-body">' + attempts + '</div>' : "") +
                '</section>';
              })
              .join("");

            const instanceCostLabel = formatCostPairInline(instance);
            const instanceCostLine = instanceCostLabel
              ? '<div class="session-instance-cost mono">' + escapeInline(instanceCostLabel) + '</div>'
              : '';
            return '<section class="session-instance-group' + (instanceExpanded ? " expanded" : "") + '">' +
              '<button class="session-instance-toggle" type="button" data-session-instance-id="' + escapeInline(instance.id) + '" aria-expanded="' + String(instanceExpanded) + '">' +
                '<div class="session-instance-row">' +
                  '<span class="session-instance-caret mono" aria-hidden="true">&gt;</span>' +
                  '<div>' +
                    '<div class="session-instance-title" title="' + escapeInline(instance.routingLabel || "Session instance") + '">' + escapeInline(instance.routingLabel || "Session instance") + '</div>' +
                    instanceCostLine +
                  '</div>' +
                '</div>' +
              '</button>' +
              (instanceExpanded ? '<div class="session-instance-body">' + instanceBody + '</div>' : "") +
            '</section>';
          })
          .join("");

        layout.panelBody.innerHTML = body;
      }

      function renderRuns() {
        const sessions = buildSessionGroups(getFilteredRuns());
        ensureExpandedGroups(sessions);

        if (!sessions.length) {
          nodes.runs.innerHTML = '<div class="empty" style="padding: 18px;">No matching runs.</div>';
          state.renderedSessionTabsSignature = "";
          state.renderedSessionHeaderSignature = "";
          return;
        }

        const activeSession = sessions.find((session) => session.id === state.activeSessionGroupId) || sessions[0];
        const layout = ensureRunBrowserLayout();
        renderSessionTabs(layout, sessions, activeSession);
        renderSessionPanelHeader(layout, activeSession);
        renderSessionPanelBody(layout, activeSession);
      }

      function findRenderedRunAttemptButton(runAttemptId) {
        if (!runAttemptId) return null;
        for (const button of nodes.runs.querySelectorAll(".record")) {
          if (button.getAttribute("data-run-attempt-id") === runAttemptId) {
            return button;
          }
        }
        return null;
      }

      function updateSelectedRunButtons(nextRunAttemptId) {
        for (const button of nodes.runs.querySelectorAll(".record.active")) {
          if (button.getAttribute("data-run-attempt-id") !== nextRunAttemptId) {
            button.classList.remove("active");
          }
        }
        const nextButton = findRenderedRunAttemptButton(nextRunAttemptId);
        if (nextButton) {
          nextButton.classList.add("active");
        }
      }

      function renderDetail() {
        const run = state.detail;
        if (!run) {
          nodes.detailTitle.textContent = "Waiting for data";
          nodes.detailSubtitle.textContent = "Select an attempt from the left pane.";
          nodes.statusChip.style.display = "none";
          nodes.costChip.style.display = "none";
          nodes.durationChip.style.display = "none";
          nodes.detailStats.innerHTML = "";
          nodes.detailBody.innerHTML = '<div class="empty">No runs yet.</div>';
          return;
        }

        nodes.detailTitle.textContent = [run.context.provider, run.context.model].filter(Boolean).join(" / ");
        nodes.detailSubtitle.textContent = run.runAttemptId;

        var status = run.meta.status || "inflight";
        nodes.statusChip.textContent = status;
        nodes.statusChip.className = "chip mono status-chip status-" + status;
        nodes.statusChip.style.display = "";

        var costText = formatCostPairInline(run.usage);
        nodes.costChip.textContent = costText;
        var costTitle = formatRunCostTitle(run.usage);
        if (costTitle) {
          nodes.costChip.title = costTitle;
        } else {
          nodes.costChip.removeAttribute("title");
        }
        nodes.costChip.style.display = costText ? "" : "none";

        var durationText = formatDuration(run.meta.durationMs);
        nodes.durationChip.textContent = durationText;
        nodes.durationChip.style.display = durationText === "n/a" ? "none" : "";

        const llmInputEvent = buildLlmInputEvent(run);
        const llmInputCtx = buildLlmInputContextSnapshot(run);

        var statsHtml = [];
        var costBreakdownCallout = renderCostBreakdownCallout(run);
        if (costBreakdownCallout) {
          statsHtml.push(costBreakdownCallout);
        }
        if (run.meta.error) {
          statsHtml.push('<div class="callout error">Error: ' + escapeInline(run.meta.error) + "</div>");
        }
        nodes.detailStats.innerHTML = statsHtml.join("");

        var html = "";

        if (state.activeTab === "input") {
          html += renderPromptSection("System Prompt", llmInputEvent.systemPrompt || "");
          html += renderPromptSection("Prompt", llmInputEvent.prompt || "");

          var historyMessages = llmInputEvent.historyMessages || [];
          var toolCallMap = buildToolCallMap(historyMessages);
          if (historyMessages.length > 0) {
            html += '<div>' +
              '<div class="section-label">History Messages (' + historyMessages.length + ')</div>' +
              '<details' + (historyMessages.length <= 10 ? ' open' : '') + '>' +
                '<summary>' + (historyMessages.length <= 10 ? 'Messages' : historyMessages.length + ' messages (click to expand)') + '</summary>' +
                '<div class="chat-list" style="padding: 10px 14px 14px;">' +
                  historyMessages.map(function (m) { return renderChatMessage(m, toolCallMap); }).join("") +
                '</div>' +
              '</details>' +
            '</div>';
          }

          html += '<hr class="section-divider">';
          html += '<div class="debug-group-label">Raw Debug Data</div>';

          html += '<details class="raw-debug">' +
            '<summary>LLM Input Event (Raw JSON)</summary>' +
            '<pre>' + escapeInline(JSON.stringify(llmInputEvent, null, 2)) + '</pre>' +
          '</details>';

          html += '<details class="raw-debug">' +
            '<summary>LLM Input Context Snapshot</summary>' +
            '<pre>' + escapeInline(JSON.stringify(llmInputCtx, null, 2)) + '</pre>' +
          '</details>';
        } else {
          var outputMessages = run.output.messages || [];
          var assistantTexts = run.output.assistantTexts || [];
          if (assistantTexts.length > 0) {
            html += '<details open>' +
              '<summary>Assistant Texts (' + assistantTexts.length + ')</summary>' +
              '<div class="chat-list" style="padding: 10px 14px 14px;">' +
                assistantTexts.map(function (text, i) {
                  return '<div class="chat-msg role-assistant">' +
                    '<span class="chat-role">assistant #' + (i + 1) + '</span>' +
                    '<div class="chat-content">' + escapeInline(typeof text === "string" ? text : JSON.stringify(text, null, 2)) + '</div>' +
                  '</div>';
                }).join("") +
              '</div>' +
            '</details>';
          }
          if (outputMessages.length > 0) {
            html += '<details>' +
              '<summary>Messages (' + outputMessages.length + ')</summary>' +
              '<div class="chat-list" style="padding: 10px 14px 14px;">' +
                outputMessages.map(function (m) { return renderChatMessage(m, buildToolCallMap(outputMessages)); }).join("") +
              '</div>' +
            '</details>';
          }

          html += '<details>' +
            '<summary>Usage</summary>' +
            '<pre>' + escapeInline(JSON.stringify(pickOpenClawUsageFields(run.usage), null, 2)) + '</pre>' +
          '</details>';

          if (assistantTexts.length === 0 && outputMessages.length === 0) {
            html += '<div class="empty">No output data yet.</div>';
          }
        }

        nodes.detailBody.innerHTML = html;

        for (var btn of nodes.detailBody.querySelectorAll(".prompt-expand-btn")) {
          btn.addEventListener("click", function () {
            var block = this.closest(".prompt-block");
            if (!block) return;
            var isCollapsed = block.classList.contains("collapsed");
            block.classList.toggle("collapsed", !isCollapsed);
            this.textContent = isCollapsed ? "Show less" : "Show more";
          });
        }
      }

      function renderPromptSection(label, text) {
        if (!text) return "";
        var needsCollapse = text.length > 500 || text.split("\\n").length > 8;
        return '<div>' +
          '<div class="section-label">' + escapeInline(label) + '</div>' +
          '<div class="prompt-block' + (needsCollapse ? ' collapsed' : '') + '">' +
            '<pre>' + escapeInline(text) + '</pre>' +
            (needsCollapse ? '<button class="prompt-expand-btn" type="button">Show more</button>' : '') +
          '</div>' +
        '</div>';
      }

      function shortenPath(p) {
        if (!p) return p;
        return p.replace(/^\\/Users\\/[^/]+(\\/|$)/, "~$1")
                .replace(/^\\/home\\/[^/]+(\\/|$)/, "~$1")
                .replace(/^C:\\\\Users\\\\[^\\\\]+(\\\\|$)/i, "~$1");
      }

      function parseToolArgs(fn) {
        if (typeof fn.arguments === "string") {
          try { return JSON.parse(fn.arguments); } catch (e) { return null; }
        }
        return fn.arguments || null;
      }

      function resolveToolDetail(name, args) {
        var key = (name || "").trim().toLowerCase();
        var a = (args && typeof args === "object") ? args : {};

        var path = a.path || a.file_path || a.filePath || "";
        if (path) path = shortenPath(path);

        if (key === "read") {
          if (!path) return null;
          var offset = typeof a.offset === "number" ? a.offset : undefined;
          var limit = typeof a.limit === "number" ? a.limit : undefined;
          if (offset && limit) return "lines " + offset + "-" + (offset + limit - 1) + " from " + path;
          if (offset) return "from line " + offset + " in " + path;
          return path;
        }
        if (key === "write" || key === "create") {
          if (!path) return null;
          var len = typeof a.content === "string" ? a.content.length : 0;
          return path + (len ? " (" + len + " chars)" : "");
        }
        if (key === "edit") {
          if (!path) return null;
          return path;
        }
        if (key === "exec" || key === "bash") {
          var cmd = a.command || a.cmd || "";
          if (!cmd) return null;
          var first = cmd.split("\\n")[0].trim();
          return first.length > 80 ? first.slice(0, 77) + "…" : first;
        }
        if (key === "web_search") {
          return a.query ? '"' + a.query + '"' : null;
        }
        if (key === "web_fetch") {
          return a.url || null;
        }
        if (key === "attach") {
          return path ? "from " + path : null;
        }
        if (path) return path;
        return null;
      }

      function toolDisplayLabel(name) {
        var key = (name || "tool").trim().toLowerCase();
        var labels = {
          read: "Read", write: "Write", create: "Create", edit: "Edit",
          exec: "Exec", bash: "Bash", web_search: "Search", web_fetch: "Fetch",
          attach: "Attach", message_send: "Message", sessions_send: "Session Send",
          browser: "Browser",
        };
        if (labels[key]) return labels[key];
        return (name || "Tool").replace(/_/g, " ").replace(/\\b\\w/g, function (c) { return c.toUpperCase(); });
      }

      function buildToolCallMap(messages) {
        var map = {};
        for (var i = 0; i < messages.length; i++) {
          var m = messages[i];
          var calls = (m && (m.tool_calls || m.toolCalls)) || null;
          if (!Array.isArray(calls)) continue;
          for (var j = 0; j < calls.length; j++) {
            var tc = calls[j];
            var fn = tc.function || tc;
            var id = tc.id || tc.tool_call_id || tc.toolCallId;
            if (!id) continue;
            map[id] = { name: fn.name || tc.name || "", args: parseToolArgs(fn) };
          }
        }
        return map;
      }

      function renderChatMessage(msg, toolCallMap) {
        var role = (msg && msg.role) || "unknown";
        var roleLower = role.toLowerCase();

        var isToolResult = roleLower === "tool" || roleLower === "function" ||
          (msg && (msg.tool_call_id || msg.toolCallId));
        var toolCalls = (msg && (msg.tool_calls || msg.toolCalls)) || null;
        var hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;

        if (isToolResult) {
          roleLower = "tool";
        }

        var content = "";
        if (typeof msg === "string") {
          content = msg;
        } else if (msg && typeof msg.content === "string") {
          content = msg.content;
        } else if (msg && Array.isArray(msg.content)) {
          content = msg.content.map(function (item) {
            if (typeof item === "string") return item;
            if (item && item.type === "text" && typeof item.text === "string") return item.text;
            return JSON.stringify(item, null, 2);
          }).join("\\n");
        } else if (msg) {
          content = JSON.stringify(msg.content != null ? msg.content : msg, null, 2);
        }

        var roleClass = "role-" + roleLower.replace(/[^a-z]/g, "");
        var extraClass = hasToolCalls ? " has-tool-calls" : "";

        var badgeHtml = "";
        var toolResultDetail = "";
        if (isToolResult) {
          var toolName = (msg && (msg.name || msg.toolName || msg.tool_name)) || "";
          var label = toolDisplayLabel(toolName);
          badgeHtml = '<span class="chat-role-badge badge-tool-result">' + escapeInline(label) + ' result</span>';

          var tcId = msg && (msg.tool_call_id || msg.toolCallId);
          if (tcId && toolCallMap && toolCallMap[tcId]) {
            var matched = toolCallMap[tcId];
            toolResultDetail = resolveToolDetail(matched.name || toolName, matched.args) || "";
          }
        } else if (hasToolCalls) {
          badgeHtml = '<span class="chat-role-badge badge-tool-call">' +
            toolCalls.length + ' tool call' + (toolCalls.length > 1 ? 's' : '') + '</span>';
        }

        var html = '<div class="chat-msg ' + roleClass + extraClass + '">';
        html += '<span class="chat-role">' + escapeInline(role) + badgeHtml + '</span>';

        if (isToolResult) {
          var contentLen = content ? content.length : 0;
          var isLong = contentLen > 300;
          html += '<div class="tool-result-summary">';
          if (toolResultDetail) {
            html += '<span class="tool-result-detail">' + escapeInline(toolResultDetail) + '</span> · ';
          }
          html += '<span class="tool-result-size">' + contentLen.toLocaleString() + ' chars</span>';
          html += '</div>';
          if (content) {
            html += '<details' + (isLong ? '' : ' open') + '>';
            html += '<summary>Output</summary>';
            html += '<div class="chat-content">' + escapeInline(content) + '</div>';
            html += '</details>';
          }
        } else if (content) {
          html += '<div class="chat-content">' + escapeInline(content) + '</div>';
        }

        if (hasToolCalls) {
          html += '<div class="tool-calls-list">';
          for (var i = 0; i < toolCalls.length; i++) {
            var tc = toolCalls[i];
            var fn = (tc.function || tc);
            var tcName = fn.name || tc.name || "unnamed";
            var tcLabel = toolDisplayLabel(tcName);
            var tcArgsObj = parseToolArgs(fn);
            var tcDetail = resolveToolDetail(tcName, tcArgsObj);

            html += '<div class="tool-call-item">';
            html += '<div class="tool-call-name">' + escapeInline(tcLabel);
            if (tcDetail) {
              html += ' <span class="tool-call-detail">' + escapeInline(tcDetail) + '</span>';
            }
            html += '</div>';

            if (tcArgsObj) {
              var tcArgsStr = JSON.stringify(tcArgsObj, null, 2);
              html += '<details><summary class="tool-call-args-toggle">args</summary>';
              html += '<div class="tool-call-args">' + escapeInline(tcArgsStr) + '</div>';
              html += '</details>';
            }
            html += '</div>';
          }
          html += '</div>';
        }

        html += '</div>';
        return html;
      }

      function renderDetailItem(label, value) {
        const displayValue = value === undefined || value === null || value === "" ? "n/a" : String(value);
        return '<div class="detail-item"><strong>' + escapeInline(label) + '</strong><div class="value mono">' + escapeInline(displayValue) + "</div></div>";
      }

      function buildLlmInputEvent(run) {
        if (run.llmInput && run.llmInput.event) {
          return run.llmInput.event;
        }
        return {
          runId: run.runId,
          sessionId: run.context.sessionId || "",
          provider: run.context.provider,
          model: run.context.model,
          ...(run.input.systemPrompt ? { systemPrompt: run.input.systemPrompt } : {}),
          prompt: run.input.prompt || "",
          historyMessages: run.input.historyMessages || [],
          imagesCount: typeof run.input.imagesCount === "number" ? run.input.imagesCount : 0,
        };
      }

      function buildLlmInputContextSnapshot(run) {
        if (run.llmInput && run.llmInput.ctx) {
          return run.llmInput.ctx;
        }
        return {
          runId: run.runId,
          ...(run.context.agentId ? { agentId: run.context.agentId } : {}),
          ...(run.context.sessionKey ? { sessionKey: run.context.sessionKey } : {}),
          ...(run.context.sessionId ? { sessionId: run.context.sessionId } : {}),
          ...(run.context.workspaceDir ? { workspaceDir: run.context.workspaceDir } : {}),
          ...(run.context.messageProvider ? { messageProvider: run.context.messageProvider } : {}),
          ...(run.context.trigger ? { trigger: run.context.trigger } : {}),
          ...(run.context.channelId ? { channelId: run.context.channelId } : {}),
        };
      }

      function upsertRun(runSummary) {
        const next = state.runs.filter((run) => run.runAttemptId !== runSummary.runAttemptId);
        next.unshift(runSummary);
        next.sort((left, right) => right.updatedAt - left.updatedAt);
        state.runs = next.slice(0, 200);
        const sessionId = buildSessionGroupId(runSummary);
        const sessionInstanceId = buildSessionInstanceGroupId(sessionId, runSummary);
        if (!state.selectedRunAttemptId || state.selectedRunAttemptId === runSummary.runAttemptId) {
          setActiveSessionGroup(sessionId);
          setSessionInstanceExpanded(sessionInstanceId, true);
          setRunExpanded(buildRunGroupId(sessionInstanceId, runSummary), true);
        }
        syncFilterOptions();
        renderRuns();
      }

      async function selectRunAttempt(runAttemptId) {
        const previousRunAttemptId = state.selectedRunAttemptId;
        state.selectedRunAttemptId = runAttemptId;
        const selectedSummary = state.runs.find((run) => run.runAttemptId === runAttemptId);
        const hasRenderedButton = Boolean(findRenderedRunAttemptButton(runAttemptId));
        let shouldRenderRuns = !hasRenderedButton;
        if (selectedSummary) {
          const sessionId = buildSessionGroupId(selectedSummary);
          if (!isSessionActive(sessionId)) {
            setActiveSessionGroup(sessionId);
            shouldRenderRuns = true;
          }
          const sessionInstanceId = buildSessionInstanceGroupId(sessionId, selectedSummary);
          if (!hasRenderedButton && !isSessionInstanceExpanded(sessionInstanceId)) {
            setSessionInstanceExpanded(sessionInstanceId, true);
            shouldRenderRuns = true;
          }
          const runGroupId = buildRunGroupId(sessionInstanceId, selectedSummary);
          if (!hasRenderedButton && !isRunExpanded(runGroupId)) {
            setRunExpanded(runGroupId, true);
            shouldRenderRuns = true;
          }
        }
        if (shouldRenderRuns) {
          renderRuns();
        } else if (previousRunAttemptId !== runAttemptId) {
          updateSelectedRunButtons(runAttemptId);
        }
        await loadRunAttemptDetail(runAttemptId);
      }

      async function loadRunAttemptDetail(runAttemptId) {
        state.loadingDetail = true;
        try {
          const payload = await fetchJson(BASE_PATH + "/api/run-attempt/" + encodeURIComponent(runAttemptId));
          state.detail = payload.run;
          renderDetail();
        } catch (error) {
          state.detail = null;
          nodes.detailBody.innerHTML = '<div class="callout error">Failed to load detail: ' + escapeInline(error.message || String(error)) + '</div>';
        } finally {
          state.loadingDetail = false;
        }
      }

      async function refreshRecentRuns() {
        state.refreshingRecent = true;
        nodes.refreshButton.disabled = true;
        nodes.refreshButton.textContent = "Refreshing";
        const payload = await fetchJson(BASE_PATH + "/api/recent");
        const nextRuns = payload.runs || [];
        const previousSelectedSummary = state.runs.find((run) => run.runAttemptId === state.selectedRunAttemptId);
        state.runs = nextRuns;
        syncFilterOptions();
        renderRuns();

        if (!state.selectedRunAttemptId && state.runs.length > 0) {
          await selectRunAttempt(state.runs[0].runAttemptId);
          return;
        }

        if (state.selectedRunAttemptId) {
          const selectedSummary = state.runs.find((run) => run.runAttemptId === state.selectedRunAttemptId);
          if (!selectedSummary) {
            state.detail = null;
            state.selectedRunAttemptId = null;
            renderDetail();
            if (state.runs.length > 0) {
              await selectRunAttempt(state.runs[0].runAttemptId);
            }
            return;
          }
          if (
            !state.detail ||
            state.detail.runAttemptId !== selectedSummary.runAttemptId ||
            !previousSelectedSummary ||
            selectedSummary.updatedAt !== previousSelectedSummary.updatedAt
          ) {
            await loadRunAttemptDetail(selectedSummary.runAttemptId);
          }
        }
      }

      async function loadRecentRuns() {
        try {
          await refreshRecentRuns();
        } finally {
          state.refreshingRecent = false;
          nodes.refreshButton.disabled = false;
          nodes.refreshButton.textContent = "Refresh";
        }
      }

      function connectEvents() {
        if (!TOKEN) {
          nodes.connectionState.textContent = "missing token";
          nodes.connectionState.classList.add("error");
          return;
        }
        const source = new EventSource(withToken(BASE_PATH + "/api/events"));
        source.addEventListener("open", () => {
          nodes.connectionState.textContent = "live";
          nodes.connectionState.classList.remove("error");
        });
        source.addEventListener("error", () => {
          nodes.connectionState.textContent = "reconnecting";
        });
        source.addEventListener("upsert", async (event) => {
          try {
            const payload = JSON.parse(event.data);
            upsertRun(payload.run);
            if (state.selectedRunAttemptId === payload.run.runAttemptId) {
              await loadRunAttemptDetail(payload.run.runAttemptId);
            }
          } catch (error) {
            console.error("run-observer SSE parse error", error);
          }
        });
      }

      nodes.refreshButton.addEventListener("click", () => {
        if (state.refreshingRecent) {
          return;
        }
        refreshRecentRuns()
          .catch((error) => {
            nodes.connectionState.textContent = "refresh failed";
            nodes.connectionState.classList.add("error");
            console.error("run-observer manual refresh failed", error);
          })
          .finally(() => {
            state.refreshingRecent = false;
            nodes.refreshButton.disabled = false;
            nodes.refreshButton.textContent = "Refresh";
          });
      });

      loadRecentRuns()
        .then(connectEvents)
        .catch((error) => {
          nodes.connectionState.textContent = "error";
          nodes.connectionState.classList.add("error");
          nodes.runs.innerHTML = '<div class="callout error">Failed to load runs: ' + escapeInline(error.message || String(error)) + '</div>';
        });
    </script>
  </body>
</html>`;
}
