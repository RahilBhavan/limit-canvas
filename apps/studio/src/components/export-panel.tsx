"use client";

interface ExportPanelProps {
  artifacts: { path: string; content: string }[];
  extensionHash: string;
  onDownloadBundle: () => void;
  onDownloadManifest: () => void;
}

export function ExportPanel({
  artifacts,
  extensionHash,
  onDownloadBundle,
  onDownloadManifest,
}: ExportPanelProps) {
  const manifest = artifacts.find((a) => a.path === "manifest.json");
  const hasBundle = artifacts.length > 0;

  return (
    <div className="export-panel">
      <p>
        Download reproducible artifacts for integrators and testnet deploy. The
        extension hash must match your order salt.
      </p>
      <div className="export-hash">
        <span>Extension hash</span>
        <p className="export-hash-explainer">
          Unique fingerprint of your packed extension. LOP uses the low 160 bits
          in the order salt — mismatches reject fills.
        </p>
        <code>
          {extensionHash === "pending" ? "Generate first" : extensionHash}
        </code>
        {extensionHash !== "pending" && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigator.clipboard.writeText(extensionHash)}
          >
            Copy
          </button>
        )}
      </div>
      <p className="export-hash-note">
        This hash is embedded in the salt (low 160 bits). A mismatch causes fill
        rejection.
      </p>
      <div className="export-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!hasBundle}
          onClick={onDownloadBundle}
        >
          Download bundle (.zip)
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!manifest}
          onClick={onDownloadManifest}
        >
          Download manifest.json
        </button>
      </div>
      {manifest && (
        <details className="export-manifest-preview">
          <summary>Manifest preview</summary>
          <pre>{manifest.content.slice(0, 2000)}</pre>
        </details>
      )}
    </div>
  );
}
