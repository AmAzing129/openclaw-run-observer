export const RUN_OBSERVER_VIEWER_STYLES = `
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
        display: flex;
        flex-direction: column;
      }

      /* ── Top bar ── */

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 22px;
        border-bottom: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(16px);
        flex-shrink: 0;
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .topbar-left {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }

      .topbar-eyebrow {
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        flex-shrink: 0;
      }

      .topbar-title {
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .topbar-right {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
      }

      /* ── Shell: sidebar + detail ── */

      .shell {
        display: grid;
        grid-template-columns: 420px minmax(0, 1fr);
        flex: 1;
        min-height: 0;
      }

      /* ── Sidebar ── */

      .sidebar {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        border-right: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(16px);
        overflow: hidden;
        height: calc(100vh - 45px);
        position: sticky;
        top: 45px;
      }

      .sidebar.has-agent-channel-tabs {
        grid-template-columns: 92px minmax(0, 1fr);
      }

      .sidebar-agent-bar {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 8px;
        border-right: 1px solid var(--line);
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
        background: var(--panel);
        backdrop-filter: blur(16px);
        position: relative;
        z-index: 1;
      }

      .agent-channel-tab {
        width: 100%;
        min-height: 78px;
        padding: 10px 8px;
        border-radius: 20px;
        border: 1px solid rgba(148, 97, 45, 0.12);
        background: rgba(255, 255, 255, 0.44);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        color: inherit;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          background 140ms ease,
          border-color 140ms ease,
          box-shadow 140ms ease;
      }

      .agent-channel-tab:hover {
        border-color: rgba(148, 97, 45, 0.24);
        background: rgba(255, 255, 255, 0.58);
      }

      .agent-channel-tab.active {
        background: linear-gradient(180deg, rgba(255, 249, 240, 0.96), rgba(248, 238, 224, 0.94));
        border-color: rgba(148, 97, 45, 0.3);
        box-shadow: 0 2px 8px rgba(53, 38, 22, 0.06);
      }

      .agent-channel-tab-title {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-width: 0;
      }

      .agent-channel-tab-icon {
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .agent-channel-tab-icon svg {
        width: 20px;
        height: 20px;
        display: block;
        opacity: 0.86;
      }

      .agent-channel-tab-icon-fallback {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: var(--accent);
        background: rgba(148, 97, 45, 0.12);
      }

      .agent-channel-tab-label {
        display: block;
        max-width: 100%;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }

      .sidebar-sessions {
        min-height: 0;
        min-width: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 6px;
        scrollbar-gutter: stable;
      }

      /* ── Session section inside sidebar ── */

      .session-section {
        margin-bottom: 4px;
        border: 1px solid rgba(148, 97, 45, 0.1);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.34);
        overflow: hidden;
      }

      .session-section.active {
        border-color: rgba(148, 97, 45, 0.22);
        background: rgba(255, 255, 255, 0.52);
      }

      .session-tab {
        width: 100%;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;
        font: inherit;
        padding: 8px 10px;
        transition: background 140ms ease;
      }

      .session-tab:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .session-tab-row {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .session-tab-heading {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        min-width: 0;
      }

      .session-tab-icon {
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .session-tab-icon svg {
        width: 16px;
        height: 16px;
        display: block;
      }

      .session-tab-title {
        font-weight: 700;
        font-size: 12px;
        line-height: 1.3;
        display: block;
        overflow-wrap: anywhere;
      }

      .session-tab-subtitle {
        font-size: 11px;
        line-height: 1.3;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-body {
        padding: 0 6px 6px;
      }

      /* ── Session instance groups ── */

      .session-instance-group {
        margin-top: 2px;
        border: 1px solid rgba(148, 97, 45, 0.1);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.34);
        overflow: hidden;
      }

      .session-instance-group.expanded {
        background: rgba(255, 255, 255, 0.48);
        border-color: rgba(148, 97, 45, 0.18);
      }

      .session-instance-toggle {
        width: 100%;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;
        font: inherit;
        padding: 6px 10px;
        transition: background 140ms ease;
      }

      .session-instance-toggle:hover {
        background: rgba(255, 255, 255, 0.28);
      }

      .session-instance-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }

      .session-instance-caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        margin-top: 1px;
        color: var(--muted);
        font-size: 11px;
        transition: transform 140ms ease;
      }

      .session-instance-toggle[aria-expanded="true"] .session-instance-caret {
        transform: rotate(90deg);
      }

      .session-instance-title {
        font-weight: 700;
        font-size: 11px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-instance-subtitle {
        margin-top: 1px;
        font-size: 10px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-instance-cost {
        margin-top: 2px;
        font-size: 11px;
        font-weight: 600;
        color: var(--accent);
      }

      .session-instance-body {
        margin: 0 6px 4px 16px;
        padding-left: 8px;
        border-left: 1px solid rgba(148, 97, 45, 0.12);
      }

      /* ── Run groups ── */

      .run-group {
        margin-top: 2px;
        border: 1px solid rgba(148, 97, 45, 0.1);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.34);
        overflow: hidden;
      }

      .run-group.expanded {
        background: rgba(255, 255, 255, 0.48);
        border-color: rgba(148, 97, 45, 0.18);
      }

      .run-toggle {
        width: 100%;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;
        font: inherit;
        padding: 6px 10px;
        transition: background 140ms ease;
      }

      .run-toggle:hover {
        background: rgba(255, 255, 255, 0.28);
      }

      .run-toggle-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }

      .run-toggle-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        min-width: 0;
      }

      .run-toggle-main.has-provider-icon {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .run-caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        margin-top: 1px;
        color: var(--muted);
        font-size: 11px;
        transition: transform 140ms ease;
      }

      .run-toggle[aria-expanded="true"] .run-caret {
        transform: rotate(90deg);
      }

      .run-title {
        font-weight: 700;
        font-size: 11px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .run-subtitle {
        margin-top: 2px;
        font-size: 11px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .run-body {
        margin: 0 6px 4px 16px;
        padding-left: 8px;
        border-left: 1px solid rgba(148, 97, 45, 0.12);
      }

      /* ── Record (single attempt) ── */

      .record {
        width: 100%;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;
        font: inherit;
        display: grid;
        gap: 2px;
        margin-top: 2px;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid transparent;
        transition:
          border-color 140ms ease,
          background 140ms ease;
      }

      .record:hover {
        border-color: rgba(148, 97, 45, 0.24);
        background: rgba(255, 255, 255, 0.62);
      }

      .record.active {
        border-color: rgba(148, 97, 45, 0.3);
        background: linear-gradient(180deg, rgba(255, 249, 240, 0.96), rgba(248, 238, 224, 0.94));
      }

      .record-head {
        display: grid;
        gap: 2px;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
      }

      .record-head.has-provider-icon {
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }

      .record-head-text {
        min-width: 0;
      }

      .record-title {
        font-weight: 700;
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .record-subtitle {
        font-size: 10px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .record-provider-icon,
      .run-provider-icon,
      .detail-provider-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .record-provider-icon,
      .run-provider-icon {
        width: 14px;
        height: 14px;
        margin-top: 1px;
      }

      .record-provider-icon svg,
      .run-provider-icon svg {
        width: 14px;
        height: 14px;
        display: block;
        opacity: 0.92;
      }

      /* ── Detail main area ── */

      .detail-main {
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 45px);
        min-width: 0;
      }

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 22px;
        border-bottom: 1px solid var(--line);
        flex-shrink: 0;
      }

      .detail-header-text {
        min-width: 0;
      }

      .detail-header-text h2 {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        font-size: 18px;
        line-height: 1.2;
      }

      .detail-title-row {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .detail-provider-icon {
        width: 20px;
        height: 20px;
      }

      .detail-provider-icon svg {
        width: 20px;
        height: 20px;
        display: block;
      }

      .detail-chips {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
      }

      .subtitle {
        margin-top: 4px;
        color: var(--muted);
        line-height: 1.5;
        font-size: 12px;
      }

      .detail-stats {
        padding: 10px 22px 0;
      }

      .detail-stats:empty {
        display: none;
      }

      .detail-tabs {
        display: flex;
        gap: 0;
        padding: 0 22px;
        border-bottom: 1px solid var(--line);
        flex-shrink: 0;
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
        flex: 1;
        overflow-y: auto;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
      }

      .detail-item {
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--panel-strong);
        border: 1px solid var(--line);
      }

      .detail-item strong {
        display: block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 2px;
      }

      .detail-item .value {
        font-size: 13px;
        font-weight: 600;
        word-break: break-word;
      }

      /* ── Shared components ── */

      h1,
      h2,
      h3,
      summary {
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
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

      .connection-indicator {
        padding: 4px 10px;
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .connection-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: currentColor;
        flex-shrink: 0;
      }

      .connection-label {
        min-width: 4ch;
      }

      .connection-indicator[data-state="connecting"],
      .connection-indicator[data-state="reconnecting"] {
        color: var(--accent);
        background: rgba(148, 97, 45, 0.08);
        border-color: rgba(148, 97, 45, 0.22);
      }

      .connection-indicator[data-state="live"] {
        color: var(--ok);
        background: rgba(42, 119, 82, 0.08);
        border-color: rgba(42, 119, 82, 0.22);
      }

      .connection-indicator[data-state="error"] {
        color: var(--danger);
        background: rgba(163, 62, 44, 0.08);
        border-color: rgba(163, 62, 44, 0.22);
      }

      .connection-indicator[data-state="connecting"] .connection-dot,
      .connection-indicator[data-state="reconnecting"] .connection-dot {
        animation: connection-pulse 1.4s ease-in-out infinite;
      }

      @keyframes connection-pulse {
        0%, 100% {
          transform: scale(0.92);
          opacity: 0.68;
        }

        50% {
          transform: scale(1.18);
          opacity: 1;
        }
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

      .empty {
        color: var(--muted);
      }

      .callout {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.64);
        line-height: 1.5;
        font-size: 13px;
        color: var(--muted);
      }

      .callout + .callout {
        margin-top: 8px;
      }

      .callout-head {
        display: flex;
        justify-content: flex-end;
        margin: -2px -2px 6px;
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

      /* ── Content details / pre / prompts ── */

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

      .copyable-details {
        position: relative;
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

      .copyable-details > summary {
        padding-right: 56px;
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

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .section-heading {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
      }

      .section-header .section-label {
        margin: 0;
      }

      .section-meta {
        font-size: 11px;
        color: var(--muted);
        flex-shrink: 0;
        white-space: nowrap;
      }

      .summary-title {
        min-width: 0;
      }

      .details-summary-actions {
        position: absolute;
        top: 8px;
        right: 12px;
        display: flex;
        align-items: center;
        z-index: 1;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .copy-block-btn {
        width: 30px;
        height: 30px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .copy-block-btn:hover {
        transform: none;
      }

      .copy-block-btn[data-copy-state="pending"] {
        color: var(--accent);
      }

      .copy-block-btn[data-copy-state="success"] {
        color: var(--ok);
        border-color: rgba(42, 119, 82, 0.24);
        background: rgba(42, 119, 82, 0.08);
      }

      .copy-block-btn[data-copy-state="error"] {
        color: var(--danger);
        border-color: rgba(163, 62, 44, 0.24);
        background: rgba(163, 62, 44, 0.08);
      }

      .copy-block-icon {
        width: 15px;
        height: 15px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .copy-block-icon svg {
        width: 15px;
        height: 15px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .copy-block-btn[data-copy-state="pending"] .copy-block-icon {
        opacity: 0.72;
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

      /* ── Chat messages ── */

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

      .chat-msg-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px 0;
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
        width: min(100%, 960px);
        max-width: 100%;
      }

      .chat-msg.role-tool.is-tool-error,
      .chat-msg.role-function.is-tool-error {
        border-left-color: var(--danger);
        background: rgba(163, 62, 44, 0.06);
      }

      .chat-msg.has-tool-calls {
        border-left: 3px solid #7c6cb0;
      }

      .chat-role {
        display: inline-block;
        padding: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .chat-msg-head .chat-role {
        padding-right: 0;
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

      .chat-msg.role-tool .chat-role-badge.badge-tool-result {
        background: rgba(124, 108, 176, 0.14);
      }

      .chat-content {
        padding: 8px 14px 14px;
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 200px;
        overflow: auto;
      }

      .tool-calls-list {
        padding: 4px 14px 14px;
        display: grid;
        gap: 8px;
      }

      .tool-call-item {
        border: 1px solid rgba(124, 108, 176, 0.16);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(249, 246, 255, 0.78));
        padding: 10px 12px;
        font-size: 11px;
        line-height: 1.45;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }

      .tool-call-heading {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .tool-call-kicker {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(124, 108, 176, 0.78);
      }

      .tool-call-name {
        font-weight: 700;
        color: #7c6cb0;
        font-size: 15px;
        letter-spacing: 0.01em;
        line-height: 1.2;
      }

      .tool-call-detail {
        font-weight: 400;
        color: var(--muted);
        font-size: 11px;
        word-break: break-word;
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .tool-call-args-toggle {
        font-size: 11px;
        color: var(--muted);
        cursor: pointer;
        padding: 8px 0 0;
        list-style: none;
        font-weight: 600;
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
        max-height: 160px;
        overflow: auto;
        color: var(--muted);
        margin-top: 6px;
        padding: 10px 11px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.66);
        border: 1px solid rgba(124, 108, 176, 0.12);
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .tool-call-args-details {
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px dashed rgba(124, 108, 176, 0.16);
      }

      .tool-result-summary {
        padding: 8px 14px 0;
        display: grid;
        gap: 10px;
      }

      .tool-result-topline {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }

      .tool-result-heading {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .tool-result-name {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.25;
        color: var(--text);
      }

      .tool-result-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }

      .tool-result-status {
        display: inline-flex;
        align-items: center;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(42, 119, 82, 0.12);
        color: var(--ok);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .tool-result-status.is-error {
        background: rgba(163, 62, 44, 0.12);
        color: var(--danger);
      }

      .tool-result-detail {
        font-size: 12px;
        font-weight: 500;
        color: var(--muted);
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
        word-break: break-word;
      }

      .tool-result-chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.64);
        border: 1px solid rgba(124, 108, 176, 0.1);
        min-width: 0;
      }

      .tool-result-size {
        font-size: 11px;
        color: var(--muted);
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .tool-result-preview {
        padding: 10px 11px;
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(247, 243, 255, 0.72));
        border: 1px solid rgba(124, 108, 176, 0.12);
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.5;
        color: var(--text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .tool-result-empty {
        padding: 0 14px 14px;
        font-size: 12px;
        color: var(--muted);
      }

      .chat-msg.role-tool > details {
        margin: 4px 14px 14px;
        border: 1px solid rgba(124, 108, 176, 0.14);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.58);
      }

      .chat-msg.role-tool > details > summary {
        font-size: 12px;
        padding: 10px 12px 8px;
        color: var(--muted);
        cursor: pointer;
        font-weight: 600;
      }

      .chat-msg.role-tool > details.tool-result-output > summary {
        font-weight: 600;
      }

      .chat-msg.role-tool > details > .chat-content {
        padding-top: 0;
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

      .detail-prelude {
        color: var(--muted);
      }

      /* ── Responsive ── */

      @media (max-width: 900px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          height: auto;
          position: static;
          max-height: 50vh;
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        .detail-main {
          min-height: auto;
        }

        .detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        .topbar {
          padding: 8px 14px;
        }

        .sidebar.has-agent-channel-tabs {
          grid-template-columns: 78px minmax(0, 1fr);
        }

        .sidebar-agent-bar {
          gap: 6px;
          padding: 8px 6px;
        }

        .agent-channel-tab {
          min-height: 70px;
          padding: 8px 6px;
        }

        .detail-body,
        .detail-header {
          padding-left: 14px;
          padding-right: 14px;
        }

        .detail-grid {
          grid-template-columns: 1fr;
        }

        .detail-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
`;
