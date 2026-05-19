import { describe, expect, test } from "bun:test";
import { parseStrategyDocument } from "@limit-canvas/hook-dsl";
import { generateArtifacts } from "./generate.js";

const gasGuard = parseStrategyDocument({
  version: "1.0.0",
  templateId: "gas-guard",
  name: "Gas proof",
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

const gasSafeStopLoss = parseStrategyDocument({
  version: "1.0.0",
  templateId: "stop-loss",
  name: "Gas-safe stop loss",
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
    allowPartialFills: true,
  },
  block: {
    type: "stop-loss",
    oracle: "0x5555555555555555555555555555555555555555",
    threshold: "75000000000",
    direction: "below",
    staleAfter: 3600,
    decimals: 8,
  },
  graph: {
    version: "1.0.0",
    nodes: [
      {
        id: "order",
        kind: "order",
        label: "Maker intent",
        params: {},
      },
      {
        id: "stop-loss",
        kind: "predicate",
        templateId: "stop-loss",
        label: "stop-loss",
        params: {
          oracle: "0x5555555555555555555555555555555555555555",
          threshold: "75000000000",
          direction: "below",
        },
      },
      {
        id: "gas-guard-addon",
        kind: "predicate",
        templateId: "gas-guard",
        label: "gas-guard",
        params: { maxGwei: 25 },
      },
      {
        id: "extension",
        kind: "extension",
        label: "Packed LOP extension",
        params: {},
      },
    ],
    edges: [
      {
        id: "order-condition",
        source: "order",
        target: "stop-loss",
        label: "configure",
      },
      {
        id: "condition-gas",
        source: "stop-loss",
        target: "gas-guard-addon",
        label: "and",
      },
      {
        id: "gas-extension",
        source: "gas-guard-addon",
        target: "extension",
        label: "pack",
      },
    ],
    compiledPredicate: {
      mode: "and",
      rootNodeIds: ["stop-loss", "gas-guard-addon"],
    },
  },
});

describe("generateArtifacts", () => {
  test("emits reproducible manifest fields", () => {
    const result = generateArtifacts(gasGuard);
    const manifestArtifact = result.artifacts.find(
      (artifact) => artifact.relativePath === "manifest.json",
    );
    expect(manifestArtifact).toBeDefined();
    const manifest = JSON.parse(manifestArtifact?.content ?? "{}") as {
      dslHash: string;
      template: { id: string; version: string; maturity: string };
      extensionHash: string;
      generatedFiles: string[];
      lop: { version: string; chainId: number };
    };
    expect(manifest.dslHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(manifest.template).toEqual({
      id: "gas-guard",
      version: "1.0.0",
      maturity: "audit-ready",
    });
    expect(manifest.extensionHash).toBe(result.extensionHash);
    expect(manifest.generatedFiles).toContain("manifest.json");
    expect(manifest.lop).toEqual({
      version: "4.3.2",
      chainId: 1,
      address: "0x111111125421ca6dc452d289314280a0f8842a65",
    });
  });

  test("emits orderbook payload shape with extension", () => {
    const result = generateArtifacts(gasGuard);
    const extensions = result.artifacts.find(
      (artifact) => artifact.relativePath === "extensions.json",
    );
    const parsed = JSON.parse(extensions?.content ?? "{}") as {
      extension: string;
      orderbookPayloadShape: { data: { extension: string; salt: string } };
    };
    expect(parsed.orderbookPayloadShape.data.extension).toBe(parsed.extension);
    expect(BigInt(parsed.orderbookPayloadShape.data.salt)).toBeGreaterThan(0n);
  });

  test("compiles graph-composed stop-loss and gas guard predicates", () => {
    const result = generateArtifacts(gasSafeStopLoss);
    expect(result.predicateTree.mode).toBe("and");
    expect(result.predicateTree.nodes).toHaveLength(2);
    expect(result.predicateTree.nodes.map((node) => node.templateId)).toEqual([
      "stop-loss",
      "gas-guard",
    ]);

    const manifestArtifact = result.artifacts.find(
      (artifact) => artifact.relativePath === "manifest.json",
    );
    const manifest = JSON.parse(manifestArtifact?.content ?? "{}") as {
      graph: { nodes: Array<{ id: string }> };
      compiledPredicateTree: { mode: string; root: string };
    };
    expect(manifest.graph.nodes.map((node) => node.id)).toContain(
      "gas-guard-addon",
    );
    expect(manifest.compiledPredicateTree.mode).toBe("and");
    expect(manifest.compiledPredicateTree.root).toMatch(/^0x[a-fA-F0-9]+$/);

    const extensions = result.artifacts.find(
      (artifact) => artifact.relativePath === "extensions.json",
    );
    const parsed = JSON.parse(extensions?.content ?? "{}") as {
      predicateTree: { mode: string };
    };
    expect(parsed.predicateTree.mode).toBe("and");
  });
});
