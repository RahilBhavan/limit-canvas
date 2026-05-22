import type { UiMode, WorkflowStepId } from "@/lib/composer-types";
import type {
  SimulationInput,
  StrategyAddonState,
} from "@/lib/strategy-workstation";
import {
  DSL_VERSION,
  type StrategyDocument,
  strategyDocumentSchema,
} from "@limit-canvas/hook-dsl";

const STORAGE_KEY = "limit-canvas.composer.v1";

/** Persist-envelope shape version — bump only when these wrapper fields change. */
const ENVELOPE_VERSION = 1 as const;

export interface PersistedComposerState {
  version: typeof ENVELOPE_VERSION;
  /** DSL schema version the saved `doc` was written against. */
  dslVersion: string;
  doc: StrategyDocument;
  addons: StrategyAddonState;
  simulationInput: SimulationInput;
  copilotPrompt: string;
  uiMode: UiMode;
  workflowStep: WorkflowStepId;
  onboardingDone: boolean;
}

/** What a caller supplies — envelope/DSL versions are stamped on save. */
export type ComposerStatePayload = Omit<
  PersistedComposerState,
  "version" | "dslVersion"
>;

/**
 * Result of reading persisted state. `incompatible` means a strategy was
 * saved but no longer parses against the current DSL schema — the caller
 * should fall back to defaults *and* tell the user, rather than silently
 * dropping their work.
 */
export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; state: PersistedComposerState }
  | { status: "incompatible"; savedDslVersion: string | null };

export function loadPersistedState(): LoadResult {
  if (typeof window === "undefined") return { status: "empty" };

  let parsed: Partial<PersistedComposerState>;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "empty" };
    parsed = JSON.parse(raw) as Partial<PersistedComposerState>;
  } catch {
    return { status: "empty" };
  }

  // Old persist-envelope shape — the wrapper fields can't be trusted.
  if (parsed.version !== ENVELOPE_VERSION) {
    return {
      status: "incompatible",
      savedDslVersion: parsed.dslVersion ?? null,
    };
  }

  // Validate the saved strategy against the *current* DSL schema. A schema
  // bump (DSL_VERSION change, new required field, tighter refinement) makes
  // this fail loudly instead of feeding a stale document into the wizard.
  const result = strategyDocumentSchema.safeParse(parsed.doc);
  if (!result.success) {
    return {
      status: "incompatible",
      savedDslVersion: parsed.dslVersion ?? null,
    };
  }

  return {
    status: "ok",
    state: { ...(parsed as PersistedComposerState), doc: result.data },
  };
}

export function savePersistedState(payload: ComposerStatePayload): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: PersistedComposerState = {
      version: ENVELOPE_VERSION,
      dslVersion: DSL_VERSION,
      ...payload,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // quota or private mode — ignore
  }
}

export function clearPersistedState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
