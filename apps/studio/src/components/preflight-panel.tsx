"use client";

import type { Phase } from "@/components/compose-wizard";
import { MainnetGateProgress } from "@/components/mainnet-gate-progress";
import { ProofStatusCards } from "@/components/proof-status-cards";
import type { ProofStatus } from "@/lib/strategy-workstation";
import type {
  ReadinessGateId,
  ReadinessItem,
  reviewStrategy,
} from "@/lib/strategy-workstation";
import type { Dispatch, RefObject, SetStateAction } from "react";

interface PreflightPanelProps {
  phase: Phase;
  mainnetReady: boolean;
  proof: ProofStatus;
  maturity: string;
  readiness: ReadinessItem[];
  lastProofRunAt: number | null;
  pending: boolean;
  artifactsReady: boolean;
  reviewed: {
    extensionHash: boolean;
    bytecodeHash: boolean;
    explicitConfirm: boolean;
  };
  setReviewed: Dispatch<
    SetStateAction<{
      extensionHash: boolean;
      bytecodeHash: boolean;
      explicitConfirm: boolean;
    }>
  >;
  readinessRef: RefObject<HTMLDetailsElement | null>;
  review: ReturnType<typeof reviewStrategy>;
  graphDocJson: string;
  warnings: string[];
  artifactsCount: number;
  lopVerified: boolean;
  saltMatched: boolean;
  extensionHash: string;
  bytecodeHash: string | null;
  makerTraits: string;
  onRunChecks: () => void;
  onGenerate: () => void;
  onExport: () => void;
  onDeploy: () => void;
  onGateFix: (gateId: ReadinessGateId) => void;
}

export function PreflightPanel({
  phase,
  mainnetReady,
  proof,
  readiness,
  lastProofRunAt,
  pending,
  artifactsReady,
  reviewed,
  setReviewed,
  readinessRef,
  review,
  warnings,
  artifactsCount,
  lopVerified,
  saltMatched,
  extensionHash,
  bytecodeHash,
  makerTraits,
  onRunChecks,
  onGenerate,
  onExport,
  onDeploy,
  onGateFix,
}: PreflightPanelProps) {
  const proofGreen =
    proof.tests === "pass" && proof.fuzz === "pass" && proof.gas === "pass";
  const firstOpenGate = readiness.find((item) => !item.ok);

  return (
    <div className="preflight">
      <div className="panel-heading">
        <h2>Preflight</h2>
        <span className="panel-hint">Mainnet readiness</span>
      </div>

      <div className={`preflight-status ${mainnetReady ? "ready" : "blocked"}`}>
        <strong>{mainnetReady ? "Ready to ship" : "Not ready yet"}</strong>
        <p>
          {mainnetReady
            ? "Checks and gates look good. Continue to ship."
            : firstOpenGate
              ? `Next: ${firstOpenGate.label} — ${firstOpenGate.detail}`
              : "Run checks and complete the steps below."}
        </p>
      </div>

      <PhaseActions
        phase={phase}
        artifactsReady={artifactsReady}
        proofGreen={proofGreen}
        pending={pending}
        onGenerate={onGenerate}
        onRunChecks={onRunChecks}
        onExport={onExport}
        onDeploy={onDeploy}
      />

      <MainnetGateProgress items={readiness} compact onGateFix={onGateFix} />

      <ExtensionHashCard extensionHash={extensionHash} />

      <details ref={readinessRef} className="preflight-collapsed">
        <summary>Advanced — proof, sign-off, review</summary>
        <div className="preflight-advanced">
          <section>
            <h3 className="preflight-subheading">Proof</h3>
            <ProofStatusCards proof={proof} lastRunAt={lastProofRunAt} />
            <ProofEvidence
              proof={proof}
              warnings={warnings}
              artifactsCount={artifactsCount}
              lopVerified={lopVerified}
              saltMatched={saltMatched}
            />
            <div className="hash-line-stack">
              <HashLine label="extension" value={extensionHash} />
              <HashLine
                label="bytecode"
                value={bytecodeHash ?? "generate artifacts first"}
              />
              <HashLine label="maker traits" value={makerTraits} />
            </div>
          </section>

          <section>
            <h3 className="preflight-subheading">Sign-off</h3>
            <div className="review-checks">
              <label>
                <input
                  type="checkbox"
                  checked={reviewed.extensionHash}
                  onChange={(event) =>
                    setReviewed((current) => ({
                      ...current,
                      extensionHash: event.target.checked,
                    }))
                  }
                />
                Extension hash reviewed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reviewed.bytecodeHash}
                  disabled={!bytecodeHash}
                  onChange={(event) =>
                    setReviewed((current) => ({
                      ...current,
                      bytecodeHash: event.target.checked,
                    }))
                  }
                />
                Bytecode hash reviewed
                {bytecodeHash ? (
                  <code className="hash-inline">{bytecodeHash}</code>
                ) : (
                  <span className="hash-pending">
                    (run Generate to populate)
                  </span>
                )}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reviewed.explicitConfirm}
                  onChange={(event) =>
                    setReviewed((current) => ({
                      ...current,
                      explicitConfirm: event.target.checked,
                    }))
                  }
                />
                Explicit mainnet confirmation
              </label>
            </div>
          </section>

          <section>
            <h3 className="preflight-subheading">Strategy review</h3>
            <ReviewList title="Fills when" items={review.fillsWhen} />
            <ReviewList title="Fails when" items={review.failsWhen} />
            <ReviewList title="Assumptions" items={review.assumptions} />
            <ReviewList title="Risks" items={review.risks} />
            <ReviewList
              title="Mainnet blockers"
              items={review.mainnetBlockers}
            />
          </section>
        </div>
      </details>
    </div>
  );
}

function PhaseActions({
  phase,
  artifactsReady,
  proofGreen,
  pending,
  onGenerate,
  onRunChecks,
  onExport,
  onDeploy,
}: {
  phase: Phase;
  artifactsReady: boolean;
  proofGreen: boolean;
  pending: boolean;
  onGenerate: () => void;
  onRunChecks: () => void;
  onExport: () => void;
  onDeploy: () => void;
}) {
  if (phase === "build") {
    return (
      <div className="phase-actions">
        <p className="phase-hint">
          Edit the strategy on the left, then continue to Test.
        </p>
      </div>
    );
  }
  if (phase === "test") {
    return (
      <div className="phase-actions">
        <button
          type="button"
          className="primary-button"
          onClick={artifactsReady ? onRunChecks : onGenerate}
          disabled={pending}
        >
          {artifactsReady ? "Run checks" : "Generate bundle"}
        </button>
        {artifactsReady && !proofGreen && (
          <p className="phase-hint">
            Checks haven't run yet — Forge tests, fuzz, and gas benchmark.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="phase-actions phase-actions--row">
      <button
        type="button"
        className="primary-button"
        onClick={onExport}
        disabled={pending || !artifactsReady}
      >
        Export
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={onDeploy}
        disabled={!artifactsReady}
      >
        Deploy
      </button>
    </div>
  );
}

function ExtensionHashCard({ extensionHash }: { extensionHash: string }) {
  const ready = extensionHash !== "pending";
  return (
    <div className="extension-hash-card">
      <div className="extension-hash-card-head">
        <span>Extension hash</span>
        {ready && (
          <button
            type="button"
            className="ghost-button ghost-button--sm"
            onClick={() => navigator.clipboard.writeText(extensionHash)}
          >
            Copy
          </button>
        )}
      </div>
      <code>{ready ? extensionHash : "Generate artifacts to preview"}</code>
      <p>
        Low 160 bits get embedded in the order salt. Mismatch rejects fills.
      </p>
    </div>
  );
}

function HashLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="hash-line">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function ProofEvidence({
  proof,
  warnings,
  artifactsCount,
  lopVerified,
  saltMatched,
}: {
  proof: ProofStatus;
  warnings: string[];
  artifactsCount: number;
  lopVerified: boolean;
  saltMatched: boolean;
}) {
  const evidence = proof.evidence;
  const blockingWarnings = warnings.filter(
    (w) => !/audit|review/i.test(w),
  ).length;
  const nonBlockingWarnings = warnings.length - blockingWarnings;
  return (
    <div className="evidence-grid">
      <Evidence
        label="tests"
        value={
          evidence
            ? `${evidence.testsPassed} pass / ${evidence.testsFailed} fail`
            : "not run"
        }
      />
      <Evidence
        label="fuzz runs"
        value={evidence ? String(evidence.fuzzRuns) : "not run"}
      />
      <Evidence label="files" value={String(artifactsCount)} />
      <Evidence
        label="warnings"
        value={`${blockingWarnings} blocking / ${nonBlockingWarnings} review`}
      />
      <Evidence
        label="salt low-160"
        value={saltMatched ? "matched" : "pending"}
      />
      <Evidence
        label="LOP address"
        value={lopVerified ? "verified" : "mismatch"}
      />
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="evidence">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="review-list">
      <span>{title}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
