/** Known LOP v4 deployments from the official 1inch repository README. */
export const LOP_REGISTRY: Record<number, `0x${string}`> = {
  1: "0x111111125421ca6dc452d289314280a0f8842a65",
  10: "0x111111125421ca6dc452d289314280a0f8842a65",
  56: "0x111111125421ca6dc452d289314280a0f8842a65",
  100: "0x111111125421ca6dc452d289314280a0f8842a65",
  137: "0x111111125421ca6dc452d289314280a0f8842a65",
  324: "0x6fd4383cb451173d5f9304f041c7bcbf27d561ff",
  8453: "0x111111125421ca6dc452d289314280a0f8842a65",
  42161: "0x111111125421ca6dc452d289314280a0f8842a65",
  43114: "0x111111125421ca6dc452d289314280a0f8842a65",
  11155111: "0x111111125421ca6dc452d289314280a0f8842a65",
};

export function getLopAddress(chainId: number): `0x${string}` | undefined {
  return LOP_REGISTRY[chainId];
}

export function isKnownLopAddress(chainId: number, address: string): boolean {
  return getLopAddress(chainId)?.toLowerCase() === address.toLowerCase();
}
