import { describe, expect, it } from "vitest";
import { pickOpenClawUsageFields, renderRunObserverHtml } from "../src/html.js";

describe("pickOpenClawUsageFields", () => {
  it("keeps only OpenClaw usage payload fields", () => {
    expect(
      pickOpenClawUsageFields({
        input: 120,
        output: 48,
        cacheRead: 12,
        cacheWrite: 3,
        total: 183,
        derivedTotalTokens: 999,
        latestPromptTokens: 777,
        reportedCostUsd: 0.1,
        estimatedCostUsd: 0.2,
        estimatedPricingUsdPerMillion: {
          input: 1,
          output: 2,
        },
      }),
    ).toEqual({
      input: 120,
      output: 48,
      cacheRead: 12,
      cacheWrite: 3,
      total: 183,
    });
  });

  it("returns an empty object when only plugin-added usage fields exist", () => {
    expect(
      pickOpenClawUsageFields({
        derivedTotalTokens: 999,
        latestPromptTokens: 777,
        reportedCostUsd: 0.1,
      }),
    ).toEqual({});
  });
});

describe("renderRunObserverHtml", () => {
  it("renders the usage panel from filtered OpenClaw usage fields only", () => {
    const html = renderRunObserverHtml({
      basePath: "/plugins/run-observer",
      pluginName: "Run Observer",
    });

    expect(html).toContain("const pickOpenClawUsageFields = function pickOpenClawUsageFields");
    expect(html).toContain("JSON.stringify(pickOpenClawUsageFields(run.usage), null, 2)");
    expect(html).not.toContain("JSON.stringify(run.usage || { status: usageState }, null, 2)");
    expect(html).not.toContain("usageCostHtml +");
  });
});
