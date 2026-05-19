"use client";

import {
  GAS_PRESETS,
  type GasPresetId,
  gweiToGasPreset,
} from "@/lib/human-units";

interface GasPresetFieldProps {
  maxGwei: number;
  onChange: (maxGwei: number) => void;
}

export function GasPresetField({ maxGwei, onChange }: GasPresetFieldProps) {
  const active = gweiToGasPreset(maxGwei);

  return (
    <div className="gas-preset-field">
      <span className="field-label">Gas limit</span>
      <div
        className="gas-preset-options gas-preset-options--detailed"
        role="group"
        aria-label="Gas preset"
      >
        {(Object.keys(GAS_PRESETS) as GasPresetId[]).map((id) => {
          const preset = GAS_PRESETS[id];
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              className={selected ? "active" : ""}
              aria-pressed={selected}
              onClick={() => onChange(preset.maxGwei)}
            >
              <span className="gas-preset-label">{preset.label}</span>
              <span className="gas-preset-cap">≤ {preset.maxGwei} gwei</span>
              <span className="gas-preset-hint">{preset.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
