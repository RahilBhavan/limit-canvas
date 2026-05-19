"use client";

import type { ProofStatus } from "@/lib/strategy-workstation";

interface ProofStatusCardsProps {
  proof: ProofStatus;
  lastRunAt: number | null;
}

export function ProofStatusCards({ proof, lastRunAt }: ProofStatusCardsProps) {
  const rows: { id: string; label: string; status: ProofStatus["tests"] }[] = [
    { id: "tests", label: "Contract tests", status: proof.tests },
    { id: "fuzz", label: "Fuzz", status: proof.fuzz },
    { id: "gas", label: "Gas benchmark", status: proof.gas },
  ];

  return (
    <div className="proof-status-cards">
      {rows.map((row) => (
        <div key={row.id} className={`proof-card ${tone(row.status)}`}>
          <span>{row.label}</span>
          <b>{label(row.status)}</b>
        </div>
      ))}
      {lastRunAt && (
        <p className="proof-last-run">
          Last run {new Date(lastRunAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function tone(status: ProofStatus["tests"]): string {
  if (status === "pass") return "pass";
  if (status === "fail") return "fail";
  if (status === "running") return "running";
  return "idle";
}

function label(status: ProofStatus["tests"]): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "running":
      return "Running";
    case "idle":
      return "Not run";
  }
}
