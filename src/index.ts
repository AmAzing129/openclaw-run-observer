import path from "node:path";
import {
  definePluginEntry,
  emptyPluginConfigSchema,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/core";
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ROUTE_BASE } from "./constants.js";
import {
  buildRunObserverUrl,
  registerRunObserverCli,
  RUN_OBSERVER_CLI_DESCRIPTOR,
} from "./cli.js";
import { createRunObserverHttpHandler } from "./http.js";
import { RunObserverRuntime } from "./observer.js";
import type { RunObserverLlmInputPayload } from "./types.js";

export default definePluginEntry({
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  description:
    "Capture OpenClaw run inputs, outputs, usage, and context, persist recent attempts, and inspect them in a live local viewer.",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    const stateDir = api.runtime.state.resolveStateDir();
    const observer = new RunObserverRuntime({
      logger: api.logger,
      rootDir: path.join(stateDir, "plugins", PLUGIN_ID),
      stateDir,
      config: api.config,
    });

    api.on("llm_input", async (event, ctx) => {
      await observer.recordLlmInput({
        runId: event.runId,
        sessionId: event.sessionId,
        provider: event.provider,
        model: event.model,
        prompt: event.prompt,
        historyMessages: event.historyMessages,
        imagesCount: event.imagesCount,
        ...(event.systemPrompt !== undefined ? { systemPrompt: event.systemPrompt } : {}),
        ctx: buildLlmInputContext(ctx),
      });
    });

    api.on("llm_output", async (event) => {
      await observer.recordLlmOutput({
        runId: event.runId,
        assistantTexts: event.assistantTexts,
        ...(event.lastAssistant !== undefined ? { lastAssistant: event.lastAssistant } : {}),
        ...(event.usage !== undefined ? { usage: event.usage } : {}),
      });
    });

    api.on("agent_end", async (event, ctx) => {
      if (!ctx.runId) {
        api.logger.warn(`[${PLUGIN_ID}] agent_end received without runId; skipping run-attempt update`);
        return;
      }
      await observer.recordAgentEnd({
        runId: ctx.runId,
        messages: event.messages,
        success: event.success,
        ...(event.error !== undefined ? { error: event.error } : {}),
        ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
      });
    });

    api.registerHttpRoute({
      path: PLUGIN_ROUTE_BASE,
      auth: "plugin",
      match: "prefix",
      handler: createRunObserverHttpHandler({ observer }),
    });

    api.registerCli(
      ({ program, config }) => {
        registerRunObserverCli({
          program,
          config,
          observer,
        });
      },
      {
        descriptors: [RUN_OBSERVER_CLI_DESCRIPTOR],
      },
    );

    api.registerService({
      id: PLUGIN_ID,
      start: async () => {
        await observer.start();
        const access = await observer.getAccessState();
        const viewerUrl = new URL(buildRunObserverUrl(api.config, access.token));
        viewerUrl.search = "";
        api.logger.info(
          `[${PLUGIN_ID}] viewer ready at ${viewerUrl.toString()}`,
        );
      },
      stop: async () => {
        await observer.stop();
      },
    });
  },
});

function buildLlmInputContext(
  ctx: RunObserverLlmInputPayload["ctx"],
): RunObserverLlmInputPayload["ctx"] {
  const runId = ctx.runId?.trim();
  const agentId = ctx.agentId?.trim();
  const sessionId = ctx.sessionId?.trim();
  const sessionKey = ctx.sessionKey?.trim();
  const workspaceDir = ctx.workspaceDir?.trim();
  const trigger = ctx.trigger?.trim();
  const channelId = ctx.channelId?.trim();
  const messageProvider = ctx.messageProvider?.trim();

  return {
    ...(runId ? { runId } : {}),
    ...(agentId ? { agentId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(sessionKey ? { sessionKey } : {}),
    ...(workspaceDir ? { workspaceDir } : {}),
    ...(trigger ? { trigger } : {}),
    ...(channelId ? { channelId } : {}),
    ...(messageProvider ? { messageProvider } : {}),
  };
}
