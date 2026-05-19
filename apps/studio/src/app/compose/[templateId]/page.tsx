import { ComposeWizard } from "@/components/compose-wizard";
import { getTemplate } from "@/lib/templates";
import type { TemplateId } from "@limit-canvas/hook-dsl";
import { notFound } from "next/navigation";

const VALID: TemplateId[] = [
  "stop-loss",
  "gas-guard",
  "twap-slice",
  "dca-schedule",
];

export default async function ComposePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const meta = getTemplate(templateId);
  if (!meta || !VALID.includes(templateId as TemplateId)) notFound();

  return <ComposeWizard templateId={templateId as TemplateId} />;
}
