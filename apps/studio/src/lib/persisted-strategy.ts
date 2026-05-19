import type { SimulationInput, StrategyAddonState } from "@/lib/strategy-workstation";
import type { StrategyDocument, TemplateId } from "@limit-canvas/hook-dsl";
import type { UiMode, WorkflowStepId } from "@/lib/composer-types";

const STORAGE_KEY = "limit-canvas.composer.v1";

export interface PersistedComposerState {
  version: 1;
  doc: StrategyDocument;
  addons: StrategyAddonState;
  simulationInput: SimulationInput;
  copilotPrompt: string;
  uiMode: UiMode;
  workflowStep: WorkflowStepId;
  onboardingDone: boolean;
}

export function loadPersistedState(): PersistedComposerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedComposerState;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedComposerState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota or private mode — ignore
  }
}

export function clearPersistedState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
