import {
  TEMPLATE_CATALOG,
  type TemplateCatalogEntry,
  type TemplateId,
} from "@limit-canvas/hook-dsl";

export interface TemplateMeta extends TemplateCatalogEntry {
  id: TemplateId;
  description: string;
}

const catalog: readonly TemplateCatalogEntry[] = TEMPLATE_CATALOG;

export const TEMPLATES: TemplateMeta[] = catalog
  .filter((template): template is TemplateMeta => template.executable)
  .map((template) => ({
    ...template,
    id: template.id as TemplateId,
    description: template.summary,
  }));

export const PLANNED_TEMPLATES = catalog.filter(
  (template) => !template.executable,
);

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Full codegen + proof path for average users. */
export const PRODUCTION_READY_TEMPLATE_IDS = [
  "stop-loss",
  "gas-guard",
  "twap-slice",
  "dca-schedule",
] as const;

/** Visible in UI but not recommended for Simple mode codegen. */
export const PREVIEW_ONLY_TEMPLATE_IDS = [] as const;

export function isPreviewOnlyTemplate(id: string): boolean {
  return (PREVIEW_ONLY_TEMPLATE_IDS as readonly string[]).includes(id);
}

/** Whether the studio should compile the visual graph into a combined predicate tree. */
export function isGraphCodegenTemplate(id: string): boolean {
  const entry = catalog.find((template) => template.id === id);
  return entry?.graphCodegenExecutable === true;
}

export function isProductionReadyTemplate(id: string): boolean {
  return (PRODUCTION_READY_TEMPLATE_IDS as readonly string[]).includes(id);
}
