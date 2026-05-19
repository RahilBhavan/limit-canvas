# Limit Canvas — Internal Review

*Reviewer perspective: 1inch LOP team engineer*
*Reviewed: Limit Canvas v0.1 against LOP v4.3.2*
*Scope: protocol correctness, production readiness, integration risk, partner-fit*

---

## TL;DR

A small, surprisingly disciplined toolchain for composing LOP v4.3.2 extensions. It is **not** a wrapper-pretending-to-be-a-product. It pins our protocol at a tagged release, packs extensions against our actual encoding (predicate-only with offset header), respects the low-160 salt invariant, and proves an end-to-end fill through `LimitOrderProtocol.fillOrderArgs` in a Foundry test. The UI is clean, has a single canonical flow, and surfaces the things a maker would actually misconfigure (extension hash mismatch, gas guard semantics, oracle direction).

I'd be comfortable pointing a partner engineering team at this as a **reference implementation** for LOP extension composition. I would not yet be comfortable telling them "deploy what this generates to mainnet" — and the project explicitly agrees, gating mainnet behind `audited: true` plus bytecode review.

The single biggest gap is that two of the four templates (TWAP, DCA) are preview-only on the codegen path, so the studio's "compose visually → ship Solidity" promise currently only fully holds for **stop-loss** and **gas-guard**.

---

## What this is

A monorepo with five concerns kept properly separated:

| Package | Responsibility |
|---|---|
| `packages/hook-dsl` | Zod-validated strategy document schema (DSL v1.0.0) |
| `packages/lop-sdk` | Extension packing, predicate builders, salt/hash, LOP address registry, orderbook payload shape |
| `packages/codegen` | DSL → Solidity strategy contract + deploy script + tests + manifest |
| `packages/contracts` | Foundry harness pinned to LOP 4.3.2: templates, mocks, unit/fuzz/integration/benchmark tests |
| `apps/studio` | Next.js 15 wizard: visual canvas, simulation, codegen trigger, proof status, export, deploy handoff |

The wizard's flagship flow is **gas-safe stop-loss**: oracle price predicate AND'd with a base-fee predicate, compiled into a single LOP extension via `PredicateHelper.and`, with the order salt's low 160 bits constrained to equal the extension hash.

---

## What I noticed first (good signals)

These are the things I look for to decide whether a partner project is "actually integrated with LOP" or "vaguely inspired by LOP."

1. **Protocol is pinned at a real tag.** `packages/contracts/lib/limit-order-protocol` is a submodule at `4.3.2`. CI clones the same tag. No drift against `master`. (`docs/plan/07-production-readiness.md` makes this a release gate, and `.github/workflows/ci.yml` enforces it.)

2. **The integration test actually fills.** `packages/contracts/test/integration/LopFillIntegration.t.sol` constructs an order with a gas-guard predicate, packs it via the studio's own helper (`LopOrderTestLib.buildPredicateExtension`), signs it with the maker key, calls `lop.fillOrderArgs(...)`, and asserts both balance deltas and revert paths. That's the test I want to see — not "we packed bytes and they match a snapshot."

3. **The salt invariant is honored and tested.** `packages/lop-sdk/src/extension.ts` builds the salt with `(rawSalt & ~mask) | extensionHashLow160`. The TS test asserts `salt & ((1<<160)-1) == hash`, and `LopOrderTestLib.saltFromExtension` mirrors the same rule in Solidity. The UI surfaces the same constraint as a copyable "Extension hash" card with explanatory copy.

4. **Predicate composition uses the protocol's own primitive.** `buildAndPredicate` produces calldata that decodes to `PredicateHelper.and(uint256 offsets, bytes data)` with packed end-offsets — the same shape LOP uses internally. The decode round-trip is asserted in tests.

5. **Chain registry matches our public docs.** `LOP_REGISTRY` in `packages/lop-sdk/src/registry.ts` matches the canonical `0x111111125421ca6dc452d289314280a0f8842a65` deployment across Ethereum / Optimism / BSC / Gnosis / Polygon / Base / Arbitrum / Avalanche / Sepolia, plus the zkSync-Era exception. The UI surfaces "LOP address" as a readiness gate.

6. **Manifest is reproducible and useful.** Every generated bundle includes `dslHash`, `template.{id,version,maturity}`, `compiler.solidity`, `lop.{version,chainId,address}`, `compiledPredicateTree`, `extensionHash`, `bytecodeHash` placeholder, warnings, and a `testCommandResults` slot. A partner can diff two manifests and know whether anything material changed.

7. **Mainnet is intentionally gated.** The readiness panel exposes five gates (template maturity, LOP address verified, warnings clear, hashes reviewed, explicit confirmation), and mainnet is blocked unless all pass. `audited: true` is described conservatively in docs: it means "this template implementation was reviewed," not "your strategy is safe."

8. **The UI doesn't lie about what it's doing.** There is no fake AI branding. Preview-only templates (`twap-slice`, `dca-schedule`) are labelled as such on the template card. Demo mode preloads a known-good configuration rather than pretending the user assembled it.

---

## What I'd show my team

If I had ten minutes in a sync, I'd open three things:

- `LopFillIntegrationTest::test_fillOrderArgs_gas_guard_succeeds_when_basefee_within_cap` — proof the studio's extension shape fills through *our* contract.
- `packages/lop-sdk/src/extension.ts` + the salt/hash test — proof someone read the spec.
- The composer UI on `/?phase=test`, run demo → click Generate → click Run checks. The 3-phase rail (Build / Test / Ship), the status pill ("Ready" / warning-count), and the readiness gates list communicate state without a tutorial.

That's enough to decide "this is serious."

---

## Limitations and concerns

I'd rather list these candidly than have a partner discover them post-handoff.

### L1 — Codegen coverage is narrow

Only `stop-loss` and `gas-guard` have a true end-to-end DSL → Solidity → integration-test path. `twap-slice` and `dca-schedule` ship Solidity helpers and unit tests, but the studio explicitly marks them `preview` and the readiness panel will flag them. This is a correct call (no false production surface) but it limits the "look how much you can compose" pitch.

### L2 — `bytecodeHash` is a placeholder

The manifest reserves `bytecodeHash` but does not currently populate it from a deterministic compile, and the readiness checklist asks the user to tick "Bytecode hash reviewed" without showing them a hash to review. For a partner deploying mainnet, this needs to be a real artifact (e.g. `keccak256` of the runtime bytecode emitted by a pinned `solc 0.8.23` build).

### L3 — Stop-loss assumes ideal oracle behavior

`StopLossStrategy.checkPrice` reads `IPriceOracle.latestAnswer()`, rejects non-positive answers, and compares against a threshold. It does **not** verify:
- staleness (`updatedAt` / heartbeat),
- round completeness (`answeredInRound >= roundId`),
- aggregator decimals,
- aggregator address against a chain-specific allowlist.

For Chainlink, that's the standard set of checks every audited consumer applies. The research dossier (`docs/plan/08-research-dossier.md`) flags this. Until those land, "stop-loss" is honest as a template but not safe as a production deployment.

### L4 — TWAP/DCA liveness is undocumented in the artifact bundle

The Solidity helpers and tests exist, but a real TWAP/DCA strategy only works if a taker/keeper actually pings the order every slice. There is no keeper integration (Chainlink Automation, Gelato, 1inch resolvers) and the generated README does not yet enumerate liveness assumptions. For a partner, "your DCA will silently stop filling if no taker bothers" is the kind of footgun that needs to be loud in the bundle, not just in the design docs.

### L5 — No orderbook submission path

The SDK includes `buildOrderbookPayloadShape` to produce a payload matching `POST /orderbook/v4.1/{chain}`, but the studio explicitly does not submit. That's deliberate (and I agree — generating + signing + auto-submitting is a much larger trust surface), but it means the "compose → ship" flow ends at "you have a payload and an extension." A partner integrating this still needs their own submission pipeline.

### L6 — `audited` is a single boolean

The template catalog uses `maturity: "draft" | "tested" | "benchmarked" | "audit-ready" | "mainnet-enabled"`. There is no provenance attached to `audit-ready`: no auditor name, report URL, scope, date, or commit hash. If 1inch ever signs off on a template, we'd want the provenance baked into the manifest (so a maker can verify "you said this template was audited by X at commit Y").

### L7 — Predicate composition is `AND`-only

`buildAndPredicate` and the codegen's `compilePredicateTree` only emit `PredicateHelper.and`. LOP supports `or`, `not`, `eq`, `lt`, `gt`, `arbitraryStaticCall`. The narrow set is fine for v1 (gas-safe stop-loss is `AND(stopLoss, gasGuard)`), but the visual canvas as built suggests more composability than the codegen currently delivers.

### L8 — Maker traits are partly nominal

`makerTraitsLabel(hasExtension)` in `strategy-workstation.ts` and the corresponding helper give the user a status string, but the studio does not yet expose / generate maker traits flags (`USE_PERMIT2`, `ALLOW_PARTIAL_FILL`, `ALLOW_MULTIPLE_FILLS`, `NO_PARTIAL_FILLS`, etc.) as first-class controls. For some templates the wrong combination will silently break fills.

### L9 — Gas benchmarks are helper-level, not fill-level

Benchmarks live in `test/benchmark/*` and measure the optimized helper vs a `NaiveGasChecker` baseline. That's useful as a regression guard, but a partner cares about "what's the gas cost of filling an order that uses this extension" — which would mean benchmarking the `fillOrderArgs` path. The research dossier flags this as "gas benchmark theater" risk; I agree.

### L10 — Single-chain demo

The chain registry covers ten chains, but the LOP integration test, the demo flow, and the deploy scripts assume an EVM-mainnet-shape environment. zkSync-Era has a different LOP address and historically different gas semantics; if we want this to be a credible multichain reference, at least one non-mainnet-EVM integration test would help.

### L11 — Persisted state is unversioned across schema changes

`packages/studio/src/lib/persisted-strategy.ts` uses `version: 1` and bails on mismatch, but if the DSL schema evolves the wizard will silently fall back to the default. For a tool that pitches reproducibility, the on-disk strategy should round-trip across DSL versions or fail loudly with a migration path.

### L12 — Generated artifacts are emitted to memory, not the filesystem

`generateFromDsl` returns `{ path, content }[]` and the UI offers a single-file concatenated `.txt` download. That's adequate for a hackathon demo. For a production handoff, a partner expects a zip with the directory structure preserved (so they can `forge build` it directly), or at minimum a `tar.gz`.

---

## Improvement suggestions

In priority order, what I'd want to see before promoting this from "reference implementation" to "officially recommended partner tooling."

### P0 — Mandatory before mainnet claims

1. **Oracle hardening for stop-loss.** Add `staleAfter` (seconds), `decimals`, `aggregator allowlist` (Chainlink registry per-chain) to the DSL; emit the corresponding revert paths in `StopLossStrategy`; add a negative test that a stale price reverts the fill.
2. **Real bytecode hash in the manifest.** Compile the generated contract through `solc 0.8.23` (or via a reproducible Foundry `forge build --use 0.8.23`), keccak256 the runtime, embed in manifest, show in the readiness checklist before the "Bytecode hash reviewed" tick is meaningful.
3. **Audit provenance schema.** Replace the boolean `audited` with `audit: { auditor, reportUrl, scope, commitHash, date }`. Manifest carries the provenance. UI shows it.
4. **End-to-end fill benchmark.** Add `test/benchmark/StopLossFill.benchmark.t.sol` that snapshots gas for `fillOrderArgs` on a stop-loss + gas-guard order, not just the predicate helper. Snapshot it in CI.

### P1 — Closes the "production-grade" gap

5. **Maker traits as first-class DSL.** Expose `allowPartialFills`, `allowMultipleFills`, `expiration`, `nonce`, `privateTaker`, `permit2`, `epoch` as schema fields with cross-field validation (e.g. TWAP requires `allowPartialFills && allowMultipleFills`). The studio already validates some of this; lift it to schema-level.
6. **Keeper documentation in the generated README.** For TWAP/DCA bundles, the auto-generated `README.generated.md` should include a "Liveness" section describing what off-chain process must call which method on what cadence, with reference Gelato / Chainlink Automation snippets.
7. **TWAP + DCA on the codegen path.** Implement `compilePredicateTree` for getter-based templates and emit `IAmountGetter`-compatible Solidity. This is non-trivial — it requires modelling getters, not just predicates — but it's the difference between "4 templates" and "2 templates plus marketing."
8. **Zip / tar bundle export.** Replace the `.txt` concatenation with a `.zip` containing `foundry.toml`, `src/`, `test/`, `script/`, `README.generated.md`, `manifest.json`.
9. **`OR` / `NOT` predicate primitives.** Add to `lop-sdk` and the canvas. The codegen already has the data structure (`mode: "and" | "single"`); broaden to `"and" | "or" | "not" | "single"`.

### P2 — Quality of life and trust

10. **Snapshot-test generated Solidity.** `packages/codegen/src/examples.test.ts` should byte-equal canonical strategies (gas-safe stop-loss, plain gas-guard). The current `dslHash` discipline is good; pair it with output-side hashing.
11. **Diff view between two manifests.** A partner reviewing a hand-off wants to know "is this the same artifact as last week's." A small diff UI in `/test` would land cheap.
12. **Provenance for the LOP address.** The readiness gate "LOP address verified" should not just match the registry — it should link to the chain explorer of the contract at that address with the LOP version visible. Trust transfers when the user can click.
13. **CSP and source-map review for the deployed studio.** Standard hygiene for anything hosting strategy logic.
14. **Optional: 1inch SDK round-trip test.** A TS test that pipes the studio's order/extension through `@1inch/limit-order-sdk` and asserts byte-equality. Highest-value canary for upstream drift.

---

## Documentation appendix

The rest of this document is intended to be readable by an engineer who has never seen the codebase before. It is the documentation I would want when onboarding to review or extend this project.

### A. Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │  apps/studio (Next.js 15 wizard)                        │
   │  ┌──────────────┐  ┌────────────────┐  ┌────────────┐   │
   │  │ Strategy     │  │ Visual canvas  │  │ Preflight  │   │
   │  │ controls     │  │ (React Flow)   │  │ + readiness│   │
   │  └──────┬───────┘  └────────┬───────┘  └─────┬──────┘   │
   │         └──────────┬────────┘                │          │
   │                    ▼                         │          │
   │              Strategy DSL                    │          │
   │           (Zod-validated JSON)               │          │
   └────────────────────┬─────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  packages/codegen                                       │
   │  • compilePredicateTree (and / single)                  │
   │  • emit Solidity strategy + deploy + tests              │
   │  • emit manifest.json (dslHash, extensionHash, LOP pin) │
   └────────────────────┬────────────────────────────────────┘
                        │
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  packages/lop-sdk                                       │
   │  • buildStopLossPredicate / buildGasGuardPredicate      │
   │  • buildAndPredicate (offsets-packed)                   │
   │  • packPredicateOnlyExtension                           │
   │  • computeExtensionHash + buildSaltWithExtension        │
   │  • LOP_REGISTRY (chain → known address)                 │
   │  • buildOrderbookPayloadShape                           │
   └────────────────────┬────────────────────────────────────┘
                        │
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  packages/contracts (Foundry, pinned LOP 4.3.2)         │
   │  • src/templates: StopLoss, GasGuard, TwapSlice, Dca…   │
   │  • test/integration: LopFillIntegration (real fill)     │
   │  • test/fuzz, test/benchmark                            │
   │  • script/Deploy*.s.sol                                 │
   └─────────────────────────────────────────────────────────┘
```

### B. Core invariants

These are the things that must hold for any strategy emitted by this toolchain to fill on LOP. Any change to the codegen path must preserve them or call them out.

| Invariant | Where enforced | Where tested |
|---|---|---|
| Order salt's low 160 bits == low 160 bits of `keccak256(extension)` | `lop-sdk/src/extension.ts::buildSaltWithExtension` | `lop-sdk/src/extension.test.ts` ("salt low 160 bits matches extension hash"); `LopOrderTestLib.saltFromExtension` |
| Predicate-only extension = 32-byte header with predicate end offset in bytes [16..19], followed by the predicate calldata | `lop-sdk/src/extension.ts::packPredicateOnlyExtension` | Decoded in `LopFillIntegrationTest::_gasGuardPredicate` round-trip |
| `PredicateHelper.and(offsets, data)` packs end-offsets in 32-bit chunks of `offsets` | `lop-sdk/src/predicates.ts::buildAndPredicate` | `lop-sdk/src/extension.test.ts` ("builds LOP PredicateHelper.and calldata with offsets") |
| LOP address must match the official registry for the chain | `lop-sdk/src/registry.ts::isKnownLopAddress` | `lop-sdk/src/extension.test.ts` ("recognizes official mainnet LOP address"); UI readiness gate |
| Mainnet deploy is blocked unless template maturity is `audit-ready`+ AND the extension hash + explicit-confirm gates are checked | `apps/studio/src/components/preflight-panel.tsx` + readiness checklist | UI test path; `script/Deploy*.s.sol` profile separation; `packages/codegen/src/cli.ts` mainnet gate |
| LOP submodule is pinned to `4.3.2` tag | `packages/contracts/.gitmodules` (commit pin) | `.github/workflows/ci.yml` (`submodules: recursive`) |
| Manifest's `dslHash` is deterministic for the same input DSL | `packages/codegen/src/generate.ts` | `packages/codegen/src/generate.test.ts` |

### C. Trust boundaries

Everything inside the studio is trusted; everything crossing these boundaries is not.

- **DSL boundary.** All user input enters via Zod-validated schemas (`packages/hook-dsl/src/schemas.ts`). Addresses are regex-validated; numeric strings are constrained; cross-field constraints (template type + block type) are enforced in `parseStrategyDocument`.
- **Chain boundary.** The chain ID drives the LOP address lookup. Any address that fails the registry check produces a readiness gate failure; mainnet is unreachable through the deploy guard.
- **Codegen boundary.** Generated Solidity is **not** arbitrary user code. It's a template-driven render with no string interpolation of user input into executable positions. User input lands only in constructor args / view function parameters.
- **Deploy boundary.** The studio never holds keys. Deploy scripts read `DEPLOYER_KEY` and `RPC_URL` from env. The studio surfaces the CLI command; the user runs it.
- **Submission boundary.** The studio never POSTs to the 1inch Orderbook API. It produces a payload shape (`buildOrderbookPayloadShape`). The user submits.

### D. How to evaluate this project (15-minute partner review)

1. `cd packages/contracts && forge test -vvv` — should show ~all pass on `4.3.2` submodule. The fill-path tests in `test/integration/` are the load-bearing ones.
2. Open `packages/lop-sdk/src/extension.ts` and `packages/lop-sdk/src/predicates.ts`. Read maybe 50 lines. This is where protocol correctness lives.
3. Open `packages/contracts/test/integration/LopFillIntegration.t.sol`. Read `test_fillOrderArgs_gas_guard_succeeds_when_basefee_within_cap` and the matching reverts-when-basefee-exceeds test. This is your "does this actually fill" evidence.
4. `bun run dev`, open the wizard, click **Run demo**, walk Build → Test → Ship. Watch the readiness gates change state. Open the **Artifacts** tab and look at `manifest.json`.
5. Read `docs/plan/07-production-readiness.md`. Compare its release gates to what's actually implemented in the readiness panel.

If those five steps land, the project is what it claims. If any of them fail, that's the conversation to have.

### E. Glossary

| Term | Meaning in this project |
|---|---|
| **DSL** | The Zod schema for a `StrategyDocument` (`packages/hook-dsl`). Versioned at `1.0.0`. |
| **Template** | One of `stop-loss`, `gas-guard`, `twap-slice`, `dca-schedule`. Each has a maturity (`draft` / `tested` / `benchmarked` / `audit-ready` / `mainnet-enabled`). |
| **Predicate** | Boolean view-function calldata invoked by LOP via `arbitraryStaticCall`. The order fills only when the predicate returns non-zero. |
| **Extension** | The 32-byte-header-prefixed calldata blob attached to an order via taker traits. Currently predicate-only in this project. |
| **Extension hash** | `keccak256(extension)`. Its low 160 bits must equal the order salt's low 160 bits. |
| **Maturity** | A template's deploy-eligibility label. `audit-ready` or `mainnet-enabled` unblocks mainnet, and only with explicit user confirmation. |
| **Readiness gate** | A UI check (LOP address, template maturity, warnings, hashes, explicit confirm). All five must pass before mainnet. |
| **Manifest** | The deterministic JSON emitted alongside Solidity that fingerprints the strategy (`dslHash`, `extensionHash`, `lop.version`, etc.). |
| **Phase** | The wizard's three-stage flow: **Build** (compose), **Test** (simulate, generate, prove), **Ship** (export, deploy). |

---

## Closing read

If I had to put this in one sentence to a 1inch product lead: *"It does the unsexy parts right (pinning, packing, salt, address registry, integration test) and stops short where it should (mainnet, orderbook submission, audit claim). The remaining work is well-scoped, not foundational."*

The constructive way forward is the P0 list above — oracle hardening, real bytecode hash, audit provenance, fill-path benchmark — and then promoting TWAP/DCA from preview to first-class. With those done, this is a tool I'd be willing to point a partner at unprompted.
