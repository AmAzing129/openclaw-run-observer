import { renderRunObserverClientScript } from "./viewer/client-script.js";
import { RUN_OBSERVER_VIEWER_STYLES } from "./viewer/styles.js";
import { escapeHtml } from "./utils.js";

export function renderRunObserverHtml(params: {
  basePath: string;
  pluginName: string;
}): string {
  const basePath = escapeHtml(params.basePath.replace(/\/$/, ""));
  const pluginName = escapeHtml(params.pluginName);
  const clientScript = renderRunObserverClientScript({ basePath });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pluginName}</title>
    <style>${RUN_OBSERVER_VIEWER_STYLES}
    </style>
  </head>
  <body>
    <div class="page">
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-eyebrow">OpenClaw</span>
          <span class="topbar-title">${pluginName}</span>
        </div>
        <div class="topbar-right">
          <span class="chip mono connection-indicator" id="connection-state" data-state="connecting" aria-live="polite" aria-label="Connecting to live updates" title="Connecting to live updates">
            <span class="connection-dot" aria-hidden="true"></span>
            <span class="connection-label" id="connection-state-label">sync</span>
          </span>
          <button class="action-button mono" id="refresh-button" type="button" style="padding:5px 12px;font-size:12px;">Refresh</button>
        </div>
      </header>

      <div class="shell">
        <aside class="sidebar" id="runs"></aside>

        <main class="detail-main">
          <div class="detail-header">
            <div class="detail-header-text">
              <h2 id="detail-title">Waiting for data</h2>
              <div class="subtitle mono" id="detail-subtitle">Select a run from the sidebar.</div>
            </div>
            <div class="detail-chips">
              <span class="chip mono status-chip" id="status-chip" style="display:none;"></span>
              <span class="chip mono" id="cost-chip" style="display:none;"></span>
              <span class="chip mono" id="duration-chip" style="display:none;"></span>
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
        </main>
      </div>
    </div>

    <script>${clientScript}
    </script>
  </body>
</html>`;
}
