import {
  type AuditProvenance,
  type StrategyDocument,
  getTemplateCatalogEntry,
  validateExtensionTraits,
} from "@limit-canvas/hook-dsl";
import {
  buildAndPredicate,
  buildGasGuardPredicate,
  buildOrderbookPayloadShape,
  buildSaltWithExtension,
  buildStopLossPredicate,
  computeExtensionHash,
  lookupOracle,
  packExtension,
  packPredicateOnlyExtension,
} from "@limit-canvas/lop-sdk";
import { keccak256, stringToHex } from "viem";
import bytecodeHashesData from "./bytecode-hashes.json" with { type: "json" };
import {
  type GeneratedArtifact,
  generateDcaRegistry,
  generateDeployScript,
  generateGasGuardStrategy,
  generateReadme,
  generateStopLossStrategy,
  generateTestStub,
  generateTwapSliceGetter,
} from "./templates.js";

const BYTECODE_HASHES = bytecodeHashesData as Record<
  string,
  { compiler: string; bytecodeHash: string }
>;

export interface CodegenResult {
  doc: StrategyDocument;
  extensionHash: string;
  bytecodeHash: string | null;
  predicateTree: CompiledPredicateTree;
  artifacts: GeneratedArtifact[];
}

interface CompiledPredicateTree {
  mode: "single" | "and" | "or" | "not";
  nodes: Array<{
    id: string;
    templateId: string;
    predicateCalldata: string;
  }>;
  root: `0x${string}`;
}

interface ArtifactManifest {
  manifestVersion: "1.0.0";
  generatedBy: "limit-canvas";
  dslHash: string;
  template: {
    id: string;
    version: string;
    maturity: string;
  };
  compiler: {
    solidity: string;
  };
  lop: {
    version: string;
    chainId: number;
    address: string;
  };
  generatedFiles: string[];
  graph: StrategyDocument["graph"] | null;
  compiledPredicateTree: CompiledPredicateTree;
  extensionHash: string;
  bytecodeHash: string | null;
  audit: AuditProvenance | null;
  warnings: string[];
  testCommandResults: {
    tests: string;
    fuzz: string;
    gas: string;
  };
}

const STRATEGY_PLACEHOLDER =
  "0x0000000000000000000000000000000000000001" as const;

export function generateArtifacts(doc: StrategyDocument): CodegenResult {
  const enriched = { ...doc };
  let strategySol: string;
  let contractName: string;
  let predicateCalldata = (doc.predicateCalldata ?? "0x") as `0x${string}`;
  let predicateTree: CompiledPredicateTree = {
    mode: "single",
    nodes: [],
    root: "0x",
  };

  switch (doc.templateId) {
    case "stop-loss": {
      contractName = "StopLossStrategy";
      strategySol = generateStopLossStrategy(doc);
      predicateCalldata = buildStopLossPredicate(
        STRATEGY_PLACEHOLDER,
        doc.block as never,
      ) as `0x${string}`;
      predicateTree = compilePredicateTree(doc, predicateCalldata);
      break;
    }
    case "gas-guard": {
      contractName = "GasGuardStrategy";
      strategySol = generateGasGuardStrategy(doc);
      predicateCalldata = buildGasGuardPredicate(
        STRATEGY_PLACEHOLDER,
        (doc.block as { maxGwei: number }).maxGwei,
      ) as `0x${string}`;
      predicateTree = compilePredicateTree(doc, predicateCalldata);
      break;
    }
    case "twap-slice": {
      contractName = "TwapSliceGetter";
      strategySol = generateTwapSliceGetter(doc);
      break;
    }
    case "dca-schedule": {
      contractName = "DcaSeriesRegistry";
      strategySol = generateDcaRegistry(doc);
      break;
    }
    default:
      throw new Error(`Unknown template: ${doc.templateId}`);
  }

  enriched.predicateCalldata = predicateCalldata;
  if (predicateTree.root !== "0x") {
    predicateCalldata = predicateTree.root;
    enriched.predicateCalldata = predicateCalldata;
  }
  let extension: `0x${string}`;
  if (doc.templateId === "twap-slice") {
    extension = packExtension({
      makingAmountData: STRATEGY_PLACEHOLDER,
      takingAmountData: STRATEGY_PLACEHOLDER,
      predicate: predicateCalldata === "0x" ? undefined : predicateCalldata,
    });
  } else {
    extension = packPredicateOnlyExtension(predicateCalldata as `0x${string}`);
  }
  const extensionHash = computeExtensionHash(extension);
  const salt = buildSaltWithExtension(1n, extension);
  const catalogEntry = getTemplateCatalogEntry(doc.templateId);
  const warnings = validateExtensionTraits(enriched);
  if (doc.block.type === "stop-loss") {
    const known = lookupOracle(doc.network.chainId, doc.block.oracle);
    if (!known) {
      warnings.push(
        `Oracle ${doc.block.oracle} is not in the curated Chainlink allowlist for chain ${doc.network.chainId} — verify the aggregator manually before mainnet.`,
      );
    } else {
      if (known.decimals !== doc.block.decimals) {
        warnings.push(
          `Configured decimals (${doc.block.decimals}) do not match ${known.name} feed decimals (${known.decimals}).`,
        );
      }
      if (doc.block.staleAfter < known.heartbeatSeconds) {
        warnings.push(
          `staleAfter (${doc.block.staleAfter}s) is shorter than ${known.name} heartbeat (${known.heartbeatSeconds}s); fills will frequently revert as stale.`,
        );
      }
    }
  }

  const id = doc.templateId;
  const artifacts: GeneratedArtifact[] = [
    { relativePath: `src/generated/${id}/Strategy.sol`, content: strategySol },
    {
      relativePath: `src/generated/${id}/Strategy.t.sol`,
      content: generateTestStub(`${contractName}Generated`),
    },
    {
      relativePath: `script/generated/Deploy${contractName}.s.sol`,
      content: generateDeployScript(contractName, id),
    },
    {
      relativePath: "extensions.json",
      content: JSON.stringify(
        {
          templateId: doc.templateId,
          extension,
          extensionHash,
          predicateCalldata,
          predicateTree,
          salt: salt.toString(),
          network: doc.network,
          orderbookPayloadShape: buildOrderbookPayloadShape(
            enriched,
            extension,
            salt,
          ),
        },
        null,
        2,
      ),
    },
    {
      relativePath: "README.generated.md",
      content: generateReadme(doc, extensionHash),
    },
  ];

  if (doc.templateId === "dca-schedule" && doc.block.type === "dca-schedule") {
    const orders = [];
    for (let i = 0; i < doc.block.tranches; i++) {
      orders.push({
        tranche: i,
        makingAmount: doc.block.amountPerTranche,
        seriesId: doc.block.seriesId,
        fillAfter: i * doc.block.intervalSeconds,
      });
    }
    artifacts.push({
      relativePath: "dca-orders.json",
      content: JSON.stringify({ orders }, null, 2),
    });
  }

  const manifest: ArtifactManifest = {
    manifestVersion: "1.0.0",
    generatedBy: "limit-canvas",
    dslHash: keccak256(stringToHex(stableStringify(enriched))),
    template: {
      id,
      version: catalogEntry?.version ?? "0.0.0",
      maturity: catalogEntry?.maturity ?? "draft",
    },
    compiler: {
      solidity: "0.8.23",
    },
    lop: {
      version: "4.3.2",
      chainId: doc.network.chainId,
      address: doc.network.lopAddress,
    },
    generatedFiles: [
      ...artifacts.map((artifact) => artifact.relativePath),
      "manifest.json",
    ],
    graph: doc.graph ?? null,
    compiledPredicateTree: predicateTree,
    extensionHash,
    bytecodeHash: BYTECODE_HASHES[doc.templateId]?.bytecodeHash ?? null,
    audit: doc.audit ?? null,
    warnings,
    testCommandResults: {
      tests: "not-run",
      fuzz: "not-run",
      gas: "not-run",
    },
  };

  artifacts.push({
    relativePath: "manifest.json",
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  });

  return {
    doc: enriched,
    extensionHash,
    bytecodeHash: manifest.bytecodeHash,
    predicateTree,
    artifacts,
  };
}

function compilePredicateTree(
  doc: StrategyDocument,
  basePredicate: `0x${string}`,
): CompiledPredicateTree {
  const graphNodes = doc.graph?.nodes ?? [];
  const gasNode = graphNodes.find(
    (node) => node.templateId === "gas-guard" && node.id !== doc.templateId,
  );
  if (!gasNode || doc.templateId === "gas-guard") {
    return {
      mode: "single",
      nodes: [
        {
          id: doc.templateId,
          templateId: doc.templateId,
          predicateCalldata: basePredicate,
        },
      ],
      root: basePredicate,
    };
  }

  const maxGwei =
    typeof gasNode.params.maxGwei === "number" ? gasNode.params.maxGwei : 25;
  const gasPredicate = buildGasGuardPredicate(STRATEGY_PLACEHOLDER, maxGwei);
  const root = buildAndPredicate([basePredicate, gasPredicate]);
  return {
    mode: "and",
    nodes: [
      {
        id: doc.templateId,
        templateId: doc.templateId,
        predicateCalldata: basePredicate,
      },
      {
        id: gasNode.id,
        templateId: "gas-guard",
        predicateCalldata: gasPredicate,
      },
    ],
    root,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
