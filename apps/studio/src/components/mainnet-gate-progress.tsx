"use client";

import type { ReadinessGateId, ReadinessItem } from "@/lib/strategy-workstation";

interface MainnetGateProgressProps {
  items: ReadinessItem[];
  /** When true, gate list starts collapsed behind a summary. */
  compact?: boolean;
  onGateFix?: (gateId: ReadinessGateId) => void;
}

export function MainnetGateProgress({
  items,
  compact = false,
  onGateFix,
}: MainnetGateProgressProps) {
  const met = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((met / total) * 100);

  return (
    <div className="mainnet-progress">
      <div className="mainnet-progress-header">
        <span>Mainnet readiness</span>
        <span
          className="mainnet-progress-summary"
          title={`${met} of ${total} gates complete`}
        >
          {met} / {total} complete
        </span>
      </div>
      <div
        className="mainnet-progress-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${met} of ${total} readiness gates complete`}
      >
        <div className="mainnet-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="mainnet-progress-caption">
        {total} gates: template, network, proofs, warnings, and hash confirmations.
      </p>
      <GateChecklist
        items={items}
        defaultCollapsed={compact}
        onGateFix={onGateFix}
      />
    </div>
  );
}


function GateChecklist({
  items,
  defaultCollapsed,
  onGateFix,
}: {
  items: ReadinessItem[];
  defaultCollapsed: boolean;
  onGateFix?: (gateId: ReadinessGateId) => void;
}) {
  if (defaultCollapsed) {
    return (
      <details className="mainnet-gate-details">
        <summary>Show all {items.length} gates</summary>
        <ul className="mainnet-progress-list">
          {items.map((item) => (
            <GateRow key={item.id} item={item} onGateFix={onGateFix} />
          ))}
        </ul>
      </details>
    );
  }

  return (
    <ul className="mainnet-progress-list">
      {items.map((item) => (
        <GateRow key={item.id} item={item} onGateFix={onGateFix} />
      ))}
    </ul>
  );
}

function GateRow({
  item,
  onGateFix,
}: {
  item: ReadinessItem;
  onGateFix?: (gateId: ReadinessGateId) => void;
}) {
  return (
    <li className={item.ok ? "met" : "blocked"}>
      <span className={item.ok ? "dot pass" : "dot fail"} aria-hidden="true" />
      <div className="gate-row-copy">
        <span>{item.label}</span>
        <small>{item.detail}</small>
      </div>
      {!item.ok && onGateFix ? (
        <button
          type="button"
          className="gate-fix-button"
          onClick={() => onGateFix(item.id)}
        >
          {item.fixLabel}
        </button>
      ) : (
        <span className="gate-status-pill">{item.ok ? "Done" : "Open"}</span>
      )}
    </li>
  );
}
