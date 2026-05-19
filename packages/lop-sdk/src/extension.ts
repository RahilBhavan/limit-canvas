import { type Hex, keccak256 } from "viem";

/**
 * LOP extension layout: 32-byte offset header + concatenated segments.
 * Predicate-only: only bytes [16..19] of header hold predicate end offset.
 */
export function packPredicateOnlyExtension(predicateCalldata: Hex): Hex {
  const pred = (
    predicateCalldata.startsWith("0x")
      ? predicateCalldata
      : `0x${predicateCalldata}`
  ) as Hex;
  const predBytes = (pred.length - 2) / 2;
  if (predBytes === 0) return "0x";

  const paddedLen = Math.ceil(predBytes / 32) * 32;
  const endOffset = 32 + paddedLen;

  const header = new Uint8Array(32);
  header[16] = (endOffset >> 24) & 0xff;
  header[17] = (endOffset >> 16) & 0xff;
  header[18] = (endOffset >> 8) & 0xff;
  header[19] = endOffset & 0xff;

  const headerHex = Array.from(header)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `0x${headerHex}${pred.slice(2)}` as Hex;
}

/** Lower 160 bits of keccak256(extension) — encoded in order salt */
export function computeExtensionHash(extension: Hex): Hex {
  const hash = keccak256(extension);
  return `0x${hash.slice(-40)}` as Hex;
}

export function buildSaltWithExtension(
  saltHigh96: bigint,
  extension: Hex,
): bigint {
  const extHash = BigInt(computeExtensionHash(extension));
  return (saltHigh96 << 160n) | extHash;
}
