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

    <script>${clientScript}
    </script>
  </body>
</html>`;
}
