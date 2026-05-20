import type { OrderConfig } from "@limit-canvas/hook-dsl";

export function packMakerTraits(
  order: Partial<OrderConfig>,
  hasExtension: boolean,
): string {
  let traits = 0n;

  // High bits (Flags)
  if (order.allowPartialFills === false) {
    traits |= 1n << 255n;
  }
  if (order.allowMultipleFills === true) {
    traits |= 1n << 254n;
  }
  if (hasExtension) {
    traits |= 1n << 249n;
  }
  if (order.usePermit2 === true) {
    traits |= 1n << 248n;
  }
  if (order.unwrapWeth === true) {
    traits |= 1n << 247n;
  }

  // Low bits (Fields)
  if (order.privateTaker) {
    const addrBig = BigInt(order.privateTaker);
    const lower80 = addrBig & 0xffffffffffffffffffffn;
    traits |= lower80;
  }

  if (order.expiration) {
    traits |= (BigInt(order.expiration) & 0xffffffffffn) << 80n;
  }

  if (order.nonce) {
    traits |= (BigInt(order.nonce) & 0xffffffffffn) << 120n;
  }

  if (order.series) {
    traits |= (BigInt(order.series) & 0xffffffffffn) << 160n;
  }

  return traits.toString();
}
