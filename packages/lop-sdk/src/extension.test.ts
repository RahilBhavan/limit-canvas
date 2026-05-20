import { describe, expect, test } from "bun:test";
import { parseStrategyDocument } from "@limit-canvas/hook-dsl";
import { decodeFunctionData } from "viem";
import {
  buildSaltWithExtension,
  computeExtensionHash,
  packExtension,
  packPredicateOnlyExtension,
} from "./extension.js";
import { packMakerTraits } from "./maker-traits.js";
import { buildOrderbookPayloadShape } from "./orderbook.js";
import {
  buildAndPredicate,
  buildNotPredicate,
  buildOrPredicate,
} from "./predicates.js";
import { isKnownLopAddress } from "./registry.js";

describe("extension hash", () => {
  test("stable hash for same predicate", () => {
    const ext = packPredicateOnlyExtension("0x01020304");
    const h1 = computeExtensionHash(ext);
    const h2 = computeExtensionHash(ext);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(42);
  });

  test("salt low 160 bits matches extension hash", () => {
    const ext = packPredicateOnlyExtension("0x01020304");
    const hash = BigInt(computeExtensionHash(ext));
    const salt = buildSaltWithExtension(77n, ext);
    const mask = (1n << 160n) - 1n;
    expect(salt & mask).toBe(hash);
  });

  test("empty predicate has stable empty extension", () => {
    expect(packPredicateOnlyExtension("0x")).toBe("0x");
  });

  test("builds LOP PredicateHelper.and calldata with offsets", () => {
    const predicate = buildAndPredicate(["0x01020304", "0xaabb"]);
    expect(predicate.startsWith("0xbfa75143")).toBe(true);

    const decoded = decodeFunctionData({
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
      data: predicate,
    });
    expect(decoded.args[0]).toBe(0x0000000600000004n);
    expect(decoded.args[1]).toBe("0x01020304aabb");
  });

  test("builds LOP PredicateHelper.or calldata with offsets", () => {
    const predicate = buildOrPredicate(["0x01020304", "0xaabb"]);
    expect(predicate.startsWith("0x74261145")).toBe(true);

    const decoded = decodeFunctionData({
      abi: [
        {
          name: "or",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "offsets", type: "uint256" },
            { name: "data", type: "bytes" },
          ],
          outputs: [{ type: "bool" }],
        },
      ],
      data: predicate,
    });
    expect(decoded.args[0]).toBe(0x0000000600000004n);
    expect(decoded.args[1]).toBe("0x01020304aabb");
  });

  test("builds LOP PredicateHelper.not calldata", () => {
    const inner = "0x01020304" as `0x${string}`;
    const predicate = buildNotPredicate(inner);
    expect(predicate.startsWith("0xbf797959")).toBe(true);

    const decoded = decodeFunctionData({
      abi: [
        {
          name: "not",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "data", type: "bytes" }],
          outputs: [{ type: "bool" }],
        },
      ],
      data: predicate,
    });
    expect(decoded.args[0]).toBe(inner);
  });
});

describe("registry and orderbook shape", () => {
  test("recognizes official mainnet LOP address", () => {
    expect(
      isKnownLopAddress(1, "0x111111125421ca6dc452d289314280a0f8842a65"),
    ).toBe(true);
  });

  test("builds orderbook payload shape without submitting", () => {
    const doc = parseStrategyDocument({
      version: "1.0.0",
      templateId: "gas-guard",
      name: "payload",
      audited: false,
      network: {
        chainId: 1,
        lopAddress: "0x111111125421ca6dc452d289314280a0f8842a65",
      },
      order: {
        maker: "0x2222222222222222222222222222222222222222",
        makerAsset: "0x3333333333333333333333333333333333333333",
        takerAsset: "0x4444444444444444444444444444444444444444",
        makingAmount: "1000000",
        takingAmount: "2000000",
        allowPartialFills: false,
      },
      block: { type: "gas-guard", maxGwei: 30 },
    });
    const payload = buildOrderbookPayloadShape(doc, "0x1234", 123n);
    expect(payload.data.maker).toBe(doc.order.maker);
    expect(payload.data.extension).toBe("0x1234");
    expect(payload.signature).toBe("0x");
  });
});

describe("packExtension and maker traits", () => {
  test("packExtension sets offsets correctly for multiple fields", () => {
    const ext = packExtension({
      makingAmountData: "0x1111",
      takingAmountData: "0x2222",
      predicate: "0x33333333",
    });

    // 0x1111 (2 bytes), 0x2222 (2 bytes), 0x33333333 (4 bytes)
    // Accumulated offsets:
    // field 0 (makerAssetSuffix): 0
    // field 1 (takerAssetSuffix): 0
    // field 2 (makingAmountData): 2
    // field 3 (takingAmountData): 4
    // field 4 (predicate): 8
    // fields 5,6,7 (remaining): 8
    // So the offsets array is: [0, 0, 2, 4, 8, 8, 8, 8]
    // Packed in big-endian:
    // offsets[7] = 8 -> bytes 0..3 (00000008)
    // offsets[6] = 8 -> bytes 4..7 (00000008)
    // offsets[5] = 8 -> bytes 8..11 (00000008)
    // offsets[4] = 8 -> bytes 12..15 (00000008)
    // offsets[3] = 4 -> bytes 16..19 (00000004)
    // offsets[2] = 2 -> bytes 20..23 (00000002)
    // offsets[1] = 0 -> bytes 24..27 (00000000)
    // offsets[0] = 0 -> bytes 28..31 (00000000)
    // Combined header hex:
    // 00000008 00000008 00000008 00000008 00000004 00000002 00000000 00000000
    // Followed by concat: 1111222233333333
    expect(ext).toBe(
      "0x00000008000000080000000800000008000000040000000200000000000000001111222233333333",
    );
  });

  test("packMakerTraits packs traits accurately according to LOP spec", () => {
    // 1. Default order: partial fill allow, no extension, no other flags set
    const t1 = packMakerTraits({ allowPartialFills: true }, false);
    expect(t1).toBe("0");

    // 2. No partial fill (sets bit 255): 1 << 255 = 57896044618658097711785492504343953926634992332820282019728792003956564819968
    const t2 = packMakerTraits({ allowPartialFills: false }, false);
    expect(t2).toBe(
      "57896044618658097711785492504343953926634992332820282019728792003956564819968",
    );

    // 3. Extension (sets bit 249): 1 << 249
    const t3 = packMakerTraits({}, true);
    expect(t3).toBe(
      "904625697166532776746648320380374280103671755200316906558262375061821325312",
    );

    // 4. Series + Nonce + Expiration + Private Taker
    // Expiration = 12345 (0x3039)
    // Nonce = 10 (0xa)
    // Series = 5 (0x5)
    // Private Taker = 0x00000000000000000000000000000000000000FF (low 80 bits = 255)
    const traits = packMakerTraits(
      {
        expiration: 12345,
        nonce: "10",
        series: "5",
        privateTaker: "0x00000000000000000000000000000000000000FF",
      },
      false,
    );
    const traitsBig = BigInt(traits);
    expect(traitsBig & 0xffffffffffffffffffffn).toBe(255n); // private taker lower 80 bits
    expect((traitsBig >> 80n) & 0xffffffffffn).toBe(12345n); // expiration
    expect((traitsBig >> 120n) & 0xffffffffffn).toBe(10n); // nonce
    expect((traitsBig >> 160n) & 0xffffffffffn).toBe(5n); // series
  });
});
