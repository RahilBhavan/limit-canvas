"use client";

import {
  PREVIEW_ONLY_TEMPLATE_IDS,
  TEMPLATES,
  type TemplateMeta,
} from "@/lib/templates";
import type { TemplateId } from "@limit-canvas/hook-dsl";

const USE_CASE: Record<string, string> = {
  "stop-loss": "Limit sells / buys at an oracle price",
  "gas-guard": "Only fill when network gas is reasonable",
  "twap-slice": "Slice large orders over time (preview)",
  "dca-schedule": "Recurring tranches (preview)",
};

interface TemplateGalleryProps {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}

export function TemplateGallery({ value, onChange }: TemplateGalleryProps) {
  return (
    <div className="template-gallery">
      {TEMPLATES.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          selected={template.id === value}
          previewOnly={(PREVIEW_ONLY_TEMPLATE_IDS as readonly string[]).includes(
            template.id,
          )}
          onSelect={() => onChange(template.id)}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  previewOnly,
  onSelect,
}: {
  template: TemplateMeta;
  selected: boolean;
  previewOnly: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`template-card ${selected ? "selected" : ""}${
        previewOnly ? " preview-only" : ""
      }`}
      onClick={onSelect}
    >
      <span className="template-card-title">{template.title}</span>
      <small>{USE_CASE[template.id] ?? template.description}</small>
      <span className={`template-badge ${previewOnly ? "preview" : "ready"}`}>
        {previewOnly ? "Preview" : "Ready"}
      </span>
    </button>
  );
}
