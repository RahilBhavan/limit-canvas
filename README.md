# Limit Canvas

> Visual builder + verifier for [1inch Limit Order Protocol](https://github.com/1inch/limit-order-protocol) **v4.3.2** extensions.
> Drag blocks → simulate fills → generate Solidity → prove correctness — before you ever sign.

[![CI](https://github.com/RahilBhavan/limit-canvas/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml) · [License: MIT](LICENSE) · [Security policy](SECURITY.md)

---

## What it does, in one picture

```
   ┌─────────────────────────────────────────────────────────────┐
   │  apps/studio  (Next.js wizard)                              │
   │   drag blocks  ─▶  simulate price/gas  ─▶  proof checklist  │
   └─────────────────────────────┬───────────────────────────────┘
                                 ▼
                       Strategy DSL  (Zod-validated JSON)
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  packages/lop-sdk        packages/codegen        packages/contracts
   pack extension          DSL → Solidity          Foundry harness
   keccak salt rule        deploy script           pinned LOP 4.3.2
   LOP registry            manifest.json           integration tests
                                                   gas benchmarks
                                                          │
                                                          ▼
                                              proof a real fill works
```

LOP supports rich order logic (predicates, amount getters, partial fills, hooks) but it's expert-only:
extension calldata must be byte-perfect, and the order salt's low 160 bits must equal `keccak256(extension)`.
**Get any of that wrong and the order silently never fills.**

This studio handles the encoding, generates the contracts and tests, and proves the extension fills through
real LOP — all from a visual canvas that a non-protocol-engineer can drive.

---

## 60-second demo

```bash
bun install && bun run dev
# open http://localhost:3000
```

In the browser:

1. Click **Run demo** → loads the **gas-safe stop-loss** strategy.
2. Watch the canvas: `Maker intent → Price condition → Gas guard → LOP extension → Proof`.
3. Drag the simulated base fee above the cap → the proof panel shows *why* the fill would be blocked.
4. Click **Generate** → inspect the deterministic `manifest.json` (DSL hash, extension hash, LOP pin).
5. Click **Run checks** → Foundry tests, fuzz, and gas snapshots run locally.

That's the whole pitch: **compose visually, see why it fills or doesn't, ship the proof alongside the code.**

---

## What's actually proven (not just claimed)

| Claim | Evidence |
|---|---|
| Extension shape fills through real LOP | [`LopFillIntegration.t.sol`](packages/contracts/test/integration/LopFillIntegration.t.sol) calls `lop.fillOrderArgs(...)` against pinned 4.3.2 |
| Salt's low 160 bits == `keccak256(extension)` low 160 bits | [`extension.test.ts`](packages/lop-sdk/src/extension.test.ts) + Solidity mirror in `LopOrderTestLib.saltFromExtension` |
| Predicate composition uses `PredicateHelper.and` | [`predicates.ts::buildAndPredicate`](packages/lop-sdk/src/predicates.ts) (offsets-packed; decode round-trip tested) |
| LOP address matches official registry across 10 chains | [`registry.ts`](packages/lop-sdk/src/registry.ts) — surfaced as a readiness gate in the UI |
| Same DSL → byte-identical artifacts | `dslHash` in [`generate.ts`](packages/codegen/src/generate.ts) + output-side snapshots in [`examples.test.ts`](packages/codegen/src/examples.test.ts) |
| Stop-loss reverts on stale / incomplete / wrong-decimals oracle data | `StopLossStrategy.checkPrice` + negative tests in [`StopLossStrategy.t.sol`](packages/contracts/test/unit/StopLossStrategy.t.sol) and [`LopFillIntegration.t.sol`](packages/contracts/test/integration/LopFillIntegration.t.sol) |
| `manifest.bytecodeHash` is a real compiled runtime hash, not a placeholder | [`snapshot-bytecode-hashes.ts`](packages/codegen/scripts/snapshot-bytecode-hashes.ts) — keccak of `deployedBytecode`, metadata-stripped via `foundry.toml`; CI re-verifies |
| Mainnet is gated, not aspirational | Readiness checks + explicit confirmations in [`preflight-panel.tsx`](apps/studio/src/components/preflight-panel.tsx); CLI refuses unless the template's catalog `maturity` is `audit-ready`+ AND the DSL has `audited: true` (set `FOUNDRY_PROFILE=mainnet`) |

---

## For reviewers

If you have **5 minutes**, read [**CODE_TOUR.md**](CODE_TOUR.md) — the 5 most load-bearing files with one line each.

If you have **15 minutes**, read [**docs/1inch-review.md**](docs/1inch-review.md) — a reviewer-perspective audit (limitations honest, P0/P1/P2 improvement list).

If you have **50 minutes**, read [**docs/packages/README.md**](docs/packages/README.md) — full per-package technical reference.

---

## Quickstart

```bash
bun install
bun run dev                    # studio at http://localhost:3000
```

Run the full proof stack:

```bash
bun run build:packages
bun run test:packages          # Bun unit tests across hook-dsl / lop-sdk / codegen
cd packages/contracts && forge test -vvv
bun run bench                  # gas snapshots
```

---

## Monorepo layout

| Path | Responsibility | Reading time | Doc |
| --- | --- | --- | --- |
| `apps/studio` | Next.js 15 wizard: canvas, simulation, proof | 15 min | [studio.md](docs/packages/studio.md) |
| `packages/hook-dsl` | Zod schema for `StrategyDocument` | 5 min | [hook-dsl.md](docs/packages/hook-dsl.md) |
| `packages/lop-sdk` | Extension packing, salt rule, LOP registry | 10 min | [lop-sdk.md](docs/packages/lop-sdk.md) |
| `packages/codegen` | DSL → Solidity + deploy + tests + manifest | 10 min | [codegen.md](docs/packages/codegen.md) |
| `packages/contracts` | Foundry templates + integration fill test | 10 min | [contracts.md](docs/packages/contracts.md) |
| `examples/` | Strategy JSON examples (one per template) | — | — |
| `docs/plan/` | Original design docs (architecture, roadmap) | — | [index](docs/plan/README.md) |

---

## Template library

**Executable — full DSL → Solidity → manifest codegen, graph compose, and a Foundry fill test:**

- `stop-loss` — oracle price predicate with staleness / round-completeness / decimals guards (powers the `gas-safe stop-loss` hero demo: `AND(stop-loss, gas-guard)`)
- `gas-guard` — base-fee predicate
- `twap-slice` — time-windowed partial-fill amount getter; the generated bundle ships keeper-liveness docs
- `dca-schedule` — tranche order series with an on-chain metadata registry and keeper guidance

All four are at `audit-ready` maturity with unit + fuzz + integration + benchmark tests, and all four
generate through `packages/codegen` (`bun run codegen examples/<template>.json`).

**Planned / research (visible in the catalog, not executable):**

- Oracle band · Deadline window · Private taker / allowlist · Dutch auction (research-only)

---

## Guardrails

- LOP submodule **pinned to tag 4.3.2**, never `master`. CI clones via `submodules: recursive`.
- Mainnet blocked unless the template's catalog `maturity` is `audit-ready` or higher AND the user confirms the extension hash + accepts mainnet risk in-session.
- No Orderbook API submission in v1 — the studio produces the payload shape only.
- The describe-strategy sketcher uses local keyword rules; LLM assist requires `OPENAI_API_KEY` in `.env.local`.

---

## Honest limitations

The four P0 release-blockers and the P1 production-gap items from [docs/1inch-review.md](docs/1inch-review.md)
are closed. The remaining limitations are deliberate scope boundaries, not unfinished work:

- **No Orderbook submission path.** The SDK produces the `POST /orderbook/v4.1` payload *shape*, but the studio never submits — auto-submitting signed orders is a much larger trust surface. A partner integrates their own submission pipeline.
- **Single-chain integration coverage.** The chain registry covers 10 chains, but the LOP fill test and deploy scripts assume an EVM-mainnet-shape environment; zkSync-Era is not yet exercised by an integration test.
- **Persisted studio state is unversioned across DSL changes.** `persisted-strategy.ts` falls back to the default on a schema mismatch rather than migrating saved strategies.

---

## Environment

Copy `.env.example` → `.env.local`:

- `DEPLOYER_KEY` — deployer private key (testnet only by default)
- `RPC_URL` — RPC endpoint
- `ETHERSCAN_API_KEY` — contract verification
- `OPENAI_API_KEY` — optional, enables LLM strategy sketching

---

## License

MIT — see [LICENSE](LICENSE).
