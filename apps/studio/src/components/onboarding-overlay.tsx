"use client";

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
  onRunDemo: () => void;
}

export function OnboardingOverlay({
  open,
  onClose,
  onRunDemo,
}: OnboardingOverlayProps) {
  if (!open) return null;

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true">
      <div className="onboarding-card">
        <div className="onboarding-eyebrow">
          Limit Canvas · gas-safe stop-loss demo
        </div>
        <h2>
          See an order that only fills when the price drops and gas is cheap.
        </h2>
        <p className="onboarding-lede">
          You'll compose a 1inch limit order with two conditions — a price floor
          and a base-fee cap — watch why it would or wouldn't fill, then
          generate the Solidity and proof artifacts behind it. No wallet signing
          required.
        </p>
        <ol>
          <li>
            <strong>Run demo</strong> loads a working{" "}
            <em>gas-safe stop-loss</em> on the canvas.
          </li>
          <li>
            Drag the price and base fee sliders to see <em>fill</em> vs{" "}
            <em>blocked</em> in real time.
          </li>
          <li>
            <strong>Generate</strong> compiles the visual graph into a
            deterministic Solidity bundle + manifest.
          </li>
          <li>
            <strong>Run checks</strong> executes Foundry tests, fuzz, and gas
            benchmarks locally.
          </li>
        </ol>
        <div className="onboarding-actions">
          <button type="button" className="primary-button" onClick={onRunDemo}>
            Run demo
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Skip — I'll explore
          </button>
        </div>
      </div>
    </div>
  );
}
