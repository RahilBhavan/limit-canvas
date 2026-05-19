import type { AssistRequest, AssistResponse } from "@/lib/agents/schemas";

/** Optional OpenAI path when `ai` + `@ai-sdk/openai` are installed and keyed. */
export async function runWithLlm(
  request: AssistRequest,
): Promise<AssistResponse | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const { generateObject } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { assistResponseSchema } = await import("@/lib/agents/schemas");

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = `You are Limit Canvas assistant for 1inch Limit Order Protocol extensions.
Only suggest dslPatch when kind=strategy. Never invent private keys or promise mainnet safety.`;

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: assistResponseSchema,
      system,
      prompt: JSON.stringify(request),
    });

    return {
      ...(object as AssistResponse),
      source: "llm" as const,
    };
  } catch {
    return null;
  }
}
