# `@limit-canvas/hook-dsl`

The **strategy DSL**. A small, Zod-validated TypeScript schema that defines what an LOP extension strategy looks like in this project. Every other package — `lop-sdk`, `codegen`, `apps/studio` — consumes `StrategyDocument` as its input contract.

If a value reaches the codegen or the wizard without coming through this schema, that's a bug.

---

## At a glance

| | |
|---|---|
| **Source** | `packages/hook-dsl/src/` |
| **Entry** | `packages/hook-dsl/src/index.ts` |
| **Runtime** | Bun / Node (pure TypeScript, no I/O) |
| **Dependencies** | `zod` only |
| **Tests** | `packages/hook-dsl/src/schemas.test.ts` |
| **DSL version** | `"1.0.0"` (frozen until a schema-breaking change ships) |
| **Imported by** | `lop-sdk`, `codegen`, `apps/studio` |

---

## Why a DSL

LOP order extensions are a small typed surface (predicate, amount getters, traits, salt), but the wire format is unforgiving: a wrong address encoding, a missing required field, or an off-by-one numeric value silently produces an extension that won't fill. By forcing every strategy through one Zod schema we get:

- a single place to validate addresses, hex, numeric strings, ranges,
- a discriminated union over block types so the wrong `block` for a `templateId` is a compile-time *and* runtime error,
- cross-field rules (e.g. "TWAP requires `allowPartialFills`") in one place,
- a stable `StrategyDocument` type the rest of the monorepo depends on.

The wizard's "Simple/JSON" toggles, the codegen CLI, and the server actions all parse through `parseStrategyDocument` before doing anything.

---

## Public API

Re-exported from `@limit-canvas/hook-dsl`:

| Symbol | Kind | Purpose |
|---|---|---|
| `DSL_VERSION` | `const "1.0.0"` | Frozen schema version literal |
| `strategyDocumentSchema` | `ZodEffects<...>` | The root schema (with cross-field refinements) |
| `templateIdSchema` | `ZodEnum` | `"stop-loss" \| "gas-guard" \| "twap-slice" \| "dca-schedule"` |
| `parseStrategyDocument(raw)` | `(unknown) => StrategyDocument` | Throws `ZodError` on invalid input |
| `validateExtensionTraits(doc)` | `(StrategyDocument) => string[]` | Soft warnings (not exceptions) |
| `MAKER_TRAIT_HAS_EXTENSION` | `const 249` | Bit position of LOP's `HAS_EXTENSION` flag in maker traits |
| `TEMPLATE_CATALOG` | `readonly TemplateCatalogEntry[]` | Catalog of implemented + planned templates |
| `IMPLEMENTED_TEMPLATE_IDS` | `readonly TemplateId[]` | The four executable templates |
| `getTemplateCatalogEntry(id)` | `(string) => TemplateCatalogEntry \| undefined` | Catalog lookup |

### Type exports

`StrategyDocument`, `StrategyDocumentInput`, `TemplateId`, `OrderConfig`, `NetworkConfig`, `StrategyGraph`, `StrategyGraphNode`, `StrategyGraphEdge`, `StopLossBlock`, `GasGuardBlock`, `TwapSliceBlock`, `DcaScheduleBlock`, `TemplateBlock`, `TemplateCatalogEntry`, `TemplateStage`, `TemplateMaturity`.

`StrategyDocumentInput` is the **pre-default** Zod input (`z.input<typeof schema>`); `StrategyDocument` is the **post-default** parsed output (`z.infer<typeof schema>`). Default-bearing fields like `audited`, `allowPartialFills`, `allowMultipleFills`, and `seriesId` are optional on input, required on output.

---

## Schema reference

### `StrategyDocument` (root)

```ts
{
  version: "1.0.0"          // literal
  templateId: TemplateId    // discriminator
  name: string              // 1..128 chars
  audited: boolean          // default false — required true for mainnet gate
  network: NetworkConfig
  order: OrderConfig
  block: TemplateBlock      // discriminated by `type`, must match templateId
  predicateCalldata?: hex   // filled by codegen / SDK, not by users
  graph?: StrategyGraph     // optional visual graph metadata
}
```

**Cross-field rules** (`superRefine` in `schemas.ts`):

| Rule | Path |
|---|---|
| `block.type === templateId` | `block` |
| `templateId === "twap-slice"` ⟹ `order.allowPartialFills === true` | `order.allowPartialFills` |

### `NetworkConfig`

```ts
{ chainId: number (positive int), lopAddress: 0x[40 hex] }
```

The `lopAddress` is validated against the official LOP registry in `@limit-canvas/lop-sdk` (`isKnownLopAddress`) — not at DSL parse time, but as a readiness gate in the wizard.

### `OrderConfig`

```ts
{
  maker:               0x[40 hex]
  receiver?:           0x[40 hex]                  // defaults to maker on fill
  makerAsset:          0x[40 hex]
  takerAsset:          0x[40 hex]
  makingAmount:        string of digits            // base-10 wei
  takingAmount:        string of digits
  allowPartialFills:   boolean (default true)
  allowMultipleFills:  boolean (default false)
  expiration?:         non-negative int (unix seconds)
  privateTaker?:       0x[40 hex]                  // restrict fill to one taker
}
```

Amounts are **strings of digits**, not `bigint` or `number`, because they cross a JSON boundary into the wizard and must survive `JSON.parse` without precision loss.

### `TemplateBlock` (discriminated union)

| Block type | Fields |
|---|---|
| `stop-loss` | `oracle: 0x[40]`, `threshold: string-of-digits`, `direction: "above" \| "below"` |
| `gas-guard` | `maxGwei: positive number` |
| `twap-slice` | `totalAmount`, `sliceAmount` (string of digits), `intervalSeconds: positive int`, `startTime: non-negative int` |
| `dca-schedule` | `tranches: int 2..52`, `amountPerTranche: string of digits`, `intervalSeconds: positive int`, `seriesId: non-negative int (default 0)` |

### `StrategyGraph` (optional)

The visual canvas's graph is part of the DSL — not a UI-only construct. When `graph` is set, codegen embeds it in `manifest.json` so a downstream consumer can prove which visual composition produced the artifact.

```ts
{
  version: "1.0.0"
  nodes:  StrategyGraphNode[]   // ≥ 1
  edges:  StrategyGraphEdge[]
  compiledPredicate?: {
    mode: "single" | "and"
    rootNodeIds: string[]
  }
}
```

Node kinds: `"order" | "predicate" | "getter" | "extension" | "proof"`. Only `templateId`-bearing nodes participate in codegen; `extension` and `proof` nodes are diagnostic.

---

## Template catalog

`TEMPLATE_CATALOG` (in `template-catalog.ts`) is the **single source of truth** for which templates exist and how mature they are. Both the wizard's template gallery and the codegen's manifest read from here.

Entry shape:

```ts
{
  id: string
  title: string
  stage: "production-candidate" | "planned" | "research"
  maturity: "draft" | "tested" | "benchmarked" | "audit-ready" | "mainnet-enabled"
  version: string
  executable: boolean              // codegen will emit Solidity if true
  graphCodegenExecutable: boolean  // full graph→Solidity supported if true
  summary: string
  lopSurface: string[]             // which LOP features this template uses
  productionRequirements: string[] // what must land before mainnet
  risks: string[]
}
```

Current catalog (truncated):

| ID | Stage | Maturity | Exec | Graph codegen |
|---|---|---|---|---|
| `stop-loss` | production-candidate | audit-ready | ✅ | ✅ |
| `gas-guard` | production-candidate | audit-ready | ✅ | ✅ |
| `twap-slice` | production-candidate | benchmarked | ✅ | ⛔ preview |
| `dca-schedule` | production-candidate | tested | ✅ | ⛔ preview |
| `oracle-band` | planned | draft | ⛔ | ⛔ |
| `deadline-window` | planned | draft | ⛔ | ⛔ |
| `private-taker` | planned | draft | ⛔ | ⛔ |
| `dutch-auction` | research | draft | ⛔ | ⛔ |

**Promotion gates** (informal, documented in `docs/plan/07-production-readiness.md`):

- `draft` → `tested`: unit tests pass against the template Solidity helper.
- `tested` → `benchmarked`: gas snapshot exists with a baseline.
- `benchmarked` → `audit-ready`: fuzz coverage + LOP fill integration test + DSL determinism test.
- `audit-ready` → `mainnet-enabled`: external audit provenance landed in the manifest (see [the 1inch-review limitations list](../1inch-review.md#l6--audited-is-a-single-boolean) — this gate is not yet enforced beyond a boolean).

---

## `validateExtensionTraits` (soft warnings)

Distinct from `parseStrategyDocument`: this returns string warnings without throwing. The wizard surfaces them in the preflight panel; the codegen embeds them in `manifest.warnings`.

Current rules (`validate.ts`):

| Trigger | Warning |
|---|---|
| `templateId ∈ {gas-guard, stop-loss}` ∧ no `predicateCalldata` | `"Predicate calldata not set — run codegen or lop-sdk packer."` |
| `templateId === "dca-schedule"` | `"DCA emits N orders — off-chain keeper required (see README.generated.md)."` |
| `network.chainId === 1` ∧ `audited === false` | `"mainnet deploy blocked until audited: true in DSL."` |

`validateExtensionTraits` is the right place to add new soft checks (oracle freshness, traits mismatches, etc.). Keep hard validation in the Zod schema.

---

## Invariants

| # | Invariant | Enforced in |
|---|---|---|
| 1 | `version === "1.0.0"` for any parsed document | `schemas.ts` (`z.literal(DSL_VERSION)`) |
| 2 | `block.type === templateId` | `schemas.ts` (`superRefine`) |
| 3 | TWAP requires partial fills | `schemas.ts` (`superRefine`) |
| 4 | All addresses are lowercase-or-checksum `0x[40 hex]` | `schemas.ts` (`address` regex) |
| 5 | All amounts are decimal-digit strings (no scientific notation, no decimals) | `schemas.ts` (`/^\d+$/`) |
| 6 | DCA tranches ∈ [2, 52] | `schemas.ts` |
| 7 | Maker traits bit 249 means "extension present" | `validate.ts` (`MAKER_TRAIT_HAS_EXTENSION`) |

---

## Example

```ts
import {
  parseStrategyDocument,
  validateExtensionTraits,
} from "@limit-canvas/hook-dsl";

const doc = parseStrategyDocument({
  version: "1.0.0",
  templateId: "stop-loss",
  name: "Gas-safe ETH stop-loss",
  audited: false,
  network: {
    chainId: 1,
    lopAddress: "0x111111125421ca6dc452d289314280a0f8842a65",
  },
  order: {
    maker: "0xMakerAddress...",
    makerAsset: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    takerAsset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    makingAmount: "1000000000000000000",                       // 1 WETH
    takingAmount: "3000000000",                                // 3000 USDC
    allowPartialFills: true,
  },
  block: {
    type: "stop-loss",
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD
    threshold: "300000000000",                              // 3000 * 1e8
    direction: "below",
  },
});

// doc is fully typed as StrategyDocument
const warnings = validateExtensionTraits(doc);
// → [ "Predicate calldata not set — run codegen or lop-sdk packer." ]
```

A `ZodError` is thrown if:
- `block.type !== templateId`,
- any address fails the regex,
- amounts contain non-digits,
- TWAP is configured without `allowPartialFills`.

---

## Testing

`packages/hook-dsl/src/schemas.test.ts` covers:

- happy-path parse for each template,
- cross-field rule rejection (`block.type` mismatch, TWAP without partial fills),
- address / hex / numeric-string regex failures,
- DCA tranche bounds.

Run:

```bash
bun test packages/hook-dsl
```

---

## Extending

### Add a soft validation rule

Edit `validate.ts`, push a string into `warnings`. No tests required in DSL (test in `apps/studio` if it changes UI state).

### Add a new template

This is a four-package change. In `hook-dsl` alone:

1. Add the literal to `templateIdSchema` (`schemas.ts`).
2. Define `myTemplateBlockSchema` with all fields.
3. Add it to the discriminated union in `strategyDocumentSchema`.
4. Add a `TemplateCatalogEntry` to `TEMPLATE_CATALOG` with `executable: false` until the harness lands.
5. Export the inferred block type from `types.ts` and add to `TemplateBlock`.

Then implement codegen, predicate builder, contract template, and tests in the other packages. The wizard's `defaultDocument` and template gallery pick up new entries automatically through the catalog.

### Bump DSL version

Required when any schema change would invalidate an existing parsed document (renamed field, removed field, narrowed type). Procedure:

1. Update `DSL_VERSION` (e.g. `"1.1.0"`).
2. Update the `version` literal in `strategyDocumentSchema`.
3. Add a migration path in `apps/studio/src/lib/persisted-strategy.ts` (currently bails on mismatch — see [L11 in the 1inch review](../1inch-review.md#l11--persisted-state-is-unversioned-across-schema-changes)).
4. Bump the manifest's `manifestVersion` if codegen output shape changes.

---

## Gotchas

- **Default fields.** `audited`, `allowPartialFills`, `allowMultipleFills`, `seriesId`, `params` are optional on input but always present on the parsed type. Don't write user-facing tooling that treats them as nullable.
- **`predicateCalldata` is internal.** Users should never set this in their DSL JSON — codegen / `lop-sdk` populates it. If a user-authored JSON contains stale predicate calldata, codegen will overwrite it during `generateArtifacts`.
- **`graph` is optional but load-bearing for codegen composition.** The "gas-safe stop-loss" graph composition (predicate AND'd with gas guard) only happens when a `graph` is present and contains a `gas-guard` node. A DSL without a graph compiles to a single predicate, even if the wizard would have rendered an AND. Codegen never invents a graph.
- **`audited: true` is currently a self-declaration.** There is no on-chain or off-chain provenance attached. Treat as a deploy gate, not a security guarantee.

---

## See also

- [`lop-sdk`](./lop-sdk.md) — consumes `StrategyDocument` to pack extensions and build predicates.
- [`codegen`](./codegen.md) — consumes `StrategyDocument` to emit Solidity + manifest.
- [`apps/studio`](./studio.md) — uses the schema for form state and persisted-strategy round-trips.
- [`docs/plan/03-templates.md`](../plan/03-templates.md) — per-template design notes.
- [`docs/1inch-review.md`](../1inch-review.md) — limitations and what would need to change for production.
