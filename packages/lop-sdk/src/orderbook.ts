import type { StrategyDocument } from "@limit-canvas/hook-dsl";
import type { Hex } from "viem";

export interface OrderbookPayloadShape {
  orderHash: Hex;
  signature: Hex;
  data: {
    makerAsset: Hex;
    takerAsset: Hex;
    maker: Hex;
    receiver: Hex;
    makingAmount: string;
    takingAmount: string;
    salt: string;
    extension: Hex;
    makerTraits: string;
  };
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function buildOrderbookPayloadShape(
  doc: StrategyDocument,
  extension: Hex,
  salt: bigint,
): OrderbookPayloadShape {
  return {
    orderHash: "0x",
    signature: "0x",
    data: {
      makerAsset: doc.order.makerAsset as Hex,
      takerAsset: doc.order.takerAsset as Hex,
      maker: doc.order.maker as Hex,
      receiver: (doc.order.receiver ?? ZERO_ADDRESS) as Hex,
      makingAmount: doc.order.makingAmount,
      takingAmount: doc.order.takingAmount,
      salt: salt.toString(),
      extension,
      makerTraits: "0",
    },
  };
}
