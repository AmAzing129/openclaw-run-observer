import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { PLUGIN_NAME, PLUGIN_ROUTE_BASE } from "./constants.js";
import type { RunObserverRuntime } from "./observer.js";

type CliProgramLike = {
  command: (name: string) => {
    description: (value: string) => ReturnType<CliProgramLike["command"]>;
    command: (name: string) => ReturnType<CliProgramLike["command"]>;
    action: (handler: () => void | Promise<void>) => ReturnType<CliProgramLike["command"]>;
  };
};

export function registerRunObserverCli(params: {
  program: CliProgramLike;
  config: OpenClawConfig;
  observer: RunObserverRuntime;
}): void {
  const root = params.program
    .command("run-observer")
    .description("Inspect captured OpenClaw run inputs, outputs, usage, and context.");

  root
    .command("url")
    .description("Print the local Run Observer viewer URL.")
    .action(async () => {
      const access = await params.observer.getAccessState();
      process.stdout.write(`${buildRunObserverUrl(params.config, access.token)}\n`);
    });

  root
    .command("rotate-token")
    .description("Rotate the local Run Observer access token and print the new URL.")
    .action(async () => {
      const access = await params.observer.rotateAccessToken();
      process.stdout.write(`${buildRunObserverUrl(params.config, access.token)}\n`);
    });
}

export function buildRunObserverUrl(config: OpenClawConfig, token: string): string {
  const port = resolveGatewayPort(config, process.env);
  const url = new URL(`http://127.0.0.1:${port}${PLUGIN_ROUTE_BASE}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

function resolveGatewayPort(config: OpenClawConfig, env: NodeJS.ProcessEnv): number {
  const rawFromEnv = env.OPENCLAW_GATEWAY_PORT?.trim();
  const envPort = parsePositivePort(rawFromEnv);
  if (envPort !== undefined) {
    return envPort;
  }
  const configPort = config.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort) && configPort > 0) {
    return configPort;
  }
  return 18789;
}

function parsePositivePort(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export const RUN_OBSERVER_CLI_DESCRIPTOR = {
  name: "run-observer",
  description: `${PLUGIN_NAME} local viewer and token management commands`,
  hasSubcommands: true,
} as const;
