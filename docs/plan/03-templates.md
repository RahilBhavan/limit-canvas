# Template library

## stop-loss

- **Mechanism:** LOP `Predicate` — `gt(oraclePrice, threshold)` or `lt` for floor
- **Params:** `oracle`, `threshold`, `direction` (`above` | `below`)
- **Contract:** `StopLossStrategy.sol` — documents oracle interface; tests use `MockOracle`
- **Naive baseline:** duplicate nested `arbitraryStaticCall` reads (benchmark only)

## gas-guard

- **Mechanism:** Predicate — `block.basefee <= maxBaseFee`
- **Params:** `maxGwei` (converted to wei base fee cap)
- **Contract:** `GasGuardStrategy.sol` — pure view helper for predicate builder off-chain
- **Naive baseline:** external `GasChecker` contract per fill

## twap-slice

- **Mechanism:** `ALLOW_PARTIAL_FILLS` + max slice amount + time window predicate
- **Params:** `totalAmount`, `sliceAmount`, `intervalSeconds`, `startTime`
- **Contract:** `TwapSliceGetter.sol` — caps making amount per fill by slice index
- **Naive baseline:** single full-size fill order

## dca-schedule

- **Mechanism:** N orders sharing `series`; codegen emits order array + keeper hints
- **Params:** `tranches`, `amountPerTranche`, `intervalSeconds`, assets
- **Contract:** `DcaSeriesRegistry.sol` — emits series metadata for indexers
- **Naive baseline:** one-shot full amount order

## DSL `templateId` enum

`stop-loss` | `gas-guard` | `twap-slice` | `dca-schedule`

## Expansion rule

Do not add a new `templateId` to the executable DSL until its Solidity/codegen/test/benchmark/UI/docs bundle is ready. Candidate templates live in [09-template-roadmap.md](./09-template-roadmap.md) first.
