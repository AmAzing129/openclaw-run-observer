import { describe, expect, it } from "vitest";
import {
  buildSessionSidebarGroups,
  pickOpenClawUsageFields,
  renderRunObserverHtml,
} from "../src/html.js";
import type { RunObserverRunSummary } from "../src/types.js";

function makeRunSummary(
  overrides: Partial<RunObserverRunSummary> = {},
): RunObserverRunSummary {
  return {
    runAttemptId: "run-a:1",
    runId: "run-a",
    attemptOrdinal: 1,
    storageDay: "2026-04-02",
    agentId: "agent:main",
    sessionId: "session-a",
    provider: "openai",
    model: "gpt-5.4",
    status: "completed",
    usageStatus: "available",
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe("pickOpenClawUsageFields", () => {
  it("keeps only OpenClaw usage payload fields", () => {
    expect(
      pickOpenClawUsageFields({
        input: 120,
        output: 48,
        cacheRead: 12,
        cacheWrite: 3,
        total: 183,
        derivedTotalTokens: 999,
        latestPromptTokens: 777,
        reportedCostUsd: 0.1,
        estimatedCostUsd: 0.2,
        estimatedPricingUsdPerMillion: {
          input: 1,
          output: 2,
        },
      }),
    ).toEqual({
      input: 120,
      output: 48,
      cacheRead: 12,
      cacheWrite: 3,
      total: 183,
    });
  });

  it("returns an empty object when only plugin-added usage fields exist", () => {
    expect(
      pickOpenClawUsageFields({
        derivedTotalTokens: 999,
        latestPromptTokens: 777,
        reportedCostUsd: 0.1,
      }),
    ).toEqual({});
  });
});

describe("buildSessionSidebarGroups", () => {
  it("groups runs by sessionKey first and then by sessionId", () => {
    const groups = buildSessionSidebarGroups([
      makeRunSummary({
        runAttemptId: "run-a:1",
        runId: "run-a",
        attemptOrdinal: 1,
        sessionId: "session-1",
        sessionKey: "agent:lobehub:discord:channel:1487002333144547400",
        updatedAt: 100,
      }),
      makeRunSummary({
        runAttemptId: "run-a:2",
        runId: "run-a",
        attemptOrdinal: 2,
        sessionId: "session-1",
        sessionKey: "agent:lobehub:discord:channel:1487002333144547400",
        updatedAt: 200,
      }),
      makeRunSummary({
        runAttemptId: "run-b:1",
        runId: "run-b",
        attemptOrdinal: 1,
        sessionId: "session-2",
        sessionKey: "agent:lobehub:discord:channel:1487002333144547400",
        updatedAt: 300,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.routingLabel).toBe("agent:lobehub:discord:channel:1487002333144547400");
    expect(groups[0]?.instances.map((instance) => instance.sessionId)).toEqual(["session-2", "session-1"]);
    expect(groups[0]?.instances[0]?.runs.map((runGroup) => runGroup.runId)).toEqual(["run-b"]);
    expect(groups[0]?.instances[1]?.runs.map((runGroup) => runGroup.runId)).toEqual(["run-a"]);
    expect(groups[0]?.instances[1]?.runs[0]?.attempts.map((attempt) => attempt.runAttemptId)).toEqual(["run-a:2", "run-a:1"]);
  });

  it("falls back to sessionId when sessionKey is absent", () => {
    const groups = buildSessionSidebarGroups([
      makeRunSummary({
        runAttemptId: "run-a:1",
        sessionId: "session-1",
        updatedAt: 100,
      }),
      makeRunSummary({
        runAttemptId: "run-b:1",
        runId: "run-b",
        sessionId: "session-2",
        updatedAt: 200,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.routingLabel)).toEqual(["session-2", "session-1"]);
    expect(groups.map((group) => group.instances[0]?.sessionId)).toEqual(["session-2", "session-1"]);
  });
});

describe("renderRunObserverHtml", () => {
  it("renders the usage panel from filtered OpenClaw usage fields only", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain("const pickOpenClawUsageFields = function pickOpenClawUsageFields");
    expect(html).toContain("JSON.stringify(pickOpenClawUsageFields(run.usage), null, 2)");
    expect(html).not.toContain("JSON.stringify(run.usage || { status: usageState }, null, 2)");
    expect(html).not.toContain("usageCostHtml +");
  });

  it("embeds channel and provider icon mappings for session badges", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('var SIMPLE_ICONS_CDN_BASE = "https://cdn.simpleicons.org";');
    expect(html).toContain(
      'var LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE = "https://unpkg.com/@lobehub/icons-static-png@latest/light";',
    );
    expect(html).toContain('"discord":"discord"');
    expect(html).toContain('"telegram":"telegram"');
    expect(html).toContain('"openai":"openai"');
    expect(html).toContain('"vercel":"vercel"');
    expect(html).toContain('"doubao":"bytedance-color"');
    expect(html).toContain('"01":"zeroone"');
    expect(html).toContain("return lobehubPngIconUrl(slug);");
    expect(html).toContain('return SIMPLE_ICONS_CDN_BASE + "/" + encodeURIComponent(slug);');
    expect(html).toContain(
      'return LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE + "/" + encodeURIComponent(slug) + ".png";',
    );
    expect(html).toContain('referrerpolicy="no-referrer" onerror="this.remove()"');
    expect(html).toContain("tabIconsPrefix + escapeInline(session.label)");
    expect(html).toContain("titleIconsPrefix + escapeInline(activeSession.label)");
  });

  it("avoids rerendering the full run list when switching between already visible runs", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain("function updateSelectedRunButtons(nextRunAttemptId)");
    expect(html).toContain("const hasRenderedButton = Boolean(findRenderedRunAttemptButton(runAttemptId));");
    expect(html).toContain("if (shouldRenderRuns) {");
    expect(html).toContain("updateSelectedRunButtons(runAttemptId);");
  });

  it("embeds nested session instance grouping for sessionKey buckets", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain("activeSessionGroupId");
    expect(html).toContain('role="tablist"');
    expect(html).toContain("data-session-tab-id");
    expect(html).toContain("findFirstAttemptIdForSessionGroup");
    expect(html).toContain("const buildSessionSidebarInstanceId = function buildSessionSidebarInstanceId");
    expect(html).not.toContain("formatCostPairInline(session)");
    expect(html).not.toContain("formatCostPairInline(activeSession)");
    expect(html).not.toContain("formatSidebarTime(session.updatedAt)");
    expect(html).not.toContain("formatSidebarTime(activeSession.updatedAt)");
    expect(html).not.toContain("session.updatedAt].join(\"|\")");
    expect(html).not.toContain("session.updatedAt,");
  });

  it("allows long sessionKey subtitles to wrap in the session panel", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain(".session-panel-subtitle {");
    expect(html).toContain("overflow: visible;");
    expect(html).toContain("text-overflow: clip;");
    expect(html).toContain("white-space: normal;");
    expect(html).toContain("overflow-wrap: anywhere;");
  });

  it("does not repeat the channel label beneath the session header", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).not.toContain(".session-panel-meta {");
    expect(html).not.toContain("var panelMeta = activeSession.channelLabel");
    expect(html).not.toContain('escapeInline(activeSession.channelLabel) + "</span>"');
  });

  it("shows cost only at the sessionId level in the sidebar run browser", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain(".session-instance-cost {");
    expect(html).toContain("instanceCostLine");
    expect(html).toContain('class="session-instance-cost mono"');
    expect(html).not.toContain("formatCostPairInline(attempt)");
    expect(html).not.toContain("attemptCostSuffix");
    expect(html).not.toContain("costSuffix");
  });

  it("shows timestamps only on run rows in the sidebar", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).not.toContain('class="session-instance-subtitle"');
    expect(html).not.toContain("formatSidebarTime(instance.updatedAt)");
    expect(html).toContain('if (status === "completed") return "✅";');
    expect(html).toContain('if (status === "failed") return "❌";');
    expect(html).toContain('if (status === "interrupted") return "⛔";');
    expect(html).toContain('if (status === "inflight") return "⏳";');
    expect(html).toContain("const runTitle = formatSidebarTimeWithStatus(runGroup.updatedAt, latestAttempt && latestAttempt.status);");
    expect(html).toContain("const subtitle = formatSidebarTimeWithStatus(attempt.updatedAt, attempt.status);");
  });

  it("formats inline costs as reported(estimated) without R/E labels", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('return formatCostValueOrNa(costs.reportedCostUsd) + "(" + formatCostValueOrNa(costs.estimatedCostUsd) + ")";');
    expect(html).not.toContain('"R " + formatCostValueOrNa(costs.reportedCostUsd)');
  });

  it("labels detail cost copy as current-run cost only", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('<div><strong>Run reported cost:</strong> ');
    expect(html).toContain('<div><strong>Run estimated cost:</strong> ');
    expect(html).toContain("<div><strong>Scope:</strong> current run only</div>");
    expect(html).toContain('return "Current run only. Reported: " +');
  });

  it("shows run attempt id in the detail subtitle instead of sessionKey", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('id="detail-subtitle"');
    expect(html).toContain("Select an attempt from the left pane.");
    expect(html).toContain("nodes.detailSubtitle.textContent = run.runAttemptId;");
    expect(html).not.toContain("nodes.detailSubtitle.textContent = run.context.sessionKey || run.runId;");
    expect(html).not.toContain('id="run-attempt-id-chip"');
    expect(html).not.toContain("runAttemptIdChip:");
  });
});
