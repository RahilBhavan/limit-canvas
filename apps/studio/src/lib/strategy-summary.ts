import type { StrategyAddonState } from "@/lib/strategy-workstation";
import type { StrategyDocument } from "@limit-canvas/hook-dsl";

/** One-sentence summary for non-protocol users. */
export function plainLanguageSummary(
  doc: StrategyDocument,
  addons: StrategyAddonState,
): string {
  const gasNote = addons.gasGuard.enabled
    ? ` Fills only when network gas is at or below ${addons.gasGuard.maxGwei} gwei.`
    : "";

  switch (doc.block.type) {
    case "stop-loss":
      return `Limit order that can fill when the oracle price goes ${doc.block.direction} ${formatPrice(doc.block.threshold)}.${gasNote}`;
    case "gas-guard":
      return `Limit order that can fill only when base fee is at or below ${doc.block.maxGwei} gwei.`;
    case "twap-slice":
      return `Slices up to ${formatTokenAmount(doc.block.sliceAmount)} every ${formatDuration(doc.block.intervalSeconds)} after the start time.${gasNote}`;
    case "dca-schedule":
      return `DCA series with ${doc.block.tranches} tranches; keeper execution stays off-chain in v1.${gasNote}`;
  }
}

/** Wei → tokens (3 sig figs), with raw fallback for non-numeric input. */
function formatTokenAmount(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  const wei = BigInt(value);
  const ONE = 10n ** 18n;
  if (wei === 0n) return "0 tokens";
  if (wei < ONE / 1000n) return `${wei.toString()} wei`;
  const whole = Number((wei * 1000n) / ONE) / 1000;
  return `${whole.toFixed(whole < 1 ? 3 : 2)} tokens`;
}

/** Chainlink-shaped price (8 decimals) → display number, with raw fallback. */
function formatPrice(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  const raw = BigInt(value);
  if (raw === 0n) return "0";
  const SCALE = 10n ** 8n;
  if (raw < SCALE) return value;
  const whole = Number((raw * 100n) / SCALE) / 100;
  return whole.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return `${seconds}s`;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round((seconds / 3600) * 10) / 10} h`;
  return `${Math.round((seconds / 86400) * 10) / 10} d`;
}
