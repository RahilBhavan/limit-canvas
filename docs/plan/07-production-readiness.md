# Production readiness

## Production promise

Limit Canvas is only production-grade if every generated strategy is reproducible, testable, benchmarked, and explainable before a maker signs or deploys anything. The studio should feel like an engineer-in-a-box for 1inch LOP extensions, not a form that emits risky calldata.

## Release gates

| Gate | Required evidence |
|------|-------------------|
| Protocol pin | LOP dependency points to an audited tagged release, not `master` |
| DSL determinism | Same strategy JSON always emits byte-identical artifacts |
| Extension correctness | Extension packing, offsets, maker traits, and salt hash are validated before deploy/fill |
| Template tests | Unit, integration, fuzz, benchmark, and generated artifact tests pass |
| Mainnet guard | `audited: true`, bytecode hash display, chain/address verification, explicit user confirmation |
| Gas report | Snapshot generated for optimized template and naive baseline |
| Docs | Generated README explains assumptions, risks, fill requirements, and keeper requirements |

## Security model

- Treat generated contracts as template instances, not arbitrary user-authored Solidity.
- Keep user input inside a typed DSL and validated numeric/address fields.
- Make extension hash mismatches impossible to miss in the UI and CLI.
- Require chain-specific LOP address validation before signing or deploying.
- Do not submit orders to external APIs automatically in v1; generate payloads and require explicit user action.
- Keep DCA/TWAP keeper automation off-chain in v1 and document liveness assumptions.

## Test matrix

| Layer | Scope |
|-------|-------|
| DSL | Schema validation, cross-field constraints, bad address/amount rejection |
| SDK | Extension packing offsets, salt low-160 hash rule, maker/taker trait helpers |
| Codegen | Snapshot generated files from canonical examples |
| Contracts | Template helper behavior, mocks, revert paths |
| LOP integration | Fill pass/fail paths through pinned LOP contracts when submodule exists |
| Fuzz | Oracle price, base fee, timestamps, tranche counts, partial fill amounts |
| Benchmarks | Optimized vs naive implementation for each template |
| UI | Template selection, preview accuracy, generated artifact download, mainnet disabled states |

## Operational guardrails

- Generated deploy scripts read `DEPLOYER_KEY`, `RPC_URL`, and `ETHERSCAN_API_KEY` only from env.
- Mainnet profile must be blocked for unaudited templates.
- Generated artifact bundles include a manifest with DSL hash, generated timestamp, compiler version, LOP tag, and template version.
- CI should fail on lint, typecheck, package tests, Foundry tests, and gas snapshot regression once baselines are stabilized.

## Open production questions

- Which audit provider or internal review process will label a template `audited: true`?
- Should the studio ever submit to the 1inch Orderbook API directly, or always export payloads?
- Which chains are supported at launch beyond Ethereum/Sepolia?
- What is the canonical keeper story for TWAP and DCA: docs only, Chainlink Automation, Gelato, or 1inch resolver integration?
