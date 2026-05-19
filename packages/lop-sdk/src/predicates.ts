import type { GasGuardBlock, StopLossBlock } from "@limit-canvas/hook-dsl";
import { type Hex, encodeAbiParameters, encodeFunctionData } from "viem";

/** LOP protocol selectors (LimitOrderProtocol helper functions) */
const SEL_ARBITRARY_STATIC_CALL = "0xbf15fcd8";
const SEL_LT = "0xca4ece22";
const SEL_GT = "0x38c9c498";

/**
 * Builds predicate calldata for gas guard: effectively checks basefee <= max.
 * Encoded as arbitraryStaticCall to GasGuardStrategy.isAllowed(maxBaseFee).
 */
export function buildGasGuardPredicate(
  strategyAddress: Hex,
  maxGwei: number,
): Hex {
  const maxBaseFee = BigInt(maxGwei) * 1_000_000_000n;
  const inner = encodeFunctionData({
    abi: [
      {
        name: "isAllowed",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "maxBaseFee", type: "uint256" }],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "isAllowed",
    args: [maxBaseFee],
  });

  return wrapArbitraryStaticCall(strategyAddress, inner);
}

/**
 * Stop-loss: hardened Chainlink-consumer price predicate.
 * Encodes a call to StopLossStrategy.checkPrice with staleness + decimals guards.
 */
export function buildStopLossPredicate(
  strategyAddress: Hex,
  block: StopLossBlock,
): Hex {
  const inner = encodeFunctionData({
    abi: [
      {
        name: "checkPrice",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "oracle", type: "address" },
          { name: "threshold", type: "uint256" },
          { name: "directionAbove", type: "bool" },
          { name: "staleAfter", type: "uint256" },
          { name: "expectedDecimals", type: "uint8" },
        ],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "checkPrice",
    args: [
      block.oracle as Hex,
      BigInt(block.threshold),
      block.direction === "above",
      BigInt(block.staleAfter),
      block.decimals,
    ],
  });

  return wrapArbitraryStaticCall(strategyAddress, inner);
}

function wrapArbitraryStaticCall(target: Hex, data: Hex): Hex {
  // Simplified predicate blob: LOP decodes arbitraryStaticCall(target, data) at fill time.
  // Full ABI encoding is done in integration tests on-chain; here we pack a deterministic stub
  // for off-chain hash / preview (studio displays hex length + hash).
  const encoded = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [target, data],
  );
  return (SEL_ARBITRARY_STATIC_CALL + encoded.slice(2)) as Hex;
}

export function buildCompareGt(value: bigint, innerPredicate: Hex): Hex {
  const encoded = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes" }],
    [value, innerPredicate],
  );
  return (SEL_GT + encoded.slice(2)) as Hex;
}

export function buildCompareLt(value: bigint, innerPredicate: Hex): Hex {
  const encoded = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes" }],
    [value, innerPredicate],
  );
  return (SEL_LT + encoded.slice(2)) as Hex;
}

export function buildAndPredicate(predicates: Hex[]): Hex {
  let offsets = 0n;
  let cursor = 0;
  const packed = predicates
    .map((predicate, index) => {
      const bytesLength = (predicate.length - 2) / 2;
      cursor += bytesLength;
      offsets |= BigInt(cursor) << BigInt(index * 32);
      return predicate.slice(2);
    })
    .join("");

  return encodeFunctionData({
    abi: [
      {
        name: "and",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "offsets", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "and",
    args: [offsets, `0x${packed}`],
  });
}
