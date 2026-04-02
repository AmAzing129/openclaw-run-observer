import crypto from "node:crypto";

export function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

export function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function formatStorageDay(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export function createAccessToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function deriveLatestPromptTokens(lastAssistant?: unknown): number | undefined {
  if (!lastAssistant || typeof lastAssistant !== "object" || Array.isArray(lastAssistant)) {
    return undefined;
  }
  const usage = (lastAssistant as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return undefined;
  }
  const input = asFiniteNumber((usage as { input?: unknown }).input) ?? 0;
  const cacheRead = asFiniteNumber((usage as { cacheRead?: unknown }).cacheRead) ?? 0;
  const cacheWrite = asFiniteNumber((usage as { cacheWrite?: unknown }).cacheWrite) ?? 0;
  const total = input + cacheRead + cacheWrite;
  return total > 0 ? total : undefined;
}

export function deriveUsageTotal(usage?: {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
}): number | undefined {
  if (!usage) {
    return undefined;
  }
  if (typeof usage.total === "number" && Number.isFinite(usage.total) && usage.total >= 0) {
    return usage.total;
  }
  const values = [usage.input, usage.output, usage.cacheRead, usage.cacheWrite].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0);
}

export function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export function trimRecentRecords<T>(items: T[], maxItems: number): T[] {
  return items.length <= maxItems ? items : items.slice(0, maxItems);
}

export function buildPromptPreview(value: unknown, maxChars = 88): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  const truncated = normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd();
  return truncated ? `${truncated}...` : normalized.slice(0, maxChars);
}

export function isLoopbackRemoteAddress(remoteAddress: string | undefined): boolean {
  const raw = remoteAddress?.trim().toLowerCase();
  if (!raw) {
    return false;
  }
  return (
    raw === "127.0.0.1" ||
    raw === "::1" ||
    raw === "::ffff:127.0.0.1" ||
    raw === "::127.0.0.1" ||
    raw.startsWith("127.") ||
    raw.startsWith("::ffff:127.")
  );
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
