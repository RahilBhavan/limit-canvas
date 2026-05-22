# Limit Canvas — Internal Review

*Reviewer perspective: 1inch LOP team engineer*
*Reviewed: Limit Canvas v0.1 against LOP v4.3.2*
*Scope: protocol correctness, production readiness, integration risk, partner-fit*

---

## TL;DR

A small, surprisingly disciplined toolchain for composing LOP v4.3.2 extensions. It is **not** a wrapper-pretending-to-be-a-product. It pins our protocol at a tagged release, packs extensions against our actual encoding (predicate-only with offset header), respects the low-160 salt invariant, and proves an end-to-end fill through `LimitOrderProtocol.fillOrderArgs` in a Foundry test. The UI is clean, has a single canonical flow, and surfaces the things a maker would actually misconfigure (extension hash mismatch, gas guard semantics, oracle direction).

I'd be comfortable pointing a partner engineering team at this as a **reference implementation** for LOP extension composition. I would not yet be comfortable telling them "deploy what this generates to mainnet" — and the project explicitly agrees, gating mainnet behind `audited: true` plus bytecode review.

**Update since first review:** all four P0 release-blockers *and* the five P1 production-gap items below have been closed. All four templates (stop-loss, gas-guard, TWAP, DCA) are now first-class on the codegen path; the oracle is hardened; the bytecode hash is a real compiled hash; audit provenance is structured; `OR`/`NOT` predicate primitives and first-class maker traits have landed. The remaining open items (L5 and L10) are deliberate scope boundaries — orderbook submission, multichain integration coverage — not foundational work.

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

6. **Manifest is reproducible and useful.** Every generated bundle includes `dslHash`, `template.{id,version,maturity}`, `compiler.solidity`, `lop.{version,chainId,address}`, `compiledPredicateTree`, `extensionHash`, a real compiled-runtime `bytecodeHash`, warnings, and a `testCommandResults` slot. A partner can diff two manifests and know whether anything material changed.

7. **Mainnet is intentionally gated.** The readiness panel exposes five gates (template maturity, LOP address verified, warnings clear, hashes reviewed, explicit confirmation), and mainnet is blocked unless all pass. `audited: true` is described conservatively in docs: it means "this template implementation was reviewed," not "your strategy is safe."

8. **The UI doesn't lie about what it's doing.** There is no fake AI branding. Every template card shows its catalog `maturity` honestly, and research-only catalog entries (oracle band, deadline window, private taker, Dutch auction) are surfaced as non-executable. Demo mode preloads a known-good configuration rather than pretending the user assembled it.

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

### L1 — Codegen coverage (Resolved)

All four templates now have a true end-to-end DSL → Solidity → manifest path. `twap-slice` and `dca-schedule` are `executable` + `graphCodegenExecutable` in the template catalog at `audit-ready` maturity, generate through `packages/codegen`, and are exercised by `LopFillIntegration.t.sol` (`test_fillOrderArgs_twap_slice_getter_succeeds`, `test_registerDcaSeries_succeeds`). There is no longer a `preview` tier — `PREVIEW_ONLY_TEMPLATE_IDS` is empty.

### L2 — `bytecodeHash` is fully verified (Resolved)

The manifest now populates `bytecodeHash` using a deterministic compile process. The script `packages/codegen/scripts/snapshot-bytecode-hashes.ts` reads `deployedBytecode.object` from Forge's compilation output, computes the `keccak256` hash of the runtime bytecode, and commits it to `bytecode-hashes.json`. The Solidity compiler configuration in `foundry.toml` enforces metadata-independent builds via `bytecode_hash = "none"` and `cbor_metadata = false`. The studio UI surfaces the bytecode hash in the preflight gate checklist, allowing builders to explicitly verify and sign off on the exact bytecode hashes before staging to mainnet.

### L3 — Stop-loss oracle behavior hardened (Resolved)

`StopLossStrategy.checkPrice` has been fully hardened to read `latestRoundData()` and perform rigorous security checks before verifying threshold logic. It enforces:
- Price staleness limits (reverts via `StaleAnswer` error if the difference between `block.timestamp` and `updatedAt` exceeds `staleAfter`),
- Round completeness (asserts `updatedAt > 0` and `answeredInRound >= roundId`),
- Aggregator decimals match (asserts decimals parameter matches target oracle decimals on-chain),
- Curator allowlist check: the `@limit-canvas/lop-sdk` package exports a validated Chainlink oracle registry which triggers warnings if the chosen aggregator is off-list, or if `staleAfter` is configured shorter than the feed's official heartbeat.

### L4 — TWAP/DCA liveness (Partially resolved)

The footgun is now loud in the bundle: `generateReadme` emits a liveness section for TWAP and DCA spelling out that fills depend on a keeper pinging the order each slice, and `validateExtensionTraits` surfaces a DCA keeper warning in the studio. What remains out of scope is *shipping* a keeper integration — there is still no generated Chainlink Automation / Gelato / 1inch-resolver wiring, only the documented assumption.

### L5 — No orderbook submission path

The SDK includes `buildOrderbookPayloadShape` to produce a payload matching `POST /orderbook/v4.1/{chain}`, but the studio explicitly does not submit. That's deliberate (and I agree — generating + signing + auto-submitting is a much larger trust surface), but it means the "compose → ship" flow ends at "you have a payload and an extension." A partner integrating this still needs their own submission pipeline.

### L6 — Structured audit provenance (Resolved)

The project now supports structured audit provenance. The Zod schema in `packages/hook-dsl` includes a nested `audit` metadata object (containing `auditor`, `reportUrl`, `scope`, `commitHash`, and `date`). This audit evidence is embedded verbatim into the generated strategy manifest. The studio's preflight panel deprecates the standalone `audited: true` boolean check in favor of verifying that this audit provenance object is populated and matches the active commit.

### L7 — Predicate composition primitives (Resolved)

`lop-sdk/src/predicates.ts` now exports `buildOrPredicate` and `buildNotPredicate` alongside `buildAndPredicate`, plus the `buildCompareGt` / `buildCompareLt` comparator builders. The strategy graph schema's `compiledPredicate.mode` accepts `single | and | or | not`, so the canvas and codegen agree on the composable set. `AND` remains the path the hero demo exercises end-to-end.

### L8 — Maker traits as first-class DSL (Resolved)

`orderSchema` in `hook-dsl` now carries `allowPartialFills`, `allowMultipleFills`, `usePermit2`, `unwrapWeth`, `nonce`, `series`, `expiration`, and `privateTaker` as validated fields, surfaced as controls in the studio's Order panel. `strategyDocumentSchema.superRefine` enforces cross-field constraints (`twap-slice` requires `allowPartialFills && allowMultipleFills`). `lop-sdk/src/maker-traits.ts::packMakerTraits` packs them into the real MakerTraits bit layout (flags in the high bits, expiration/nonce/series fields in the low bits).

### L9 — Fill-path benchmarks (Resolved)

The project now includes a comprehensive fill-path benchmark test `packages/contracts/test/benchmark/StopLossFill.benchmark.t.sol` that snapshots the gas consumption of a real `fillOrderArgs` invocation on a composed stop-loss and gas-guard order. This ensures gas benchmarks reflect actual protocol execution rather than isolated helper calls. The gas snapshot is checked in and verified in CI on every run via `forge snapshot --check`.

### L10 — Single-chain demo

The chain registry covers ten chains, but the LOP integration test, the demo flow, and the deploy scripts assume an EVM-mainnet-shape environment. zkSync-Era has a different LOP address and historically different gas semantics; if we want this to be a credible multichain reference, at least one non-mainnet-EVM integration test would help.

### L11 — Persisted state validates against the DSL schema (Resolved)

`apps/studio/src/lib/persisted-strategy.ts` now stamps the saved blob with the `DSL_VERSION` it was written under and, on load, re-parses the persisted `doc` through `strategyDocumentSchema.safeParse`. A DSL schema change (version bump, new required field, tighter refinement) is therefore detected rather than silently feeding a stale document into the wizard. `loadPersistedState` returns a discriminated `empty | ok | incompatible` result; on `incompatible` the wizard clears the stale blob and surfaces a dismissible notice naming the saved DSL version, instead of failing silently.

### L12 — Zip bundle export (Resolved)

The studio now exports a real `.zip` (via `fflate`) with the directory structure preserved — `src/`, `test/`, `script/`, `README.generated.md`, `extensions.json`, `manifest.json` — so a partner can unzip and `forge build` directly. `generateFromDsl` still returns `{ path, content }[]`; `downloadBundle` in `compose-wizard.tsx` packs those paths into the archive.

---

## Resolved P0 Items (Mandatory before mainnet claims)

All four critical security and verification P0 tasks have been resolved:

1. **Oracle hardening for stop-loss:** Added `staleAfter` (seconds) and `decimals` to the DSL schema, updated `StopLossStrategy` to check `latestRoundData()` and revert on stale/dec-mismatch data. Created negative tests for all failure cases and a Chainlink oracle registry check in codegen.
2. **Real bytecode hash in manifest:** Implemented a reproducible `forge build` bytecode hash generator that outputs `bytecode-hashes.json`. The compiler configuration in `foundry.toml` strips metadata, enabling hash consistency. The UI surfaces the compiled bytecode hash in the preflight readiness panel.
3. **Audit provenance schema:** Added structured audit metadata Zod schema and validated it in the DSL parser, studio UI, and generated manifest.
4. **End-to-end fill benchmark:** Added `StopLossFill.benchmark.t.sol` to record accurate `fillOrderArgs` gas consumption in `.gas-snapshot`, which is verified by CI.

## Improvement suggestions

In priority order, what I'd want to see before promoting this from "reference implementation" to "officially recommended partner tooling."

### P1 — Closes the "production-grade" gap (Resolved)

All five P1 items are closed. See L1, L7, L8 above and the notes below.

5. **Maker traits as first-class DSL.** *Resolved.* `orderSchema` exposes `allowPartialFills`, `allowMultipleFills`, `usePermit2`, `unwrapWeth`, `nonce`, `series`, `expiration`, `privateTaker`; `superRefine` enforces the TWAP `allowPartialFills && allowMultipleFills` constraint; `lop-sdk/src/maker-traits.ts` packs the real bit layout. (See L8.)
6. **Keeper documentation in the generated README.** *Resolved.* `generateReadme` in `packages/codegen/src/templates.ts` emits a liveness section for TWAP and DCA bundles describing the off-chain keeper requirement (Chainlink Automation / Gelato / custom bots).
7. **TWAP + DCA on the codegen path.** *Resolved.* `generateTwapSliceGetter` and `generateDcaRegistry` emit getter / series Solidity; both templates are `graphCodegenExecutable` and covered by `LopFillIntegration.t.sol`. (See L1.)
8. **Zip bundle export.** *Resolved.* The studio exports a real `.zip` with directory structure preserved. (See L12.)
9. **`OR` / `NOT` predicate primitives.** *Resolved.* `lop-sdk/src/predicates.ts` exports `buildOrPredicate` / `buildNotPredicate` and the graph `mode` enum is `single | and | or | not`. (See L7.)

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

The constructive way forward was the P0 list — oracle hardening, real bytecode hash, audit provenance, fill-path benchmark — followed by the P1 list: promoting TWAP/DCA to first-class, maker traits as DSL, keeper docs, `OR`/`NOT` primitives, zip export. **All of that is now done.** What remains is genuine scope — orderbook submission (L5) and multichain integration coverage (L10) — not foundational work. This is a tool I'd point a partner at unprompted.
