# Template roadmap

## Production template policy

A template is not part of the executable product until it has:

- DSL schema and examples
- codegen for Solidity, tests, deploy script, and generated README
- Foundry unit and LOP integration tests
- fuzz coverage for boundary conditions
- gas benchmark vs a naive baseline
- UI metadata and preview rendering
- documented risks and keeper assumptions

## v1 executable set

| Template | Why it belongs in v1 | LOP surface | Production additions needed |
|----------|----------------------|-------------|-----------------------------|
| Stop-loss / take-profit | Familiar strategy, proves oracle-gated predicates | Predicate + arbitrary static call | Stale oracle guard, decimals config, Chainlink interface docs |
| Gas guard | Simple, memorable conditional fill | Predicate on `block.basefee` | EIP-1559 edge cases, basefee fuzzing, chain caveats |
| TWAP slice | Shows partial fills and dynamic making amount | Partial fills + amount getter + time predicate | Remaining amount accounting, realistic fill benchmarks |
| DCA schedule | Shows order series and keeper/liveness story | Multiple orders + metadata registry | Keeper adapter docs, order payload array export |

## v1.1 candidates

| Template | Use case | Notes |
|----------|----------|-------|
| Oracle band | Fill only inside/outside a price range | Extends stop-loss with min/max bounds and stale-price guard |
| Deadline window | Fill only between start/end timestamps | Useful reusable predicate block; likely no helper contract needed |
| Private/allowlisted taker | OTC/RFQ-like constrained fills | Prefer native maker traits where possible |
| Slippage guard | Require minimum realized amount or price | Needs careful interaction with existing order price semantics |
| Volatility pause | Pause fills when oracle movement exceeds threshold | Requires multiple oracle observations or off-chain attestation |

## v2 candidates

| Template | Use case | Why later |
|----------|----------|-----------|
| Dutch auction | Dynamic price over time | LOP supports dynamic amount getters; needs careful math/audit |
| Range order | Price curve depends on filled volume | More complex getter invariants and gas benchmarking |
| Portfolio rebalance | Conditional multi-asset rotation | Larger UX, solver, and risk surface |
| Cross-chain intent helper | Chain-specific settlement assumptions | Depends on external infra and 1inch roadmap alignment |

## Default recommendation

Keep the core four as v1. They cover the most important primitives without turning the first production release into a grab bag. Add oracle band and deadline window next because they compose naturally with the existing predicate system and are easier to audit than dynamic pricing templates.
