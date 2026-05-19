import { describe, expect, test } from "bun:test";
import { parseStrategyDocument } from "@limit-canvas/hook-dsl";
import { decodeFunctionData } from "viem";
import {
  buildSaltWithExtension,
  computeExtensionHash,
  packPredicateOnlyExtension,
} from "./extension.js";
import { buildOrderbookPayloadShape } from "./orderbook.js";
import { buildAndPredicate } from "./predicates.js";
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
