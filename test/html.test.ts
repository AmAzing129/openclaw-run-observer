import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  renderRunObserverHtml,
} from "../src/html.js";
import { buildLocalIconSvgMap } from "../src/viewer/assets.js";
import { renderRunObserverClientScript } from "../src/viewer/client-script.js";
import {
  buildAgentChannelSidebarGroups,
  buildSessionSidebarGroups,
  pickOpenClawUsageFields,
} from "../src/viewer/grouping.js";
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

describe("buildAgentChannelSidebarGroups", () => {
  it("groups sessionKey buckets under agent and channel", () => {
    const groups = buildAgentChannelSidebarGroups([
      makeRunSummary({
        runAttemptId: "run-a:1",
        runId: "run-a",
        agentId: "main",
        messageProvider: "telegram",
        channelId: "telegram",
        sessionId: "session-1",
        sessionKey: "agent:main:telegram:direct:123",
        updatedAt: 100,
      }),
      makeRunSummary({
        runAttemptId: "run-b:1",
        runId: "run-b",
        agentId: "main",
        messageProvider: "telegram",
        channelId: "telegram",
        sessionId: "session-2",
        sessionKey: "agent:main:telegram:group:-100123:topic:77",
        updatedAt: 200,
      }),
      makeRunSummary({
        runAttemptId: "run-c:1",
        runId: "run-c",
        agentId: "main",
        messageProvider: "discord",
        channelId: "discord",
        sessionId: "session-3",
        sessionKey: "agent:main:discord:channel:1487002333144547400:thread:1001",
        updatedAt: 300,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      label: "main",
      channelLabel: "discord",
    });
    expect(groups[1]).toMatchObject({
      label: "main",
      channelLabel: "telegram",
    });
    expect(groups[1]?.sessions.map((session) => session.routingLabel)).toEqual([
      "agent:main:telegram:group:-100123:topic:77",
      "agent:main:telegram:direct:123",
    ]);
  });

  it("falls back to a sessionKey-derived channel when provider metadata is missing", () => {
    const groups = buildAgentChannelSidebarGroups([
      makeRunSummary({
        runAttemptId: "run-tui:1",
        runId: "run-tui",
        agentId: "main",
        messageProvider: "",
        channelId: "",
        sessionId: "session-tui",
        sessionKey: "agent:main:tui-4f1b4460-af84-42e8-baab-0f1757081876",
        updatedAt: 400,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "main",
      channelLabel: "tui",
    });
  });

  it("does not treat internal session routes as delivery channels", () => {
    const groups = buildAgentChannelSidebarGroups([
      makeRunSummary({
        runAttemptId: "run-main:1",
        runId: "run-main",
        agentId: "main",
        messageProvider: "",
        channelId: "",
        sessionId: "session-main",
        sessionKey: "agent:main:main",
        updatedAt: 450,
      }),
      makeRunSummary({
        runAttemptId: "run-subagent:1",
        runId: "run-subagent",
        agentId: "main",
        messageProvider: "",
        channelId: "",
        sessionId: "session-subagent",
        sessionKey: "agent:main:subagent:9d6b8634-3c4c-4bbd-bf41-0d4fa65c6d5f",
        updatedAt: 460,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "main",
      channelLabel: "Unknown channel",
    });
    expect(groups[0]?.sessions.map((session) => session.routingLabel)).toEqual([
      "agent:main:subagent:9d6b8634-3c4c-4bbd-bf41-0d4fa65c6d5f",
      "agent:main:main",
    ]);
  });

  it("prefers a sessionKey-derived channel over generic webchat metadata", () => {
    const groups = buildAgentChannelSidebarGroups([
      makeRunSummary({
        runAttemptId: "run-webchat-tui:1",
        runId: "run-webchat-tui",
        agentId: "main",
        messageProvider: "webchat",
        channelId: "webchat",
        sessionId: "session-webchat-tui",
        sessionKey: "agent:main:tui-4f1b4460-af84-42e8-baab-0f1757081876",
        updatedAt: 500,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "main",
      channelLabel: "tui",
    });
  });
});

describe("buildLocalIconSvgMap", () => {
  it("accepts SVG files with an xml declaration and leading comments", () => {
    const iconDirectory = mkdtempSync(
      path.join(tmpdir(), "run-observer-viewer-icons-"),
    );
    const svg =
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- generated asset -->\n<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6"/></svg>';

    try {
      writeFileSync(path.join(iconDirectory, "custom-icon.svg"), svg);

      expect(
        buildLocalIconSvgMap({
          iconDirectory,
          slugs: ["custom-icon"],
        }),
      ).toEqual({
        "custom-icon": svg,
      });
    } finally {
      rmSync(iconDirectory, { recursive: true, force: true });
    }
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

  it("keeps the viewer shell wired to token-aware API and SSE routes", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('const BASE_PATH = "/plugins/run-observer";');
    expect(html).toContain('const TOKEN = params.get("token") || "";');
    expect(html).toContain('id="connection-state-label">sync</span>');
    expect(html).toContain('const CONNECTION_STATE_META = {');
    expect(html).toContain('function setConnectionState(stateName, title) {');
    expect(html).toContain('setConnectionState("connecting");');
    expect(html).toContain('url.searchParams.set("token", TOKEN);');
    expect(html).toContain(
      'const payload = await fetchJson(BASE_PATH + "/api/run-attempt/" + encodeURIComponent(runAttemptId));',
    );
    expect(html).toContain('const payload = await fetchJson(BASE_PATH + "/api/recent");');
    expect(html).toContain(
      'const source = new EventSource(withToken(BASE_PATH + "/api/events"));',
    );
    expect(html).toContain('setConnectionState("live");');
    expect(html).toContain('setConnectionState("reconnecting");');
    expect(html).toContain('setConnectionState("error", "Missing viewer token");');
  });

  it("embeds local channel and provider SVG mappings for session badges", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain("var LOCAL_ICON_SVGS = {");
    expect(html).toContain('var OPENCLAW_MAIN_ICON_SLUG = "openclaw";');
    expect(html).toContain('"openclaw":"\\u003Csvg');
    expect(html).toContain('"discord":"discord"');
    expect(html).toContain('"telegram":"telegram"');
    expect(html).toContain('"tui":"ghostty"');
    expect(html).toContain('"weixin":"wechat"');
    expect(html).toContain('"wechat":"wechat"');
    expect(html).toContain('"openai":"openai"');
    expect(html).toContain('"vercel":"vercel"');
    expect(html).toContain('"doubao":"bytedance-color"');
    expect(html).toContain('"01":"zeroone"');
    expect(html).toContain("return LOCAL_ICON_SVGS[slug] || \"\";");
    expect(html).toContain("return localIconSvg(slug);");
    expect(html).not.toContain("simpleicons.org");
    expect(html).not.toContain("@lobehub/icons-static-png");
    expect(html).toContain("function renderProviderIcon(provider, model, className)");
    expect(html).toContain('class="agent-channel-tab-icon"');
    expect(html).toContain('class="agent-channel-tab-label"');
    expect(html).toContain('class="session-tab-icon"');
    expect(html).toContain('class="session-tab-heading"');
    expect(html).toContain('renderProviderIcon(attempt.provider, attempt.model, "record-provider-icon")');
    expect(html).toContain('renderProviderIcon(latestAttempt.provider, latestAttempt.model, "run-provider-icon")');
    expect(html).toContain('renderProviderIcon(provider, model, "detail-provider-icon")');
    expect(html).toContain(".record-provider-icon,");
    expect(html).toContain(".run-provider-icon,");
    expect(html).toContain(".detail-provider-icon {");
    expect(html).toContain("function isMainConversationSession(session)");
  });

  it("escapes inline SVG payloads before embedding them in the client script", () => {
    const script = renderRunObserverClientScript({
      basePath: "/plugins/run-observer",
      localIconSvgs: {
        danger:
          '<svg xmlns="http://www.w3.org/2000/svg"><desc></script><script>alert("x")</script></desc></svg>',
      },
    });

    expect(script).toContain("var LOCAL_ICON_SVGS = {");
    expect(script).toContain("\\u003C/script>");
    expect(script).not.toContain("</script>");
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

    expect(html).toContain(".topbar {");
    expect(html).toContain("z-index: 30;");
    expect(html).toContain(".sidebar.has-agent-channel-tabs {");
    expect(html).toContain(".sidebar-agent-bar {");
    expect(html).toContain("grid-template-columns: 92px minmax(0, 1fr);");
    expect(html).toContain("flex-direction: column;");
    expect(html).toContain("border-right: 1px solid var(--line);");
    expect(html).toContain("position: relative;");
    expect(html).toContain(".sidebar-sessions {");
    expect(html).toContain("min-height: 0;");
    expect(html).toContain("min-width: 0;");
    expect(html).toContain("scrollbar-gutter: stable;");
    expect(html).toContain("activeAgentChannelGroupId");
    expect(html).toContain("activeSessionGroupId");
    expect(html).toContain('class="sidebar-agent-bar"');
    expect(html).toContain("data-agent-channel-tab-id");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain("data-session-tab-id");
    expect(html).toContain("findFirstAttemptIdForSessionGroup");
    expect(html).toContain("const buildAgentChannelSidebarGroups = function buildAgentChannelSidebarGroups");
    expect(html).toContain("const buildSessionSidebarInstanceId = function buildSessionSidebarInstanceId");
    expect(html).toContain("grid-template-columns: 420px minmax(0, 1fr);");
    expect(html).toContain("min-width: 0;");
    expect(html).toContain("text-overflow: ellipsis;");
    expect(html).toContain("white-space: nowrap;");
    expect(html).toContain(".session-tab-title {");
    expect(html).toContain("overflow-wrap: anywhere;");
    expect(html).toContain(".agent-channel-tab-label {");
    expect(html).not.toContain("formatCostPairInline(session)");
    expect(html).not.toContain("formatCostPairInline(activeSession)");
    expect(html).not.toContain("formatSidebarTime(session.updatedAt)");
    expect(html).not.toContain("formatSidebarTime(activeSession.updatedAt)");
    expect(html).not.toContain("session.updatedAt].join(\"|\")");
    expect(html).toContain("String(session.instances.length)");
  });

  it("allows long sessionKey subtitles to wrap in the session tab", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain(".session-tab-title {");
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

  it("renders detail cost copy without extra scope messaging", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('<div><strong>Run reported cost:</strong> ');
    expect(html).toContain('<div><strong>Run estimated cost:</strong> ');
    expect(html).not.toContain("<div><strong>Scope:</strong> current run only</div>");
    expect(html).toContain('return "Reported: " +');
    expect(html).not.toContain('return "Current run only. Reported: " +');
  });

  it("adds copy buttons to detail blocks with clipboard fallback support", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('class="copy-block-btn action-button mono"');
    expect(html).toContain('class="copy-block-icon"');
    expect(html).toContain('class="visually-hidden"');
    expect(html).toContain("data-copy-block");
    expect(html).toContain("data-copy-label");
    expect(html).toContain("data-copy-source");
    expect(html).toContain('class="details-summary-actions"');
    expect(html).toContain("'<summary><span class=\"summary-title\">' + escapeInline(summary) + '</span></summary>' +");
    expect(html).toContain("'<div class=\"details-summary-actions\">' + renderCopyButton(summary) + '</div>' +");
    expect(html).not.toContain('<summary><span class="summary-row">');
    expect(html).toContain("nodes.detailBody.addEventListener(\"click\", async (event) => {");
    expect(html).toContain("await handleCopyButtonClick(target);");
    expect(html).toContain("function copyButtonIconSvg(stateName) {");
    expect(html).toContain("button.innerHTML = renderCopyButtonContents(label, stateName);");
    expect(html).toContain("async function writeTextToClipboard(text) {");
    expect(html).toContain("navigator.clipboard.writeText(text);");
    expect(html).toContain("document.execCommand(\"copy\")");
    expect(html).toContain("button.setAttribute(\"aria-label\", actionLabel);");
  });

  it("shows run attempt id in the detail subtitle instead of sessionKey", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain('id="detail-subtitle"');
    expect(html).toContain("Select an attempt from the left pane.");
    expect(html).toContain('class="detail-title-row"');
    expect(html).toContain("nodes.detailTitle.innerHTML = renderDetailTitle(run.context.provider, run.context.model);");
    expect(html).toContain("nodes.detailSubtitle.textContent = run.runAttemptId;");
    expect(html).not.toContain("nodes.detailSubtitle.textContent = run.context.sessionKey || run.runId;");
    expect(html).not.toContain('id="run-attempt-id-chip"');
    expect(html).not.toContain("runAttemptIdChip:");
  });
});
