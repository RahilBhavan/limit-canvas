import { runContractTests } from "@/app/test-actions";
import Link from "next/link";

export default async function TestPage() {
  const result = await runContractTests();

  return (
    <div className="workstation">
      <header className="topbar">
        <div className="topbar-identity">
          <span className="eyebrow">Verify</span>
          <h1>Contract verification</h1>
        </div>
        <div className="topbar-status">
          <span
            className={`status-pill ${
              result.ok ? "status-pill--ready" : "status-pill--blocked"
            }`}
          >
            <span className="status-dot" aria-hidden="true" />
            {result.ok ? "All tests passed" : "Tests failed"}
          </span>
        </div>
        <div className="topbar-actions">
          <Link href="/" className="ghost-button">
            Back to Compose
          </Link>
        </div>
      </header>

      <p className="topline-summary">
        One-shot Foundry test suite. For the full strategy workflow with
        simulation, fuzz, and gas benchmarks, use <strong>Run checks</strong> in
        the composer.
      </p>

      <details className="proof-output" open>
        <summary>Raw forge output</summary>
        <pre>{result.output || "(no output)"}</pre>
      </details>
    </div>
  );
}
