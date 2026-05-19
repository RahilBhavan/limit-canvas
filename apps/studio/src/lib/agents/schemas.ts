import { z } from "zod";

export const assistRequestSchema = z.object({
  kind: z.enum(["intent", "strategy", "proof", "review"]),
  prompt: z.string().optional(),
  docJson: z.string().optional(),
  proofOutput: z.string().optional(),
  proofStatus: z
    .object({
      tests: z.string(),
      fuzz: z.string(),
      gas: z.string(),
    })
    .optional(),
});

export type AssistRequest = z.infer<typeof assistRequestSchema>;
export type AssistKind = AssistRequest["kind"];

export const assistResponseSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()),
  questions: z.array(z.string()).optional(),
  dslPatch: z.record(z.unknown()).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.enum(["rules", "llm"]),
});

export type AssistResponse = z.infer<typeof assistResponseSchema>;
