"use client";

import type {
  PredicatePreview,
  SimulationInput,
  StrategyAddonState,
} from "@/lib/strategy-workstation";
import type {
  computeSimulation,
  simulationTimeline,
} from "@/lib/strategy-workstation";
import type { StrategyDocument } from "@limit-canvas/hook-dsl";

interface SimulationPanelProps {
  doc: StrategyDocument;
  addons: StrategyAddonState;
  input: SimulationInput;
  setInput: (input: SimulationInput) => void;
  simulation: ReturnType<typeof computeSimulation>;
  timeline: ReturnType<typeof simulationTimeline>;
  predicatePreview?: PredicatePreview | null;
}

export function SimulationPanel({
  doc,
  addons,
  input,
  setInput,
  simulation,
  timeline,
  predicatePreview,
}: SimulationPanelProps) {
  return (
    <section className="simulation-panel">
      <div className="simulation-outcome-header">
        <div className={`simulation-result ${simulation.ok ? "pass" : "fail"}`}>
          <strong>{simulation.title}</strong>
          <span>{simulation.reason}</span>
          <small>{simulation.detail}</small>
        </div>
        <ScenarioPresets
          doc={doc}
          addons={addons}
          input={input}
          onSelect={setInput}
        />
      </div>
      <div className="simulation-inputs">
        <SimulationControls
          doc={doc}
          addons={addons}
          input={input}
          setInput={setInput}
        />
        {predicatePreview && (
          <div className="predicate-preview" aria-label="Compiled predicate">
            <span className="field-label">Compiled predicate</span>
            <code>{predicatePreview.root}</code>
            <small>
              {predicatePreview.mode} · {predicatePreview.nodeCount} node(s)
            </small>
          </div>
        )}
        <div className="simulation-timeline" aria-label="Simulation timeline">
          {timeline.map((step, index) => (
            <div
              key={`${step.label}-${index}`}
              className={`timeline-step ${step.state}`}
            >
              <span>{step.label}</span>
              <b>{step.detail}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScenarioPresets({
  doc,
  addons,
  input,
  onSelect,
}: {
  doc: StrategyDocument;
  addons: StrategyAddonState;
  input: SimulationInput;
  onSelect: (input: SimulationInput) => void;
}) {
  const presets = simulationPresets(doc, addons);
  return (
    <fieldset className="scenario-presets" aria-label="Scenario presets">
      <legend>Try a scenario</legend>
      <p className="scenario-presets-hint">
        Each button loads inputs for a different fill path — not live status.
      </p>
      <div className="scenario-presets-buttons">
        {presets.map((preset) => {
          const active = presetMatchesInput(preset.input, input);
          return (
            <button
              type="button"
              key={preset.label}
              className={active ? "active" : ""}
              aria-pressed={active}
              onClick={() => onSelect(preset.input)}
            >
              <span className="scenario-preset-label">{preset.label}</span>
              <small>{preset.description}</small>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function presetMatchesInput(
  preset: SimulationInput,
  current: SimulationInput,
): boolean {
  return (
    preset.oraclePrice === current.oraclePrice &&
    preset.baseFeeGwei === current.baseFeeGwei &&
    preset.timestamp === current.timestamp &&
    preset.requestedMaking === current.requestedMaking &&
    preset.trancheIndex === current.trancheIndex
  );
}

function SimulationControls({
  doc,
  addons,
  input,
  setInput,
}: {
  doc: StrategyDocument;
  addons: StrategyAddonState;
  input: SimulationInput;
  setInput: (input: SimulationInput) => void;
}) {
  const set = (key: keyof SimulationInput, value: string) =>
    setInput({ ...input, [key]: value });

  if (doc.block.type === "gas-guard") {
    return (
      <RangeTextField
        label="Simulated base fee (gwei)"
        value={input.baseFeeGwei}
        min={1}
        max={140}
        onChange={(value) => set("baseFeeGwei", value)}
      />
    );
  }
  if (doc.block.type === "stop-loss") {
    return (
      <div className="field-grid two">
        <TextField
          label="Simulated oracle price"
          value={input.oraclePrice}
          onChange={(value) => set("oraclePrice", value)}
        />
        {addons.gasGuard.enabled && (
          <RangeTextField
            label="Simulated base fee (gwei)"
            value={input.baseFeeGwei}
            min={1}
            max={140}
            onChange={(value) => set("baseFeeGwei", value)}
          />
        )}
      </div>
    );
  }
  if (doc.block.type === "twap-slice") {
    return (
      <div className="field-grid two">
        <TextField
          label="Timestamp"
          value={input.timestamp}
          onChange={(value) => set("timestamp", value)}
        />
        <TextField
          label="Requested making"
          value={input.requestedMaking}
          onChange={(value) => set("requestedMaking", value)}
        />
      </div>
    );
  }
  return (
    <TextField
      label="Tranche index"
      value={input.trancheIndex}
      onChange={(value) => set("trancheIndex", value)}
    />
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RangeTextField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  const numericValue = Number(value || 0);
  return (
    <label className="field range-field">
      <span>{label}</span>
      <div className="range-control">
        <input
          type="range"
          min={min}
          max={max}
          value={Number.isFinite(numericValue) ? numericValue : min}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
        />
      </div>
    </label>
  );
}

function simulationPresets(
  doc: StrategyDocument,
  addons: StrategyAddonState,
): { label: string; description: string; input: SimulationInput }[] {
  const base: SimulationInput = {
    oraclePrice: "90000000000",
    baseFeeGwei: "22",
    timestamp: "7200",
    requestedMaking: "1000000000000000000",
    trancheIndex: "1",
  };
  const gasPass = String(Math.max(1, addons.gasGuard.maxGwei - 7));
  const gasFail = String(addons.gasGuard.maxGwei + 18);

  if (doc.block.type === "stop-loss") {
    const threshold = Number(doc.block.threshold || 0);
    const crossed =
      doc.block.direction === "below"
        ? String(Math.max(0, threshold - 3000000000))
        : String(threshold + 3000000000);
    const uncrossed =
      doc.block.direction === "below"
        ? String(threshold + 3000000000)
        : String(Math.max(0, threshold - 3000000000));
    return [
      {
        label: "Would fill",
        description: "Price crossed and gas within cap",
        input: { ...base, oraclePrice: crossed, baseFeeGwei: gasPass },
      },
      {
        label: "High gas",
        description: "Price ok but base fee above guard",
        input: { ...base, oraclePrice: crossed, baseFeeGwei: gasFail },
      },
      {
        label: "Price not met",
        description: "Oracle has not crossed threshold",
        input: { ...base, oraclePrice: uncrossed, baseFeeGwei: gasPass },
      },
    ];
  }

  if (doc.block.type === "twap-slice") {
    return [
      {
        label: "Would fill",
        description: "Slice window open",
        input: { ...base, timestamp: "7200" },
      },
      {
        label: "Too early",
        description: "Before next slice time",
        input: { ...base, timestamp: "0" },
      },
      {
        label: "High gas",
        description: "Time ok but gas above cap",
        input: { ...base, timestamp: "7200", baseFeeGwei: gasFail },
      },
    ];
  }

  if (doc.block.type === "dca-schedule") {
    return [
      {
        label: "Would fill",
        description: "Valid tranche index",
        input: { ...base, trancheIndex: "1" },
      },
      {
        label: "Out of range",
        description: "Tranche index past schedule",
        input: { ...base, trancheIndex: String(doc.block.tranches + 1) },
      },
      {
        label: "High gas",
        description: "Tranche ok but gas blocked",
        input: { ...base, trancheIndex: "1", baseFeeGwei: gasFail },
      },
    ];
  }

  return [
    {
      label: "Would fill",
      description: "Base fee within guard",
      input: { ...base, baseFeeGwei: "18" },
    },
    {
      label: "High gas",
      description: "Base fee above max gwei",
      input: { ...base, baseFeeGwei: String(doc.block.maxGwei + 18) },
    },
  ];
}
