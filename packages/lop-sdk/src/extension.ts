import { type Hex, keccak256 } from "viem";

export interface ExtensionFields {
  makerAssetSuffix?: Hex;
  takerAssetSuffix?: Hex;
  makingAmountData?: Hex;
  takingAmountData?: Hex;
  predicate?: Hex;
  makerPermit?: Hex;
  preInteractionData?: Hex;
  postInteractionData?: Hex;
}

export function packExtension(fields: ExtensionFields): Hex {
  const fieldList = [
    fields.makerAssetSuffix,
    fields.takerAssetSuffix,
    fields.makingAmountData,
    fields.takingAmountData,
    fields.predicate,
    fields.makerPermit,
    fields.preInteractionData,
    fields.postInteractionData,
  ];

  let concatHex = "";
  const offsets: number[] = [];
  let currentOffset = 0;

  for (let i = 0; i < 8; i++) {
    const rawVal = fieldList[i];
    let val = "";
    if (rawVal) {
      val = rawVal.startsWith("0x") ? rawVal.slice(2) : rawVal;
    }
    if (val.length > 0) {
      concatHex += val;
      currentOffset += val.length / 2;
    }
    offsets.push(currentOffset);
  }

  if (currentOffset === 0) {
    return "0x";
  }

  const header = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const offsetVal = offsets[i] ?? 0;
    const byteIndex = (7 - i) * 4;
    header[byteIndex] = (offsetVal >> 24) & 0xff;
    header[byteIndex + 1] = (offsetVal >> 16) & 0xff;
    header[byteIndex + 2] = (offsetVal >> 8) & 0xff;
    header[byteIndex + 3] = offsetVal & 0xff;
  }

  const headerHex = Array.from(header)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `0x${headerHex}${concatHex}` as Hex;
}

export function packPredicateOnlyExtension(predicateCalldata: Hex): Hex {
  return packExtension({ predicate: predicateCalldata });
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
