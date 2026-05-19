"use client";

export type ShipFlowStep = "export" | "verify" | "deploy";

interface ShipFlowStepperProps {
  activeStep: ShipFlowStep;
  artifactsReady: boolean;
  verifyReady: boolean;
  onStep: (step: ShipFlowStep) => void;
}

const STEPS: { id: ShipFlowStep; label: string; detail: string }[] = [
  {
    id: "export",
    label: "Export",
    detail: "Generate and download the testnet pack",
  },
  {
    id: "verify",
    label: "Verify",
    detail: "Run checks and confirm extension / bytecode hashes",
  },
  {
    id: "deploy",
    label: "Deploy",
    detail: "Follow Foundry steps for testnet deployment",
  },
];

export function ShipFlowStepper({
  activeStep,
  artifactsReady,
  verifyReady,
  onStep,
}: ShipFlowStepperProps) {
  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <ol className="ship-flow-stepper" aria-label="Ship workflow">
      {STEPS.map((step, index) => {
        const done =
          index < stepIndex ||
          (step.id === "export" &&
            artifactsReady &&
            activeStep !== "export") ||
          (step.id === "verify" &&
            verifyReady &&
            activeStep === "deploy");
        const current = step.id === activeStep;
        const state = done ? "done" : current ? "current" : "upcoming";
        return (
          <li key={step.id} className={state}>
            <button type="button" onClick={() => onStep(step.id)}>
              <span className="ship-step-index">{index + 1}</span>
              <span className="ship-step-copy">
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
