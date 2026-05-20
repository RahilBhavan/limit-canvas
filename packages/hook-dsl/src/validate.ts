import type { StrategyDocument } from "./types.js";

/** MakerTraits HAS_EXTENSION flag bit 249 */
export const MAKER_TRAIT_HAS_EXTENSION = 249;

/**
 * Returns human-readable warnings for extension / trait mismatches.
 */
export function validateExtensionTraits(doc: StrategyDocument): string[] {
  const warnings: string[] = [];

  if (doc.templateId === "gas-guard" || doc.templateId === "stop-loss") {
    if (!doc.predicateCalldata) {
      warnings.push(
        "Predicate calldata not set — run codegen or lop-sdk packer.",
      );
    }
  }

  if (doc.templateId === "dca-schedule" && doc.block.type === "dca-schedule") {
    warnings.push(
      `DCA emits ${doc.block.tranches} orders — off-chain keeper required (see README.generated.md).`,
    );
  }

  if (doc.order.unwrapWeth) {
    const isWeth = (addr: string) => {
      const weths = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Ethereum Mainnet
        "0x7b79995e5f793A07Bc00c21412e50ecae098E7f9", // Sepolia
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
        "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        "0x82aF49447D8a07e3bd95BD0d56f352415231aa11", // Arbitrum WETH
        "0x4200000000000000000000000000000000000006", // Optimism/Base WETH
      ].map((a) => a.toLowerCase());
      return weths.includes(addr.toLowerCase());
    };
    if (!isWeth(doc.order.makerAsset) && !isWeth(doc.order.takerAsset)) {
      warnings.push(
        "unwrapWeth is enabled but neither makerAsset nor takerAsset is a recognized WETH address.",
      );
    }
  }

  if (doc.network.chainId === 1 && !doc.audited) {
    warnings.push("mainnet deploy blocked until audited: true in DSL.");
  }

  if (doc.audited && !doc.audit) {
    warnings.push(
      "audited: true is set without an `audit` provenance object (auditor, reportUrl, scope, commitHash, date). The boolean form is deprecated for mainnet.",
    );
  }

  return warnings;
}
