# Testing and benchmarks

## Per-template suite

| Layer | Location | Purpose |
|-------|----------|---------|
| Unit | `test/unit/*` | Strategy helpers, getters |
| Integration | `test/integration/*` | Predicate pass/fail with mocks |
| Fuzz | `test/fuzz/*` | Bounded oracle price, basefee |
| Benchmark | `test/benchmark/*` | Gas vs naive `.benchmark.t.sol` |

## Harness

`test/helpers/LopHarness.sol` — deploys mocks, mints ERC20, builds minimal orders.

Full LOP fill tests run when `lib/limit-order-protocol` submodule is present; otherwise unit tests skip with `vm.skip(true)`.

## Production additions

- Snapshot generated artifacts from `examples/*.json`.
- Add negative tests for extension hash/salt mismatch.
- Add chain registry tests for known LOP deployments.
- Add UI-level tests for deploy gating and artifact preview.
- Add benchmark baselines for TWAP and DCA before marking v1 production-ready.

## Snapshots

```bash
cd packages/contracts && forge snapshot
```

CI runs `forge snapshot --check` with 3% regression tolerance (documented in workflow).

## Target table (fill path gas, indicative)

| Template | Optimized | Naive baseline | Notes |
|----------|-----------|----------------|-------|
| stop-loss | TBD in CI artifact | nested oracle reads | |
| gas-guard | TBD | external checker | |
| twap-slice | TBD | full fill | Requires realistic partial-fill benchmark |
| dca-schedule | TBD | single order | Requires generated order-array benchmark |

Update this table from CI gas report artifacts after first green run.
