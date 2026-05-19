# `packages/contracts` (Foundry harness)

The **Solidity side** of the project. Pins the 1inch Limit Order Protocol at tag `4.3.2`, ships four strategy template contracts, two naive-baseline contracts, three mock dependencies, and a five-tier test suite (unit, fuzz, integration, benchmark, deploy script smoke tests).

Run `forge test -vvv` here and you have the strongest available evidence that everything the studio promises about a generated bundle is also true at the protocol level.

---

## At a glance

| | |
|---|---|
| **Tooling** | Foundry (`forge`, `cast`, `anvil`) |
| **Solidity** | `0.8.23`, `via_ir = true`, `optimizer_runs = 200` |
| **LOP pin** | tag `4.3.2` via git submodule at `lib/limit-order-protocol/` |
| **Solidity utils** | `@1inch/solidity-utils@6.4.1` |
| **Profiles** | `default` (Anvil/local), `testnet`, `mainnet` |
| **CI** | `.github/workflows/ci.yml` — clones LOP fresh on every run and snapshot-checks benchmarks |
| **Test command** | `cd packages/contracts && forge test -vvv` |

---

## Directory layout

```
packages/contracts/
├── foundry.toml
├── .gas-snapshot
├── lib/                                      ← submodule + installs
│   ├── limit-order-protocol/                 ← pinned 4.3.2
│   ├── solidity-utils/                       ← @1inch/solidity-utils 6.4.1
│   ├── forge-std/
│   └── openzeppelin-contracts/
├── src/
│   ├── templates/                            ← LOP extension helpers (the product)
│   │   ├── StopLossStrategy.sol
│   │   ├── GasGuardStrategy.sol
│   │   ├── TwapSliceGetter.sol
│   │   └── DcaSeriesRegistry.sol
│   ├── benchmarks/                           ← naive baselines for gas comparison
│   │   ├── NaiveGasChecker.sol
│   │   └── NaiveStopLossChecker.sol
│   └── mocks/                                ← test fixtures only
│       ├── MockERC20.sol
│       ├── MockOracle.sol
│       └── MockWeth.sol
├── test/
│   ├── unit/                                 ← per-contract behavior
│   │   ├── GasGuardStrategy.t.sol
│   │   ├── StopLossStrategy.t.sol
│   │   ├── TwapSliceGetter.t.sol
│   │   └── DcaSeriesRegistry.t.sol
│   ├── fuzz/                                 ← property-style
│   │   └── GasGuardFuzz.t.sol
│   ├── integration/                          ← cross-contract, real LOP
│   │   ├── LopIntegration.t.sol              ← submodule smoke
│   │   └── LopFillIntegration.t.sol          ← real fillOrderArgs round-trip
│   ├── benchmark/                            ← gas snapshots
│   │   ├── GasGuard.benchmark.t.sol
│   │   └── StopLoss.benchmark.t.sol
│   └── helpers/
│       ├── LopOrderTestLib.sol               ← order/extension construction
│       └── LopHarness.sol                    ← shared mock fixtures
└── script/                                   ← Foundry deploy scripts
    ├── DeployStopLoss.s.sol
    ├── DeployGasGuard.s.sol
    ├── DeployTwapSlice.s.sol
    └── DeployDcaSchedule.s.sol
```

---

## Strategy templates

These are the contracts deployed by makers (or partners) and called by LOP via `arbitraryStaticCall` (predicates) or as amount getters / on-chain metadata. They must remain byte-aligned with the codegen package's emitted Solidity — the `examples.test.ts` snapshot suite in `codegen` is the canary for drift.

### `StopLossStrategy`

```solidity
contract StopLossStrategy {
  function checkPrice(address oracle, uint256 threshold, bool directionAbove)
    external view returns (uint256);
}
```

Reads `IPriceOracle.latestAnswer()`, reverts on non-positive answers, returns `1` if the directional comparison passes, `0` otherwise. LOP's predicate convention treats non-zero as pass.

> **L3 caveat:** does *not* check `updatedAt`, `answeredInRound`, decimals, or aggregator address allowlist. Production hardening is P0 in the [1inch review](../1inch-review.md#l3--stop-loss-assumes-ideal-oracle-behavior).

### `GasGuardStrategy`

```solidity
contract GasGuardStrategy {
  function isAllowed(uint256 maxBaseFee)     external view returns (bool);
  function isAllowedUint(uint256 maxBaseFee) external view returns (uint256);
}
```

`block.basefee <= maxBaseFee`. Both `bool` and `uint256` variants exist because LOP's predicate path wants `uint256`. Used by [`LopFillIntegrationTest`](../../packages/contracts/test/integration/LopFillIntegration.t.sol) as the load-bearing example.

### `TwapSliceGetter`

```solidity
contract TwapSliceGetter {
  function maxMakingAmountNow() public view returns (uint256);
  function getMakingAmount(uint256 requestedMaking, uint256 remainingMaking, bytes32)
    external view returns (uint256);
}
```

Implements LOP's `IAmountGetter`-shaped `getMakingAmount(requested, remaining, orderHash)`. Caps per-fill amount by `(elapsedSlices * sliceAmount)`. Constructor args: total, slice, interval, startTime — must be supplied when deploying.

> **Not yet wired through `fillOrderArgs` in an integration test.** Unit-tested in isolation; the LOP fill round-trip is P1 (see [1inch review](../1inch-review.md#p1--closes-the-production-grade-gap)).

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

On-chain metadata for off-chain DCA orders. A keeper or UI looks up series parameters by `keccak256(abi.encode(maker, seriesId, chainId))`. No execution logic — tranches are fulfilled by independent signed orders.

---

## Benchmarks

`src/benchmarks/` contains intentionally naive baselines. They exist so `forge snapshot` comparisons measure "are we better than the dumb implementation" rather than absolute numbers (which are noisy across Solidity / EVM versions).

- `NaiveGasChecker` — does the same `block.basefee <= maxBaseFee` check but lives in a separate contract, so a cross-contract benchmark surfaces the cost of an external call.
- `NaiveStopLossChecker` — same idea for stop-loss.

> **L9 caveat:** these are *helper-level* benchmarks. They don't measure `LimitOrderProtocol.fillOrderArgs` gas with the predicate in-line. Fill-path benchmarking is P0.

---

## Tests

Tests are organised by **purpose**, not by template. This lets you reason about coverage by asking "do we have a fill-path integration test?" rather than "did we test this contract?"

### Unit (`test/unit/`)

One file per template. Behavior verification with mocks.

- `GasGuardStrategy.t.sol` — boolean returns for various `vm.fee` settings.
- `StopLossStrategy.t.sol` — pass/fail above/below threshold with `MockOracle`.
- `TwapSliceGetter.t.sol` — slice cap evolves correctly with `vm.warp`.
- `DcaSeriesRegistry.t.sol` — registration emits event, mapping populated.

### Fuzz (`test/fuzz/`)

Property tests. Currently only one:

- `GasGuardFuzzTest::testFuzz_isAllowed(uint64 maxGwei)` — bounded fuzz over base-fee caps; asserts the strategy's verdict matches `block.basefee <= maxBaseFee` for the test-fixed `vm.fee`.

Expanding fuzz coverage to stop-loss (oracle price range), TWAP (timestamps + remainingMaking), and DCA (tranche index) is part of promoting those templates from `tested`/`benchmarked` to `audit-ready`.

### Integration (`test/integration/`)

Cross-contract tests that touch real LOP `4.3.2` contracts.

- `LopIntegration.t.sol` — submodule smoke test. Deploys `LimitOrderProtocol` and `PredicateHelper`, asserts non-zero addresses. If this passes, the submodule and imports resolve.
- `LopFillIntegration.t.sol` — **the load-bearing test.** Deploys LOP, deploys `GasGuardStrategy`, builds the extension with the same packing rules the SDK uses, computes the salt via the salt-low-160 invariant, signs the order as the maker, and calls `lop.fillOrderArgs(...)` as the taker. Three positive cases (low base fee, predicate pass, balance deltas correct) and two negative cases (high base fee reverts, `checkPredicate` view path).

This file is what proves the studio's promised extension format actually fills.

### Benchmark (`test/benchmark/`)

`forge snapshot`-friendly tests. Each file runs the optimised template once and the naive baseline once; `forge snapshot --check` compares gas against `.gas-snapshot` to detect regressions.

```bash
forge snapshot --match-path "test/benchmark/*"
forge snapshot --check --match-path "test/benchmark/*"
```

CI runs both — the first regenerates, the second asserts no regression. (The check would fail if a refactor made a template more expensive.)

---

## Helpers

### `LopOrderTestLib.sol`

The Solidity-side mirror of `@limit-canvas/lop-sdk`. Whatever the TS SDK packs, this library has to be able to reproduce — otherwise the integration test wouldn't match what the wizard generates.

| Function | Purpose |
|---|---|
| `buildPredicateExtension(bytes predicate)` | Build a predicate-only extension. Note: uses a *different but compatible* encoding from the TS SDK (offsets at bit 128 of `bytes32`, predicate appended unpadded) — both produce extensions whose `keccak256` low-160 satisfies LOP's salt rule. |
| `saltFromExtension(bytes extension)` | `uint256(keccak256(extension)) & ((1 << 160) - 1)`. The Solidity-side rule. |
| `defaultMakerTraits()` | `HAS_EXTENSION (bit 249) \| ALLOW_MULTIPLE_FILLS (bit 254)` |
| `buildOrder(maker, receiver, makerAsset, takerAsset, makingAmount, takingAmount, salt)` | Construct `IOrderMixin.Order` |
| `buildTakerFillArgs(extension, threshold)` | Construct `(TakerTraits, bytes)` for `lop.fillOrderArgs` — sets `MAKER_AMOUNT_FLAG`, `SKIP_ORDER_PERMIT_FLAG`, and extension length |
| `toVs(uint8 v, bytes32 s)` | Pack signature into LOP's compact `vs` format |

### `LopHarness.sol`

Reusable mock setup (maker token, taker token, oracle). Unused by `LopFillIntegrationTest` (which has bespoke setup) but available for future integration tests that share fixtures.

---

## Deploy scripts

`script/Deploy{Template}.s.sol` — Forge scripts that:

1. Read `DEPLOYER_KEY` from env (`vm.envUint`).
2. `vm.startBroadcast(key)`.
3. Deploy the template contract with hard-coded constructor args (or no args).
4. `console2.log` the deployed address.
5. `vm.stopBroadcast()`.

Run as:

```bash
export DEPLOYER_KEY=0x...
export RPC_URL=https://sepolia.infura.io/v3/...
FOUNDRY_PROFILE=testnet forge script script/DeployGasGuard.s.sol --broadcast --verify
```

**Mainnet path:**

```bash
FOUNDRY_PROFILE=mainnet forge script ...   # requires all readiness gates green in the wizard
```

The mainnet profile uses the same script files but with a different `eth_rpc_url` env binding. There is no in-script audit check — the studio enforces audit gating; the script trusts the user.

---

## Foundry config (`foundry.toml`)

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.23"
optimizer = true
optimizer_runs = 200
via_ir = true
fs_permissions = [{ access = "read-write", path = "./" }]

remappings = [
  "forge-std/=lib/forge-std/src/",
  "@openzeppelin/=lib/openzeppelin-contracts/",
  "limit-order-protocol/=lib/limit-order-protocol/contracts/",
  "@1inch/solidity-utils/=lib/solidity-utils/"
]

[profile.testnet]
eth_rpc_url = "${RPC_URL}"
etherscan_api_key = "${ETHERSCAN_API_KEY}"

[profile.mainnet]
eth_rpc_url = "${RPC_URL}"
etherscan_api_key = "${ETHERSCAN_API_KEY}"
```

> Per the project's permanent rules ([CLAUDE.md](../../CLAUDE.md)): remappings live in `foundry.toml` only, never in a top-level `remappings.txt`.

---

## Invariants

| # | Invariant | Where |
|---|---|---|
| 1 | LOP submodule is on tag `4.3.2`, not `master` | `.gitmodules` + CI `git clone --branch 4.3.2` |
| 2 | `block.basefee <= maxBaseFee` is the *only* gas-guard rule | `GasGuardStrategy.sol`, `GasGuardFuzz.t.sol` |
| 3 | `StopLossStrategy.checkPrice` reverts on `latestAnswer() <= 0` | `StopLossStrategy.sol:23` |
| 4 | `LopOrderTestLib.saltFromExtension` matches LOP's salt-low-160 rule | `LopOrderTestLib.sol:25` |
| 5 | Order maker traits include bit 249 (`HAS_EXTENSION`) | `LopOrderTestLib.sol:11`, `LopOrderTestLib.sol:29` |
| 6 | `forge test` exits 0 in CI before any PR can merge | `.github/workflows/ci.yml` |
| 7 | `.gas-snapshot` regression breaks CI | `forge snapshot --check` in CI |

---

## Examples

### Run everything once

```bash
cd packages/contracts
forge test -vvv
forge snapshot --match-path "test/benchmark/*"
forge snapshot --check --match-path "test/benchmark/*"
```

### Run just the LOP fill round-trip

```bash
forge test -vvv --match-path "test/integration/LopFillIntegration*"
```

Expected output:

```
[PASS] test_fillOrderArgs_gas_guard_succeeds_when_basefee_within_cap
[PASS] test_fillOrderArgs_gas_guard_reverts_when_basefee_exceeds_cap
[PASS] test_checkPredicate_passes_within_gas_cap
[PASS] test_checkPredicate_fails_above_gas_cap
```

If any of these fail, the studio's promised extension format does not produce a fillable order on LOP `4.3.2`.

### Deploy a stop-loss strategy to Sepolia

```bash
export DEPLOYER_KEY=0xYourPrivateKey
export RPC_URL=https://sepolia.infura.io/v3/...
export ETHERSCAN_API_KEY=...
FOUNDRY_PROFILE=testnet \
  forge script script/DeployStopLoss.s.sol --broadcast --verify
# → console2.log "StopLossStrategy 0x..."
```

The wizard surfaces these commands in the deploy step panel; running them is up to the user.

---

## Extending

### Add a unit test

Drop a `*.t.sol` into `test/unit/`. Inherit `Test` (or `LopHarness` if you need shared fixtures). No registration needed — `forge test` picks it up automatically.

### Add an integration test for a new template

```solidity
// test/integration/MyTemplateFill.t.sol
contract MyTemplateFillTest is Test {
  function setUp() public { /* deploy LOP + template + mocks */ }

  function test_fillOrderArgs_my_template_passes() public {
    bytes memory predicate = _myPredicate();
    bytes memory extension = LopOrderTestLib.buildPredicateExtension(predicate);
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);
    // ... build order, sign as maker, call fillOrderArgs as taker, assert deltas
  }
}
```

Pattern matches `LopFillIntegration.t.sol`. The harder part is encoding the predicate calldata — must mirror what `@limit-canvas/lop-sdk` produces.

### Add a benchmark

```solidity
// test/benchmark/MyTemplate.benchmark.t.sol
contract MyTemplateBenchmarkTest is Test {
  MyTemplate internal optimized = new MyTemplate();
  NaiveMyTemplate internal naive = new NaiveMyTemplate();
  function setUp() public { /* ... */ }
  function testBenchmark_optimized() public view { optimized.theCall(); }
  function testBenchmark_naive() public view { naive.theCall(); }
}
```

Then `forge snapshot` writes a new line to `.gas-snapshot`. Commit the snapshot. CI's `--check` will hold the line.

### Update LOP submodule

This is intentionally manual:

1. `cd lib/limit-order-protocol && git fetch --tags && git checkout v4.X.Y && cd ../..`
2. `git add lib/limit-order-protocol` and commit the new submodule SHA.
3. Update the `LOP version` literal in `packages/codegen/src/generate.ts:204`.
4. Update `.github/workflows/ci.yml`'s `--branch 4.X.Y` flag.
5. Re-run the full test suite — integration tests are the canary for breaking changes.
6. Note: the SDK's predicate calldata, the `LopOrderTestLib` encoding, and the salt rule may all need updates if the version bump is anything bigger than a patch.

---

## Gotchas

- **Solidity version is hard-coded in three places** (`foundry.toml`, the manifest literal in `codegen/generate.ts:200`, every `pragma` line). Bumping `solc` requires changing all three.
- **`fs_permissions` is read-write.** This is required for `forge snapshot` to write `.gas-snapshot`. It is not required for fills.
- **CI clones LOP fresh.** Locally, `lib/limit-order-protocol` is a git submodule. CI does `git clone --depth 1 --branch 4.3.2 ...` instead, because the project's `.gitmodules` setup historically didn't always restore the submodule in CI runners. Both paths must resolve to the same code at the `4.3.2` tag.
- **`forge snapshot --check` will fail loudly** if a benchmark regresses by even one gas unit. That's intentional — but it means every legitimate optimization requires committing an updated `.gas-snapshot` in the same PR.
- **`via_ir = true`** is required for some of the LOP contracts to compile under the optimiser. Don't disable it without re-testing the integration suite.
- **`audited: true` is enforced in codegen CLI, not in deploy scripts.** A user with shell access to the contracts directory can run `FOUNDRY_PROFILE=mainnet forge script ...` directly. The audit gate is a wizard-level check, not a Solidity-level one. The threat model assumes the maker is sane; the studio enforces gates against accidental mainnet, not malicious mainnet.

---

## See also

- [`hook-dsl`](./hook-dsl.md) — the DSL whose `block` types name these contracts.
- [`lop-sdk`](./lop-sdk.md) — TS-side mirror of the predicate / extension / salt encoding.
- [`codegen`](./codegen.md) — generates string templates that must match the Solidity source in `src/templates/`.
- [`studio`](./studio.md) — runs `forge test`, `forge snapshot`, and the `Deploy*.s.sol` scripts via the wizard's server actions.
- [`docs/plan/04-testing-and-benchmarks.md`](../plan/04-testing-and-benchmarks.md) — original test design.
- [LOP v4.3.2 source](https://github.com/1inch/limit-order-protocol/tree/4.3.2) — pinned upstream.
