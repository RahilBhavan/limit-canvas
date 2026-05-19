/** Chainlink-style feeds commonly use 8 decimals. */
export const ORACLE_DECIMALS = 8;

export type GasPresetId = "strict" | "balanced" | "loose";

export const GAS_PRESETS: Record<
  GasPresetId,
  { maxGwei: number; label: string; hint: string }
> = {
  strict: {
    maxGwei: 20,
    label: "Strict",
    hint: "Favors cheap execution; may miss fills in congestion.",
  },
  balanced: {
    maxGwei: 35,
    label: "Balanced",
    hint: "Normal network conditions.",
  },
  loose: {
    maxGwei: 60,
    label: "Loose",
    hint: "Prioritizes getting filled over gas cost.",
  },
};

/** Convert human USD price (8-decimal oracle) to threshold string. */
export function usdToOracleThreshold(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "0";
  const raw = Math.round(usd * 10 ** ORACLE_DECIMALS);
  return String(raw);
}

/** Convert oracle threshold string to approximate USD for display. */
export function oracleThresholdToUsd(threshold: string): number {
  const raw = Number(threshold);
  if (!Number.isFinite(raw)) return 0;
  return raw / 10 ** ORACLE_DECIMALS;
}

/** Map preset id from max gwei (nearest). */
export function gweiToGasPreset(maxGwei: number): GasPresetId {
  if (maxGwei <= 25) return "strict";
  if (maxGwei <= 45) return "balanced";
  return "loose";
}
