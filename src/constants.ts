export const PLUGIN_ID = "run-observer";
export const PLUGIN_NAME = "Run Observer";
export const PLUGIN_ROUTE_BASE = "/plugin/run-observer";
export const DEFAULT_RECENT_RUN_LIMIT = 200;
export const SSE_RETRY_MS = 1000;
export const RUN_OBSERVER_STORAGE_SCHEMA_VERSION = 2;
export const INTERRUPTED_RUN_ERROR =
  "Gateway restarted before run-observer received agent_end for this attempt.";
