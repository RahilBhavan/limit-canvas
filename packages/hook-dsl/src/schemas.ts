import { z } from "zod";

export const DSL_VERSION = "1.0.0" as const;

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");
const hex = z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid hex");

export const templateIdSchema = z.enum([
  "stop-loss",
  "gas-guard",
  "twap-slice",
  "dca-schedule",
]);

export const networkSchema = z.object({
  chainId: z.number().int().positive(),
  lopAddress: address,
});

export const orderSchema = z.object({
  maker: address,
  receiver: address.optional(),
  makerAsset: address,
  takerAsset: address,
  makingAmount: z.string().regex(/^\d+$/),
  takingAmount: z.string().regex(/^\d+$/),
  allowPartialFills: z.boolean().default(true),
  allowMultipleFills: z.boolean().default(false),
  expiration: z.number().int().nonnegative().optional(),
  privateTaker: address.optional(),
});

export const stopLossBlockSchema = z.object({
  type: z.literal("stop-loss"),
  oracle: address,
  threshold: z.string().regex(/^\d+$/),
  /** Fill when price is above threshold (take-profit style) or below (stop-loss floor) */
  direction: z.enum(["above", "below"]),
});

export const gasGuardBlockSchema = z.object({
  type: z.literal("gas-guard"),
  maxGwei: z.number().positive(),
});

export const twapSliceBlockSchema = z.object({
  type: z.literal("twap-slice"),
  totalAmount: z.string().regex(/^\d+$/),
  sliceAmount: z.string().regex(/^\d+$/),
  intervalSeconds: z.number().int().positive(),
  startTime: z.number().int().nonnegative(),
});

export const dcaScheduleBlockSchema = z.object({
  type: z.literal("dca-schedule"),
  tranches: z.number().int().min(2).max(52),
  amountPerTranche: z.string().regex(/^\d+$/),
  intervalSeconds: z.number().int().positive(),
  seriesId: z.number().int().nonnegative().default(0),
});

export const strategyGraphNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["order", "predicate", "getter", "extension", "proof"]),
  templateId: templateIdSchema.optional(),
  label: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});

export const strategyGraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().min(1),
});

export const strategyGraphSchema = z.object({
  version: z.literal("1.0.0"),
  nodes: z.array(strategyGraphNodeSchema).min(1),
  edges: z.array(strategyGraphEdgeSchema),
  compiledPredicate: z
    .object({
      mode: z.enum(["single", "and"]),
      rootNodeIds: z.array(z.string().min(1)),
    })
    .optional(),
});

export const strategyDocumentSchema = z
  .object({
    version: z.literal(DSL_VERSION),
    templateId: templateIdSchema,
    name: z.string().min(1).max(128),
    audited: z.boolean().default(false),
    network: networkSchema,
    order: orderSchema,
    block: z.discriminatedUnion("type", [
      stopLossBlockSchema,
      gasGuardBlockSchema,
      twapSliceBlockSchema,
      dcaScheduleBlockSchema,
    ]),
    /** Pre-built predicate extension calldata (filled by codegen or SDK) */
    predicateCalldata: hex.optional(),
    graph: strategyGraphSchema.optional(),
  })
  .superRefine((doc, ctx) => {
    if (doc.block.type !== doc.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `block.type (${doc.block.type}) must match templateId (${doc.templateId})`,
        path: ["block"],
      });
    }
    if (doc.templateId === "twap-slice" && !doc.order.allowPartialFills) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "twap-slice requires allowPartialFills",
        path: ["order", "allowPartialFills"],
      });
    }
  });

export type StrategyDocumentInput = z.input<typeof strategyDocumentSchema>;
