declare module "ai" {
  export function generateObject(args: unknown): Promise<{ object: unknown }>;
}

declare module "@ai-sdk/openai" {
  export function createOpenAI(config: {
    apiKey?: string;
  }): (model: string) => unknown;
}
