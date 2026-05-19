import { describe, expect, test } from "bun:test";
import { parseStrategyDocument } from "./index.js";

const base = {
  version: "1.0.0" as const,
  name: "test-gas",
  audited: false,
  network: {
    chainId: 1,
    lopAddress: "0x1111111111111111111111111111111111111111",
  },
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

  test("accepts structured audit provenance", () => {
    const doc = parseStrategyDocument({
      ...base,
      templateId: "gas-guard",
      audited: true,
      audit: {
        auditor: "Acme Security",
        reportUrl: "https://example.com/report.pdf",
        scope: "GasGuardStrategy v0.1.0",
        commitHash: "1234abcd",
        date: "2026-04-12",
      },
      block: { type: "gas-guard", maxGwei: 30 },
    });
    expect(doc.audit?.auditor).toBe("Acme Security");
  });

  test("rejects audit with malformed commit hash", () => {
    expect(() =>
      parseStrategyDocument({
        ...base,
        templateId: "gas-guard",
        audit: {
          auditor: "Acme",
          reportUrl: "https://example.com",
          scope: "Scope",
          commitHash: "not-hex",
          date: "2026-04-12",
        },
        block: { type: "gas-guard", maxGwei: 30 },
      }),
    ).toThrow();
  });
});
