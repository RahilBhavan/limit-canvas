"use client";

import { oracleThresholdToUsd, usdToOracleThreshold } from "@/lib/human-units";
import { useState } from "react";

interface HumanThresholdFieldProps {
  threshold: string;
  direction: "above" | "below";
  onThresholdChange: (threshold: string) => void;
  onDirectionChange: (direction: "above" | "below") => void;
}

export function HumanThresholdField({
  threshold,
  direction,
  onThresholdChange,
  onDirectionChange,
}: HumanThresholdFieldProps) {
  const [usd, setUsd] = useState(() =>
    String(Math.round(oracleThresholdToUsd(threshold))),
  );

  return (
    <div className="human-threshold">
      <label className="field">
        <span>Trigger price (USD, 8-dec oracle)</span>
        <input
          type="number"
          min={0}
          step={1}
          value={usd}
          onChange={(e) => {
            const next = e.target.value;
            setUsd(next);
            const n = Number(next);
            if (Number.isFinite(n) && n > 0) {
              onThresholdChange(usdToOracleThreshold(n));
            }
          }}
        />
      </label>
      <div className="segmented-field">
        <span>Direction</span>
        <div
          className="segmented-options"
          role="group"
          aria-label="Price direction"
        >
          <button
            type="button"
            className={direction === "below" ? "active" : ""}
            onClick={() => onDirectionChange("below")}
          >
            Below
          </button>
          <button
            type="button"
            className={direction === "above" ? "active" : ""}
            onClick={() => onDirectionChange("above")}
          >
            Above
          </button>
        </div>
      </div>
      <p className="field-hint">
        {direction === "below" ? "Stop-loss" : "Take-profit"}: fills when price is{" "}
        {direction} ${usd || "…"}.
      </p>
    </div>
  );
}
