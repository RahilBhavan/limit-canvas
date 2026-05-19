export {
  auditProvenanceSchema,
  DSL_VERSION,
  strategyDocumentSchema,
  templateIdSchema,
} from "./schemas.js";
export {
  getTemplateCatalogEntry,
  IMPLEMENTED_TEMPLATE_IDS,
  TEMPLATE_CATALOG,
} from "./template-catalog.js";
export type { StrategyDocumentInput } from "./schemas.js";
export type {
  TemplateCatalogEntry,
  TemplateMaturity,
  TemplateStage,
} from "./template-catalog.js";
export type {
  AuditProvenance,
  DcaScheduleBlock,
  GasGuardBlock,
  NetworkConfig,
  OrderConfig,
  StopLossBlock,
  StrategyDocument,
  StrategyGraph,
  StrategyGraphEdge,
  StrategyGraphNode,
  TemplateBlock,
  TemplateId,
  TwapSliceBlock,
} from "./types.js";
export {
  validateExtensionTraits,
  MAKER_TRAIT_HAS_EXTENSION,
} from "./validate.js";
import { strategyDocumentSchema } from "./schemas.js";
import type { StrategyDocument } from "./types.js";

export function parseStrategyDocument(raw: unknown): StrategyDocument {
  return strategyDocumentSchema.parse(raw);
}
