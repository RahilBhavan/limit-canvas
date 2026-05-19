import type { z } from "zod";
import type {
  auditProvenanceSchema,
  dcaScheduleBlockSchema,
  gasGuardBlockSchema,
  networkSchema,
  orderSchema,
  stopLossBlockSchema,
  strategyDocumentSchema,
  strategyGraphEdgeSchema,
  strategyGraphNodeSchema,
  strategyGraphSchema,
  templateIdSchema,
  twapSliceBlockSchema,
} from "./schemas.js";

export type AuditProvenance = z.infer<typeof auditProvenanceSchema>;

export type TemplateId = z.infer<typeof templateIdSchema>;
export type StrategyDocument = z.infer<typeof strategyDocumentSchema>;
export type StrategyGraph = z.infer<typeof strategyGraphSchema>;
export type StrategyGraphNode = z.infer<typeof strategyGraphNodeSchema>;
export type StrategyGraphEdge = z.infer<typeof strategyGraphEdgeSchema>;
export type OrderConfig = z.infer<typeof orderSchema>;
export type NetworkConfig = z.infer<typeof networkSchema>;
export type StopLossBlock = z.infer<typeof stopLossBlockSchema>;
export type GasGuardBlock = z.infer<typeof gasGuardBlockSchema>;
export type TwapSliceBlock = z.infer<typeof twapSliceBlockSchema>;
export type DcaScheduleBlock = z.infer<typeof dcaScheduleBlockSchema>;

export type TemplateBlock =
  | StopLossBlock
  | GasGuardBlock
  | TwapSliceBlock
  | DcaScheduleBlock;
