import type { StrategyDocument } from "@limit-canvas/hook-dsl";
import type { TemplateId } from "@limit-canvas/hook-dsl";

export function defaultDocument(templateId: TemplateId): StrategyDocument {
  const base = {
    version: "1.0.0" as const,
    name: `My ${templateId}`,
    audited: templateId === "stop-loss" || templateId === "gas-guard",
    network: {
      chainId: 1,
      lopAddress: "0x111111125421ca6dc452d289314280a0f8842a65" as const,
    },
    order: {
      maker: "0x2222222222222222222222222222222222222222" as const,
      makerAsset: "0x3333333333333333333333333333333333333333" as const,
      takerAsset: "0x4444444444444444444444444444444444444444" as const,
      makingAmount: "1000000000000000000",
      takingAmount: "2000000000000000000",
      allowPartialFills: templateId === "twap-slice",
      allowMultipleFills: templateId === "twap-slice",
      usePermit2: false,
      unwrapWeth: false,
      nonce: "0",
      series: "0",
    },
  };

  switch (templateId) {
    case "stop-loss":
      return {
        ...base,
        templateId,
        block: {
          type: "stop-loss",
          oracle: "0x5555555555555555555555555555555555555555",
          threshold: "100000000000",
          direction: "below",
          staleAfter: 3600,
          decimals: 8,
        },
      };
    case "gas-guard":
      return {
        ...base,
        templateId,
        block: { type: "gas-guard", maxGwei: 30 },
      };
    case "twap-slice":
      return {
        ...base,
        templateId,
        block: {
          type: "twap-slice",
          totalAmount: "10000000000000000000",
          sliceAmount: "1000000000000000000",
          intervalSeconds: 3600,
          startTime: 0,
        },
      };
    case "dca-schedule":
      return {
        ...base,
        templateId,
        block: {
          type: "dca-schedule",
          tranches: 4,
          amountPerTranche: "1000000000000000000",
          intervalSeconds: 86400,
          seriesId: 1,
        },
      };
  }
}
