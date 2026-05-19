import type { AssistRequest, AssistResponse } from "@/lib/agents/schemas";
import { defaultDocument } from "@/lib/default-dsl";
import { plainLanguageSummary } from "@/lib/strategy-summary";
import {
  promptToAddons,
  promptToStrategyDocument,
  reviewStrategy,
} from "@/lib/strategy-workstation";
import {
  type StrategyDocument,
  parseStrategyDocument,
} from "@limit-canvas/hook-dsl";
import type { TemplateId } from "@limit-canvas/hook-dsl";

export async function runAssist(
  request: AssistRequest,
): Promise<AssistResponse> {
  if (process.env.OPENAI_API_KEY) {
    const { runWithLlm } = await import("@/lib/agents/llm");
    const llm = await runWithLlm(request);
    if (llm) return llm;
  }
  return runWithRules(request);
}

function runWithRules(request: AssistRequest): AssistResponse {
  switch (request.kind) {
    case "intent":
      return intentFromRules(request.prompt ?? "");
    case "strategy":
      return strategyFromRules(request.prompt ?? "", request.docJson);
    case "proof":
      return proofFromRules(request.proofStatus, request.proofOutput);
    case "review":
      return reviewFromRules(request.docJson);
  }
}

function intentFromRules(prompt: string): AssistResponse {
  const text = prompt.toLowerCase();
  const bullets: string[] = [];
  if (/stop|loss|below|floor/.test(text)) {
    bullets.push("Sounds like a stop-loss when price drops.");
  }
  if (/gas|gwei|fee/.test(text)) {
    bullets.push(
      "You may want a gas cap so the order does not fill during spikes.",
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      "Describe the fill condition (e.g. sell when ETH drops below a price) and any gas limit.",
    );
  }
  return {
    headline: "Here is how I read your goal",
    bullets,
    questions:
      bullets.length < 2
        ? ["Which asset pair?", "Stop below or take-profit above?"]
        : undefined,
    confidence: "medium",
    source: "rules",
  };
}

function strategyFromRules(prompt: string, docJson?: string): AssistResponse {
  const current = docJson
    ? parseStrategyDocument(JSON.parse(docJson))
    : defaultDocument("stop-loss");
  const next = promptToStrategyDocument(prompt, current, (id: TemplateId) =>
    defaultDocument(id),
  );
  const addons = promptToAddons(prompt, {
    gasGuard: { enabled: true, maxGwei: 25 },
  });
  return {
    headline: "Strategy draft updated",
    bullets: [
      plainLanguageSummary(next, addons),
      `Template: ${next.templateId}`,
    ],
    dslPatch: { doc: next, addons },
    confidence: "high",
    source: "rules",
  };
}

function proofFromRules(
  status?: AssistRequest["proofStatus"],
  output?: string,
): AssistResponse {
  const bullets: string[] = [];
  if (!status) {
    return {
      headline: "Run checks first",
      bullets: [
        "Click Run checks to execute Foundry tests, fuzz, and gas snapshots.",
      ],
      confidence: "high",
      source: "rules",
    };
  }
  if (status.tests !== "pass") {
    bullets.push(
      "Contract tests did not pass — open Developer details for forge output.",
    );
  } else {
    bullets.push("Contract tests passed.");
  }
  if (status.fuzz !== "pass") {
    bullets.push("Fuzz suite needs attention.");
  } else {
    bullets.push("Fuzz runs passed.");
  }
  if (status.gas !== "pass") {
    bullets.push("Gas benchmark snapshot failed or regressed.");
  } else {
    bullets.push("Gas benchmarks look good.");
  }
  const failedMatch = output?.match(/(\d+) failed/i);
  if (failedMatch) {
    bullets.push(`${failedMatch[1]} failing test(s) reported in the log.`);
  }
  const allGreen =
    status.tests === "pass" && status.fuzz === "pass" && status.gas === "pass";
  return {
    headline: allGreen ? "Proof checks green" : "Proof checks need fixes",
    bullets,
    confidence: "high",
    source: "rules",
  };
}

function reviewFromRules(docJson?: string): AssistResponse {
  if (!docJson) {
    return {
      headline: "No strategy loaded",
      bullets: ["Configure a strategy first."],
      confidence: "low",
      source: "rules",
    };
  }
  const doc = parseStrategyDocument(JSON.parse(docJson));
  const review = reviewStrategy(
    doc,
    { gasGuard: { enabled: true, maxGwei: 25 } },
    [],
    { tests: "idle", fuzz: "idle", gas: "idle" },
  );
  return {
    headline: "Strategy review",
    bullets: [
      `Fills when: ${review.fillsWhen[0] ?? "see checklist"}`,
      `Fails when: ${review.failsWhen[0] ?? "see checklist"}`,
      `Top risk: ${review.risks[0] ?? "protocol configuration"}`,
    ],
    confidence: "high",
    source: "rules",
  };
}
