"use client";

import type { StrategyAddonState } from "@/lib/strategy-workstation";
import type { StrategyDocument, TemplateId } from "@limit-canvas/hook-dsl";
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type CanvasDropAction =
  | { type: "template"; templateId: TemplateId }
  | { type: "gas-guard-addon" }
  | { type: "demo"; demoId: string };

interface StrategyCanvasProps {
  doc: StrategyDocument;
  addons: StrategyAddonState;
  extensionHash: string;
  warnings: string[];
  onTemplateSelect: (templateId: TemplateId) => void;
  onInspect: (target: CanvasInspectTarget) => void;
  onCanvasDrop: (
    action: CanvasDropAction,
    position: { x: number; y: number },
  ) => void;
  onRunDemo?: () => void;
}

const GRID_SNAP = 24;

interface StrategyNodeData extends Record<string, unknown> {
  title: string;
  eyebrow: string;
  detail: string;
  status: "ready" | "warn" | "blocked";
  issues: string[];
  inspectTarget: CanvasInspectTarget;
}

type StrategyNode = Node<StrategyNodeData, "strategy">;
export type CanvasInspectTarget =
  | "intent"
  | "condition"
  | "guard"
  | "extension"
  | "proof";

const BLOCK_LABELS: Record<TemplateId, string> = {
  "stop-loss": "Oracle trigger",
  "gas-guard": "Gas predicate",
  "twap-slice": "TWAP getter",
  "dca-schedule": "DCA series",
};

export function StrategyCanvas(props: StrategyCanvasProps) {
  return (
    <ReactFlowProvider>
      <StrategyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function StrategyCanvasInner({
  doc,
  addons,
  extensionHash,
  warnings,
  onTemplateSelect,
  onInspect,
  onCanvasDrop,
  onRunDemo,
}: StrategyCanvasProps) {
  const flow = useReactFlow<StrategyNode, Edge>();
  const [isDropHot, setIsDropHot] = useState(false);
  const [dropLabel, setDropLabel] = useState("Drop strategy blocks here");
  const isEmpty =
    doc.order.maker === "0x0000000000000000000000000000000000000000";
  const graph = useMemo(
    () => buildGraph(doc, addons, extensionHash, warnings),
    [doc, addons, extensionHash, warnings],
  );
  const [nodes, setNodes] = useState<StrategyNode[]>(graph.nodes);

  useEffect(() => {
    setNodes((current) => mergeNodePositions(current, graph.nodes));
  }, [graph.nodes]);

  const onNodesChange = useCallback((changes: NodeChange<StrategyNode>[]) => {
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      return next.map((node) => ({
        ...node,
        position: snapPosition(node.position),
      }));
    });
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDropHot(false);

      const action = getDropAction(event.dataTransfer);
      if (!action) return;

      const position = snapPosition(
        flow.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      );
      onCanvasDrop(action, position);
    },
    [flow, onCanvasDrop],
  );

  return (
    <div
      className={`strategy-canvas ${isDropHot ? "drop-hot" : ""}`}
      onDragEnter={(event) => {
        if (!getDropAction(event.dataTransfer)) return;
        setIsDropHot(true);
        setDropLabel(describeDrop(event.dataTransfer));
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(event) => {
        const related = event.relatedTarget;
        if (
          related instanceof HTMLElement &&
          event.currentTarget.contains(related)
        )
          return;
        setIsDropHot(false);
      }}
      onDrop={handleDrop}
    >
      <div className="canvas-drop-hint" aria-hidden="true">
        {dropLabel}
      </div>
      {isEmpty && (
        <CanvasQuickStart
          onPickTemplate={onTemplateSelect}
          onRunDemo={onRunDemo}
        />
      )}
      <ReactFlow
        nodes={nodes}
        edges={graph.edges}
        nodeTypes={{ strategy: StrategyNodeView }}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        snapToGrid
        snapGrid={[GRID_SNAP, GRID_SNAP]}
        panOnScroll
        zoomOnScroll
        panActivationKeyCode="Space"
        defaultEdgeOptions={{ type: "smoothstep" }}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => {
          onInspect(node.data.inspectTarget);
          if (
            node.data.inspectTarget === "condition" &&
            isTemplateId(node.data.templateId)
          ) {
            onTemplateSelect(node.data.templateId);
          }
        }}
      >
        <Background color="#27272a" gap={GRID_SNAP} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          className="strategy-minimap"
          nodeColor={() => "#86868b"}
          maskColor="rgba(0, 0, 0, 0.6)"
          pannable
          zoomable
        />
      </ReactFlow>
      <p className="canvas-keyboard-hint" aria-hidden="true">
        Space + drag to pan · Scroll to zoom
      </p>
    </div>
  );
}

function StrategyNodeView({ data }: NodeProps<StrategyNode>) {
  const isPreviewOnly =
    data.templateId === "twap-slice" || data.templateId === "dca-schedule";

  return (
    <div
      className={`strategy-node ${data.status} ${isPreviewOnly ? "preview-only" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-eyebrow">
        {data.eyebrow} {isPreviewOnly && "· Preview Only"}
      </div>
      <div className="node-title-row">
        <div className="node-title">{data.title}</div>
        <span
          className={`node-badge ${isPreviewOnly ? "preview" : data.status}`}
        >
          {isPreviewOnly
            ? "preview"
            : data.status === "ready"
              ? "ok"
              : data.status}
        </span>
      </div>
      <div className="node-detail">{data.detail}</div>
      {isPreviewOnly ? (
        <div className="node-preview-warning">
          Planning only — no codegen support yet
        </div>
      ) : (
        data.issues.length > 0 && (
          <div className="node-issue">{data.issues[0]}</div>
        )
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function buildGraph(
  doc: StrategyDocument,
  addons: StrategyAddonState,
  extensionHash: string,
  warnings: string[],
): { nodes: StrategyNode[]; edges: Edge[] } {
  const strategyDetail = describeStrategy(doc);
  const warningStatus = warnings.length > 0 ? "warn" : "ready";
  const protocolIssues = warnings.length > 0 ? warnings : [];
  const conditionX = 280;
  const extensionX = 580;
  const proofX = addons.gasGuard.enabled ? 580 : 280;
  const proofY = addons.gasGuard.enabled ? 340 : 280;
  const nodes: StrategyNode[] = [
    {
      id: "order",
      type: "strategy",
      position: { x: 0, y: 160 },
      data: {
        eyebrow: "Order",
        title: "Maker intent",
        detail: `${short(doc.order.makerAsset)} -> ${short(doc.order.takerAsset)}`,
        status: "ready",
        issues: [],
        inspectTarget: "intent",
      },
    },
    {
      id: "condition",
      type: "strategy",
      position: { x: conditionX, y: 40 },
      data: {
        eyebrow: BLOCK_LABELS[doc.templateId],
        title: titleFor(doc.templateId),
        detail: strategyDetail,
        status: warningStatus,
        issues: protocolIssues,
        inspectTarget: "condition",
        templateId: doc.templateId,
      },
    },
    ...(addons.gasGuard.enabled && doc.templateId !== "gas-guard"
      ? [
          {
            id: "gas-guard-addon",
            type: "strategy" as const,
            position: { x: conditionX, y: 280 },
            data: {
              eyebrow: "Gas predicate",
              title: "Gas guard",
              detail: `basefee <= ${addons.gasGuard.maxGwei} gwei`,
              status: "ready" as const,
              issues: [],
              inspectTarget: "guard" as const,
              templateId: "gas-guard",
            },
          },
        ]
      : []),
    {
      id: "extension",
      type: "strategy",
      position: { x: extensionX, y: 160 },
      data: {
        eyebrow: "LOP extension",
        title: "Packed calldata",
        detail:
          extensionHash === "pending"
            ? "waiting for preview"
            : short(extensionHash),
        status: extensionHash === "pending" ? "blocked" : warningStatus,
        issues:
          extensionHash === "pending"
            ? ["preview hash pending"]
            : protocolIssues,
        inspectTarget: "extension",
      },
    },
    {
      id: "proof",
      type: "strategy",
      position: { x: proofX, y: proofY },
      data: {
        eyebrow: "Proof",
        title: "Readiness gate",
        detail:
          warnings.length === 0
            ? "warnings clear"
            : `${warnings.length} warning(s)`,
        status: warningStatus,
        issues: protocolIssues,
        inspectTarget: "proof",
      },
    },
  ];

  const edges: Edge[] = [
    edge("order", "condition", "configure"),
    ...(addons.gasGuard.enabled && doc.templateId !== "gas-guard"
      ? [
          edge("condition", "gas-guard-addon", "and"),
          edge("gas-guard-addon", "extension", "pack"),
        ]
      : [edge("condition", "extension", "pack")]),
    edge("extension", "proof", "verify"),
  ];

  return { nodes, edges };
}

function mergeNodePositions(
  current: StrategyNode[],
  next: StrategyNode[],
): StrategyNode[] {
  const positions = new Map(current.map((node) => [node.id, node.position]));
  return next.map((node) => ({
    ...node,
    position: snapPosition(positions.get(node.id) ?? node.position),
  }));
}

function getDropAction(dataTransfer: DataTransfer): CanvasDropAction | null {
  const encoded = dataTransfer.getData("application/lop-canvas-action");
  if (encoded) {
    try {
      return parseDropAction(JSON.parse(encoded));
    } catch {
      return null;
    }
  }

  const templateId = dataTransfer.getData("application/lop-template");
  if (isTemplateId(templateId)) return { type: "template", templateId };
  return null;
}

function parseDropAction(value: unknown): CanvasDropAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  if (action.type === "template" && isTemplateId(action.templateId)) {
    return { type: "template", templateId: action.templateId };
  }
  if (action.type === "gas-guard-addon") return { type: "gas-guard-addon" };
  if (action.type === "demo" && typeof action.demoId === "string") {
    return { type: "demo", demoId: action.demoId };
  }
  return null;
}

function describeDrop(dataTransfer: DataTransfer): string {
  const action = getDropAction(dataTransfer);
  if (!action) return "Drop strategy blocks here";
  switch (action.type) {
    case "template":
      return `Drop to use ${BLOCK_LABELS[action.templateId]}`;
    case "gas-guard-addon":
      return "Drop to add gas guard";
    case "demo":
      return "Drop to load demo flow";
  }
}

function edge(source: string, target: string, label: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    label,
    animated: true,
    className: "logic-edge",
    style: { stroke: "rgba(255, 255, 255, 0.35)", strokeWidth: 1.5 },
    labelStyle: {
      fill: "var(--ink)",
      fontSize: 10,
      fontWeight: 500,
      fontFamily: "var(--font-mono), monospace",
    },
    labelBgStyle: {
      fill: "var(--canvas-elev)",
      stroke: "var(--hairline-strong)",
      strokeWidth: 1,
      fillOpacity: 1,
    },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 4,
  };
}

function snapPosition(position: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: Math.round(position.x / GRID_SNAP) * GRID_SNAP,
    y: Math.round(position.y / GRID_SNAP) * GRID_SNAP,
  };
}

function CanvasQuickStart({
  onPickTemplate,
  onRunDemo,
}: {
  onPickTemplate: (templateId: TemplateId) => void;
  onRunDemo?: () => void;
}) {
  return (
    <div
      className="canvas-quick-start"
      role="region"
      aria-label="Canvas quick start"
    >
      <div className="canvas-quick-start-art" aria-hidden="true">
        <svg
          viewBox="0 0 120 80"
          width="120"
          height="80"
          aria-hidden="true"
          role="img"
        >
          <title>Canvas illustration</title>
          <rect
            x="4"
            y="28"
            width="32"
            height="24"
            rx="4"
            fill="none"
            stroke="currentColor"
          />
          <rect
            x="44"
            y="16"
            width="32"
            height="24"
            rx="4"
            fill="none"
            stroke="currentColor"
          />
          <rect
            x="84"
            y="28"
            width="32"
            height="24"
            rx="4"
            fill="none"
            stroke="currentColor"
          />
          <path
            d="M36 40 H44 M76 28 V40 H84"
            stroke="currentColor"
            fill="none"
          />
        </svg>
      </div>
      <strong>Build your order logic</strong>
      <p>
        Pick a template or run the portfolio demo. Blocks snap to the grid as
        you arrange them.
      </p>
      <div className="canvas-quick-start-actions">
        <button type="button" onClick={() => onPickTemplate("stop-loss")}>
          Stop-loss
        </button>
        <button type="button" onClick={() => onPickTemplate("gas-guard")}>
          Gas guard
        </button>
        {onRunDemo && (
          <button
            type="button"
            className="secondary-button"
            onClick={onRunDemo}
          >
            Run demo flow
          </button>
        )}
      </div>
    </div>
  );
}

function titleFor(templateId: TemplateId): string {
  switch (templateId) {
    case "stop-loss":
      return "Price condition";
    case "gas-guard":
      return "Gas cap";
    case "twap-slice":
      return "Time slice";
    case "dca-schedule":
      return "Tranche series";
  }
}

function describeStrategy(doc: StrategyDocument): string {
  switch (doc.block.type) {
    case "gas-guard":
      return `basefee <= ${doc.block.maxGwei} gwei`;
    case "stop-loss":
      return `${doc.block.direction} ${doc.block.threshold}`;
    case "twap-slice":
      return `${doc.block.sliceAmount} every ${doc.block.intervalSeconds}s`;
    case "dca-schedule":
      return `${doc.block.tranches} x ${doc.block.amountPerTranche}`;
  }
}

function short(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function isTemplateId(value: string | unknown): value is TemplateId {
  return (
    value === "stop-loss" ||
    value === "gas-guard" ||
    value === "twap-slice" ||
    value === "dca-schedule"
  );
}
