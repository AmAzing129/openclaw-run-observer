import {
  CHANNEL_ICON_MAP,
  LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE,
  PROVIDER_ICON_MAP,
  SIMPLE_ICONS_CDN_BASE,
} from "./assets.js";
import {
  buildAgentChannelSidebarGroups,
  buildSessionSidebarGroupId,
  buildSessionSidebarGroups,
  buildSessionSidebarInstanceId,
  buildSidebarRunGroupId,
  pickOpenClawUsageFields,
} from "./grouping.js";

export function renderRunObserverClientScript(params: {
  basePath: string;
}): string {
  const pickOpenClawUsageFieldsSource = pickOpenClawUsageFields.toString();
  const buildSessionSidebarGroupIdSource =
    buildSessionSidebarGroupId.toString();
  const buildSessionSidebarInstanceIdSource =
    buildSessionSidebarInstanceId.toString();
  const buildSidebarRunGroupIdSource = buildSidebarRunGroupId.toString();
  const buildSessionSidebarGroupsSource = buildSessionSidebarGroups.toString();
  const buildAgentChannelSidebarGroupsSource =
    buildAgentChannelSidebarGroups.toString();
  const simpleIconsCdnBaseSource = JSON.stringify(SIMPLE_ICONS_CDN_BASE);
  const lobehubIconsPngLightCdnBaseSource = JSON.stringify(
    LOBEHUB_ICONS_PNG_LIGHT_CDN_BASE,
  );
  const channelIconMapSource = JSON.stringify(CHANNEL_ICON_MAP);
  const providerIconMapSource = JSON.stringify(PROVIDER_ICON_MAP);

  return `
      const BASE_PATH = ${JSON.stringify(params.basePath)};
      const params = new URLSearchParams(window.location.search);
      const TOKEN = params.get("token") || "";
      const pickOpenClawUsageFields = ${pickOpenClawUsageFieldsSource};
      const buildSessionSidebarGroupId = ${buildSessionSidebarGroupIdSource};
      const buildSessionSidebarInstanceId = ${buildSessionSidebarInstanceIdSource};
      const buildSidebarRunGroupId = ${buildSidebarRunGroupIdSource};
      const buildSessionSidebarGroups = ${buildSessionSidebarGroupsSource};
      const buildAgentChannelSidebarGroups = ${buildAgentChannelSidebarGroupsSource};
      const buildSessionGroupId = buildSessionSidebarGroupId;
      const buildSessionInstanceGroupId = buildSessionSidebarInstanceId;
      const buildRunGroupId = buildSidebarRunGroupId;
      const buildSessionGroups = buildSessionSidebarGroups;
      const buildAgentChannelGroups = buildAgentChannelSidebarGroups;
      const state = {
        runs: [],
        detail: null,
        selectedRunAttemptId: null,
        loadingDetail: false,
        refreshingRecent: false,
        activeAgentChannelGroupId: null,
        activeSessionGroupId: null,
        expandedSessionInstances: [],
        expandedRuns: [],
        renderedAgentChannelTabsSignature: "",
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
        connectionStateLabel: document.getElementById("connection-state-label"),
        refreshButton: document.getElementById("refresh-button"),
      };

      const CONNECTION_STATE_META = {
        connecting: {
          label: "sync",
          title: "Connecting to live updates",
        },
        live: {
          label: "live",
          title: "Receiving live updates",
        },
        reconnecting: {
          label: "retry",
          title: "Reconnecting to live updates",
        },
        error: {
          label: "error",
          title: "Live updates unavailable",
        },
      };

      function setConnectionState(stateName, title) {
        const fallback = CONNECTION_STATE_META.error;
        const nextState = CONNECTION_STATE_META[stateName] ? stateName : "error";
        const meta = CONNECTION_STATE_META[nextState] || fallback;
        const nextTitle = title || meta.title;
        if (nodes.connectionState instanceof HTMLElement) {
          nodes.connectionState.dataset.state = nextState;
          nodes.connectionState.title = nextTitle;
          nodes.connectionState.setAttribute("aria-label", nextTitle);
        }
        if (nodes.connectionStateLabel instanceof HTMLElement) {
          nodes.connectionStateLabel.textContent = meta.label;
        }
      }

      setConnectionState("connecting");

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

      nodes.detailBody.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target.closest("button") : null;
        if (!(target instanceof HTMLButtonElement) || !nodes.detailBody.contains(target)) {
          return;
        }

        if (target.classList.contains("copy-block-btn")) {
          event.preventDefault();
          event.stopPropagation();
          await handleCopyButtonClick(target);
          return;
        }

        if (target.classList.contains("prompt-expand-btn")) {
          var block = target.closest(".prompt-block");
          if (!block) return;
          var isCollapsed = block.classList.contains("collapsed");
          block.classList.toggle("collapsed", !isCollapsed);
          target.textContent = isCollapsed ? "Show less" : "Show more";
        }
      });

      nodes.runs.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target.closest("button") : null;
        if (!(target instanceof HTMLButtonElement) || !nodes.runs.contains(target)) {
          return;
        }

        if (target.classList.contains("agent-channel-tab")) {
          const agentChannelGroupId = target.getAttribute("data-agent-channel-tab-id");
          if (!agentChannelGroupId) return;
          const agentChannelGroups = buildAgentChannelGroups(getFilteredRuns());
          const agentChannelGroup = agentChannelGroups.find((entry) => entry.id === agentChannelGroupId);
          if (!agentChannelGroup) return;
          const session =
            agentChannelGroup.sessions.find((entry) => entry.id === state.activeSessionGroupId) ||
            agentChannelGroup.sessions[0];
          if (!session) return;
          const nextAttemptId = findFirstAttemptIdForSessionGroup(session);
          setActiveAgentChannelGroup(agentChannelGroup.id);
          setActiveSessionGroup(session.id);
          if (nextAttemptId && nextAttemptId !== state.selectedRunAttemptId) {
            await selectRunAttempt(nextAttemptId);
            return;
          }
          renderRuns();
          return;
        }

        if (target.classList.contains("session-tab")) {
          const sessionId = target.getAttribute("data-session-tab-id");
          if (!sessionId) return;
          const agentChannelGroups = buildAgentChannelGroups(getFilteredRuns());
          const agentChannelGroup = agentChannelGroups.find((group) =>
            group.sessions.some((entry) => entry.id === sessionId),
          );
          const session = agentChannelGroup?.sessions.find((entry) => entry.id === sessionId);
          if (!session) return;
          const nextAttemptId = findFirstAttemptIdForSessionGroup(session);
          if (agentChannelGroup) {
            setActiveAgentChannelGroup(agentChannelGroup.id);
          }
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
          const sessions = buildAgentChannelGroups(getFilteredRuns()).flatMap((group) => group.sessions);
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
        return "Reported: " +
          formatCostValueOrNa(costs.reportedCostUsd) +
          " | Estimated: " +
          formatCostValueOrNa(costs.estimatedCostUsd);
      }

      function renderCostBreakdownCallout(run) {
        const usage = run && run.usage ? run.usage : {};
        const costs = readCostValues(usage);
        const pricingRates =
          costs.estimatedCostUsd !== undefined
            ? formatPricingRates(usage.estimatedPricingUsdPerMillion)
            : "";
        const copyTextParts = [
          "Run reported cost: " + formatCostValueOrNa(costs.reportedCostUsd),
          "Run estimated cost: " + formatCostValueOrNa(costs.estimatedCostUsd),
        ];
        if (pricingRates) {
          copyTextParts.push("Pricing rates: " + pricingRates);
        }
        const lines = [
          '<div><strong>Run reported cost:</strong> ' + escapeInline(formatCostValueOrNa(costs.reportedCostUsd)) + "</div>",
          '<div><strong>Run estimated cost:</strong> ' + escapeInline(formatCostValueOrNa(costs.estimatedCostUsd)) + "</div>",
        ];
        return '<div class="callout cost-callout" data-copy-block>' +
          '<pre class="copy-source-hidden" data-copy-source hidden>' + escapeInline(copyTextParts.join("\\n")) + '</pre>' +
          '<div class="callout-head">' + renderCopyButton("cost breakdown") + '</div>' +
          lines.join("") +
          (pricingRates
            ? '<div class="callout-meta mono">' + escapeInline(pricingRates) + '</div>'
            : '') +
        '</div>';
      }

      function syncFilterOptions() {}

      function copyButtonStateText(label, stateName) {
        var targetLabel = label || "block";
        if (stateName === "pending") {
          return "Copying " + targetLabel;
        }
        if (stateName === "success") {
          return "Copied " + targetLabel;
        }
        if (stateName === "error") {
          return "Copy failed for " + targetLabel + ", retry";
        }
        return "Copy " + targetLabel;
      }

      function copyButtonIconSvg(stateName) {
        if (stateName === "success") {
          return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M3.75 8.25 6.5 11l5.75-6"/></svg>';
        }
        if (stateName === "error") {
          return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="m8 2.5 5.5 10H2.5Z"/><path d="M8 6v3.5"/><path d="M8 11.75h.01"/></svg>';
        }
        return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><rect x="5.25" y="2.75" width="7" height="9" rx="1.25"/><path d="M10.75 13.25H4.5a1.75 1.75 0 0 1-1.75-1.75V5.25"/></svg>';
      }

      function renderCopyButtonContents(label, stateName) {
        var actionLabel = copyButtonStateText(label, stateName);
        return '<span class="copy-block-icon" aria-hidden="true">' + copyButtonIconSvg(stateName) + '</span>' +
          '<span class="visually-hidden">' + escapeInline(actionLabel) + '</span>';
      }

      function renderCopyButton(label) {
        var normalizedLabel = label || "block";
        var escapedLabel = escapeInline(normalizedLabel);
        var actionLabel = copyButtonStateText(normalizedLabel, "idle");
        return '<button class="copy-block-btn action-button mono" type="button" data-copy-state="idle" data-copy-label="' + escapedLabel + '" title="' + escapeInline(actionLabel) + '" aria-label="' + escapeInline(actionLabel) + '">' +
          renderCopyButtonContents(normalizedLabel, "idle") +
        '</button>';
      }

      function renderCopyableDetails(summary, bodyHtml, options) {
        var attrs = [];
        var classNames = [];
        if (options && options.className) {
          classNames.push(options.className);
        }
        classNames.push("copyable-details");
        if (classNames.length > 0) {
          attrs.push('class="' + escapeInline(classNames.join(" ")) + '"');
        }
        attrs.push("data-copy-block");
        return '<details ' + attrs.join(" ") + '>' +
          '<summary><span class="summary-title">' + escapeInline(summary) + '</span></summary>' +
          '<div class="details-summary-actions">' + renderCopyButton(summary) + '</div>' +
          bodyHtml +
        '</details>';
      }

      function getCopySourceText(button) {
        var block = button.closest("[data-copy-block]");
        if (!block) return "";
        var source = block.querySelector("[data-copy-source]");
        if (!source) {
          return block.textContent || "";
        }
        if (source instanceof HTMLTextAreaElement || source instanceof HTMLInputElement) {
          return source.value;
        }
        return source.textContent || "";
      }

      async function writeTextToClipboard(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(text);
          return;
        }

        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        var copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("Copy failed");
        }
      }

      function setCopyButtonState(button, stateName) {
        button.dataset.copyState = stateName;
        var label = button.dataset.copyLabel || "block";
        var actionLabel = copyButtonStateText(label, stateName);
        button.title = actionLabel;
        button.setAttribute("aria-label", actionLabel);
        button.innerHTML = renderCopyButtonContents(label, stateName);
      }

      function scheduleCopyButtonReset(button) {
        var previousTimer = Number(button.dataset.copyResetTimer || "0");
        if (previousTimer) {
          window.clearTimeout(previousTimer);
        }
        var timer = window.setTimeout(function () {
          if (document.body.contains(button)) {
            setCopyButtonState(button, "idle");
          }
        }, 1500);
        button.dataset.copyResetTimer = String(timer);
      }

      async function handleCopyButtonClick(button) {
        var text = getCopySourceText(button);
        if (!text) {
          setCopyButtonState(button, "error");
          scheduleCopyButtonReset(button);
          return;
        }

        button.disabled = true;
        setCopyButtonState(button, "pending");

        try {
          await writeTextToClipboard(text);
          setCopyButtonState(button, "success");
        } catch (error) {
          console.error("run-observer copy failed", error);
          setCopyButtonState(button, "error");
        } finally {
          button.disabled = false;
          scheduleCopyButtonReset(button);
        }
      }

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

      function isAgentChannelGroupActive(agentChannelGroupId) {
        return state.activeAgentChannelGroupId === agentChannelGroupId;
      }

      function setActiveAgentChannelGroup(agentChannelGroupId) {
        state.activeAgentChannelGroupId = agentChannelGroupId;
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

      function findSidebarSelectionForRun(agentChannelGroups, runSummary) {
        if (!runSummary) {
          return null;
        }

        const sessionGroupId = buildSessionGroupId(runSummary);
        const sessionInstanceId = buildSessionInstanceGroupId(sessionGroupId, runSummary);
        const runGroupId = buildRunGroupId(sessionInstanceId, runSummary);
        const agentChannelGroup = agentChannelGroups.find((group) =>
          group.sessions.some((session) => session.id === sessionGroupId),
        );

        return {
          agentChannelGroupId: agentChannelGroup ? agentChannelGroup.id : null,
          sessionGroupId,
          sessionInstanceId,
          runGroupId,
        };
      }

      function ensureExpandedGroups(agentChannelGroups) {
        const validAgentChannelGroupIds = new Set(agentChannelGroups.map((group) => group.id));
        const sessions = agentChannelGroups.flatMap((group) => group.sessions);
        const validSessionIds = new Set(sessions.map((group) => group.id));
        const validSessionInstanceIds = new Set();
        const validRunIds = new Set();
        for (const group of sessions) {
          for (const instance of group.instances) {
            validSessionInstanceIds.add(instance.id);
            for (const runGroup of instance.runs) {
              if (runGroup.attempts.length > 1) {
                validRunIds.add(runGroup.id);
              }
            }
          }
        }
        if (
          !state.activeAgentChannelGroupId ||
          !validAgentChannelGroupIds.has(state.activeAgentChannelGroupId)
        ) {
          state.activeAgentChannelGroupId = null;
        }
        if (!state.activeSessionGroupId || !validSessionIds.has(state.activeSessionGroupId)) {
          state.activeSessionGroupId = null;
        }
        state.expandedSessionInstances = state.expandedSessionInstances.filter((sessionInstanceId) => validSessionInstanceIds.has(sessionInstanceId));
        state.expandedRuns = state.expandedRuns.filter((runGroupId) => validRunIds.has(runGroupId));

        const selectedRun = state.runs.find((run) => run.runAttemptId === state.selectedRunAttemptId);
        if (selectedRun) {
          const selection = findSidebarSelectionForRun(agentChannelGroups, selectedRun);
          if (selection?.agentChannelGroupId && validAgentChannelGroupIds.has(selection.agentChannelGroupId)) {
            setActiveAgentChannelGroup(selection.agentChannelGroupId);
          }
          if (selection?.sessionGroupId && validSessionIds.has(selection.sessionGroupId)) {
            setActiveSessionGroup(selection.sessionGroupId);
          }
          if (
            selection?.sessionInstanceId &&
            validSessionInstanceIds.has(selection.sessionInstanceId) &&
            !isSessionInstanceExpanded(selection.sessionInstanceId)
          ) {
            setSessionInstanceExpanded(selection.sessionInstanceId, true);
          }
          if (
            selection?.runGroupId &&
            validRunIds.has(selection.runGroupId) &&
            !isRunExpanded(selection.runGroupId)
          ) {
            setRunExpanded(selection.runGroupId, true);
          }
        }

        if (!state.activeAgentChannelGroupId && agentChannelGroups.length > 0) {
          state.activeAgentChannelGroupId = agentChannelGroups[0].id;
        }
        const activeAgentChannelGroup =
          agentChannelGroups.find((group) => group.id === state.activeAgentChannelGroupId) ||
          agentChannelGroups[0];
        const activeSessions = activeAgentChannelGroup ? activeAgentChannelGroup.sessions : [];
        if (
          (!state.activeSessionGroupId ||
            !activeSessions.some((group) => group.id === state.activeSessionGroupId)) &&
          activeSessions.length > 0
        ) {
          state.activeSessionGroupId = activeSessions[0].id;
        }
        const activeSession =
          activeSessions.find((group) => group.id === state.activeSessionGroupId) || activeSessions[0];
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
          const firstExpandedRun = (activeSession ? activeSession.instances : sessions.flatMap((group) => group.instances))
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

      function buildAgentChannelTabsSignature(agentChannelGroups) {
        return agentChannelGroups
          .map((group) => [group.id, group.label, group.channelLabel].join("|"))
          .join("::");
      }

      function buildSessionTabsSignature(sessions) {
        return sessions
          .map((session) => [session.id, session.routingLabel, String(session.instances.length)].join("|"))
          .join("::");
      }

      function buildSessionHeaderSignature(agentChannelGroup, session) {
        return [
          agentChannelGroup.id,
          agentChannelGroup.label,
          agentChannelGroup.channelLabel,
          session.id,
          session.label,
          session.routingLabel,
          session.channelLabel,
        ].join("|");
      }

      function ensureRunBrowserLayout() {
        if (!nodes.runs.querySelector(".sidebar-agent-bar")) {
          nodes.runs.innerHTML =
            '<div class="sidebar-agent-bar" role="tablist" aria-orientation="vertical"></div>' +
            '<div class="sidebar-sessions"></div>';
        }
        return {
          root: nodes.runs,
          agentTabs: nodes.runs.querySelector(".sidebar-agent-bar"),
          sessionsContainer: nodes.runs.querySelector(".sidebar-sessions"),
        };
      }

      function updateAgentChannelTabSelection(activeAgentChannelGroupId) {
        for (const button of nodes.runs.querySelectorAll(".agent-channel-tab")) {
          const active =
            button.getAttribute("data-agent-channel-tab-id") === activeAgentChannelGroupId;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
        }
      }

      function updateSessionTabSelection(activeSessionId) {
        for (const button of nodes.runs.querySelectorAll(".session-tab")) {
          const active = button.getAttribute("data-session-tab-id") === activeSessionId;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
        }
      }

      function renderAgentChannelTabs(layout, agentChannelGroups, activeAgentChannelGroup) {
        if (!(layout.root instanceof HTMLElement) || !(layout.agentTabs instanceof HTMLElement)) {
          return;
        }
        const shouldShowAgentTabs = agentChannelGroups.length > 1;
        layout.root.classList.toggle("has-agent-channel-tabs", shouldShowAgentTabs);
        if (!shouldShowAgentTabs) {
          layout.agentTabs.style.display = "none";
        } else {
          layout.agentTabs.style.display = "";
        }
        const signature = buildAgentChannelTabsSignature(agentChannelGroups);
        if (signature !== state.renderedAgentChannelTabsSignature) {
          layout.agentTabs.innerHTML = agentChannelGroups
            .map((group) => {
              const active = group.id === activeAgentChannelGroup.id;
              var tabIconLabel = group.channelLabel || group.label || "?";
              var tabChannelIconSrc = channelIconUrl(group.channelLabel);
              var tabIconHtml = '<span class="agent-channel-tab-icon">';
              if (tabChannelIconSrc) {
                tabIconHtml += '<img src="' + escapeInline(tabChannelIconSrc) + '" alt="' + escapeInline(tabIconLabel) + '" title="' + escapeInline(tabIconLabel) + '" referrerpolicy="no-referrer" onerror="this.remove()" />';
              } else {
                tabIconHtml += '<span class="agent-channel-tab-icon-fallback" aria-hidden="true">' + escapeInline(tabIconLabel.slice(0, 1).toUpperCase()) + '</span>';
              }
              tabIconHtml += "</span>";
              return '<button class="agent-channel-tab' + (active ? " active" : "") + '" type="button" role="tab" aria-selected="' + String(active) + '" data-agent-channel-tab-id="' + escapeInline(group.id) + '">' +
                '<span class="agent-channel-tab-title">' +
                  tabIconHtml +
                  '<span class="agent-channel-tab-label">' + escapeInline(group.label) + '</span>' +
                '</span>' +
              '</button>';
            })
            .join("");
          state.renderedAgentChannelTabsSignature = signature;
        }
        updateAgentChannelTabSelection(activeAgentChannelGroup.id);
      }

      function renderSidebarSessions(layout, sessions, activeSession) {
        if (!(layout.sessionsContainer instanceof HTMLElement)) {
          return;
        }
        layout.sessionsContainer.innerHTML = sessions
          .map((session) => {
            const isActive = session.id === activeSession.id;
            var sessionTitle = session.routingLabel || session.sessionKey || session.sessionId || "Session";
            var sessionSubtitle = session.instances.length + " session" + (session.instances.length === 1 ? "" : "s");

            var instancesHtml = "";
            if (isActive) {
              instancesHtml = session.instances
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
                            '<div class="record-title" title="' + escapeInline(recordTitle) + '">' + escapeInline(recordTitle) + '</div>' +
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
                              '<div class="record-title" title="' + escapeInline(title) + '">' + escapeInline(title) + '</div>' +
                              '<div class="record-subtitle mono" title="' + escapeInline(subtitle) + '">' + escapeInline(subtitle) + '</div>' +
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
            }

            return '<div class="session-section' + (isActive ? " active" : "") + '">' +
              '<button class="session-tab" type="button" data-session-tab-id="' + escapeInline(session.id) + '">' +
                '<div class="session-tab-row">' +
                  '<div class="session-tab-title mono">' + escapeInline(sessionTitle) + '</div>' +
                  '<div class="session-tab-subtitle mono">' + escapeInline(sessionSubtitle) + '</div>' +
                '</div>' +
              '</button>' +
              (isActive && instancesHtml ? '<div class="session-body">' + instancesHtml + '</div>' : '') +
            '</div>';
          })
          .join("");
      }

      function renderRuns() {
        const agentChannelGroups = buildAgentChannelGroups(getFilteredRuns());
        ensureExpandedGroups(agentChannelGroups);

        if (!agentChannelGroups.length) {
          nodes.runs.innerHTML = '<div class="empty" style="padding: 18px;">No matching runs.</div>';
          state.renderedAgentChannelTabsSignature = "";
          return;
        }

        const activeAgentChannelGroup =
          agentChannelGroups.find((group) => group.id === state.activeAgentChannelGroupId) ||
          agentChannelGroups[0];
        const sessions = activeAgentChannelGroup ? activeAgentChannelGroup.sessions : [];
        const activeSession =
          sessions.find((session) => session.id === state.activeSessionGroupId) || sessions[0];
        const layout = ensureRunBrowserLayout();
        renderAgentChannelTabs(layout, agentChannelGroups, activeAgentChannelGroup);
        renderSidebarSessions(layout, sessions, activeSession);
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
          statsHtml.push(
            '<div class="callout error" data-copy-block>' +
              '<pre class="copy-source-hidden" data-copy-source hidden>' + escapeInline(String(run.meta.error)) + '</pre>' +
              '<div class="callout-head">' + renderCopyButton("error") + '</div>' +
              'Error: ' + escapeInline(run.meta.error) +
            "</div>",
          );
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

          html += renderCopyableDetails(
            "LLM Input Event (Raw JSON)",
            '<pre data-copy-source>' + escapeInline(JSON.stringify(llmInputEvent, null, 2)) + '</pre>',
            { className: "raw-debug" },
          );

          html += renderCopyableDetails(
            "LLM Input Context Snapshot",
            '<pre data-copy-source>' + escapeInline(JSON.stringify(llmInputCtx, null, 2)) + '</pre>',
            { className: "raw-debug" },
          );
        } else {
          var outputMessages = run.output.messages || [];
          var assistantTexts = run.output.assistantTexts || [];
          if (assistantTexts.length > 0) {
            html += '<details open>' +
              '<summary>Assistant Texts (' + assistantTexts.length + ')</summary>' +
              '<div class="chat-list" style="padding: 10px 14px 14px;">' +
                assistantTexts.map(function (text, i) {
                  var renderedText = typeof text === "string" ? text : JSON.stringify(text, null, 2);
                  return '<div class="chat-msg role-assistant">' +
                    '<div class="chat-msg-head" data-copy-block>' +
                      '<pre class="copy-source-hidden" data-copy-source hidden>' + escapeInline(renderedText) + '</pre>' +
                      '<span class="chat-role">assistant #' + (i + 1) + '</span>' +
                      renderCopyButton("assistant #" + (i + 1)) +
                    '</div>' +
                    '<div class="chat-content">' + escapeInline(renderedText) + '</div>' +
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

          html += renderCopyableDetails(
            "Usage",
            '<pre data-copy-source>' + escapeInline(JSON.stringify(pickOpenClawUsageFields(run.usage), null, 2)) + '</pre>',
            {},
          );

          if (assistantTexts.length === 0 && outputMessages.length === 0) {
            html += '<div class="empty">No output data yet.</div>';
          }
        }

        nodes.detailBody.innerHTML = html;
      }

      function renderPromptSection(label, text) {
        if (!text) return "";
        var needsCollapse = text.length > 500 || text.split("\\n").length > 8;
        return '<div data-copy-block>' +
          '<div class="section-header">' +
            '<div class="section-label">' + escapeInline(label) + '</div>' +
            renderCopyButton(label) +
          '</div>' +
          '<div class="prompt-block' + (needsCollapse ? ' collapsed' : '') + '">' +
            '<pre data-copy-source>' + escapeInline(text) + '</pre>' +
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
        var copyText = content;
        if (!copyText && msg) {
          copyText = JSON.stringify(msg, null, 2);
        }

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

        var html = '<div class="chat-msg ' + roleClass + extraClass + '"' + (copyText ? ' data-copy-block' : '') + '>';
        if (copyText) {
          html += '<pre class="copy-source-hidden" data-copy-source hidden>' + escapeInline(copyText) + '</pre>';
        }
        html += '<div class="chat-msg-head">';
        html += '<span class="chat-role">' + escapeInline(role) + badgeHtml + '</span>';
        if (copyText) {
          html += renderCopyButton(role);
        }
        html += '</div>';

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
        const agentChannelGroups = buildAgentChannelGroups(state.runs);
        const selection = findSidebarSelectionForRun(agentChannelGroups, runSummary);
        if (!state.selectedRunAttemptId || state.selectedRunAttemptId === runSummary.runAttemptId) {
          if (selection?.agentChannelGroupId) {
            setActiveAgentChannelGroup(selection.agentChannelGroupId);
          }
          if (selection?.sessionGroupId) {
            setActiveSessionGroup(selection.sessionGroupId);
          }
          if (selection?.sessionInstanceId) {
            setSessionInstanceExpanded(selection.sessionInstanceId, true);
          }
          if (selection?.runGroupId) {
            setRunExpanded(selection.runGroupId, true);
          }
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
          const agentChannelGroups = buildAgentChannelGroups(getFilteredRuns());
          const selection = findSidebarSelectionForRun(agentChannelGroups, selectedSummary);
          if (
            selection?.agentChannelGroupId &&
            !isAgentChannelGroupActive(selection.agentChannelGroupId)
          ) {
            setActiveAgentChannelGroup(selection.agentChannelGroupId);
            shouldRenderRuns = true;
          }
          if (selection?.sessionGroupId && !isSessionActive(selection.sessionGroupId)) {
            setActiveSessionGroup(selection.sessionGroupId);
            shouldRenderRuns = true;
          }
          if (
            selection?.sessionInstanceId &&
            !hasRenderedButton &&
            !isSessionInstanceExpanded(selection.sessionInstanceId)
          ) {
            setSessionInstanceExpanded(selection.sessionInstanceId, true);
            shouldRenderRuns = true;
          }
          if (
            selection?.runGroupId &&
            !hasRenderedButton &&
            !isRunExpanded(selection.runGroupId)
          ) {
            setRunExpanded(selection.runGroupId, true);
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
          setConnectionState("error", "Missing viewer token");
          return;
        }
        const source = new EventSource(withToken(BASE_PATH + "/api/events"));
        source.addEventListener("open", () => {
          setConnectionState("live");
        });
        source.addEventListener("error", () => {
          setConnectionState("reconnecting");
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
            setConnectionState("error", "Manual refresh failed");
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
          setConnectionState("error", "Failed to load runs");
          nodes.runs.innerHTML = '<div class="callout error">Failed to load runs: ' + escapeInline(error.message || String(error)) + '</div>';
        });
`;
}
