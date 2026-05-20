"use client";

import {
  type ProofCheckResult,
  generateFromDsl,
  previewExtension,
  runProofChecks,
} from "@/app/actions";
import { DeployStepPanel } from "@/components/deploy-step-panel";
import { ExportPanel } from "@/components/export-panel";
import { GasPresetField } from "@/components/gas-preset-field";
import { HumanThresholdField } from "@/components/human-threshold-field";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { PreflightPanel } from "@/components/preflight-panel";
import { SimulationPanel } from "@/components/simulation-panel";
import { TemplateGallery } from "@/components/template-gallery";
import type { UiMode } from "@/lib/composer-types";
import { defaultDocument } from "@/lib/default-dsl";
import {
  loadPersistedState,
  savePersistedState,
} from "@/lib/persisted-strategy";
import { plainLanguageSummary } from "@/lib/strategy-summary";
import {
  type PredicatePreview,
  type ProofStatus,
  type ReadinessGateId,
  type SimulationInput,
  type StrategyAddonState,
  attachGraph,
  computeSimulation,
  makerTraitsLabel,
  parseProofEvidence,
  readinessItems,
  reviewStrategy,
  saltCompatibility,
  simulationTimeline,
} from "@/lib/strategy-workstation";
import { TEMPLATES, isGraphCodegenTemplate } from "@/lib/templates";
import { connectMakerAddress } from "@/lib/wallet";
import { generateArtifacts } from "@limit-canvas/codegen";
import type { StrategyDocument, TemplateId } from "@limit-canvas/hook-dsl";
import { strToU8, zipSync } from "fflate";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { StrategyCanvas } from "./strategy-canvas";
import type { CanvasDropAction, CanvasInspectTarget } from "./strategy-canvas";

export type Phase = "build" | "test" | "ship";

interface ComposeWizardProps {
  templateId: TemplateId;
  initialPhase?: Phase;
}

type PreviewState = Awaited<ReturnType<typeof previewExtension>>;
type Dock = "simulate" | "extension" | "artifacts";

const EMPTY_PROOF: ProofStatus = {
  tests: "idle",
  fuzz: "idle",
  gas: "idle",
};

const DEFAULT_SIMULATION: SimulationInput = {
  oraclePrice: "90000000000",
  baseFeeGwei: "22",
  timestamp: "7200",
  requestedMaking: "1000000000000000000",
  trancheIndex: "1",
};

const DEFAULT_ADDONS: StrategyAddonState = {
  gasGuard: { enabled: true, maxGwei: 25 },
};

const PHASES: { id: Phase; label: string; summary: string }[] = [
  { id: "build", label: "Build", summary: "Design the order logic" },
  { id: "test", label: "Test", summary: "Simulate, generate, prove" },
  { id: "ship", label: "Ship", summary: "Export and deploy" },
];

export function ComposeWizard({
  templateId,
  initialPhase,
}: ComposeWizardProps) {
  const [doc, setDoc] = useState<StrategyDocument>(() =>
    defaultDocument(templateId),
  );
  const [addons, setAddons] = useState<StrategyAddonState>(DEFAULT_ADDONS);
  const [phase, setPhase] = useState<Phase>(initialPhase ?? "build");
  const [uiMode, setUiMode] = useState<UiMode>("simple");
  const [dock, setDock] = useState<Dock>("simulate");
  const [activeInspector, setActiveInspector] =
    useState<CanvasInspectTarget>("condition");

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [artifacts, setArtifacts] = useState<
    { path: string; content: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofStatus>(EMPTY_PROOF);
  const [reviewed, setReviewed] = useState({
    extensionHash: false,
    bytecodeHash: false,
    explicitConfirm: false,
  });
  const [simulationInput, setSimulationInput] =
    useState<SimulationInput>(DEFAULT_SIMULATION);
  const [pending, startTransition] = useTransition();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [lastProofRunAt, setLastProofRunAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const proofRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLElement>(null);
  const readinessRef = useRef<HTMLDetailsElement>(null);

  const selectedTemplate = TEMPLATES.find((t) => t.id === doc.templateId);
  const graphDoc = useMemo(() => attachGraph(doc, addons), [doc, addons]);

  const predicatePreview = useMemo((): PredicatePreview | null => {
    if (!isGraphCodegenTemplate(doc.templateId)) return null;
    try {
      const r = generateArtifacts(graphDoc);
      return {
        mode: r.predicateTree.mode,
        root: r.predicateTree.root,
        extensionHash: r.extensionHash,
        nodeCount: r.predicateTree.nodes.length,
      };
    } catch {
      return null;
    }
  }, [graphDoc, doc.templateId]);

  const simulation = useMemo(
    () => computeSimulation(doc, simulationInput, addons),
    [doc, simulationInput, addons],
  );
  const timeline = useMemo(
    () => simulationTimeline(doc, simulationInput, addons, predicatePreview),
    [doc, simulationInput, addons, predicatePreview],
  );

  const warnings = preview?.warnings ?? [];
  const extension = preview?.extension ?? "0x";
  const salt = saltCompatibility(extension);
  const readiness = readinessItems(
    doc,
    warnings,
    proof,
    reviewed,
    preview?.bytecodeHash ?? null,
  );
  const lopVerified =
    readiness.find((i) => i.label === "LOP address")?.ok ?? false;
  const saltMatched = extension !== "0x" && salt !== "0";
  const mainnetReady = readiness.every((i) => i.ok);
  const review = useMemo(
    () => reviewStrategy(doc, addons, warnings, proof),
    [doc, addons, warnings, proof],
  );
  const summary = useMemo(
    () => plainLanguageSummary(doc, addons),
    [doc, addons],
  );
  const proofGreen =
    proof.tests === "pass" && proof.fuzz === "pass" && proof.gas === "pass";

  const syncDoc = useCallback((next: StrategyDocument) => {
    setDoc(next);
    setArtifacts([]);
    setReviewed({
      extensionHash: false,
      bytecodeHash: false,
      explicitConfirm: false,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot hydrate from localStorage
  useEffect(() => {
    const saved = loadPersistedState();
    if (saved) {
      setDoc(saved.doc);
      setAddons(saved.addons);
      setSimulationInput(saved.simulationInput);
      setOnboardingOpen(!saved.onboardingDone);
      setPhase(initialPhase ?? phaseFromLegacyStep(saved.workflowStep));
      setUiMode(saved.uiMode ?? "simple");
    } else {
      syncDoc(defaultDocument(templateId));
      setOnboardingOpen(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState({
      version: 1,
      doc,
      addons,
      simulationInput,
      copilotPrompt: "",
      uiMode,
      workflowStep: legacyStepFromPhase(phase),
      onboardingDone: !onboardingOpen,
    });
  }, [hydrated, doc, addons, simulationInput, phase, onboardingOpen, uiMode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await previewExtension(JSON.stringify(graphDoc));
        if (cancelled) return;
        setPreview(next);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setPreview(null);
        setError(formatError("Preview generation failed", e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphDoc]);

  const updateDoc = (mutator: (d: StrategyDocument) => StrategyDocument) =>
    syncDoc(mutator(doc));

  const selectTemplate = (next: TemplateId) => syncDoc(defaultDocument(next));

  const loadExample = (example: PortfolioExample) => {
    syncDoc(example.doc);
    setAddons(example.addons);
    setSimulationInput(example.simulation);
  };

  const handleCanvasDrop = (
    action: CanvasDropAction,
    _position: { x: number; y: number },
  ) => {
    if (action.type === "template") {
      selectTemplate(action.templateId);
      return;
    }
    if (action.type === "gas-guard-addon") {
      setAddons((c) => ({
        ...c,
        gasGuard: { ...c.gasGuard, enabled: true },
      }));
      return;
    }
    if (action.type === "demo") {
      const demo = PORTFOLIO_EXAMPLES.find((e) => e.id === action.demoId);
      if (demo) loadExample(demo);
    }
  };

  const handleCanvasInspect = (target: CanvasInspectTarget) => {
    setActiveInspector(target);
    if (target === "extension") setDock("extension");
    else if (target === "proof") setDock("artifacts");
    else setDock("simulate");
  };

  const goToPhase = (next: Phase) => {
    setPhase(next);
    if (next === "test") {
      if (artifacts.length === 0) generateBundle(graphDoc);
      setDock("artifacts");
      if (proof.tests === "idle") handleProofChecks();
      proofRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    } else if (next === "ship") {
      if (artifacts.length === 0) generateBundle(graphDoc);
      setDock("artifacts");
    } else {
      setDock("simulate");
      setActiveInspector("condition");
      controlsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  };

  const generateBundle = (sourceDoc: StrategyDocument) => {
    startTransition(async () => {
      const res = await generateFromDsl(JSON.stringify(sourceDoc));
      if (!res.ok) {
        setError(
          `Bundle generation failed. ${res.error ?? "Check DSL validation and try again."}`,
        );
        return;
      }
      setArtifacts(res.artifacts ?? []);
      setError(null);
    });
  };

  const handleGenerate = () => {
    generateBundle(graphDoc);
    setPhase("test");
    setDock("artifacts");
  };

  const handleProofChecks = () => {
    setProof({ tests: "running", fuzz: "running", gas: "running" });
    startTransition(async () => {
      const result: ProofCheckResult = await runProofChecks();
      setProof({
        tests: result.tests,
        fuzz: result.fuzz,
        gas: result.gas,
        output: result.output,
        evidence: parseProofEvidence(result.output),
      });
      setLastProofRunAt(Date.now());
    });
  };

  const handleGateFix = (gateId: ReadinessGateId) => {
    const item = readiness.find((g) => g.id === gateId);
    if (!item) return;
    switch (item.fixTarget) {
      case "template":
        goToPhase("build");
        setActiveInspector("condition");
        break;
      case "order":
        goToPhase("build");
        setActiveInspector("intent");
        break;
      case "simulate":
        goToPhase("test");
        setDock("simulate");
        break;
      case "generate":
        goToPhase("test");
        setDock("artifacts");
        break;
      case "prove":
        goToPhase("test");
        if (proof.tests === "idle") handleProofChecks();
        break;
      case "review":
        goToPhase("ship");
        if (readinessRef.current) readinessRef.current.open = true;
        break;
    }
  };

  const handleConnectWallet = async () => {
    const address = await connectMakerAddress();
    if (!address) {
      setError("No wallet found. Paste maker address under Order details.");
      return;
    }
    updateDoc((c) => ({
      ...c,
      order: { ...c.order, maker: address as `0x${string}` },
    }));
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadBundle = () => {
    if (artifacts.length === 0) return;
    try {
      const files: Record<string, Uint8Array> = {};
      for (const a of artifacts) {
        files[a.path] = strToU8(a.content);
      }
      const zipped = zipSync(files);
      triggerDownload(
        new Blob([zipped], { type: "application/zip" }),
        `${doc.templateId}-strategy-bundle.zip`,
      );
    } catch (e) {
      setError(
        `Bundle export failed. ${e instanceof Error ? e.message : "Could not build the zip."}`,
      );
    }
  };

  const downloadManifest = () => {
    const m = artifacts.find((a) => a.path === "manifest.json");
    if (!m) return;
    triggerDownload(
      new Blob([m.content], { type: "application/json" }),
      "manifest.json",
    );
  };

  const runDemoMode = () => {
    const demo = PORTFOLIO_EXAMPLES[0];
    if (!demo) return;
    loadExample(demo);
    setReviewed({
      extensionHash: true,
      bytecodeHash: true,
      explicitConfirm: false,
    });
    generateBundle(attachGraph(demo.doc, demo.addons));
    setOnboardingOpen(false);
    setPhase("test");
    setDock("simulate");
  };

  if (!hydrated) {
    return <div className="workstation loading-shell">Loading strategy…</div>;
  }

  const statusKind: "ready" | "blocked" | "draft" = mainnetReady
    ? "ready"
    : warnings.length > 0
      ? "blocked"
      : "draft";
  const statusLabel =
    statusKind === "ready"
      ? "Ready"
      : statusKind === "blocked"
        ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
        : "Draft";

  const primaryAction = primaryActionForPhase(phase, {
    artifactsReady: artifacts.length > 0,
    proofGreen,
    onGenerate: handleGenerate,
    onProve: handleProofChecks,
    onAdvance: () => goToPhase(nextPhase(phase)),
  });

  return (
    <div className="workstation">
      <OnboardingOverlay
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onRunDemo={runDemoMode}
      />

      <header className="topbar">
        <div className="topbar-identity">
          <span className="eyebrow">LOP Strategy</span>
          <h1>{doc.name}</h1>
        </div>
        <div className="topbar-status">
          <StatusPill kind={statusKind} label={statusLabel} />
          <span className="topbar-meta">
            chain {doc.network.chainId} ·{" "}
            {selectedTemplate?.maturity ?? "draft"}
          </span>
        </div>
        <div className="topbar-actions">
          <div className="ui-mode-switcher" role="group" aria-label="UI Mode">
            {(["simple", "standard", "advanced"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={`mode-btn ${uiMode === mode ? "active" : ""}`}
                onClick={() => setUiMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="ghost-button" onClick={runDemoMode}>
            Run demo
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={primaryAction.onClick}
            disabled={pending || primaryAction.disabled}
          >
            {primaryAction.label}
          </button>
        </div>
      </header>

      <output className="topline-summary">{summary}</output>

      <PhaseRail current={phase} onSelect={goToPhase} />

      <div className={`composer-grid mode-${uiMode} phase-${phase}`}>
        <section ref={controlsRef} className="panel controls-panel">
          <PanelHeading
            title="Strategy"
            hint={selectedTemplate?.maturity ?? "draft"}
          />
          <Disclosure title="Template" defaultOpen meta={doc.templateId}>
            <TemplateGallery value={doc.templateId} onChange={selectTemplate} />
          </Disclosure>
          <Disclosure
            title="Condition"
            defaultOpen
            meta={summarizeCondition(doc)}
            active={
              activeInspector === "condition" || activeInspector === "guard"
            }
          >
            <TemplateControls doc={doc} updateDoc={updateDoc} />
            <AddonControls addons={addons} setAddons={setAddons} />
          </Disclosure>
          <Disclosure
            title="Order"
            meta={`${shortAddress(doc.order.makerAsset)} → ${shortAddress(doc.order.takerAsset)}`}
            active={activeInspector === "intent"}
            defaultOpen={phase === "ship"}
          >
            <OrderDetailsForm
              doc={doc}
              updateDoc={updateDoc}
              onConnectWallet={handleConnectWallet}
            />
          </Disclosure>
          <Disclosure title="Demos" meta={`${PORTFOLIO_EXAMPLES.length}`}>
            <ExampleGallery onLoad={loadExample} />
          </Disclosure>
        </section>

        <section className="panel canvas-panel">
          <div className="canvas-header">
            <PanelHeading title="Strategy graph" hint="Visual order logic" />
            <button
              type="button"
              className="ghost-button ghost-button--sm"
              onClick={downloadBundle}
              disabled={artifacts.length === 0}
            >
              Download bundle
            </button>
          </div>
          <div className="canvas-stage">
            <StrategyCanvas
              doc={doc}
              addons={addons}
              extensionHash={preview?.hash ?? "pending"}
              warnings={warnings}
              onTemplateSelect={selectTemplate}
              onInspect={handleCanvasInspect}
              onCanvasDrop={handleCanvasDrop}
              onRunDemo={runDemoMode}
            />
          </div>
          <DockTabs active={dock} onChange={setDock} />
          <div className="dock-content">
            {dock === "simulate" && (
              <SimulationPanel
                doc={doc}
                addons={addons}
                input={simulationInput}
                setInput={setSimulationInput}
                simulation={simulation}
                timeline={timeline}
                predicatePreview={predicatePreview}
                uiMode={uiMode}
              />
            )}
            {dock === "extension" && (
              <ExtensionPreview
                preview={preview}
                salt={salt}
                addons={addons}
                doc={graphDoc}
              />
            )}
            {dock === "artifacts" && <ArtifactDrawer artifacts={artifacts} />}
          </div>
        </section>

        <aside ref={proofRef} className="panel proof-panel">
          <PreflightPanel
            phase={phase}
            mainnetReady={mainnetReady}
            proof={proof}
            maturity={selectedTemplate?.maturity ?? "draft"}
            readiness={readiness}
            lastProofRunAt={lastProofRunAt}
            pending={pending}
            artifactsReady={artifacts.length > 0}
            reviewed={reviewed}
            setReviewed={setReviewed}
            readinessRef={readinessRef}
            review={review}
            graphDocJson={JSON.stringify(graphDoc)}
            warnings={warnings}
            artifactsCount={artifacts.length}
            lopVerified={lopVerified}
            saltMatched={saltMatched}
            extensionHash={preview?.hash ?? "pending"}
            bytecodeHash={preview?.bytecodeHash ?? null}
            makerTraits={makerTraitsLabel(extension !== "0x")}
            uiMode={uiMode}
            onRunChecks={handleProofChecks}
            onGenerate={handleGenerate}
            onExport={() => goToPhase("ship")}
            onDeploy={() => goToPhase("ship")}
            onGateFix={handleGateFix}
          />
        </aside>
      </div>

      {phase === "ship" && (
        <section className="panel ship-panel">
          <div className="ship-grid">
            <div>
              <PanelHeading title="Export" hint="Testnet artifact pack" />
              <ExportPanel
                artifacts={artifacts}
                extensionHash={preview?.hash ?? "pending"}
                onDownloadBundle={downloadBundle}
                onDownloadManifest={downloadManifest}
              />
            </div>
            <div>
              <PanelHeading title="Deploy" hint="Foundry script handoff" />
              <DeployStepPanel
                templateId={doc.templateId}
                proofGreen={proofGreen}
                artifactsReady={artifacts.length > 0}
              />
            </div>
          </div>
        </section>
      )}

      {proof.output && (
        <details className="proof-output">
          <summary>Forge output</summary>
          <pre>{proof.output}</pre>
        </details>
      )}

      {error && (
        <div className="error-banner">
          <strong>{error.split(". ")[0]}</strong>
          <span>{error.split(". ").slice(1).join(". ")}</span>
        </div>
      )}
    </div>
  );
}

interface PortfolioExample {
  id: string;
  title: string;
  description: string;
  doc: StrategyDocument;
  addons: StrategyAddonState;
  simulation: SimulationInput;
}

const PORTFOLIO_EXAMPLES: PortfolioExample[] = [
  {
    id: "gas-safe-stop-loss",
    title: "Gas-safe stop-loss",
    description: "Oracle floor + gas cap. The flagship demo.",
    doc: {
      ...defaultDocument("stop-loss"),
      name: "Gas-safe ETH stop-loss",
      block: {
        type: "stop-loss",
        oracle: "0x5555555555555555555555555555555555555555",
        threshold: "75000000000",
        direction: "below",
        staleAfter: 3600,
        decimals: 8,
      },
    },
    addons: { gasGuard: { enabled: true, maxGwei: 25 } },
    simulation: {
      ...DEFAULT_SIMULATION,
      oraclePrice: "72000000000",
      baseFeeGwei: "18",
    },
  },
  {
    id: "hourly-twap",
    title: "Hourly TWAP",
    description: "Partial fills capped by time windows.",
    doc: defaultDocument("twap-slice"),
    addons: DEFAULT_ADDONS,
    simulation: {
      ...DEFAULT_SIMULATION,
      timestamp: "7200",
      requestedMaking: "1000000000000000000",
    },
  },
  {
    id: "weekly-dca",
    title: "Weekly DCA",
    description: "Four tranche order series with keeper assumptions.",
    doc: defaultDocument("dca-schedule"),
    addons: DEFAULT_ADDONS,
    simulation: { ...DEFAULT_SIMULATION, trancheIndex: "2" },
  },
];

function nextPhase(phase: Phase): Phase {
  if (phase === "build") return "test";
  if (phase === "test") return "ship";
  return "ship";
}

function phaseFromLegacyStep(step: string): Phase {
  if (step === "export" || step === "deploy") return "ship";
  if (
    step === "simulate" ||
    step === "generate" ||
    step === "prove" ||
    step === "review"
  ) {
    return "test";
  }
  return "build";
}

function legacyStepFromPhase(phase: Phase): "sketch" | "simulate" | "export" {
  if (phase === "build") return "sketch";
  if (phase === "test") return "simulate";
  return "export";
}

function primaryActionForPhase(
  phase: Phase,
  ctx: {
    artifactsReady: boolean;
    proofGreen: boolean;
    onGenerate: () => void;
    onProve: () => void;
    onAdvance: () => void;
  },
): { label: string; onClick: () => void; disabled?: boolean } {
  if (phase === "build") {
    return { label: "Continue to Test", onClick: ctx.onAdvance };
  }
  if (phase === "test") {
    if (!ctx.artifactsReady) {
      return { label: "Generate bundle", onClick: ctx.onGenerate };
    }
    if (!ctx.proofGreen) {
      return { label: "Run checks", onClick: ctx.onProve };
    }
    return { label: "Continue to Ship", onClick: ctx.onAdvance };
  }
  return { label: "Open export pack", onClick: ctx.onAdvance };
}

function formatError(scope: string, error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Check the current strategy inputs.";
  return `${scope}. ${message}`;
}

function PhaseRail({
  current,
  onSelect,
}: {
  current: Phase;
  onSelect: (phase: Phase) => void;
}) {
  const currentIndex = PHASES.findIndex((p) => p.id === current);
  return (
    <nav className="phase-rail" aria-label="Workflow phase">
      {PHASES.map((p, index) => {
        const state =
          index < currentIndex
            ? "done"
            : index === currentIndex
              ? "current"
              : "upcoming";
        return (
          <button
            type="button"
            key={p.id}
            className={`phase-step ${state}`}
            onClick={() => onSelect(p.id)}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="phase-index">{index + 1}</span>
            <span className="phase-copy">
              <strong>{p.label}</strong>
              <small>{p.summary}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function StatusPill({
  kind,
  label,
}: {
  kind: "ready" | "blocked" | "draft";
  label: string;
}) {
  return (
    <span className={`status-pill status-pill--${kind}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function PanelHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      {hint && <span className="panel-hint">{hint}</span>}
    </div>
  );
}

function Disclosure({
  title,
  meta,
  defaultOpen = false,
  active = false,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className={`disclosure ${active ? "active" : ""}`}
      open={defaultOpen || active}
    >
      <summary>
        <span>{title}</span>
        {meta && <small>{meta}</small>}
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

function DockTabs({
  active,
  onChange,
}: {
  active: Dock;
  onChange: (tab: Dock) => void;
}) {
  return (
    <div className="dock-tabs" role="tablist" aria-label="Inspector">
      {(
        [
          ["simulate", "Simulation"],
          ["extension", "Extension"],
          ["artifacts", "Artifacts"],
        ] as const
      ).map(([tab, label]) => (
        <button
          type="button"
          key={tab}
          className={active === tab ? "active" : ""}
          onClick={() => onChange(tab)}
          role="tab"
          aria-selected={active === tab}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ExampleGallery({
  onLoad,
}: {
  onLoad: (example: PortfolioExample) => void;
}) {
  return (
    <div className="example-gallery">
      {PORTFOLIO_EXAMPLES.map((example) => (
        <button
          type="button"
          key={example.title}
          onClick={() => onLoad(example)}
        >
          <span>{example.title}</span>
          <small>{example.description}</small>
        </button>
      ))}
    </div>
  );
}

function OrderDetailsForm({
  doc,
  updateDoc,
  onConnectWallet,
}: {
  doc: StrategyDocument;
  updateDoc: (mutator: (current: StrategyDocument) => StrategyDocument) => void;
  onConnectWallet?: () => void;
}) {
  return (
    <div className="form-grid">
      {onConnectWallet && (
        <button
          type="button"
          className="ghost-button ghost-button--sm wallet-connect"
          onClick={onConnectWallet}
        >
          Connect wallet
        </button>
      )}
      <TextField
        label="Strategy name"
        value={doc.name}
        onChange={(name) => updateDoc((c) => ({ ...c, name }))}
      />
      <NumberField
        label="Chain ID"
        value={doc.network.chainId}
        onChange={(chainId) =>
          updateDoc((c) => ({
            ...c,
            network: { ...c.network, chainId },
          }))
        }
      />
      <TextField
        label="LOP address"
        value={doc.network.lopAddress}
        onChange={(lopAddress) =>
          updateDoc((c) => ({
            ...c,
            network: { ...c.network, lopAddress },
          }))
        }
      />
      <TextField
        label="Maker"
        value={doc.order.maker}
        onChange={(maker) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, maker },
          }))
        }
      />
      <TextField
        label="Maker asset"
        value={doc.order.makerAsset}
        onChange={(makerAsset) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, makerAsset },
          }))
        }
      />
      <TextField
        label="Taker asset"
        value={doc.order.takerAsset}
        onChange={(takerAsset) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, takerAsset },
          }))
        }
      />
      <TextField
        label="Making amount"
        value={doc.order.makingAmount}
        onChange={(makingAmount) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, makingAmount },
          }))
        }
      />
      <TextField
        label="Taking amount"
        value={doc.order.takingAmount}
        onChange={(takingAmount) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, takingAmount },
          }))
        }
      />
      <TextField
        label="Nonce"
        value={doc.order.nonce ?? "0"}
        onChange={(nonce) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, nonce },
          }))
        }
      />
      <TextField
        label="Series"
        value={doc.order.series ?? "0"}
        onChange={(series) =>
          updateDoc((c) => ({
            ...c,
            order: { ...c.order, series },
          }))
        }
      />
      <div className="toggle-group col-span-2">
        <ToggleField
          label="Allow partial fills"
          checked={doc.order.allowPartialFills ?? true}
          onChange={(allowPartialFills) =>
            updateDoc((c) => ({
              ...c,
              order: { ...c.order, allowPartialFills },
            }))
          }
        />
        <ToggleField
          label="Allow multiple fills"
          checked={doc.order.allowMultipleFills ?? true}
          onChange={(allowMultipleFills) =>
            updateDoc((c) => ({
              ...c,
              order: { ...c.order, allowMultipleFills },
            }))
          }
        />
        <ToggleField
          label="Use Permit2"
          checked={doc.order.usePermit2 ?? false}
          onChange={(usePermit2) =>
            updateDoc((c) => ({
              ...c,
              order: { ...c.order, usePermit2 },
            }))
          }
        />
        <ToggleField
          label="Unwrap WETH"
          checked={doc.order.unwrapWeth ?? false}
          onChange={(unwrapWeth) =>
            updateDoc((c) => ({
              ...c,
              order: { ...c.order, unwrapWeth },
            }))
          }
        />
      </div>
    </div>
  );
}

function AddonControls({
  addons,
  setAddons,
}: {
  addons: StrategyAddonState;
  setAddons: (addons: StrategyAddonState) => void;
}) {
  return (
    <div className="addon-block">
      <ToggleField
        label="Gas guard"
        checked={addons.gasGuard.enabled}
        onChange={(enabled) =>
          setAddons({ ...addons, gasGuard: { ...addons.gasGuard, enabled } })
        }
      />
      {addons.gasGuard.enabled && (
        <GasPresetField
          maxGwei={addons.gasGuard.maxGwei}
          onChange={(maxGwei) =>
            setAddons({ ...addons, gasGuard: { enabled: true, maxGwei } })
          }
        />
      )}
    </div>
  );
}

function TemplateControls({
  doc,
  updateDoc,
}: {
  doc: StrategyDocument;
  updateDoc: (mutator: (current: StrategyDocument) => StrategyDocument) => void;
}) {
  if (doc.block.type === "gas-guard") {
    return (
      <div className="addon-block">
        <RangeNumberField
          label="Max base fee (gwei)"
          value={doc.block.maxGwei}
          min={5}
          max={120}
          step={1}
          onChange={(maxGwei) =>
            updateDoc((c) => ({ ...c, block: { type: "gas-guard", maxGwei } }))
          }
        />
      </div>
    );
  }

  if (doc.block.type === "stop-loss") {
    return (
      <div className="addon-block">
        <HumanThresholdField
          threshold={doc.block.threshold}
          direction={doc.block.direction}
          onThresholdChange={(threshold) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, threshold } }))
          }
          onDirectionChange={(direction) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, direction } }))
          }
        />
        <TextField
          label="Oracle"
          value={doc.block.oracle}
          onChange={(oracle) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, oracle } }))
          }
        />
        <NumberField
          label="Heartbeat (staleAfter, seconds)"
          value={doc.block.staleAfter}
          onChange={(staleAfter) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, staleAfter } }))
          }
        />
        <NumberField
          label="Feed decimals"
          value={doc.block.decimals}
          onChange={(decimals) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, decimals } }))
          }
        />
      </div>
    );
  }

  if (doc.block.type === "twap-slice") {
    return (
      <div className="addon-block">
        <TextField
          label="Total amount"
          value={doc.block.totalAmount}
          onChange={(totalAmount) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, totalAmount } }))
          }
        />
        <TextField
          label="Slice amount"
          value={doc.block.sliceAmount}
          onChange={(sliceAmount) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, sliceAmount } }))
          }
        />
        <NumberField
          label="Interval seconds"
          value={doc.block.intervalSeconds}
          onChange={(intervalSeconds) =>
            updateDoc((c) => ({
              ...c,
              block: { ...doc.block, intervalSeconds },
            }))
          }
        />
        <NumberField
          label="Start time"
          value={doc.block.startTime}
          onChange={(startTime) =>
            updateDoc((c) => ({ ...c, block: { ...doc.block, startTime } }))
          }
        />
        <ToggleField
          label="Allow multiple fills"
          checked={doc.order.allowMultipleFills}
          onChange={(allowMultipleFills) =>
            updateDoc((c) => ({
              ...c,
              order: {
                ...c.order,
                allowPartialFills: true,
                allowMultipleFills,
              },
            }))
          }
        />
      </div>
    );
  }

  return (
    <div className="addon-block">
      <NumberField
        label="Tranches"
        value={doc.block.tranches}
        onChange={(tranches) =>
          updateDoc((c) => ({ ...c, block: { ...doc.block, tranches } }))
        }
      />
      <TextField
        label="Amount per tranche"
        value={doc.block.amountPerTranche}
        onChange={(amountPerTranche) =>
          updateDoc((c) => ({
            ...c,
            block: { ...doc.block, amountPerTranche },
          }))
        }
      />
      <NumberField
        label="Interval seconds"
        value={doc.block.intervalSeconds}
        onChange={(intervalSeconds) =>
          updateDoc((c) => ({
            ...c,
            block: { ...doc.block, intervalSeconds },
          }))
        }
      />
      <NumberField
        label="Series ID"
        value={doc.block.seriesId}
        onChange={(seriesId) =>
          updateDoc((c) => ({ ...c, block: { ...doc.block, seriesId } }))
        }
      />
    </div>
  );
}

function ExtensionPreview({
  preview,
  salt,
  addons,
  doc,
}: {
  preview: PreviewState | null;
  salt: string;
  addons: StrategyAddonState;
  doc: StrategyDocument;
}) {
  if (!preview) {
    return (
      <p className="empty-state">
        Preview pending. Adjust the strategy to regenerate.
      </p>
    );
  }
  return (
    <div className="extension-preview">
      <HashLine label="extension hash" value={preview.hash} />
      <HashLine label="salt" value={salt} />
      <HashLine label="calldata bytes" value={String(preview.calldataLength)} />
      {doc.graph?.compiledPredicate && (
        <div className="hash-line">
          <span>compiled predicate</span>
          <code>
            {doc.graph.compiledPredicate.mode} /{" "}
            {doc.graph.compiledPredicate.rootNodeIds.join(" + ")}
          </code>
        </div>
      )}
      <ul className="preview-tree">
        {addons.gasGuard.enabled && doc.templateId !== "gas-guard" && (
          <li>Composed guard: basefee ≤ {addons.gasGuard.maxGwei} gwei</li>
        )}
        {preview.tree.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function ArtifactDrawer({
  artifacts,
}: {
  artifacts: { path: string; content: string }[];
}) {
  const preferred = artifacts.find((a) => a.path === "manifest.json");
  const [activePath, setActivePath] = useState(
    preferred?.path ?? artifacts[0]?.path ?? "",
  );
  const [expanded, setExpanded] = useState(false);
  const manifest = artifacts.find((a) => a.path === "manifest.json");
  const manifestSummary = manifest
    ? parseManifestSummary(manifest.content)
    : null;
  const fingerprint = artifactFingerprint(artifacts);
  const activeArtifact =
    artifacts.find((a) => a.path === activePath) ?? preferred ?? artifacts[0];

  if (artifacts.length === 0) {
    return (
      <p className="empty-state">
        Run Generate to produce the deployable bundle.
      </p>
    );
  }

  const PREVIEW_LIMIT = 600;
  const previewContent = activeArtifact?.content ?? "";
  const truncated = previewContent.length > PREVIEW_LIMIT;

  return (
    <div className="artifact-drawer">
      <div className="drawer-row">
        <span>bundle fingerprint</span>
        <code>{fingerprint}</code>
      </div>
      {manifestSummary && (
        <div className="evidence-grid">
          <Evidence
            label="dsl hash"
            value={shortHash(manifestSummary.dslHash)}
          />
          <Evidence label="template" value={manifestSummary.template} />
          <Evidence label="predicate" value={manifestSummary.predicate} />
          <Evidence
            label="ext hash"
            value={shortHash(manifestSummary.extensionHash)}
          />
          <Evidence
            label="bytecode hash"
            value={shortHash(manifestSummary.bytecodeHash)}
          />
          <Evidence label="audit" value={manifestSummary.audit} />
          <Evidence label="lop" value={manifestSummary.lop} />
        </div>
      )}
      <div className="artifact-tabs" role="tablist">
        {artifacts.map((a) => (
          <button
            type="button"
            key={a.path}
            className={activeArtifact?.path === a.path ? "active" : ""}
            onClick={() => {
              setActivePath(a.path);
              setExpanded(false);
            }}
          >
            <span>{artifactLabel(a.path)}</span>
            <small>{a.content.length}b</small>
          </button>
        ))}
      </div>
      {activeArtifact && (
        <>
          <pre className="manifest-preview">
            {expanded || !truncated
              ? previewContent
              : `${previewContent.slice(0, PREVIEW_LIMIT)}…`}
          </pre>
          {truncated && (
            <button
              type="button"
              className="ghost-button ghost-button--sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? "Collapse"
                : `Show full file (${previewContent.length}b)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function parseManifestSummary(content: string): {
  dslHash: string;
  template: string;
  predicate: string;
  extensionHash: string;
  bytecodeHash: string;
  audit: string;
  lop: string;
} | null {
  try {
    const parsed = JSON.parse(content) as {
      dslHash?: string;
      extensionHash?: string;
      bytecodeHash?: string | null;
      template?: { id?: string; maturity?: string };
      compiledPredicateTree?: { mode?: string; nodes?: unknown[] };
      lop?: { version?: string; chainId?: number };
      audit?: {
        auditor?: string;
        reportUrl?: string;
        commitHash?: string;
        date?: string;
      } | null;
    };
    const audit = parsed.audit;
    return {
      dslHash: parsed.dslHash ?? "missing",
      template: `${parsed.template?.id ?? "unknown"} / ${parsed.template?.maturity ?? "draft"}`,
      predicate: `${parsed.compiledPredicateTree?.mode ?? "none"} / ${parsed.compiledPredicateTree?.nodes?.length ?? 0} node(s)`,
      extensionHash: parsed.extensionHash ?? "missing",
      bytecodeHash: parsed.bytecodeHash ?? "missing",
      audit: audit
        ? `${audit.auditor ?? "?"} · ${audit.date ?? "?"} · ${audit.commitHash?.slice(0, 8) ?? "?"}`
        : "none",
      lop: `${parsed.lop?.version ?? "unknown"} / ${parsed.lop?.chainId ?? "?"}`,
    };
  } catch {
    return null;
  }
}

function artifactFingerprint(
  artifacts: { path: string; content: string }[],
): string {
  let hash = 2166136261;
  const text = artifacts.map((a) => `${a.path}:${a.content}`).join("\n");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `lop-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function shortHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function shortAddress(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function artifactLabel(path: string): string {
  if (path === "manifest.json") return "Manifest";
  if (/test/i.test(path)) return "Tests";
  if (/deploy|script/i.test(path)) return "Deploy";
  if (/readme/i.test(path)) return "README";
  if (/\.sol$/i.test(path)) return "Strategy.sol";
  return path.split("/").at(-1) ?? path;
}

function summarizeCondition(doc: StrategyDocument): string {
  switch (doc.block.type) {
    case "gas-guard":
      return `≤ ${doc.block.maxGwei} gwei`;
    case "stop-loss":
      return `${doc.block.direction} ${shortHash(doc.block.threshold)}`;
    case "twap-slice":
      return `slice ${doc.block.sliceAmount}`;
    case "dca-schedule":
      return `${doc.block.tranches} tranches`;
  }
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="evidence">
      <span>{label}</span>
      <b>{value}</b>
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field range-field">
      <span>{label}</span>
      <div className="range-control">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
