# `apps/studio` (Next.js wizard)

The **user-facing surface**. A Next.js 15 App Router app that lets a maker (or partner engineer) compose an LOP extension strategy through a 3-phase wizard, simulate fills, generate Solidity artifacts, run Foundry proof checks, and produce a testnet/mainnet deploy handoff.

Everything in this app is a thin shell over the protocol-correctness layer in `@limit-canvas/lop-sdk`. If the wizard claims a strategy is "ready," the underlying claim comes from those packages — not from the UI.

---

## At a glance

| | |
|---|---|
| **Framework** | Next.js `15.x` (App Router, RSC + client components) |
| **Runtime** | Bun (dev/build); Node compatible at runtime |
| **Styling** | Tailwind CSS 4 + a hand-authored design system in `src/app/globals.css` |
| **State** | React state + `localStorage` (`persisted-strategy.ts`) |
| **Visual graph** | `@xyflow/react` (React Flow) |
| **LLM (optional)** | `@ai-sdk/openai` if `OPENAI_API_KEY` is set; rules-based fallback otherwise |
| **Server actions** | Run `forge` via `child_process.exec` (`runProofChecks`) |
| **Dev** | `cd apps/studio && bun run dev` (port 3000) |
| **Routes** | `/` (compose), `/test` (verify), `/deploy` (redirects with `?phase=ship`) |

---

## What the UI is for

In one sentence: **the user composes a strategy in the canvas, the wizard packs it through `lop-sdk` + `codegen`, runs `forge test` via a server action, and emits a deploy handoff.** Nothing the user types reaches Solidity without going through the DSL parser and the predicate builders first.

The wizard has three phases, exposed both in the URL (`/?phase=build|test|ship`) and in the top-of-page rail:

| Phase | What happens | Primary CTA |
|---|---|---|
| **Build** | Pick a template, edit condition + order, optionally enable gas guard, drag on canvas | "Continue to Test" |
| **Test** | Simulate fill scenarios, generate the artifact bundle, run Foundry checks | "Generate bundle" → "Run checks" → "Continue to Ship" |
| **Ship** | Review readiness gates, copy the extension hash, download bundle, follow deploy CLI | "Open export pack" |

---

## File layout

```
apps/studio/
├── src/
│   ├── app/                              ← Next.js routes
│   │   ├── layout.tsx                    ← Header nav, brand mark, version tag
│   │   ├── globals.css                   ← Design system (dark-lab tokens, components)
│   │   ├── page.tsx                      ← Compose entry; parses ?template, ?phase
│   │   ├── actions.ts                    ← Server actions: generateFromDsl, previewExtension, runProofChecks
│   │   ├── test/page.tsx                 ← /test — one-shot forge test runner with status pill
│   │   ├── test-actions.ts               ← runContractTests() server action
│   │   ├── deploy/page.tsx               ← /deploy — redirects to /?phase=ship
│   │   ├── deploy/deploy-form.tsx        ← Legacy form (not currently routed)
│   │   └── api/assist/route.ts           ← POST /api/assist — LLM or rules-based copilot
│   ├── components/                       ← UI (all "use client")
│   │   ├── compose-wizard.tsx            ← The shell: phases, state, layout
│   │   ├── strategy-canvas.tsx           ← React Flow canvas + drop zones + node renderer
│   │   ├── preflight-panel.tsx           ← Right-side readiness column
│   │   ├── simulation-panel.tsx          ← Outcome card + scenario presets + timeline
│   │   ├── template-gallery.tsx          ← 4 template cards (Ready / Preview badges)
│   │   ├── export-panel.tsx              ← Ship phase: download .txt bundle + manifest.json
│   │   ├── deploy-step-panel.tsx         ← Ship phase: forge script CLI handoff
│   │   ├── onboarding-overlay.tsx        ← First-load modal with Run-demo CTA
│   │   ├── proof-status-cards.tsx        ← tests / fuzz / gas status tiles
│   │   ├── mainnet-gate-progress.tsx     ← Readiness checklist with fix-links
│   │   ├── ship-flow-stepper.tsx         ← (legacy; superseded by phase rail)
│   │   ├── gas-preset-field.tsx          ← Strict/balanced/loose gwei pill picker
│   │   └── human-threshold-field.tsx     ← Stop-loss price input with above/below toggle
│   ├── lib/                              ← Pure logic, no JSX
│   │   ├── strategy-workstation.ts       ← Simulation, readiness gates, review, prompt parsing
│   │   ├── strategy-summary.ts           ← plainLanguageSummary()
│   │   ├── templates.ts                  ← UI-facing template metadata, maturity filters
│   │   ├── default-dsl.ts                ← Default StrategyDocument per templateId
│   │   ├── composer-types.ts             ← Persisted-state types (UiMode, WorkflowStepId — legacy)
│   │   ├── persisted-strategy.ts         ← localStorage round-trip
│   │   ├── human-units.ts                ← Wei <-> decimal helpers for the UI
│   │   ├── wallet.ts                     ← window.ethereum maker-address request
│   │   └── agents/                       ← Strategy assistant ("copilot")
│   │       ├── schemas.ts                ← Zod schemas for /api/assist
│   │       ├── orchestrator.ts           ← Dispatch: LLM path if OPENAI_API_KEY, else rules
│   │       └── llm.ts                    ← OpenAI call (only loaded when key present)
│   └── types/ai-modules.d.ts             ← Ambient types for optional @ai-sdk modules
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

---

## Composition: the wizard's heart

`compose-wizard.tsx` is the only non-trivial component. Everything else is a leaf rendered by it.

### State

```ts
const [doc,            setDoc]           = useState<StrategyDocument>(...);
const [addons,         setAddons]        = useState<StrategyAddonState>({ gasGuard: { enabled: true, maxGwei: 25 }});
const [phase,          setPhase]         = useState<Phase>("build");           // build | test | ship
const [dock,           setDock]          = useState<Dock>("simulate");         // simulate | extension | artifacts
const [activeInspector,setActiveInspector] = useState<CanvasInspectTarget>("condition");
const [preview,        setPreview]       = useState<PreviewState | null>(null);// from previewExtension server action
const [artifacts,      setArtifacts]     = useState<{ path; content }[]>([]);  // from generateFromDsl
const [proof,          setProof]         = useState<ProofStatus>(EMPTY_PROOF); // from runProofChecks
const [simulationInput,setSimulationInput] = useState<SimulationInput>(...);   // client-only "what if" knobs
const [reviewed,       setReviewed]      = useState({ extensionHash, bytecodeHash, explicitConfirm });
const [onboardingOpen, setOnboardingOpen] = useState(false);
```

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Topbar:  [LOP Strategy] {name}    {status pill} chain N · maturity   [Run demo] [Primary]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Strategy summary (plain language)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase rail:  ① Build     ② Test     ③ Ship                                   │
├──────────────┬─────────────────────────────────────────┬────────────────────┤
│ Controls     │ Strategy graph (React Flow canvas)      │ Preflight          │
│ ┌──────────┐ │                                         │ ┌────────────────┐ │
│ │ Template │ │   ┌────┐    ┌────┐    ┌────┐    ┌────┐  │ │ Status banner  │ │
│ │ Condition│ │   │ord │───►│cond│───►│ext │───►│prf │  │ │ Phase actions  │ │
│ │ Order    │ │   └────┘    └────┘    └────┘    └────┘  │ │ Readiness gates│ │
│ │ Demos    │ │                                         │ │ Ext hash card  │ │
│ └──────────┘ │                                         │ │ Technical (+)  │ │
│              │ Dock tabs:  [Simulation] [Ext] [Artif.] │ │ Sign-off (+)   │ │
│              │ Dock content                            │ │ Review (+)     │ │
└──────────────┴─────────────────────────────────────────┴────────────────────┘

Phase=Ship additionally renders the Export + Deploy panels below the grid.
```

### Wiring

| Event | Action |
|---|---|
| User edits template / condition / order | `setDoc`, `syncDoc` clears `artifacts` + `reviewed` checkboxes |
| `doc` or `addons` changes | `useMemo` recomputes graph, predicate preview, simulation, readiness |
| `doc` changes | `useEffect` calls `previewExtension(graphDoc)` server action and updates `preview` |
| Click "Run demo" | `loadExample(PORTFOLIO_EXAMPLES[0])` → loads gas-safe stop-loss, switches to phase=test, calls `generateBundle` |
| Click "Generate bundle" | `generateBundle(graphDoc)` → server action `generateFromDsl` returns artifacts |
| Click "Run checks" | `handleProofChecks` → server action `runProofChecks` runs `forge test`/`forge snapshot` |
| Click readiness gate "Fix" | `handleGateFix` routes to the relevant phase + inspector |
| User edits localStorage-persisted state | `useEffect` saves to `persisted-strategy.ts` |

### Persistence

Versioned (`version: 1`) `localStorage` entry. Stored:

```ts
interface PersistedComposerState {
  version: 1;
  doc: StrategyDocument;
  addons: StrategyAddonState;
  simulationInput: SimulationInput;
  copilotPrompt: string;
  uiMode: UiMode;          // legacy — always "simple" in the redesigned UI
  workflowStep: WorkflowStepId;  // legacy — derived from phase on save
  onboardingDone: boolean;
}
```

On hydrate, legacy `workflowStep` values are mapped to a `Phase` via `phaseFromLegacyStep`. Schema mismatch returns `null` and resets to defaults — a known gap, see [L11](../1inch-review.md#l11--persisted-state-is-unversioned-across-schema-changes).

---

## Server actions

All in `apps/studio/src/app/actions.ts` (`"use server"` directive at the top).

### `generateFromDsl(json: string): Promise<GenerateResult>`

Parses the JSON through `parseStrategyDocument`, calls `generateArtifacts` from `@limit-canvas/codegen`, runs `validateExtensionTraits`, and returns `{ ok, extensionHash, extension, warnings, artifacts }`. On Zod failure or codegen throw, returns `{ ok: false, error }`.

### `previewExtension(json: string): Promise<{ hash, extension, calldataLength, tree, warnings }>`

Same as above but cheaper — used by a `useEffect` on every `doc` change to keep the extension hash card live. Returns a human-readable `tree` of strings for the Extension dock tab.

### `runProofChecks(): Promise<ProofCheckResult>`

Shells out via `child_process.exec` (180s timeout, 8MB buffer):

```bash
cd ../../packages/contracts
forge test -vvv
forge test --match-path "test/fuzz/*" -vvv
forge snapshot --match-path "test/benchmark/*"
```

The PATH is prefixed with `$HOME/.foundry/bin` (Foundry's default install location). Each command's pass/fail is determined by a regex over combined stdout+stderr (`/0 passed; [1-9]\d* failed|FAIL|Error:/i`). The full output is concatenated and returned for the wizard's "Forge output" collapsed details.

> This server action exists to make the wizard self-contained for a demo. In production a partner would run `forge` themselves; the action's regex-based pass/fail detection is reliable for the demo path but is not a substitute for parsing JSON output from Forge.

---

## Domain logic in `lib/strategy-workstation.ts`

The single largest non-component file. Pure functions only (no React imports, no `window` access).

| Export | Purpose |
|---|---|
| `ProofStatus`, `ProofEvidence`, `SimulationInput`, `PredicatePreview`, `StrategyAddonState`, `SimulationResult`, `SimulationTimelineStep`, `ReadinessGateId`, `ReadinessItem`, `StrategyReview` | UI-shared types |
| `buildStrategyGraph(doc, addons)` | Build the visual graph object (nodes + edges) used both by the canvas and embedded in the DSL `graph` field |
| `attachGraph(doc, addons)` | Return a copy of `doc` with `graph` populated (input to codegen) |
| `safeParseJson(json)` | Try `parseStrategyDocument`; return `null` on failure |
| `updateTemplateDocument(...)` | Apply a template change while preserving order fields |
| `computeSimulation(doc, input, addons)` | Pure client-side simulation — "would this fill given these oracle/gas/timestamp values?" |
| `simulationTimeline(doc, input, addons, predicatePreview)` | Step-by-step pass/fail breakdown for the timeline UI |
| `readinessItems(doc, warnings, proof, reviewed)` | The 5 readiness gates (template, network, warnings, hashes, confirm) |
| `parseProofEvidence(output)` | Extract counts from forge stdout |
| `reviewStrategy(doc, addons, warnings, proof)` | "Fills when / Fails when / Assumptions / Risks / Mainnet blockers" |
| `getTemplateMaturity(templateId)` | Lookup via `getTemplateCatalogEntry` |
| `makerTraitsLabel(hasExtension)` | Status string for the UI ("HAS_EXTENSION (bit 249) set" / "not set") |
| `saltCompatibility(extension)` | Returns the salt-low-160 hex string for display |
| `promptToStrategyDocument(prompt, current, defaultFor)` | Rule-based prompt parsing — used by the Assist panel for offline mode |
| `promptToAddons(prompt, current)` | Same, for the gas-guard addon |

The simulation here is **client-only** and does not call any contract. It mirrors the rules the on-chain predicates would apply (`block.basefee <= maxGwei * 1e9`, `latestAnswer direction threshold`, slice cap math, tranche bounds). It's labelled clearly in the UI as "simulated" — the load-bearing assertion ("this strategy actually fills") still requires `forge test` via `runProofChecks`.

---

## Design system (`globals.css`)

A hand-authored, single-accent dark-lab system. ~2,300 lines, organised top-to-bottom:

```
1.  Design tokens (CSS custom properties)
2.  Reset / base
3.  App shell (header nav)
4.  Buttons
5.  Top bar
6.  Phase rail
7.  Composer grid
8.  Controls panel + disclosures
9.  Template gallery + example gallery
10. Form primitives (field, range, toggle)
11. Canvas panel + React Flow overrides
12. Dock tabs + dock content
13. Simulation panel
14. Extension preview
15. Artifact drawer
16. Preflight panel
17. Mainnet readiness progress
18. Proof status cards
19. Ship panel + Export panel + Deploy panel
20. Sub-components (HumanThreshold, GasPreset)
21. Onboarding modal
22. Error banner
23. Forge output details
```

Tokens:

| Group | Values |
|---|---|
| Surfaces | `--canvas` `#0a0a0b`, `--canvas-soft` `#131316`, `--canvas-card` `#161618`, `--canvas-elev` `#1c1c1f` |
| Hairlines | `--hairline` (white α=0.06), `--hairline-strong` (α=0.12), `--hairline-focus` (α=0.28) |
| Text | `--ink` `#fafafa`, `--body` `#cbcdd2`, `--body-mid` `#8b8d94`, `--body-dim` `#5e6068` |
| Accent | `--accent` `#ff6b00`, `--accent-soft`, `--accent-strong`, `--on-accent` `#0a0a0b` |
| Status | `--ok` `#6de08a`, `--warn` `#ffc56b`, `--bad` `#ff6b6b` (each with `*-soft` α=0.14) |
| Type | `--text-xs` 11px / `--text-sm` 13px / `--text-base` 14px / `--text-lg` 17px / `--text-xl` 22px / `--text-2xl` 30px |
| Spacing | `--sp-1` 4px through `--sp-8` 40px |
| Radius | `--radius-sm` 6 / `--radius-md` 10 / `--radius-lg` 14 / `--radius-pill` 9999 |

**Rules:**

- Mono font (`Geist Mono`) used only for hashes, addresses, numeric labels, and field labels. Body text is `Inter`.
- One accent only. No purple, no teal, no gradient ramps — `--accent` carries every "this is interactive / primary / on-task" signal.
- Hairlines are alpha-only, never opaque grey. This is what gives the dark surfaces depth without looking like a 2015 dashboard.
- Status colors (`ok`, `warn`, `bad`) used both as foreground (`color:`) and as `*-soft` background tints. Never together at full opacity.

---

## Assist panel ("copilot")

`/api/assist` is a small endpoint that exists in two modes:

- **LLM mode** — when `OPENAI_API_KEY` is set in the server env. Uses `@ai-sdk/openai` + `ai`. Loaded lazily (`await import("@/lib/agents/llm")`) so the dependency tree is unaffected when the key isn't set.
- **Rules mode** — keyword matching over the user's prompt to suggest stop-loss / gas-guard configurations. Always available; never makes a network call.

The UI is intentionally upfront about this:

> "Rules offline · add OPENAI_API_KEY on server for LLM"

The assist panel itself was simplified out of the main wizard during the redesign — the API route remains for future re-introduction.

> See [the 1inch review L7 (predicate composition)](../1inch-review.md#l7--predicate-composition-is-and-only) and the dropped-in-redesign note: this is a UX surface, not a load-bearing one.

---

## Routes

| Route | Behaviour |
|---|---|
| `GET /` | Compose wizard. Search params: `?template=stop-loss\|gas-guard\|twap-slice\|dca-schedule`, `?phase=build\|test\|ship`, legacy `?step=...` mapped to `phase` |
| `GET /test` | Runs `forge test` via `runContractTests` server action; renders a status pill and the raw forge output |
| `GET /deploy` | Redirects to `/?phase=ship` (deploy is integrated into the compose flow) |
| `POST /api/assist` | Strategy copilot — see "Assist panel" above |

---

## Invariants

| # | Invariant | Where |
|---|---|---|
| 1 | Every value reaching codegen passes through `parseStrategyDocument` first | `actions.ts:30`, `actions.ts:59`, `api/assist/route.ts:7` |
| 2 | UI never holds a private key | `wallet.ts` requests address only; server actions never receive secrets |
| 3 | Mainnet is only reachable when all 5 readiness gates are green AND the three explicit checkboxes are ticked | `preflight-panel.tsx`, `readinessItems` in `strategy-workstation.ts` |
| 4 | Persisted state is keyed by `version: 1` and rejected on mismatch | `persisted-strategy.ts:23` |
| 5 | Server actions are scoped to the local Foundry directory (`path.join(cwd, "..", "..", "packages", "contracts")`) | `actions.ts:99-105` |
| 6 | `previewExtension` is read-only — never writes to localStorage / never spawns subprocesses | `actions.ts:52-88` |
| 7 | The wizard never submits an order to the 1inch Orderbook API automatically | (not implemented anywhere) |

---

## Examples

### Start the studio

```bash
cd apps/studio && bun run dev
# → http://localhost:3000
```

### Open with a specific template at the ship phase

```
http://localhost:3000/?template=gas-guard&phase=ship
```

### Walk the demo flow programmatically

1. Open `/`.
2. Click **Run demo** in the top bar (or in the onboarding overlay on first load).
3. Wizard switches to `phase=test`, loads the gas-safe stop-loss strategy, kicks off `generateBundle`.
4. Click **Run checks** (or wait — `goToPhase("test")` triggers proof checks if `tests === "idle"`).
5. Read the readiness gates on the right. Tick the two hash checkboxes after reviewing the extension hash card.
6. Click **Continue to Ship**.
7. Phase=ship reveals the Export + Deploy panels.

### Set a custom OpenAI key

```bash
cd apps/studio
cp .env.example .env.local
echo "OPENAI_API_KEY=sk-..." >> .env.local
bun run dev
```

The API route detects the key on every request — no rebuild needed.

---

## Extending

### Add a new readiness gate

In `lib/strategy-workstation.ts`:

1. Add a new `ReadinessGateId` value (e.g. `"oracle-fresh"`).
2. Add a corresponding `ReadinessItem` to `readinessItems(...)` with `ok`, `label`, `detail`, `fixTarget`, `fixLabel`.
3. Add a handler case in `handleGateFix` in `compose-wizard.tsx` if the gate needs a routed fix.

### Add a new disclosure section to the left rail

In `compose-wizard.tsx`'s `controls-panel` `<section>`, add a `<Disclosure>` block. Pass `defaultOpen` or `active` based on the current phase / inspector state.

### Theme adjustments

All tokens live in `:root` at the top of `globals.css`. Changing the accent (`--accent`) and its derivatives is the highest-leverage tweak.

### Add a new server action

Add a new `"use server"`-marked function in `actions.ts`. It will be auto-imported as a server function by Next.js. If it shells out, follow the pattern in `runCommand`:

- bounded `timeout`,
- bounded `maxBuffer`,
- always combine stdout + stderr,
- never trust the return code in isolation — pattern-match the output too.

### Add a new template to the gallery

The gallery reads from `TEMPLATES` in `lib/templates.ts`, which mirrors `TEMPLATE_CATALOG` from `@limit-canvas/hook-dsl`. Add to the catalog there; the gallery updates automatically. Then:

1. Add a `defaultDocument(newId)` entry in `lib/default-dsl.ts`.
2. Add controls in `TemplateControls` in `compose-wizard.tsx`.
3. Add a simulation case in `computeSimulation` and `simulationTimeline`.

---

## Gotchas

- **Persisted state is forward-compatible only as long as `PersistedComposerState` keeps backward-compatible field types.** If you rename a field, bump `version` and add a migration. Currently `version: 1` is the only supported value.
- **`runProofChecks` shells out to Foundry.** This works in dev because the developer has Foundry on `$HOME/.foundry/bin`. In a deployed instance (Vercel, etc.) `forge` is not available. The `/test` and proof-check flows are intentionally local-dev-only.
- **Canvas drop zones accept `application/lop-canvas-action`.** Drag/drop of strategy blocks goes through a typed payload (see `CanvasDropAction` in `strategy-canvas.tsx`). Browsers serialize `DataTransfer` data as strings, so the payload is JSON-stringified and parsed on drop. Don't add unbounded fields to the action union — the canvas validates structurally.
- **`useEffect` for `previewExtension` runs on every `graphDoc` change.** This can be chatty during continuous slider movement. A debounce would help; currently relied on the server action being fast (no compilation).
- **`/deploy` is a server redirect.** Bookmarking `/deploy` after a hard refresh sends users to `/?phase=ship&template=...`. Both routes are stable.
- **The `assist-panel` component was removed during the redesign.** The `/api/assist` route remains, callable by any client. If you re-introduce the panel, you can mount it under any disclosure section in the left rail.
- **No SSR for the wizard itself.** `compose-wizard.tsx` is `"use client"` and hydrates from `localStorage`. The HTML shows "Loading strategy…" until JS lands; that's why `curl /` returns a placeholder body.

---

## See also

- [`hook-dsl`](./hook-dsl.md) — every form / persisted-state value parses through this.
- [`lop-sdk`](./lop-sdk.md) — extension packing and salt invariant the wizard surfaces.
- [`codegen`](./codegen.md) — generates the bundle the Ship phase exports.
- [`packages/contracts`](./contracts.md) — Foundry harness; the wizard calls `forge test` here.
- [`docs/1inch-review.md`](../1inch-review.md) — reviewer-perspective limitations, especially the bytecode-hash and audit-provenance gaps.
- [`docs/plan/02-v1-scope.md`](../plan/02-v1-scope.md) — what the wizard intentionally does *not* do (e.g. orderbook submission).
