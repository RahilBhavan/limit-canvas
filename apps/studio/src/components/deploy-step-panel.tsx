"use client";

import { isProductionReadyTemplate } from "@/lib/templates";
import type { TemplateId } from "@limit-canvas/hook-dsl";

interface DeployStepPanelProps {
  templateId: TemplateId;
  proofGreen: boolean;
  artifactsReady: boolean;
}

export function DeployStepPanel({
  templateId,
  proofGreen,
  artifactsReady,
}: DeployStepPanelProps) {
  const productionReady = isProductionReadyTemplate(templateId);

  return (
    <div className="deploy-step-panel">
      <p className="deploy-step-intro">
        Testnet deploy uses Foundry scripts in{" "}
        <code>packages/contracts/script/</code>. Mainnet stays blocked until
        templates are explicitly mainnet-enabled.
      </p>
      <ol className="deploy-checklist">
        <li className={artifactsReady ? "done" : ""}>
          Generate artifact bundle
        </li>
        <li className={proofGreen ? "done" : ""}>
          Run checks (tests + fuzz + gas)
        </li>
        <li className={productionReady ? "done" : "warn"}>
          Template on production path ({templateId})
        </li>
      </ol>
      <pre className="deploy-cli">
        {`cd packages/contracts
export DEPLOYER_KEY=0x...
export RPC_URL=https://sepolia.infura.io/v3/...
FOUNDRY_PROFILE=testnet forge script script/Deploy${scriptName(templateId)}.s.sol --broadcast --verify`}
      </pre>
      {!productionReady && (
        <p className="deploy-warn">
          {templateId} is preview-only — use stop-loss or gas guard for the
          recommended testnet path.
        </p>
      )}
      <p className="deploy-hint">
        After deploy, sign orders with the generated extension hash embedded in
        salt (low 160 bits). See generated README in your bundle.
      </p>
    </div>
  );
}

function scriptName(id: string): string {
  const map: Record<string, string> = {
    "stop-loss": "StopLoss",
    "gas-guard": "GasGuard",
    "twap-slice": "TwapSlice",
    "dca-schedule": "DcaSchedule",
  };
  return map[id] ?? "GasGuard";
}
