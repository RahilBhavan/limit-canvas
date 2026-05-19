import type { TemplateId } from "./types.js";

export type TemplateStage = "production-candidate" | "planned" | "research";
export type TemplateMaturity =
  | "draft"
  | "tested"
  | "benchmarked"
  | "audit-ready"
  | "mainnet-enabled";

export interface TemplateCatalogEntry {
  id: string;
  title: string;
  stage: TemplateStage;
  maturity: TemplateMaturity;
  version: string;
  executable: boolean;
  /** Full graph-to-codegen + manifest path in the studio (hero templates). */
  graphCodegenExecutable: boolean;
  summary: string;
  lopSurface: string[];
  productionRequirements: string[];
  risks: string[];
}

export const IMPLEMENTED_TEMPLATE_IDS = [
  "stop-loss",
  "gas-guard",
  "twap-slice",
  "dca-schedule",
] as const satisfies readonly TemplateId[];

export const TEMPLATE_CATALOG = [
  {
    id: "stop-loss",
    title: "Stop-loss / take-profit",
    stage: "production-candidate",
    maturity: "audit-ready",
    version: "1.0.0",
    executable: true,
    graphCodegenExecutable: true,
    summary: "Fill only when an oracle price crosses a threshold.",
    lopSurface: ["predicate", "arbitrary static call"],
    productionRequirements: [
      "oracle decimals",
      "stale price guard",
      "oracle trust docs",
    ],
    risks: [
      "oracle staleness",
      "oracle decimals mismatch",
      "threshold misconfiguration",
    ],
  },
  {
    id: "gas-guard",
    title: "Gas guard",
    stage: "production-candidate",
    maturity: "audit-ready",
    version: "1.0.0",
    executable: true,
    graphCodegenExecutable: true,
    summary: "Fill only when base fee is at or below a configured cap.",
    lopSurface: ["predicate", "block.basefee"],
    productionRequirements: [
      "L2 caveats",
      "basefee fuzz boundaries",
      "gas benchmark",
    ],
    risks: ["L2 basefee semantics", "missed fills during volatile gas periods"],
  },
  {
    id: "twap-slice",
    title: "TWAP slice",
    stage: "production-candidate",
    maturity: "benchmarked",
    version: "1.0.0",
    executable: true,
    graphCodegenExecutable: false,
    summary:
      "Cap partial fills by elapsed time windows (simulate in studio; full graph codegen pending).",
    lopSurface: ["partial fills", "making amount getter", "time predicate"],
    productionRequirements: [
      "cumulative fill accounting",
      "end-state tests",
      "realistic fill benchmark",
      "LOP fill integration for getter path",
    ],
    risks: [
      "studio preview only — not recommended for Simple mode codegen",
      "keeper/taker liveness",
      "partial fill accounting",
      "timestamp variance",
    ],
  },
  {
    id: "dca-schedule",
    title: "DCA schedule",
    stage: "production-candidate",
    maturity: "tested",
    version: "1.0.0",
    executable: true,
    graphCodegenExecutable: false,
    summary:
      "Generate a tranche series with keeper hints (simulate in studio; full graph codegen pending).",
    lopSurface: ["order series", "metadata registry", "keeper guidance"],
    productionRequirements: [
      "order array export",
      "keeper docs",
      "tranche benchmark",
      "LOP series fill integration tests",
    ],
    risks: [
      "studio preview only — not recommended for Simple mode codegen",
      "keeper liveness",
      "off-chain order management",
      "series replay assumptions",
    ],
  },
  {
    id: "oracle-band",
    title: "Oracle band",
    stage: "planned",
    maturity: "draft",
    version: "0.1.0",
    executable: false,
    graphCodegenExecutable: false,
    summary: "Fill only inside or outside a configured price band.",
    lopSurface: ["predicate", "oracle call"],
    productionRequirements: [
      "min/max invariant tests",
      "stale price guard",
      "decimals config",
    ],
    risks: ["unimplemented template", "oracle staleness"],
  },
  {
    id: "deadline-window",
    title: "Deadline window",
    stage: "planned",
    maturity: "draft",
    version: "0.1.0",
    executable: false,
    graphCodegenExecutable: false,
    summary: "Fill only between start and end timestamps.",
    lopSurface: ["predicate", "timestamp"],
    productionRequirements: [
      "boundary fuzzing",
      "timezone-free UI",
      "no-helper calldata path",
    ],
    risks: ["unimplemented template", "timestamp boundary assumptions"],
  },
  {
    id: "private-taker",
    title: "Private taker / allowlist",
    stage: "planned",
    maturity: "draft",
    version: "0.1.0",
    executable: false,
    graphCodegenExecutable: false,
    summary: "Restrict fills to one taker or an allowlisted resolver path.",
    lopSurface: ["maker traits", "taker restrictions"],
    productionRequirements: [
      "native trait mapping",
      "allowlist tests",
      "private fill documentation",
    ],
    risks: ["unimplemented template", "resolver address mismatch"],
  },
  {
    id: "dutch-auction",
    title: "Dutch auction",
    stage: "research",
    maturity: "draft",
    version: "0.1.0",
    executable: false,
    graphCodegenExecutable: false,
    summary: "Move price over time through dynamic amount getters.",
    lopSurface: ["making amount getter", "taking amount getter"],
    productionRequirements: [
      "math proof",
      "overflow fuzzing",
      "gas curve benchmark",
    ],
    risks: [
      "unimplemented template",
      "amount getter math",
      "price curve misconfiguration",
    ],
  },
] as const satisfies readonly TemplateCatalogEntry[];

export function getTemplateCatalogEntry(
  id: string,
): TemplateCatalogEntry | undefined {
  return TEMPLATE_CATALOG.find((template) => template.id === id);
}
