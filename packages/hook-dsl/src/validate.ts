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
