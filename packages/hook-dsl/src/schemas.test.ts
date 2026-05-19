import { describe, expect, test } from "bun:test";
import { parseStrategyDocument } from "./index.js";

const base = {
  version: "1.0.0" as const,
  name: "test-gas",
  audited: false,
  network: { chainId: 1, lopAddress: "0x1111111111111111111111111111111111111111" },
  order: {
    maker: "0x2222222222222222222222222222222222222222",
    makerAsset: "0x3333333333333333333333333333333333333333",
    takerAsset: "0x4444444444444444444444444444444444444444",
    makingAmount: "1000000",
    takingAmount: "2000000",
    allowPartialFills: true,
  },
};

describe("parseStrategyDocument", () => {
  test("accepts gas-guard", () => {
    const doc = parseStrategyDocument({
      ...base,
      templateId: "gas-guard",
      block: { type: "gas-guard", maxGwei: 30 },
    });
    expect(doc.templateId).toBe("gas-guard");
  });

  test("rejects block/template mismatch", () => {
    expect(() =>
      parseStrategyDocument({
        ...base,
        templateId: "stop-loss",
        block: { type: "gas-guard", maxGwei: 30 },
      }),
    ).toThrow();
  });
});
