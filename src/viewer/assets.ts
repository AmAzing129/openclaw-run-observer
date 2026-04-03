import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ViewerLocalIconKind = "badge" | "terminal" | "openclaw";

type ViewerLocalIconDefinition = {
  kind?: ViewerLocalIconKind;
  label?: string;
  bg: string;
  fg: string;
  accent?: string;
};

export const OPENCLAW_MAIN_ICON_SLUG = "openclaw";
export const LOCAL_ICON_DIRECTORY = fileURLToPath(
  new URL("../../viewer-icons/", import.meta.url),
);
const SVG_DOCUMENT_PREFIX =
  /^(?:\uFEFF)?\s*(?:(?:(?:<\?xml[\s\S]*?\?>)|(?:<!doctype[\s\S]*?>)|(?:<!--[\s\S]*?-->))\s*)*<svg\b/i;

export const CHANNEL_ICON_MAP: Record<string, string> = {
  discord: "discord",
  telegram: "telegram",
  tui: "ghostty",
  weixin: "wechat",
  wechat: "wechat",
  whatsapp: "whatsapp",
  slack: "slack",
  signal: "signal",
  googlechat: "googlechat",
  "google chat": "googlechat",
  imessage: "imessage",
  irc: "irc",
  line: "line",
};

export const PROVIDER_ICON_MAP: Record<string, string> = {
  vercel: "vercel",
  openrouter: "openrouter",
  "azure-openai": "azure-color",
  azure: "azure-color",
  openai: "openai",
  anthropic: "anthropic",
  claude: "anthropic",
  google: "google-color",
  gemini: "google-color",
  vertex: "google-color",
  deepseek: "deepseek-color",
  mistral: "mistral-color",
  meta: "meta-color",
  llama: "meta-color",
  cohere: "cohere-color",
  perplexity: "perplexity-color",
  groq: "groq",
  together: "together-color",
  togetherai: "together-color",
  fireworks: "fireworks-color",
  amazon: "aws-color",
  aws: "aws-color",
  bedrock: "aws-color",
  zhipu: "zhipu-color",
  moonshot: "moonshot",
  qwen: "qwen-color",
  alibaba: "alibaba-color",
  baichuan: "baichuan-color",
  minimax: "minimax-color",
  yi: "zeroone",
  "01": "zeroone",
  ai21: "ai21-brand-color",
  bytedance: "bytedance-color",
  doubao: "bytedance-color",
  spark: "spark-color",
  ollama: "ollama",
  huggingface: "huggingface-color",
  replicate: "replicate-brand",
  xai: "xai",
  grok: "xai",
  siliconflow: "siliconcloud-color",
  siliconcloud: "siliconcloud-color",
  stepfun: "stepfun-color",
  nvidia: "nvidia-color",
  cloudflare: "cloudflare-color",
  "workers-ai": "cloudflare-color",
  workersai: "cloudflare-color",
  sambanova: "sambanova-color",
  cerebras: "cerebras-brand-color",
};

const GENERATED_ICON_DEFINITIONS: Record<string, ViewerLocalIconDefinition> = {
  [OPENCLAW_MAIN_ICON_SLUG]: {
    kind: "openclaw",
    bg: "#fff6ea",
    fg: "#8b4a14",
    accent: "#d97706",
  },
  discord: { label: "D", bg: "#5865f2", fg: "#ffffff" },
  telegram: { label: "T", bg: "#229ed9", fg: "#ffffff" },
  ghostty: {
    kind: "terminal",
    label: ">_",
    bg: "#171717",
    fg: "#f8fafc",
    accent: "#f59e0b",
  },
  wechat: { label: "W", bg: "#07c160", fg: "#ffffff" },
  whatsapp: { label: "WA", bg: "#25d366", fg: "#0b2f17" },
  slack: { label: "SL", bg: "#4a154b", fg: "#ffffff" },
  signal: { label: "SI", bg: "#3b82f6", fg: "#ffffff" },
  googlechat: { label: "GC", bg: "#1a73e8", fg: "#ffffff" },
  imessage: { label: "iM", bg: "#34c759", fg: "#ffffff" },
  irc: { label: "IR", bg: "#7c3aed", fg: "#ffffff" },
  line: { label: "L", bg: "#06c755", fg: "#ffffff" },
  vercel: { label: "V", bg: "#111111", fg: "#ffffff" },
  openrouter: { label: "OR", bg: "#0f766e", fg: "#f0fdfa" },
  "azure-color": { label: "Az", bg: "#0078d4", fg: "#ffffff" },
  openai: { label: "O", bg: "#111827", fg: "#f8fafc" },
  anthropic: { label: "A", bg: "#d6bfa5", fg: "#2f2417" },
  "google-color": { label: "G", bg: "#1a73e8", fg: "#ffffff" },
  "deepseek-color": { label: "DS", bg: "#2563eb", fg: "#ffffff" },
  "mistral-color": { label: "M", bg: "#f97316", fg: "#ffffff" },
  "meta-color": { label: "M", bg: "#2563eb", fg: "#ffffff" },
  "cohere-color": { label: "C", bg: "#f97360", fg: "#ffffff" },
  "perplexity-color": { label: "P", bg: "#0891b2", fg: "#ffffff" },
  groq: { label: "GQ", bg: "#111111", fg: "#ffffff" },
  "together-color": { label: "TG", bg: "#0f766e", fg: "#f0fdfa" },
  "fireworks-color": { label: "FW", bg: "#dc2626", fg: "#ffffff" },
  "aws-color": { label: "AW", bg: "#ff9900", fg: "#1f2937" },
  "zhipu-color": { label: "Z", bg: "#0f766e", fg: "#ffffff" },
  moonshot: { label: "M", bg: "#312e81", fg: "#ffffff" },
  "qwen-color": { label: "Q", bg: "#7c3aed", fg: "#ffffff" },
  "alibaba-color": { label: "A", bg: "#ff6a00", fg: "#ffffff" },
  "baichuan-color": { label: "B", bg: "#2563eb", fg: "#ffffff" },
  "minimax-color": { label: "MM", bg: "#ec4899", fg: "#ffffff" },
  zeroone: { label: "01", bg: "#475569", fg: "#ffffff" },
  "ai21-brand-color": { label: "AI", bg: "#db2777", fg: "#ffffff" },
  "bytedance-color": { label: "BD", bg: "#2563eb", fg: "#ffffff" },
  "spark-color": { label: "SP", bg: "#ef4444", fg: "#ffffff" },
  ollama: { label: "O", bg: "#111111", fg: "#ffffff" },
  "huggingface-color": { label: "HF", bg: "#facc15", fg: "#3f2e00" },
  "replicate-brand": { label: "R", bg: "#111111", fg: "#ffffff" },
  xai: { label: "X", bg: "#0f172a", fg: "#ffffff" },
  "siliconcloud-color": { label: "SC", bg: "#2563eb", fg: "#ffffff" },
  "stepfun-color": { label: "SF", bg: "#06b6d4", fg: "#ffffff" },
  "nvidia-color": { label: "N", bg: "#76b900", fg: "#102400" },
  "cloudflare-color": { label: "CF", bg: "#f97316", fg: "#ffffff" },
  "sambanova-color": { label: "SN", bg: "#0f766e", fg: "#f0fdfa" },
  "cerebras-brand-color": { label: "CB", bg: "#16a34a", fg: "#ffffff" },
};

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeIconBaseSlug(slug: string): string {
  return slug.replace(/-(color|brand)$/g, "");
}

function deriveFallbackLabel(slug: string): string {
  const base = normalizeIconBaseSlug(slug);
  if (!base) return "?";
  const parts = base.split(/[^a-z0-9]+/i).filter(Boolean);
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase();
  }
  if (base.length >= 2 && /^\d/.test(base)) {
    return base.slice(0, 2).toUpperCase();
  }
  return base[0]?.toUpperCase() || "?";
}

function hashSlug(slug: string): number {
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function buildFallbackIconDefinition(slug: string): ViewerLocalIconDefinition {
  const palette = [
    { bg: "#6d28d9", fg: "#ffffff" },
    { bg: "#0f766e", fg: "#f0fdfa" },
    { bg: "#2563eb", fg: "#ffffff" },
    { bg: "#f97316", fg: "#ffffff" },
    { bg: "#be185d", fg: "#ffffff" },
    { bg: "#475569", fg: "#ffffff" },
  ];
  const picked =
    palette[hashSlug(slug) % palette.length] ??
    ({
      bg: "#6d28d9",
      fg: "#ffffff",
    } satisfies { bg: string; fg: string });
  return {
    label: deriveFallbackLabel(slug),
    bg: picked.bg,
    fg: picked.fg,
  };
}

function buildBadgeIconSvg(definition: ViewerLocalIconDefinition): string {
  const label = escapeSvgText(definition.label || "?");
  const fontSize =
    label.length >= 3 ? 7.5 : label.length === 2 ? 9.5 : 12.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="${definition.bg}"/><text x="12" y="12.4" fill="${definition.fg}" font-size="${fontSize}" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`;
}

function buildTerminalIconSvg(definition: ViewerLocalIconDefinition): string {
  const promptColor = definition.accent || "#f59e0b";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="5" fill="${definition.bg}"/><path d="M7 9.2 10.3 12 7 14.8" stroke="${promptColor}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.8 15h4.6" stroke="${definition.fg}" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="6.4" r="1" fill="${promptColor}" fill-opacity=".9"/><circle cx="11" cy="6.4" r="1" fill="${definition.fg}" fill-opacity=".75"/></svg>`;
}

function buildOpenClawIconSvg(definition: ViewerLocalIconDefinition): string {
  const accent = definition.accent || "#d97706";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="${definition.bg}" stroke="${accent}" stroke-opacity=".2"/><path d="M8.3 16.8c1.4-2.7 2.1-5 2.4-9" stroke="${accent}" stroke-width="1.9" stroke-linecap="round"/><path d="M11.9 17.6c1.2-2.1 1.9-4.1 2.2-7.3" stroke="${accent}" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 16.2c1-1.6 1.5-3.2 1.8-5.5" stroke="${accent}" stroke-width="1.9" stroke-linecap="round"/><path d="M6.7 16.5c1.8.7 3.5 1 5.4 1 1.9 0 3.6-.4 5.2-1.1" stroke="${definition.fg}" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".8"/></svg>`;
}

function renderGeneratedIconSvg(slug: string): string {
  const definition =
    GENERATED_ICON_DEFINITIONS[slug] || buildFallbackIconDefinition(slug);
  switch (definition.kind) {
    case "openclaw":
      return buildOpenClawIconSvg(definition);
    case "terminal":
      return buildTerminalIconSvg(definition);
    default:
      return buildBadgeIconSvg(definition);
  }
}

function collectKnownIconSlugs(): string[] {
  const slugs = new Set<string>([OPENCLAW_MAIN_ICON_SLUG]);
  for (const slug of Object.values(CHANNEL_ICON_MAP)) {
    slugs.add(slug);
  }
  for (const slug of Object.values(PROVIDER_ICON_MAP)) {
    slugs.add(slug);
  }
  return [...slugs];
}

function isSafeIconSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/i.test(slug);
}

function looksLikeSvgDocument(svg: string): boolean {
  return SVG_DOCUMENT_PREFIX.test(svg);
}

function readLocalIconSvg(
  slug: string,
  iconDirectory = LOCAL_ICON_DIRECTORY,
): string | undefined {
  if (!isSafeIconSlug(slug)) {
    return undefined;
  }
  const iconPath = path.join(iconDirectory, `${slug}.svg`);
  if (!existsSync(iconPath)) {
    return undefined;
  }
  const svg = readFileSync(iconPath, "utf8").trim();
  return looksLikeSvgDocument(svg) ? svg : undefined;
}

export const KNOWN_LOCAL_ICON_SLUGS = collectKnownIconSlugs();

export function buildLocalIconSvgMap(options?: {
  iconDirectory?: string;
  slugs?: string[];
}): Record<string, string> {
  const iconDirectory = options?.iconDirectory ?? LOCAL_ICON_DIRECTORY;
  const slugs = options?.slugs ?? KNOWN_LOCAL_ICON_SLUGS;
  return Object.fromEntries(
    slugs.map((slug) => [
      slug,
      readLocalIconSvg(slug, iconDirectory) || renderGeneratedIconSvg(slug),
    ]),
  );
}
