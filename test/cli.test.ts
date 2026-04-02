import { describe, expect, it } from "vitest";
import { buildRunObserverUrl } from "../src/cli.js";
import { PLUGIN_ROUTE_BASE } from "../src/constants.js";

describe("run-observer CLI", () => {
  it("builds local URLs from env, config, then default port", () => {
    const originalPort = process.env.OPENCLAW_GATEWAY_PORT;
    process.env.OPENCLAW_GATEWAY_PORT = "19001";
    expect(buildRunObserverUrl({}, "token-a")).toBe(
      `http://127.0.0.1:19001${PLUGIN_ROUTE_BASE}/?token=token-a`,
    );

    delete process.env.OPENCLAW_GATEWAY_PORT;
    expect(buildRunObserverUrl({ gateway: { port: 19999 } }, "token-b")).toBe(
      `http://127.0.0.1:19999${PLUGIN_ROUTE_BASE}/?token=token-b`,
    );

    expect(buildRunObserverUrl({}, "token-c")).toBe(
      `http://127.0.0.1:18789${PLUGIN_ROUTE_BASE}/?token=token-c`,
    );

    if (originalPort) {
      process.env.OPENCLAW_GATEWAY_PORT = originalPort;
    } else {
      delete process.env.OPENCLAW_GATEWAY_PORT;
    }
  });
});
