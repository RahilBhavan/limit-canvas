import { ComposeWizard, type Phase } from "@/components/compose-wizard";

const VALID_PHASES: Phase[] = ["build", "test", "ship"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; phase?: string; step?: string }>;
}) {
  const params = await searchParams;
  const templateId =
    params.template === "gas-guard" ||
    params.template === "twap-slice" ||
    params.template === "dca-schedule"
      ? params.template
      : "stop-loss";

  const rawPhase = params.phase ?? mapLegacyStep(params.step);
  const initialPhase = VALID_PHASES.includes(rawPhase as Phase)
    ? (rawPhase as Phase)
    : undefined;

  return <ComposeWizard templateId={templateId} initialPhase={initialPhase} />;
}

function mapLegacyStep(step: string | undefined): string | undefined {
  if (!step) return undefined;
  if (step === "export" || step === "deploy") return "ship";
  if (
    step === "simulate" ||
    step === "generate" ||
    step === "prove" ||
    step === "review"
  )
    return "test";
  if (step === "sketch") return "build";
  return undefined;
}
