# `@limit-canvas/codegen`

The **DSL-to-artifacts compiler**. Takes a validated `StrategyDocument` and produces a reproducible bundle: Solidity strategy contract, deploy script stub, test stub, `extensions.json` (extension + hash + salt + orderbook shape), `README.generated.md`, and `manifest.json` with a determinism fingerprint.

The package is small (~280 lines of TypeScript) and intentionally not extensible by user input — every template renderer is a fixed string template with typed substitutions. Generated Solidity is never user-authored.

---

## At a glance

| | |
|---|---|
| **Source** | `packages/codegen/src/` |
| **Entry** | `packages/codegen/src/index.ts` (programmatic) and `packages/codegen/src/cli.ts` (`lop-codegen` binary) |
| **Runtime** | Bun |
| **Dependencies** | `viem`, `@limit-canvas/hook-dsl`, `@limit-canvas/lop-sdk` |
| **Tests** | `packages/codegen/src/generate.test.ts`, `examples.test.ts` |
| **Imported by** | `apps/studio` (via the `generateFromDsl` server action) |
| **Deterministic** | Yes — same DSL ⟹ byte-identical artifacts |

---

## Public API

```ts
// index.ts
export { generateArtifacts, type CodegenResult } from "./generate.js";
export type { GeneratedArtifact } from "./templates.js";
```

| Symbol | Signature | Purpose |
|---|---|---|
| `generateArtifacts` | `(doc: StrategyDocument) => CodegenResult` | The one-shot codegen entry point |
| `CodegenResult` | `{ doc, extensionHash, predicateTree, artifacts }` | Result tuple |
| `GeneratedArtifact` | `{ relativePath: string; content: string }` | One file in the bundle |

The CLI (`packages/codegen/src/cli.ts`) is a thin Bun script that reads a DSL JSON, runs `generateArtifacts`, and writes files. Invoked from `package.json` as `lop-codegen` (or `bun run packages/codegen/src/cli.ts`).

---

## Pipeline

```
   StrategyDocument
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. Pick template renderer                                    │
   │    stop-loss   → generateStopLossStrategy   + StopLossStrategy│
   │    gas-guard   → generateGasGuardStrategy   + GasGuardStrategy│
   │    twap-slice  → generateTwapSliceGetter    + TwapSliceGetter│
   │    dca-schedule → generateDcaRegistry        + DcaSeriesRegistry│
   └──────────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 2. Build predicate calldata (lop-sdk)                        │
   │    stop-loss / gas-guard: buildStopLossPredicate /            │
   │                            buildGasGuardPredicate             │
   │    twap-slice / dca-schedule: no predicate (preview-only)     │
   └──────────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 3. Compile predicate tree                                    │
   │    mode "single" if no gas-guard node in graph or template     │
   │       is itself gas-guard                                      │
   │    mode "and"    if doc.graph has a gas-guard node alongside  │
   │       a stop-loss base predicate (the gas-safe stop-loss path)│
   └──────────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 4. Pack extension + compute salt + extension hash             │
   │    packPredicateOnlyExtension(predicateRoot)                  │
   │    computeExtensionHash(extension)                            │
   │    buildSaltWithExtension(1n, extension)                      │
   └──────────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 5. Emit artifacts                                             │
   │    Strategy.sol, Strategy.t.sol, Deploy*.s.sol,               │
   │    extensions.json, README.generated.md, manifest.json,       │
   │    dca-orders.json (DCA only)                                  │
   └──────────────────────────────────────────────────────────────┘
        │
        ▼
   CodegenResult
```

---

## Artifacts emitted

For every strategy:

| Path | Source | Description |
|---|---|---|
| `src/generated/{templateId}/Strategy.sol` | `generate*Strategy` in `templates.ts` | View-helper Solidity that LOP's `arbitraryStaticCall` invokes |
| `src/generated/{templateId}/Strategy.t.sol` | `generateTestStub` | Forge test scaffold (placeholder — a real test suite lives in `packages/contracts/test/`) |
| `script/generated/Deploy{Contract}.s.sol` | `generateDeployScript` | Forge deploy script reading `DEPLOYER_KEY` from env |
| `extensions.json` | inline in `generate.ts` | `{ templateId, extension, extensionHash, predicateCalldata, predicateTree, salt, network, orderbookPayloadShape }` |
| `README.generated.md` | `generateReadme` | Human-readable per-strategy README with risks, reproduction commands, mainnet blockers |
| `manifest.json` | inline in `generate.ts` | Determinism + provenance fingerprint (see below) |

DCA-only additional artifact:

| Path | Description |
|---|---|
| `dca-orders.json` | `{ orders: [{ tranche, makingAmount, seriesId, fillAfter }, ...] }` |

---

## The manifest

`manifest.json` is the load-bearing artifact. Every consumer (UI, partner integrator, audit reviewer) should be able to fingerprint a bundle by reading this file.

```ts
interface ArtifactManifest {
  manifestVersion: "1.0.0";
  generatedBy: "limit-canvas";
  dslHash: string;                  // keccak256(stableStringify(enrichedDoc))
  template: {
    id: string;                     // "stop-loss" | ...
    version: string;                // from TEMPLATE_CATALOG
    maturity: string;               // "draft" | "audit-ready" | ...
  };
  audit?: AuditProvenance;          // structured audit provenance (mirrored from DSL)
  compiler: { solidity: "0.8.23" };
  lop: { version: "4.3.2"; chainId: number; address: string };
  generatedFiles: string[];         // every artifact path including manifest.json itself
  graph: StrategyGraph | null;      // the visual graph if the DSL carried one
  compiledPredicateTree: CompiledPredicateTree;
  extensionHash: string;
  bytecodeHash: string;             // keccak256 hash of compiled runtime bytecode (loaded from bytecode-hashes.json)
  warnings: string[];               // from validateExtensionTraits
  testCommandResults: {
    tests: "not-run" | "pass" | "fail";
    fuzz:  "not-run" | "pass" | "fail";
    gas:   "not-run" | "pass" | "fail";
  };
}
```

### Why `dslHash` and not file hashes

`dslHash` fingerprints the **input** through a stable JSON serialization (`stableStringify`, defined inline — sorts object keys). Two different inputs producing the same artifacts would have different `dslHash`es; the artifacts being byte-identical confirms determinism. The codegen test suite asserts this.

### What's missing (intentional, documented)

- `testCommandResults` is `"not-run"` at codegen time. The wizard / CI fills these by re-emitting the manifest after running `forge test` / `forge snapshot`.

---

## `CompiledPredicateTree`

```ts
interface CompiledPredicateTree {
  mode: "single" | "and";
  nodes: Array<{ id: string; templateId: string; predicateCalldata: string }>;
  root: `0x${string}`;
}
```

- `mode: "single"` — one predicate. `root === nodes[0].predicateCalldata`.
- `mode: "and"` — two predicates AND-combined via `buildAndPredicate`. `root === and(node[0], node[1])`.

The "and" branch is triggered exclusively by the gas-safe stop-loss composition: a `stop-loss` base predicate plus a `gas-guard` node in `doc.graph.nodes`. See `compilePredicateTree` in `generate.ts:231`.

> The visual canvas in the studio is what creates `doc.graph`. A DSL with no `graph` compiles to `mode: "single"` even if the wizard would have rendered an AND. **Codegen never invents a graph.**

---

## Solidity templates emitted

These are the four contracts codegen renders. Each one mirrors a contract already in `packages/contracts/src/templates/` (so the studio's preview matches what the Foundry harness tests).

### `StopLossStrategy`

```solidity
contract StopLossStrategy {
    error InvalidAnswer();
    error IncompleteRound(uint80 roundId, uint80 answeredInRound, uint256 updatedAt);
    error StaleAnswer(uint256 updatedAt, uint256 nowTs, uint256 staleAfter);
    error DecimalsMismatch(uint8 actual, uint8 expected);

    function checkPrice(
        address oracle,
        uint256 threshold,
        bool directionAbove,
        uint256 staleAfter,
        uint8 expectedDecimals
    ) external view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            IPriceOracle(oracle).latestRoundData();
        if (answer <= 0) revert InvalidAnswer();
        if (updatedAt == 0 || answeredInRound < roundId) {
            revert IncompleteRound(roundId, answeredInRound, updatedAt);
        }
        if (block.timestamp > updatedAt && block.timestamp - updatedAt > staleAfter) {
            revert StaleAnswer(updatedAt, block.timestamp, staleAfter);
        }
        uint8 actualDecimals = IPriceOracle(oracle).decimals();
        if (actualDecimals != expectedDecimals) {
            revert DecimalsMismatch(actualDecimals, expectedDecimals);
        }
        uint256 price = uint256(answer);
        bool ok = directionAbove ? price > threshold : price < threshold;
        return ok ? 1 : 0;
    }
}
```

LOP's predicate convention: non-zero return = pass. `checkPrice` returns `uint256` (not `bool`) to match `arbitraryStaticCall` expectations.

### `GasGuardStrategy`

```solidity
contract GasGuardStrategy {
    function isAllowed(uint256 maxBaseFee) external view returns (bool) {
        return block.basefee <= maxBaseFee;
    }
    function isAllowedUint(uint256 maxBaseFee) external view returns (uint256) {
        return isAllowed(maxBaseFee) ? 1 : 0;
    }
}
```

Both shapes are emitted because LOP's predicate convention wants `uint256` but downstream consumers may want `bool`. The integration test uses `isAllowedUint`.

### `TwapSliceGetter`

```solidity
contract TwapSliceGetter {
    uint256 public immutable totalAmount;
    uint256 public immutable sliceAmount;
    uint256 public immutable intervalSeconds;
    uint256 public immutable startTime;

    constructor(uint256 _total, uint256 _slice, uint256 _interval, uint256 _start) {
        totalAmount = _total; sliceAmount = _slice;
        intervalSeconds = _interval; startTime = _start;
    }

    function maxMakingAmountNow() public view returns (uint256) { ... }
    function getMakingAmount(uint256 requestedMaking, uint256 remainingMaking, bytes32)
        external view returns (uint256) { ... }
}
```

Implements LOP's `IAmountGetter`-shaped `getMakingAmount` signature. **Not wired through the codegen predicate tree** in v1 — TWAP is preview-only on the artifact side (`graphCodegenExecutable: false` in the catalog).

### `DcaSeriesRegistry`

```solidity
contract DcaSeriesRegistry {
    event DcaSeriesRegistered(bytes32 indexed key, address indexed maker, ...);
    function registerSeries(address maker, uint256 tranches, uint256 amountPerTranche,
                            uint256 intervalSeconds, uint256 seriesId)
        external returns (bytes32 key);
    mapping(bytes32 => Series) public series;
}
```

Pure metadata. Actual DCA fills come from off-chain order publication (the wizard emits `dca-orders.json`); this registry just lets a keeper or UI look up series parameters by key.

---

## Invariants

| # | Invariant | Where |
|---|---|---|
| 1 | Same `StrategyDocument` ⟹ byte-identical artifacts | `stableStringify` + deterministic predicate builders; asserted in `examples.test.ts` |
| 2 | `manifest.extensionHash === computeExtensionHash(extensions.json:extension)` | `generate.ts:131` |
| 3 | `manifest.lop.version === "4.3.2"` always (must match the Foundry submodule) | `generate.ts:204` (hard-coded) |
| 4 | `manifest.compiler.solidity === "0.8.23"` always (must match `foundry.toml`) | `generate.ts:200` (hard-coded) |
| 5 | `manifest.generatedFiles` lists every artifact including `manifest.json` itself | `generate.ts:207-211` |
| 6 | `predicateTree.mode === "single"` for non-graph or gas-guard-only templates | `generate.ts:231-251` |
| 7 | `predicateTree.mode === "and"` exactly when a `stop-loss` base has a `gas-guard` node in `doc.graph.nodes` | `generate.ts:251-272` |
| 8 | DCA tranches in `dca-orders.json` count equals `block.tranches` | `generate.ts:175-187` |

---

## Example

### Programmatic

```ts
import { generateArtifacts } from "@limit-canvas/codegen";
import { parseStrategyDocument } from "@limit-canvas/hook-dsl";

const doc = parseStrategyDocument(JSON.parse(/* DSL json */));
const { extensionHash, predicateTree, artifacts } = generateArtifacts(doc);

console.log(extensionHash);                  // 0x...
console.log(predicateTree.mode);             // "and" if gas-safe stop-loss
for (const artifact of artifacts) {
  console.log(artifact.relativePath, artifact.content.length);
}
```

### CLI

```bash
bun run packages/codegen/src/cli.ts \
  docs/examples/gas-safe-stop-loss.dsl.json \
  ./artifacts/gas-safe-stop-loss
```

The CLI refuses to write when `FOUNDRY_PROFILE=mainnet` is set and `doc.audited !== true`:

```bash
FOUNDRY_PROFILE=mainnet bun run packages/codegen/src/cli.ts ./strategy.json
# → "Refusing mainnet codegen: set audited: true in DSL"
# → exit 1
```

This is a static guardrail. It does not check whether `audited: true` is actually justified — that's the human review step.

---

## Testing

`packages/codegen/src/`:

- `generate.test.ts` — unit tests for `generateArtifacts` shape (manifest fields populated, predicate tree mode, dslHash determinism).
- `examples.test.ts` — snapshot-style tests over canonical strategies (gas-safe stop-loss graph, plain gas-guard). Run with `bun test` and asserts byte-equal output on regeneration. **This is the determinism guard.**

Run:

```bash
bun test packages/codegen
```

---

## Extending

### Add a Solidity field to an existing template

1. Update the template Solidity in **both** `packages/codegen/src/templates.ts` (string template) **and** `packages/contracts/src/templates/{X}Strategy.sol` (live source). Keep them in sync — they have to match for the integration tests to be valid.
2. Update the DSL schema in `hook-dsl` if the field is user-configurable.
3. Update the predicate builder in `lop-sdk` if the predicate calldata changes.
4. Add a Foundry test in `packages/contracts/test/unit/`.
5. Re-run `bun test packages/codegen` — the snapshot test will fail and force a manual review of the diff.

### Add a new template

This touches every package; see the "Extending" section of [`hook-dsl`](./hook-dsl.md#add-a-new-template). In `codegen` specifically:

1. Add a `generate{NewTemplate}Strategy` function in `templates.ts`.
2. Add a case in `generateArtifacts`' switch (`generate.ts:88`).
3. Decide whether the new template participates in `compilePredicateTree`'s `"and"` composition. If yes, add it to the gas-guard composition branch.
4. Update `riskNotes` and the manifest's expected catalog entry.
5. Add an `examples.test.ts` snapshot.

### Promote TWAP/DCA to full graph codegen

This is the P1 unblocker listed in the [1inch review](../1inch-review.md#p1--closes-the-production-grade-gap). Required changes in this package:

1. Model `IAmountGetter` segments in extension packing (`lop-sdk` work).
2. Extend `CompiledPredicateTree` (or a sibling `CompiledExtensionTree`) to include getter segments alongside predicates.
3. Update `compilePredicateTree` so TWAP composes with `gas-guard` correctly.
4. Update `TEMPLATE_CATALOG`'s `graphCodegenExecutable` to `true` for TWAP/DCA.
5. Add a LOP fill integration test that fills a TWAP slice through `fillOrderArgs`.

---

## Gotchas

- **`STRATEGY_PLACEHOLDER` (`0x000...001`) is baked into emitted predicate calldata.** The deploy script's job is to substitute the real strategy contract address before signing. The wizard makes this visible; an external integrator needs to know this or fills will revert (the call would go to the placeholder address).
- **`extensions.json` includes a salt computed with `saltHigh96 = 1n`.** This is a documentation placeholder, not a usable salt for a production maker. Real makers should compute their own `saltHigh96` (nonce, random, deterministic-per-order — pick a discipline) and recompute the salt with `buildSaltWithExtension`.
- **Template `t.sol` file is a placeholder.** `generateTestStub` emits a trivial `assert(true)` test. Real test coverage lives in `packages/contracts/test/`, not in the generated bundle. If you ship the bundle to a partner, they should treat the included `*.t.sol` as a scaffold, not a test suite.
- **Determinism depends on `stableStringify`.** Locally defined in `generate.ts:275`. It sorts object keys recursively. If you replace it with `JSON.stringify`, you lose determinism whenever V8 changes its key-iteration order across versions.
- **`bytecodeHash` is `null`.** Until P0 lands, the readiness panel's "Bytecode hash reviewed" checkbox is a UX placeholder, not a real hash review.

---

## See also

- [`hook-dsl`](./hook-dsl.md) — the input schema.
- [`lop-sdk`](./lop-sdk.md) — predicate calldata, extension packing, salt invariant.
- [`packages/contracts`](./contracts.md) — the Solidity templates whose source must match codegen's strings.
- [`docs/examples/gas-safe-stop-loss.manifest.sample.json`](../examples/gas-safe-stop-loss.manifest.sample.json) — a sample emitted manifest.
- [`docs/1inch-review.md`](../1inch-review.md) — limitations and what would need to change for production.
