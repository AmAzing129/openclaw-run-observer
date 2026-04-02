import { escapeHtml } from "./utils.js";

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
  for (const key of ["input", "output", "cacheRead", "cacheWrite", "total"] as const) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      picked[key] = value;
    }
  }
  return picked;
}

export function renderRunObserverHtml(params: { basePath: string; pluginName: string }): string {
  const basePath = escapeHtml(params.basePath.replace(/\/$/, ""));
  const pluginName = escapeHtml(params.pluginName);
  const pickOpenClawUsageFieldsSource = pickOpenClawUsageFields.toString();
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

      .session-group {
        margin-top: 6px;
        border: 1px solid rgba(148, 97, 45, 0.12);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.44);
        overflow: hidden;
      }

      .session-group.expanded {
        background: rgba(255, 255, 255, 0.62);
        border-color: rgba(148, 97, 45, 0.22);
      }

      .session-toggle,
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

      .session-toggle {
        padding: 10px 14px;
        transition: background 140ms ease;
      }

      .session-toggle:hover {
        background: rgba(255, 255, 255, 0.32);
      }

      .session-toggle-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px;
        align-items: center;
      }

      .session-caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        margin-top: 2px;
        color: var(--muted);
        transition: transform 140ms ease;
      }

      .session-toggle[aria-expanded="true"] .session-caret {
        transform: rotate(90deg);
      }

      .session-title {
        font-weight: 700;
        font-size: 13px;
        line-height: 1.3;
      }

      .session-subtitle,
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
        margin-left: 6px;
        vertical-align: middle;
      }

      .session-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        opacity: 0.7;
      }

      .session-subtitle,
      .record-title,
      .record-subtitle {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .session-subtitle {
        margin-top: 2px;
        font-size: 11px;
        line-height: 1.3;
      }

      .session-body {
        margin: 0 12px 8px 22px;
        padding-left: 12px;
        border-left: 1px solid rgba(148, 97, 45, 0.16);
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

        .session-body {
          margin-left: 18px;
          margin-right: 12px;
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
              </div>
              <div class="right">
                <span class="chip mono status-chip" id="status-chip" style="display:none;"></span>
                <span class="chip mono" id="cost-chip" style="display:none;"></span>
                <span class="chip mono" id="duration-chip" style="display:none;"></span>
                <span class="chip mono" id="run-attempt-id-chip">run attempt: none</span>
              </div>
            </div>
            <div class="subtitle" id="detail-subtitle">
              Open this page with a tokenized URL from \`openclaw run-observer url\`.
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
      const state = {
        runs: [],
        detail: null,
        selectedRunAttemptId: null,
        loadingDetail: false,
        refreshingRecent: false,
        expandedSessions: [],
        expandedRuns: [],
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
        runAttemptIdChip: document.getElementById("run-attempt-id-chip"),
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
        return "R " + formatCostValueOrNa(costs.reportedCostUsd) + " · E " + formatCostValueOrNa(costs.estimatedCostUsd);
      }

      function renderCostBreakdownCallout(run) {
        const usage = run && run.usage ? run.usage : {};
        const costs = readCostValues(usage);
        const lines = [
          '<div><strong>Reported cost:</strong> ' + escapeInline(formatCostValueOrNa(costs.reportedCostUsd)) + "</div>",
          '<div><strong>Estimated cost:</strong> ' + escapeInline(formatCostValueOrNa(costs.estimatedCostUsd)) + "</div>",
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

      function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
      }

      function buildSessionGroupId(run) {
        const sessionKey = normalizeText(run.sessionKey);
        if (sessionKey) return "session-key:" + sessionKey;
        const sessionId = normalizeText(run.sessionId);
        if (sessionId) return "session-id:" + sessionId;
        return "run:" + normalizeText(run.runId || "");
      }

      function deriveAgentLabelFromSessionKey(sessionKey) {
        const normalized = normalizeText(sessionKey);
        if (!normalized.startsWith("agent:")) return "";
        const parts = normalized.split(":").filter(Boolean);
        return parts.length >= 2 ? parts.slice(0, 2).join(":") : normalized;
      }

      function getAgentLabel(run) {
        return normalizeText(run.agentId) || deriveAgentLabelFromSessionKey(run.sessionKey);
      }

      function getChannelLabel(run) {
        const provider = normalizeText(run.messageProvider);
        const channel = normalizeText(run.channelId);
        if (provider && channel && channel !== provider) {
          return /^[a-z0-9._:-]{1,24}$/i.test(channel) ? provider + " / " + channel : provider;
        }
        return provider || channel;
      }

      function getSessionLabel(run) {
        return getAgentLabel(run) || "Agent session";
      }

      var PROVIDER_ICON_MAP = {
        "openai": "openai",
        "azure-openai": "azure",
        "azure": "azure",
        "anthropic": "anthropic",
        "claude": "anthropic",
        "google": "google",
        "gemini": "google",
        "vertex": "google",
        "deepseek": "deepseek",
        "mistral": "mistral",
        "meta": "meta",
        "llama": "meta",
        "cohere": "cohere",
        "perplexity": "perplexity",
        "groq": "groq",
        "together": "togetherai",
        "togetherai": "togetherai",
        "fireworks": "fireworks",
        "amazon": "bedrock",
        "bedrock": "bedrock",
        "zhipu": "zhipu",
        "moonshot": "moonshot",
        "qwen": "qwen",
        "alibaba": "qwen",
        "baichuan": "baichuan",
        "minimax": "minimax",
        "yi": "ai01",
        "01": "ai01",
        "ai21": "ai21",
        "bytedance": "doubao",
        "doubao": "doubao",
        "spark": "spark",
        "ollama": "ollama",
        "huggingface": "huggingface",
        "replicate": "replicate",
        "xai": "xai",
        "grok": "xai",
        "siliconflow": "siliconcloud",
        "siliconcloud": "siliconcloud",
        "stepfun": "stepfun",
        "nvidia": "nvidia",
        "cloudflare": "cloudflare",
        "sambanova": "sambanova",
        "cerebras": "cerebras",
      };

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
        // Keep the local viewer self-contained and avoid third-party asset requests.
        return "";
      }

      var CHANNEL_ICON_MAP = {
        "discord": "discord",
        "telegram": "telegram",
        "whatsapp": "whatsapp",
        "slack": "slack",
        "signal": "signal",
        "googlechat": "googlechat",
        "imessage": "imessage",
        "irc": "irc",
        "line": "line",
      };

      function channelIconUrl(channelLabel) {
        var normalized = (channelLabel || "").toLowerCase().trim();
        for (var key in CHANNEL_ICON_MAP) {
          if (normalized.indexOf(key) !== -1) {
            // Keep the local viewer self-contained and avoid third-party asset requests.
            return "";
          }
        }
        return "";
      }

      function buildRunGroupId(sessionId, run) {
        return sessionId + "::run:" + normalizeText(run.runId || run.runAttemptId || "detached");
      }

      function getRunTitle(run) {
        return formatSidebarTime(run.updatedAt);
      }

      function getRunSubtitle(run) {
        return "";
      }

      function formatAttemptLabel(run) {
        return typeof run.attemptOrdinal === "number" ? "Attempt " + run.attemptOrdinal : "Attempt";
      }

      function readKnownUsd(value) {
        return typeof value === "number" && Number.isFinite(value) ? value : undefined;
      }

      function isSessionExpanded(sessionId) {
        return state.expandedSessions.includes(sessionId);
      }

      function setSessionExpanded(sessionId, expanded) {
        const next = state.expandedSessions.filter((value) => value !== sessionId);
        if (expanded) {
          next.unshift(sessionId);
        }
        state.expandedSessions = next;
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

      function ensureExpandedGroups(groups) {
        const valid = new Set(groups.map((group) => group.id));
        const validRunIds = new Set();
        for (const group of groups) {
          for (const runGroup of group.runs) {
            if (runGroup.attempts.length > 1) {
              validRunIds.add(runGroup.id);
            }
          }
        }
        state.expandedSessions = state.expandedSessions.filter((sessionId) => valid.has(sessionId));
        state.expandedRuns = state.expandedRuns.filter((runGroupId) => validRunIds.has(runGroupId));

        const selectedRun = state.runs.find((run) => run.runAttemptId === state.selectedRunAttemptId);
        if (selectedRun) {
          const selectedSessionId = buildSessionGroupId(selectedRun);
          if (valid.has(selectedSessionId) && !isSessionExpanded(selectedSessionId)) {
            setSessionExpanded(selectedSessionId, true);
          }
          const selectedRunGroupId = buildRunGroupId(selectedSessionId, selectedRun);
          if (validRunIds.has(selectedRunGroupId) && !isRunExpanded(selectedRunGroupId)) {
            setRunExpanded(selectedRunGroupId, true);
          }
        }

        if (state.expandedSessions.length === 0 && groups.length > 0) {
          state.expandedSessions = [groups[0].id];
        }
        if (state.expandedRuns.length === 0) {
          const firstExpandedRun = groups.flatMap((group) => group.runs).find((runGroup) => runGroup.attempts.length > 1);
          if (firstExpandedRun) {
            state.expandedRuns = [firstExpandedRun.id];
          }
        }
      }

      function buildSessionGroups(runs) {
        const grouped = new Map();
        for (const run of runs) {
          const sessionId = buildSessionGroupId(run);
          const runGroupId = buildRunGroupId(sessionId, run);
          const existing = grouped.get(sessionId) || {
            id: sessionId,
            label: getSessionLabel(run),
            updatedAt: run.updatedAt,
            provider: normalizeText(run.provider),
            model: normalizeText(run.model),
            channelLabel: getChannelLabel(run),
            reportedCostUsd: 0,
            estimatedCostUsd: 0,
            hasReportedCost: false,
            hasEstimatedCost: false,
            runsById: new Map(),
            runs: [],
          };
          if (run.updatedAt >= existing.updatedAt) {
            existing.updatedAt = run.updatedAt;
            existing.label = getSessionLabel(run);
            existing.provider = normalizeText(run.provider) || existing.provider;
            existing.model = normalizeText(run.model) || existing.model;
            existing.channelLabel = getChannelLabel(run) || existing.channelLabel;
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
          const existingRunGroup = existing.runsById.get(runGroupId) || {
            id: runGroupId,
            runId: normalizeText(run.runId),
            title: getRunTitle(run),
            subtitle: getRunSubtitle(run),
            updatedAt: run.updatedAt,
            attempts: [],
          };
          existingRunGroup.attempts.push(run);
          if (run.updatedAt >= existingRunGroup.updatedAt) {
            existingRunGroup.updatedAt = run.updatedAt;
            existingRunGroup.title = getRunTitle(run);
            existingRunGroup.subtitle = getRunSubtitle(run);
          }
          existing.runsById.set(runGroupId, existingRunGroup);
          grouped.set(sessionId, existing);
        }

        return Array.from(grouped.values())
          .map((group) => ({
            id: group.id,
            label: group.label,
            updatedAt: group.updatedAt,
            provider: group.provider,
            model: group.model,
            channelLabel: group.channelLabel,
            ...(group.hasReportedCost ? { reportedCostUsd: group.reportedCostUsd } : {}),
            ...(group.hasEstimatedCost ? { estimatedCostUsd: group.estimatedCostUsd } : {}),
            runs: Array.from(group.runsById.values())
              .map((runGroup) => ({
                ...runGroup,
                attempts: runGroup.attempts.sort((left, right) => right.updatedAt - left.updatedAt),
              }))
              .sort((left, right) => right.updatedAt - left.updatedAt),
          }))
          .sort((left, right) => right.updatedAt - left.updatedAt);
      }

      function getFilteredRuns() {
        return state.runs;
      }

      function renderRuns() {
        const sessions = buildSessionGroups(getFilteredRuns());
        ensureExpandedGroups(sessions);

        if (!sessions.length) {
          nodes.runs.innerHTML = '<div class="empty" style="padding: 18px;">No matching runs.</div>';
          return;
        }

        nodes.runs.innerHTML = sessions
          .map((session) => {
            const expanded = isSessionExpanded(session.id);
            const body = session.runs
              .map((runGroup) => {
                if (runGroup.attempts.length <= 1) {
                  const attempt = runGroup.attempts[0];
                  const selected = attempt.runAttemptId === state.selectedRunAttemptId ? " active" : "";
                  const costLabel = formatCostPairInline(attempt);
                  const costSuffix = costLabel ? ' <span class="mono" style="color:var(--accent);font-weight:600;">' + escapeInline(costLabel) + '</span>' : '';
                  return '<button class="record' + selected + '" type="button" data-run-attempt-id="' + escapeInline(attempt.runAttemptId) + '">' +
                    '<div class="record-head">' +
                      '<div>' +
                        '<div class="record-title" title="' + escapeInline(runGroup.title) + '">' + escapeInline(runGroup.title) + costSuffix + '</div>' +
                      '</div>' +
                    '</div>' +
                  '</button>';
                }

                const runExpanded = isRunExpanded(runGroup.id);
                const attempts = runGroup.attempts
                  .map((attempt) => {
                    const selected = attempt.runAttemptId === state.selectedRunAttemptId ? " active" : "";
                    const title = formatAttemptLabel(attempt);
                    const subtitle = formatSidebarTime(attempt.updatedAt);
                    const attemptCostLabel = formatCostPairInline(attempt);
                    const attemptCostSuffix = attemptCostLabel ? ' <span class="mono" style="color:var(--accent);font-weight:600;">' + escapeInline(attemptCostLabel) + '</span>' : '';
                    return '<button class="record' + selected + '" type="button" data-run-attempt-id="' + escapeInline(attempt.runAttemptId) + '">' +
                      '<div class="record-head">' +
                        '<div>' +
                          '<div class="record-title" title="' + escapeInline(title) + '">' + escapeInline(title) + attemptCostSuffix + '</div>' +
                          '<div class="record-subtitle mono" title="' + escapeInline(subtitle) + '">' + escapeInline(subtitle) + '</div>' +
                        '</div>' +
                      '</div>' +
                    '</button>';
                  })
                  .join("");

                return '<section class="run-group' + (runExpanded ? " expanded" : "") + '">' +
                  '<button class="run-toggle" type="button" data-run-group-id="' + escapeInline(runGroup.id) + '" aria-expanded="' + String(runExpanded) + '">' +
                    '<div class="run-toggle-row">' +
                      '<span class="run-caret mono" aria-hidden="true">&gt;</span>' +
                      '<div>' +
                        '<div class="run-title" title="' + escapeInline(runGroup.title) + '">' + escapeInline(runGroup.title) + '</div>' +
                      '</div>' +
                    '</div>' +
                  '</button>' +
                  (runExpanded ? '<div class="run-body">' + attempts + '</div>' : "") +
                '</section>';
              })
              .join("");

            var iconsHtml = "";
            var chIconSrc = channelIconUrl(session.channelLabel);
            if (chIconSrc) {
              iconsHtml += '<img class="session-icon" src="' + escapeInline(chIconSrc) + '" alt="' + escapeInline(session.channelLabel) + '" title="' + escapeInline(session.channelLabel) + '" />';
            }
            var providerSlug = resolveProviderSlug(session.provider, session.model);
            var modelIconSrc = providerIconUrl(providerSlug);
            if (modelIconSrc) {
              iconsHtml += '<img class="session-icon" src="' + escapeInline(modelIconSrc) + '" alt="' + escapeInline(session.model) + '" title="' + escapeInline(session.model) + '" />';
            }
            var titleIconsSuffix = iconsHtml ? '<span class="session-icons">' + iconsHtml + '</span>' : '';
            var sessionCostLabel = formatCostPairInline(session);
            var sessionCostSuffix = sessionCostLabel ? ' <span class="mono" style="color:var(--accent);font-weight:600;">' + escapeInline(sessionCostLabel) + '</span>' : '';

            return '<section class="session-group' + (expanded ? " expanded" : "") + '">' +
              '<button class="session-toggle" type="button" data-session-id="' + escapeInline(session.id) + '" aria-expanded="' + String(expanded) + '">' +
                '<div class="session-toggle-row">' +
                  '<span class="session-caret mono" aria-hidden="true">&gt;</span>' +
                  '<div>' +
                    '<div class="session-title" title="' + escapeInline(session.label) + '">' + escapeInline(session.label) + sessionCostSuffix + titleIconsSuffix + '</div>' +
                    '<div class="session-subtitle">' + escapeInline(formatSidebarTime(session.updatedAt)) + '</div>' +
                  '</div>' +
                '</div>' +
              '</button>' +
              (expanded ? '<div class="session-body">' + body + '</div>' : "") +
            '</section>';
          })
          .join("");

        for (const button of nodes.runs.querySelectorAll(".session-toggle")) {
          button.addEventListener("click", () => {
            const sessionId = button.getAttribute("data-session-id");
            if (!sessionId) return;
            const nextExpanded = !isSessionExpanded(sessionId);
            setSessionExpanded(sessionId, nextExpanded);
            if (nextExpanded) {
              const session = sessions.find((entry) => entry.id === sessionId);
              if (session && session.runs.length > 0) {
                const firstMultiAttemptRun = session.runs.find((runGroup) => runGroup.attempts.length > 1);
                if (firstMultiAttemptRun) {
                  setRunExpanded(firstMultiAttemptRun.id, true);
                }
              }
            }
            renderRuns();
          });
        }

        for (const button of nodes.runs.querySelectorAll(".run-toggle")) {
          button.addEventListener("click", () => {
            const runGroupId = button.getAttribute("data-run-group-id");
            if (!runGroupId) return;
            setRunExpanded(runGroupId, !isRunExpanded(runGroupId));
            renderRuns();
          });
        }

        for (const button of nodes.runs.querySelectorAll(".record")) {
          button.addEventListener("click", () => {
            const nextId = button.getAttribute("data-run-attempt-id");
            if (!nextId) return;
            selectRunAttempt(nextId);
          });
        }
      }

      function renderDetail() {
        const run = state.detail;
        if (!run) {
          nodes.runAttemptIdChip.textContent = "run attempt: none";
          nodes.detailTitle.textContent = "Waiting for data";
          nodes.detailSubtitle.textContent = "Select an attempt from the left pane.";
          nodes.statusChip.style.display = "none";
          nodes.costChip.style.display = "none";
          nodes.durationChip.style.display = "none";
          nodes.detailStats.innerHTML = "";
          nodes.detailBody.innerHTML = '<div class="empty">No runs yet.</div>';
          return;
        }

        nodes.runAttemptIdChip.textContent = "run attempt: " + run.runAttemptId;
        nodes.detailTitle.textContent = [run.context.provider, run.context.model].filter(Boolean).join(" / ");
        nodes.detailSubtitle.textContent = run.context.sessionKey || run.runId;

        var status = run.meta.status || "inflight";
        nodes.statusChip.textContent = status;
        nodes.statusChip.className = "chip mono status-chip status-" + status;
        nodes.statusChip.style.display = "";

        var costText = formatCostPairInline(run.usage);
        nodes.costChip.textContent = costText;
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
        setSessionExpanded(sessionId, true);
        setRunExpanded(buildRunGroupId(sessionId, runSummary), true);
        syncFilterOptions();
        renderRuns();
      }

      async function selectRunAttempt(runAttemptId) {
        state.selectedRunAttemptId = runAttemptId;
        const selectedSummary = state.runs.find((run) => run.runAttemptId === runAttemptId);
        if (selectedSummary) {
          const sessionId = buildSessionGroupId(selectedSummary);
          setSessionExpanded(sessionId, true);
          setRunExpanded(buildRunGroupId(sessionId, selectedSummary), true);
        }
        renderRuns();
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
