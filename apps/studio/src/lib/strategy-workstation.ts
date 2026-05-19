import {
  MAKER_TRAIT_HAS_EXTENSION,
  type StrategyDocument,
  type StrategyGraph,
  type TemplateId,
  type TemplateMaturity,
  getTemplateCatalogEntry,
  parseStrategyDocument,
} from "@limit-canvas/hook-dsl";
import {
  buildSaltWithExtension,
  isKnownLopAddress,
} from "@limit-canvas/lop-sdk";

export interface ProofStatus {
  tests: "idle" | "running" | "pass" | "fail";
  fuzz: "idle" | "running" | "pass" | "fail";
  gas: "idle" | "running" | "pass" | "fail";
  output?: string;
  evidence?: ProofEvidence;
}

export interface ProofEvidence {
  testsPassed: number;
  testsFailed: number;
  fuzzRuns: number;
  gasLines: string[];
}

export interface SimulationInput {
  oraclePrice: string;
  baseFeeGwei: string;
  timestamp: string;
  requestedMaking: string;
  trancheIndex: string;
}

/** Compiled predicate metadata shown in simulation when codegen is available. */
export interface PredicatePreview {
  mode: "single" | "and";
  root: string;
  extensionHash: string;
  nodeCount: number;
}

export interface StrategyAddonState {
  gasGuard: {
    enabled: boolean;
    maxGwei: number;
  };
}

export function buildStrategyGraph(
  doc: StrategyDocument,
  addons: StrategyAddonState,
): StrategyGraph {
  const nodes: StrategyGraph["nodes"] = [
    {
      id: "order",
      kind: "order",
      label: "Maker intent",
      params: {
        makerAsset: doc.order.makerAsset,
        takerAsset: doc.order.takerAsset,
      },
    },
    {
      id: doc.templateId,
      kind:
        doc.templateId === "twap-slice"
          ? "getter"
          : doc.templateId === "dca-schedule"
            ? "getter"
            : "predicate",
      templateId: doc.templateId,
      label: doc.templateId,
      params: doc.block,
    },
  ];

  if (addons.gasGuard.enabled && doc.templateId !== "gas-guard") {
    nodes.push({
      id: "gas-guard-addon",
      kind: "predicate",
      templateId: "gas-guard",
      label: "gas-guard",
      params: { maxGwei: addons.gasGuard.maxGwei },
    });
  }

  nodes.push(
    {
      id: "extension",
      kind: "extension",
      label: "Packed LOP extension",
      params: {},
    },
    {
      id: "proof",
      kind: "proof",
      label: "Proof gate",
      params: {},
    },
  );

  const hasGasAddon = addons.gasGuard.enabled && doc.templateId !== "gas-guard";
  return {
    version: "1.0.0",
    nodes,
    edges: [
      {
        id: "order-condition",
        source: "order",
        target: doc.templateId,
        label: "configure",
      },
      ...(hasGasAddon
        ? [
            {
              id: "condition-gas",
              source: doc.templateId,
              target: "gas-guard-addon",
              label: "and",
            },
            {
              id: "gas-extension",
              source: "gas-guard-addon",
              target: "extension",
              label: "pack",
            },
          ]
        : [
            {
              id: "condition-extension",
              source: doc.templateId,
              target: "extension",
              label: "pack",
            },
          ]),
      {
        id: "extension-proof",
        source: "extension",
        target: "proof",
        label: "verify",
      },
    ],
    compiledPredicate: {
      mode: hasGasAddon ? "and" : "single",
      rootNodeIds: hasGasAddon
        ? [doc.templateId, "gas-guard-addon"]
        : [doc.templateId],
    },
  };
}

export function attachGraph(
  doc: StrategyDocument,
  addons: StrategyAddonState,
): StrategyDocument {
  return { ...doc, graph: buildStrategyGraph(doc, addons) };
}

export interface SimulationResult {
  ok: boolean;
  title: string;
  reason: string;
  detail: string;
}

export interface SimulationTimelineStep {
  label: string;
  state: "pass" | "fail" | "pending";
  detail: string;
}

export type ReadinessGateId =
  | "template-maturity"
  | "lop-address"
  | "tests"
  | "fuzz"
  | "gas"
  | "warnings"
  | "extension-hash"
  | "bytecode-hash"
  | "explicit-confirm";

export type ReadinessFixTarget =
  | "template"
  | "order"
  | "simulate"
  | "generate"
  | "prove"
  | "review";

export interface ReadinessItem {
  id: ReadinessGateId;
  label: string;
  ok: boolean;
  detail: string;
  fixLabel: string;
  fixTarget: ReadinessFixTarget;
}

export interface StrategyReview {
  fillsWhen: string[];
  failsWhen: string[];
  assumptions: string[];
  risks: string[];
  mainnetBlockers: string[];
}

export function safeParseJson(json: string): StrategyDocument | null {
  try {
    return parseStrategyDocument(JSON.parse(json));
  } catch {
    return null;
  }
}

export function updateTemplateDocument(
  doc: StrategyDocument,
  templateId: TemplateId,
  fallback: StrategyDocument,
): StrategyDocument {
  if (doc.templateId === templateId) return doc;
  return fallback;
}

export function computeSimulation(
  doc: StrategyDocument,
  input: SimulationInput,
  addons: StrategyAddonState = { gasGuard: { enabled: false, maxGwei: 30 } },
): SimulationResult {
  const baseFee = Number(input.baseFeeGwei || 0);
  if (addons.gasGuard.enabled && baseFee > addons.gasGuard.maxGwei) {
    return {
      ok: false,
      title: "Would not fill",
      reason: `Gas guard blocks fill: ${baseFee} gwei exceeds ${addons.gasGuard.maxGwei} gwei.`,
      detail:
        "The composed strategy evaluates the gas predicate before the template-specific condition.",
    };
  }
  switch (doc.block.type) {
    case "gas-guard": {
      const ok = baseFee <= doc.block.maxGwei;
      return {
        ok,
        title: ok ? "Would fill" : "Would not fill",
        reason: ok
          ? `Base fee ${baseFee} gwei is within the ${doc.block.maxGwei} gwei cap.`
          : `Base fee ${baseFee} gwei exceeds the ${doc.block.maxGwei} gwei cap.`,
        detail: "Predicate checks block.basefee before the order can execute.",
      };
    }
    case "stop-loss": {
      const price = safeBigInt(input.oraclePrice);
      const threshold = safeBigInt(doc.block.threshold);
      const ok =
        doc.block.direction === "above" ? price > threshold : price < threshold;
      return {
        ok,
        title: ok ? "Would fill" : "Would not fill",
        reason: ok
          ? `Oracle price ${price} is ${doc.block.direction} threshold ${threshold}.`
          : `Oracle price ${price} has not crossed ${doc.block.direction} threshold ${threshold}.`,
        detail:
          "Predicate reads the configured oracle through the generated strategy helper.",
      };
    }
    case "twap-slice": {
      const now = safeBigInt(input.timestamp);
      const start = safeBigInt(doc.block.startTime);
      const requested = safeBigInt(input.requestedMaking);
      const sliceAmount = safeBigInt(doc.block.sliceAmount);
      const total = safeBigInt(doc.block.totalAmount);
      const interval = safeBigInt(doc.block.intervalSeconds || 1);
      if (now < start) {
        return {
          ok: false,
          title: "Would not fill",
          reason: "TWAP start time has not arrived.",
          detail: "The getter returns zero before the configured start time.",
        };
      }
      const slices = (now - start) / interval + 1n;
      const cap = slices * sliceAmount > total ? total : slices * sliceAmount;
      const ok = requested > 0n && requested <= cap;
      return {
        ok,
        title: ok ? "Would fill" : "Would cap or reject",
        reason: `Elapsed schedule permits ${cap}; requested making amount is ${requested}.`,
        detail:
          "The amount getter caps per-fill making amount based on elapsed intervals.",
      };
    }
    case "dca-schedule": {
      const tranche = Number(input.trancheIndex || 0);
      const ok = tranche >= 0 && tranche < doc.block.tranches;
      return {
        ok,
        title: ok ? "Tranche is valid" : "Tranche is out of range",
        reason: ok
          ? `Tranche ${tranche} maps to fillAfter ${tranche * doc.block.intervalSeconds}s.`
          : `Tranche ${tranche} is outside 0-${doc.block.tranches - 1}.`,
        detail:
          "DCA v1 emits order-series metadata; keeper execution remains off-chain.",
      };
    }
  }
}

export function simulationTimeline(
  doc: StrategyDocument,
  input: SimulationInput,
  addons: StrategyAddonState,
  predicatePreview?: PredicatePreview | null,
): SimulationTimelineStep[] {
  const template = templateSimulationStep(doc, input);
  const gas = gasSimulationStep(doc, input, addons);
  const extensionDetail = predicatePreview
    ? `${predicatePreview.mode} predicate · ${shortHex(predicatePreview.root)} · hash ${shortHex(predicatePreview.extensionHash)}`
    : template.state === "pass" && (!gas || gas.state === "pass")
      ? "predicate calldata can be packed"
      : "blocked before extension fill";
  return [
    {
      label: "Maker intent",
      state: "pass",
      detail: `${doc.order.makingAmount} for ${doc.order.takingAmount}`,
    },
    template,
    ...(gas ? [gas] : []),
    {
      label: "LOP extension",
      state:
        template.state === "pass" && (!gas || gas.state === "pass")
          ? "pass"
          : "fail",
      detail: extensionDetail,
    },
    {
      label: "Proof gate",
      state: "pending",
      detail: "run tests, fuzz, and gas benchmark",
    },
  ];
}

function templateSimulationStep(
  doc: StrategyDocument,
  input: SimulationInput,
): SimulationTimelineStep {
  switch (doc.block.type) {
    case "gas-guard": {
      const baseFee = Number(input.baseFeeGwei || 0);
      return {
        label: "Gas predicate",
        state: baseFee <= doc.block.maxGwei ? "pass" : "fail",
        detail: `${baseFee} gwei <= ${doc.block.maxGwei} gwei`,
      };
    }
    case "stop-loss": {
      const price = safeBigInt(input.oraclePrice);
      const threshold = safeBigInt(doc.block.threshold);
      const ok =
        doc.block.direction === "above" ? price > threshold : price < threshold;
      return {
        label: "Price predicate",
        state: ok ? "pass" : "fail",
        detail: `${price} ${doc.block.direction} ${threshold}`,
      };
    }
    case "twap-slice": {
      const now = safeBigInt(input.timestamp);
      const start = safeBigInt(doc.block.startTime);
      const requested = safeBigInt(input.requestedMaking);
      const sliceAmount = safeBigInt(doc.block.sliceAmount);
      const total = safeBigInt(doc.block.totalAmount);
      const interval = safeBigInt(doc.block.intervalSeconds || 1);
      const cap =
        now < start
          ? 0n
          : ((now - start) / interval + 1n) * sliceAmount > total
            ? total
            : ((now - start) / interval + 1n) * sliceAmount;
      return {
        label: "Amount getter",
        state: requested > 0n && requested <= cap ? "pass" : "fail",
        detail: `request ${requested}; cap ${cap}`,
      };
    }
    case "dca-schedule": {
      const tranche = Number(input.trancheIndex || 0);
      return {
        label: "Tranche schedule",
        state: tranche >= 0 && tranche < doc.block.tranches ? "pass" : "fail",
        detail: `tranche ${tranche} of ${doc.block.tranches}`,
      };
    }
  }
}

function gasSimulationStep(
  doc: StrategyDocument,
  input: SimulationInput,
  addons: StrategyAddonState,
): SimulationTimelineStep | null {
  if (!addons.gasGuard.enabled || doc.templateId === "gas-guard") return null;
  const baseFee = Number(input.baseFeeGwei || 0);
  return {
    label: "Gas guard",
    state: baseFee <= addons.gasGuard.maxGwei ? "pass" : "fail",
    detail: `${baseFee} gwei <= ${addons.gasGuard.maxGwei} gwei`,
  };
}

function safeBigInt(value: string | number): bigint {
  const text = String(value || "0");
  return /^\d+$/.test(text) ? BigInt(text) : 0n;
}

const MAINNET_READY_MATURITIES: TemplateMaturity[] = [
  "audit-ready",
  "mainnet-enabled",
];

export function readinessItems(
  doc: StrategyDocument,
  warnings: string[],
  proof: ProofStatus,
  reviewed: {
    extensionHash: boolean;
    bytecodeHash: boolean;
    explicitConfirm: boolean;
  },
  bytecodeHash: string | null = null,
): ReadinessItem[] {
  const maturity = getTemplateMaturity(doc.templateId);
  const maturityOk = MAINNET_READY_MATURITIES.includes(maturity);
  return [
    {
      id: "template-maturity",
      label: "Template maturity",
      ok: maturityOk,
      detail: maturityOk
        ? `${maturity} — eligible after audit sign-off`
        : `${maturity} — preview only`,
      fixLabel: "Pick a stop-loss or gas-guard template",
      fixTarget: "template",
    },
    {
      id: "lop-address",
      label: "LOP address",
      ok: isKnownLopAddress(doc.network.chainId, doc.network.lopAddress),
      detail: `${doc.network.chainId} / ${shortAddress(doc.network.lopAddress)}`,
      fixLabel: "Fix network / LOP address",
      fixTarget: "order",
    },
    {
      id: "tests",
      label: "Tests",
      ok: proof.tests === "pass",
      detail: proof.tests,
      fixLabel: "Run local tests",
      fixTarget: "prove",
    },
    {
      id: "fuzz",
      label: "Fuzz",
      ok: proof.fuzz === "pass",
      detail: proof.fuzz,
      fixLabel: "Run fuzz suite",
      fixTarget: "prove",
    },
    {
      id: "gas",
      label: "Gas benchmark",
      ok: proof.gas === "pass",
      detail: proof.gas,
      fixLabel: "Run gas benchmark",
      fixTarget: "prove",
    },
    {
      id: "warnings",
      label: "Warnings",
      ok: warnings.length === 0,
      detail: warnings.length === 0 ? "clear" : `${warnings.length} unresolved`,
      fixLabel: "Review extension warnings",
      fixTarget: "generate",
    },
    {
      id: "extension-hash",
      label: "Extension hash reviewed",
      ok: reviewed.extensionHash,
      detail: reviewed.extensionHash ? "confirmed" : "required",
      fixLabel: "Confirm extension hash",
      fixTarget: "review",
    },
    {
      id: "bytecode-hash",
      label: "Bytecode hash reviewed",
      ok: bytecodeHash != null && reviewed.bytecodeHash,
      detail: bytecodeHash
        ? reviewed.bytecodeHash
          ? `confirmed · ${shortHex(bytecodeHash)}`
          : `review ${shortHex(bytecodeHash)}`
        : "generate artifacts to surface the hash",
      fixLabel: bytecodeHash
        ? "Confirm bytecode hash"
        : "Generate artifacts first",
      fixTarget: bytecodeHash ? "review" : "generate",
    },
    {
      id: "explicit-confirm",
      label: "Explicit confirmation",
      ok: reviewed.explicitConfirm,
      detail: reviewed.explicitConfirm ? "confirmed" : "required",
      fixLabel: "Acknowledge mainnet risk",
      fixTarget: "review",
    },
  ];
}

function shortAddress(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function shortHex(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function parseProofEvidence(output = ""): ProofEvidence {
  const summary = output.match(/(\d+) tests passed,\s*(\d+) failed/i);
  const fuzz = output.match(/runs:\s*(\d+)/i);
  return {
    testsPassed: summary ? Number(summary[1]) : 0,
    testsFailed: summary ? Number(summary[2]) : 0,
    fuzzRuns: fuzz ? Number(fuzz[1]) : 0,
    gasLines: output
      .split("\n")
      .filter((line) => /testBenchmark_|gas:|Deployment Cost/i.test(line))
      .slice(0, 8),
  };
}

export function reviewStrategy(
  doc: StrategyDocument,
  addons: StrategyAddonState,
  warnings: string[],
  proof: ProofStatus,
): StrategyReview {
  const gasGuard = addons.gasGuard.enabled
    ? [`base fee is at or below ${addons.gasGuard.maxGwei} gwei`]
    : [];
  const baseMainnetBlockers = [
    "template maturity is not mainnet-enabled",
    "bytecode hash must be reviewed",
    "extension hash must be reviewed",
  ];
  if (proof.tests !== "pass")
    baseMainnetBlockers.push("local tests are not green");
  if (proof.fuzz !== "pass")
    baseMainnetBlockers.push("fuzz status is not green");
  if (proof.gas !== "pass")
    baseMainnetBlockers.push("gas benchmark status is not green");
  if (warnings.length > 0)
    baseMainnetBlockers.push("warnings remain unresolved");

  switch (doc.block.type) {
    case "stop-loss":
      return {
        fillsWhen: [
          `oracle price is ${doc.block.direction} ${doc.block.threshold}`,
          `oracle reported a positive answer within the last ${doc.block.staleAfter}s`,
          ...gasGuard,
        ],
        failsWhen: [
          `oracle price has not crossed ${doc.block.direction} ${doc.block.threshold}`,
          "oracle answer is stale, non-positive, or from an incomplete round",
          `oracle reports decimals other than ${doc.block.decimals}`,
          ...(addons.gasGuard.enabled
            ? [`base fee is above ${addons.gasGuard.maxGwei} gwei`]
            : []),
        ],
        assumptions: [
          `${doc.block.staleAfter}s heartbeat matches the configured feed`,
          "configured oracle address belongs to a feed you trust (Chainlink registry recommended)",
          "takers submit the extension calldata at fill time",
        ],
        risks: [
          "trusted-but-compromised oracle (e.g. governance attack on aggregator)",
          "strict gas guard can prevent timely execution",
          "feed retired or aggregator rotated — update DSL and redeploy",
        ],
        mainnetBlockers: baseMainnetBlockers,
      };
    case "gas-guard":
      return {
        fillsWhen: [`base fee is at or below ${doc.block.maxGwei} gwei`],
        failsWhen: [`base fee is above ${doc.block.maxGwei} gwei`],
        assumptions: ["chain basefee semantics match EIP-1559 expectations"],
        risks: ["L2 basefee semantics may differ", "strict cap may miss fills"],
        mainnetBlockers: baseMainnetBlockers,
      };
    case "twap-slice":
      return {
        fillsWhen: [
          "start time has arrived",
          `requested making amount is within ${doc.block.sliceAmount} per ${doc.block.intervalSeconds}s slice`,
          ...gasGuard,
        ],
        failsWhen: [
          "start time has not arrived",
          "requested making amount exceeds elapsed slice cap",
        ],
        assumptions: [
          "takers or keepers arrive for each slice",
          "partial fills are enabled",
        ],
        risks: [
          "keeper liveness",
          "timestamp variance",
          "partial fill accounting complexity",
        ],
        mainnetBlockers: baseMainnetBlockers,
      };
    case "dca-schedule":
      return {
        fillsWhen: [
          `keeper targets one of ${doc.block.tranches} tranche orders`,
          ...gasGuard,
        ],
        failsWhen: [
          "tranche index is out of range",
          "keeper does not publish/fill tranche order",
        ],
        assumptions: [
          "DCA execution is off-chain in v1",
          "series metadata is indexer-facing",
        ],
        risks: [
          "keeper liveness",
          "order management mistakes",
          "series replay assumptions",
        ],
        mainnetBlockers: baseMainnetBlockers,
      };
  }
}

export function getTemplateMaturity(templateId: string): TemplateMaturity {
  return getTemplateCatalogEntry(templateId)?.maturity ?? "draft";
}

export function makerTraitsLabel(hasExtension: boolean): string {
  return hasExtension
    ? `HAS_EXTENSION required (${MAKER_TRAIT_HAS_EXTENSION.toString()})`
    : "No extension trait required";
}

export function saltCompatibility(extension: `0x${string}`): string {
  return buildSaltWithExtension(1n, extension).toString();
}

export function promptToStrategyDocument(
  prompt: string,
  current: StrategyDocument,
  fallbackFor: (templateId: TemplateId) => StrategyDocument,
): StrategyDocument {
  const text = prompt.toLowerCase();
  if (/\bdca\b|tranche|weekly|daily/.test(text)) {
    const next = fallbackFor("dca-schedule");
    const tranches = numberAfter(
      text,
      /(tranches?|x)\s*(\d+)|(\d+)\s*(tranches?|x)/,
    );
    const intervalSeconds = text.includes("week")
      ? 604800
      : text.includes("hour")
        ? 3600
        : 86400;
    return {
      ...next,
      name: titleFromPrompt(prompt, "DCA schedule"),
      block:
        next.block.type === "dca-schedule"
          ? {
              ...next.block,
              tranches: tranches ?? next.block.tranches,
              intervalSeconds,
            }
          : next.block,
    };
  }
  if (/twap|slice|partial/.test(text)) {
    const next = fallbackFor("twap-slice");
    const intervalSeconds = text.includes("hour")
      ? 3600
      : text.includes("minute")
        ? 60
        : 1800;
    return {
      ...next,
      name: titleFromPrompt(prompt, "TWAP slice"),
      order: {
        ...next.order,
        allowPartialFills: true,
        allowMultipleFills: true,
      },
      block:
        next.block.type === "twap-slice"
          ? { ...next.block, intervalSeconds }
          : next.block,
    };
  }
  if (/stop|loss|take.?profit|oracle|price/.test(text)) {
    const next = fallbackFor("stop-loss");
    const direction = /above|take.?profit/.test(text) ? "above" : "below";
    const threshold = integerText(text) ?? "100000000000";
    return {
      ...next,
      name: titleFromPrompt(prompt, "Stop-loss"),
      block:
        next.block.type === "stop-loss"
          ? { ...next.block, direction, threshold }
          : next.block,
    };
  }
  const next = fallbackFor("gas-guard");
  const maxGwei = numberAfter(
    text,
    /(?:gas|basefee|base fee|below|under|<)\D*(\d+)/,
  );
  return {
    ...next,
    name: titleFromPrompt(prompt, "Gas guard"),
    block:
      next.block.type === "gas-guard"
        ? { ...next.block, maxGwei: maxGwei ?? next.block.maxGwei }
        : next.block,
  };
}

export function promptToAddons(
  prompt: string,
  current: StrategyAddonState,
): StrategyAddonState {
  const text = prompt.toLowerCase();
  const mentionsGas = /gas|basefee|base fee|gwei/.test(text);
  if (!mentionsGas) return current;
  return {
    ...current,
    gasGuard: {
      enabled: true,
      maxGwei:
        numberAfter(text, /(?:gas|basefee|base fee|below|under|<)\D*(\d+)/) ??
        current.gasGuard.maxGwei,
    },
  };
}

function numberAfter(text: string, regex: RegExp): number | undefined {
  const match = text.match(regex);
  const raw = match?.find((part, index) => index > 0 && /^\d+$/.test(part));
  return raw ? Number(raw) : undefined;
}

function integerText(text: string): string | undefined {
  return text.match(/\d{2,}/)?.[0];
}

function titleFromPrompt(prompt: string, fallback: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 64 ? `${trimmed.slice(0, 61)}...` : trimmed;
}
