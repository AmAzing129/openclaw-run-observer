import type { RunObserverRunSummary } from "../types.js";

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

export type RunObserverSidebarAgentChannelGroup = {
  id: string;
  label: string;
  channelLabel: string;
  updatedAt: number;
  sessions: RunObserverSidebarSessionGroup[];
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

export function buildAgentChannelSidebarGroups(
  runs: RunObserverRunSummary[],
): RunObserverSidebarAgentChannelGroup[] {
  const normalizeText = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const grouped = new Map<
    string,
    {
      id: string;
      label: string;
      channelLabel: string;
      updatedAt: number;
      sessions: RunObserverSidebarSessionGroup[];
    }
  >();

  for (const session of buildSessionSidebarGroups(runs)) {
    const label = normalizeText(session.label) || "Agent session";
    const channelLabel = normalizeText(session.channelLabel) || "Unknown channel";
    const agentChannelGroupId = "agent-channel:" + label + "::" + channelLabel;
    const existing = grouped.get(agentChannelGroupId) || {
      id: agentChannelGroupId,
      label,
      channelLabel,
      updatedAt: session.updatedAt,
      sessions: [],
    };

    if (session.updatedAt >= existing.updatedAt) {
      existing.updatedAt = session.updatedAt;
      existing.label = label;
      existing.channelLabel = channelLabel;
    }

    existing.sessions.push(session);
    grouped.set(agentChannelGroupId, existing);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      sessions: group.sessions.sort(
        (left, right) => right.updatedAt - left.updatedAt,
      ),
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
