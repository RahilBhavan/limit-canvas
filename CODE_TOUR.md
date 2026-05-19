# Code Tour — 5 minutes to understand this repo

If you're a reviewer landing here cold, read these files in order. Each one is small and load-bearing.
You'll understand the whole project by the end. No prior 1inch knowledge required — the [glossary](#glossary) is at the bottom.

---

## The premise

[1inch Limit Order Protocol](https://github.com/1inch/limit-order-protocol) v4 lets makers attach **extensions** to orders:
arbitrary calldata (a "predicate") that LOP calls with `staticcall` to decide whether the order is fillable right now.

Two rules trip every newcomer:

1. The extension calldata layout is rigid — a 32-byte header of end-offsets followed by the predicate bytes.
2. The order's `salt` must satisfy `salt & ((1<<160)-1) == keccak256(extension) & ((1<<160)-1)`.
   Get the salt wrong and LOP silently rejects every fill.

This repo exists to get those two things right for you, then prove it with a real fill.

---

## The 5-file tour

### 1. The proof that it actually works → `packages/contracts/test/integration/LopFillIntegration.t.sol`

A Foundry test that:
- builds a gas-guard predicate with the studio's TS helper (mirrored into Solidity)
- packs the extension, derives the salt, signs the order with a maker key
- calls `lop.fillOrderArgs(...)` on a locally-deployed instance of **the real LOP 4.3.2 contract** (submodule-pinned)
- asserts both the happy path (base fee under cap → fill succeeds, balances move) and the revert path (over cap → fill reverts)

This is the load-bearing claim of the whole project. Everything else is in service of making this test stay green.

### 2. The salt / extension rule → `packages/lop-sdk/src/extension.ts`

Two functions worth reading:
- `packPredicateOnlyExtension(predicateCalldata)` — emits the 32-byte header + predicate bytes blob.
- `buildSaltWithExtension(rawSalt, extension)` — clears the low 160 bits of the salt and ORs in the low 160 bits of `keccak256(extension)`.

Companion test `extension.test.ts` asserts the invariant directly. The Solidity side of the salt rule lives in `packages/contracts/test/utils/LopOrderTestLib.sol::saltFromExtension`. They have to agree byte-for-byte or fills don't happen.

### 3. How predicates are composed → `packages/lop-sdk/src/predicates.ts`

`buildAndPredicate(predicates: bytes[])` produces calldata that decodes to LOP's own `PredicateHelper.and(uint256 offsets, bytes data)`:
end-offsets packed in 32-bit chunks of `offsets`, predicate bodies concatenated in `data`. This is the same shape LOP uses internally, which is why the integration test's decode round-trip works.

The gas-safe stop-loss demo is `AND(stop-loss, gas-guard)` compiled through this function.

### 4. The pipeline → `packages/codegen/src/generate.ts`

Input: a `StrategyDocument` (a typed JSON object).
Output: a bundle of files plus a `manifest.json`.

The manifest is the deterministic fingerprint of a strategy. Reviewers should look at:
- `dslHash` — same DSL in, same hash out (asserted in `generate.test.ts`)
- `compiledPredicateTree` — the actual node/edge structure the canvas built
- `extensionHash` — `keccak256` of the packed extension
- `lop.{version, chainId, address}` — what protocol/chain this is for
- `compiler.solidity` — pinned `0.8.23`

Two manifests differ ⇒ something material changed.

### 5. The contract every other package is written against → `packages/hook-dsl/src/schemas.ts`

Zod schemas for `StrategyDocument`, the four template `block` shapes, and the address / numeric-string validators. Everything downstream — codegen, simulation, manifest, UI — operates on the *parsed* output of these schemas. Nothing is `any`. Cross-field constraints (e.g. `templateId === "stop-loss"` ⇒ `block.type === "stop-loss"`) are enforced in `parseStrategyDocument`.

---

## The studio (optional sixth stop)

`apps/studio/src/components/compose-wizard.tsx` is the Next.js wizard. It's larger than the other files (the UI is broad) but follows a clear shape:

- `phase` state machine: `build → test → ship`
- `doc: StrategyDocument` — the live DSL, persisted to `localStorage`
- on every edit: re-pack the extension (`previewExtension`), re-run the simulation (`computeSimulation`), re-compute readiness gates
- on **Generate**: call `generateArtifacts(graphDoc)` (the codegen) and surface the bundle
- on **Run checks**: shell out to `forge test` / `forge snapshot` via server actions (`actions.ts`)

The visual canvas itself is `strategy-canvas.tsx` (React Flow). Each node represents a step in the pipeline above.

---

## What lives where (cheat sheet)

| Question | Read this |
|---|---|
| "Does this actually fill on LOP?" | `packages/contracts/test/integration/LopFillIntegration.t.sol` |
| "How is the extension byte-packed?" | `packages/lop-sdk/src/extension.ts` |
| "What predicates are supported?" | `packages/lop-sdk/src/predicates.ts` + `packages/contracts/src/templates/` |
| "What shape is the user input?" | `packages/hook-dsl/src/schemas.ts` |
| "What gets generated?" | `packages/codegen/src/generate.ts` + `packages/codegen/src/templates.ts` |
| "What chains are supported?" | `packages/lop-sdk/src/registry.ts` |
| "How does the UI work?" | `apps/studio/src/components/compose-wizard.tsx` (main wizard) + `strategy-canvas.tsx` (canvas) |
| "Where's the deploy guardrail?" | `apps/studio/src/components/preflight-panel.tsx` + `packages/codegen/src/cli.ts` |
| "What's NOT shipped yet?" | [`docs/1inch-review.md`](docs/1inch-review.md) (sections L1–L12, P0 list) |

---

## Glossary

| Term | Meaning here |
|---|---|
| **DSL** | The Zod-validated `StrategyDocument` shape (version `1.0.0`) |
| **Template** | One of `stop-loss`, `gas-guard`, `twap-slice`, `dca-schedule` |
| **Predicate** | A view-function call LOP makes via `arbitraryStaticCall` to decide if an order is fillable now |
| **Extension** | 32-byte header + predicate calldata, attached to an order via taker traits |
| **Extension hash** | `keccak256(extension)` — its low 160 bits must equal the order salt's low 160 bits |
| **Maturity** | `draft` / `audited` / `mainnet-enabled` — only the last unlocks mainnet, and only with explicit confirmation |
| **Readiness gate** | A UI check (LOP address, maturity, warnings, hashes, explicit confirm). All five must pass before mainnet. |
| **Manifest** | Deterministic JSON fingerprinting the strategy (`dslHash`, `extensionHash`, `lop.version`, …) |
| **Phase** | The wizard's 3-stage flow: **Build → Test → Ship** |

---

## Next stops

- **Reviewer-perspective audit** (limitations, P0/P1/P2 improvements): [`docs/1inch-review.md`](docs/1inch-review.md)
- **Per-package deep dives** (50 min total): [`docs/packages/README.md`](docs/packages/README.md)
- **Original design docs** (vision → roadmap): [`docs/plan/README.md`](docs/plan/README.md)
- **Product framing** (why this matters to 1inch): [`docs/why-limit-canvas.md`](docs/why-limit-canvas.md)
