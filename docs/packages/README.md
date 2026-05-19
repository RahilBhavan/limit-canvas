# Package documentation

Per-package technical reference for Limit Canvas. Each doc is self-contained: API surface, architecture, invariants, examples, testing, extension points, and gotchas. Read in any order, or use the recommended path below.

---

## The five packages

| Package | Layer | Lines (src) | Doc |
|---|---|---:|---|
| `@limit-canvas/hook-dsl` | Schema / contract | ~200 | [hook-dsl.md](./hook-dsl.md) |
| `@limit-canvas/lop-sdk` | Protocol correctness | ~250 | [lop-sdk.md](./lop-sdk.md) |
| `@limit-canvas/codegen` | DSL → artifacts | ~500 | [codegen.md](./codegen.md) |
| `packages/contracts` | Foundry harness (Solidity) | n/a | [contracts.md](./contracts.md) |
| `apps/studio` | Next.js wizard | ~5,500 (TS + CSS) | [studio.md](./studio.md) |

---

## How they fit together

```
  StrategyDocument (JSON)                          ◀── user
        │
        ▼ parseStrategyDocument
   ┌─────────────┐
   │  hook-dsl   │  ← types, Zod schemas, catalog
   └──────┬──────┘
          │
          ├──────────────┬───────────────────┐
          ▼              ▼                   ▼
   ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐
   │  lop-sdk    │ │  codegen    │ │  apps/studio     │  ◀── user (browser)
   │  - pack ext │ │  - emit Sol │ │  - canvas + forms│
   │  - predicate│ │  - manifest │ │  - simulation    │
   │  - salt     │ │  - readme   │ │  - proof checks  │
   │  - registry │ │             │ │  - deploy handoff│
   └──────┬──────┘ └──────┬──────┘ └────┬─────────────┘
          │               │              │
          ▼               ▼              ▼
                  ┌───────────────┐
                  │  packages/    │
                  │  contracts/   │  ← Foundry; pinned LOP 4.3.2
                  │  - templates  │
                  │  - tests      │
                  │  - benchmarks │
                  │  - deploy     │
                  └───────┬───────┘
                          │
                          ▼ forge test / forge script
                  ┌───────────────┐
                  │  LOP 4.3.2    │
                  │  on chain     │  ← evidence that the studio's claims hold
                  └───────────────┘
```

Read the docs in this order for a clean mental model:

1. [**hook-dsl**](./hook-dsl.md) — the schema. Everything else is "given a `StrategyDocument`, do X."
2. [**lop-sdk**](./lop-sdk.md) — the protocol-correctness layer. Where the salt rule and predicate encoding live.
3. [**codegen**](./codegen.md) — the compiler. How a DSL becomes a bundle.
4. [**contracts**](./contracts.md) — the Foundry harness. Where claims are proved.
5. [**studio**](./studio.md) — the UI. Where users interact.

---

## Per-package reading time

- hook-dsl: ~5 min
- lop-sdk: ~10 min
- codegen: ~10 min
- contracts: ~10 min
- studio: ~15 min

Total: 50 minutes from cold to "I know what's in every directory."

---

## Cross-cutting docs

- [**1inch internal review**](../1inch-review.md) — a reviewer-perspective audit with limitations and prioritised improvements (P0/P1/P2). Read this alongside the per-package docs to understand what's intentionally *not* shipped.
- [**Why Limit Canvas**](../why-limit-canvas.md) — product framing.
- [**SECURITY.md**](../../SECURITY.md) — disclosure policy.

### Planning docs (`docs/plan/`)

These are the design documents that predated implementation. Useful for "why is it like this?" archaeology; can drift from current code.

- [00-vision.md](../plan/00-vision.md) — problem framing.
- [01-architecture.md](../plan/01-architecture.md) — original architecture sketch.
- [02-v1-scope.md](../plan/02-v1-scope.md) — what's in/out of scope for v1.
- [03-templates.md](../plan/03-templates.md) — per-template design notes.
- [04-testing-and-benchmarks.md](../plan/04-testing-and-benchmarks.md) — test strategy.
- [05-deploy-environments.md](../plan/05-deploy-environments.md) — deploy profiles.
- [06-roadmap.md](../plan/06-roadmap.md) — phased build plan.
- [07-production-readiness.md](../plan/07-production-readiness.md) — release gates and security model.
- [08-research-dossier.md](../plan/08-research-dossier.md) — LOP protocol facts.
- [09-template-roadmap.md](../plan/09-template-roadmap.md) — template promotion criteria.
- [10-implementation-backlog.md](../plan/10-implementation-backlog.md) — outstanding work list.

---

## Quick reference

### Core invariants (every package contributes to these)

| Invariant | Owned by |
|---|---|
| Strategy is Zod-validated before any other package sees it | `hook-dsl` |
| Order salt's low 160 bits == low 160 bits of `keccak256(extension)` | `lop-sdk` (producer), `contracts` (consumer) |
| LOP submodule pinned to `4.3.2`, never `master` | `contracts` + CI |
| Same DSL → byte-identical artifacts (`dslHash` determinism) | `codegen` + `codegen/examples.test.ts` |
| Mainnet gated by 5 readiness checks + 3 explicit confirmations | `apps/studio` (UI) + `codegen/cli.ts` (CLI refuses without `audited: true`) |
| Generated Solidity matches the source in `packages/contracts/src/templates/` | `codegen` (snapshot tests) + manual review |
| Maker traits bit 249 is set when an extension is present | `lop-sdk` types + `contracts` test helpers |

### Files a reviewer should read first

Sorted by load-bearingness:

1. [`packages/contracts/test/integration/LopFillIntegration.t.sol`](../../packages/contracts/test/integration/LopFillIntegration.t.sol) — proof the studio's extension shape fills through real LOP.
2. [`packages/lop-sdk/src/extension.ts`](../../packages/lop-sdk/src/extension.ts) — extension packing + salt invariant.
3. [`packages/lop-sdk/src/predicates.ts`](../../packages/lop-sdk/src/predicates.ts) — predicate calldata builders.
4. [`packages/codegen/src/generate.ts`](../../packages/codegen/src/generate.ts) — the pipeline; manifest construction.
5. [`packages/hook-dsl/src/schemas.ts`](../../packages/hook-dsl/src/schemas.ts) — the contract every other package is written against.

### Commands

```bash
# Install everything
bun install

# Run all tests
bun test                                        # TS unit tests across packages
cd packages/contracts && forge test -vvv        # Solidity tests + integration
cd packages/contracts && forge snapshot --check --match-path "test/benchmark/*"

# Run the studio
cd apps/studio && bun run dev                   # http://localhost:3000

# Generate artifacts from a DSL JSON
bun run packages/codegen/src/cli.ts \
  docs/examples/gas-safe-stop-loss.dsl.json \
  ./artifacts/gas-safe-stop-loss

# Deploy to testnet (after wizard readiness passes)
cd packages/contracts
export DEPLOYER_KEY=0x...
export RPC_URL=https://sepolia.infura.io/v3/...
FOUNDRY_PROFILE=testnet forge script script/DeployGasGuard.s.sol --broadcast --verify
```

---

## Maintaining these docs

Update a package doc when:

- You add or remove a public export.
- You change the public type signature of an exported function or type.
- You add or remove a file from the package.
- You change a protocol-correctness rule (extension layout, salt, predicate selectors, LOP pin version).
- You change a runtime dependency or build tool.

You do **not** need to update a doc when:

- You refactor internal helpers without changing the public surface.
- You add a unit test (unless it changes the documented invariants).
- You polish UI copy or layout.

Each doc has a "See also" section at the bottom; keep cross-links accurate as files move.
