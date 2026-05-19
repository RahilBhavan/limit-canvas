"use client";

import { TEMPLATES } from "@/lib/templates";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const PROFILES = ["local", "testnet", "mainnet"] as const;

export function DeployForm() {
  const searchParams = useSearchParams();
  const fromComposer = searchParams.get("template");
  const [profile, setProfile] = useState<(typeof PROFILES)[number]>("testnet");
  const [templateId, setTemplateId] = useState("stop-loss");
  const [extensionReviewed, setExtensionReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (fromComposer && TEMPLATES.some((t) => t.id === fromComposer)) {
      setTemplateId(fromComposer);
    }
  }, [fromComposer]);

  const meta = TEMPLATES.find((t) => t.id === templateId);
  const mainnetEligibleMaturity =
    meta?.maturity === "audit-ready" || meta?.maturity === "mainnet-enabled";
  const mainnetBlocked =
    profile === "mainnet" &&
    (!mainnetEligibleMaturity || !extensionReviewed || !confirmed);

  return (
    <>
      {fromComposer && (
        <p className="mb-4 rounded-lg border border-[var(--hairline)] bg-[var(--canvas-card)] px-3 py-2 text-sm text-gray-300">
          Template from composer: <strong>{fromComposer}</strong>
        </p>
      )}

      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="block text-sm">
          Environment
          <select
            className="mt-1 w-full rounded border border-[var(--border)] bg-black/40 p-2"
            value={profile}
            onChange={(e) =>
              setProfile(e.target.value as (typeof PROFILES)[number])
            }
          >
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Template
          <select
            className="mt-1 w-full rounded border border-[var(--border)] bg-black/40 p-2"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.maturity})
              </option>
            ))}
          </select>
        </label>

        {profile === "mainnet" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-amber-400">
              <input
                type="checkbox"
                checked={extensionReviewed}
                onChange={(e) => setExtensionReviewed(e.target.checked)}
              />
              Extension hash reviewed
            </label>
            <label className="flex items-center gap-2 text-sm text-amber-400">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I accept mainnet deploy risk
            </label>
          </div>
        )}

        <pre className="rounded bg-black/50 p-3 font-mono text-xs text-gray-400">
          {`cd packages/contracts
export DEPLOYER_KEY=0x...
export RPC_URL=...
FOUNDRY_PROFILE=${profile} forge script script/Deploy${scriptName(templateId)}.s.sol --broadcast${profile !== "local" ? " --verify" : ""}`}
        </pre>

        {mainnetBlocked && (
          <p className="text-sm text-red-400">
            Mainnet blocked: template maturity must be audit-ready or above and
            both confirmations must be checked.
          </p>
        )}
      </div>
    </>
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
