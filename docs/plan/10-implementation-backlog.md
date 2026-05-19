# Implementation backlog

## Phase A - correctness foundation

- Align generated Solidity pragma with checked-in Foundry compiler.
- Maintain a shared template catalog that separates executable templates from planned/research templates.
- Add generated artifact manifest with DSL hash, template version, compiler version, LOP tag, and extension hash.
- Add codegen snapshot tests for all examples in `examples/`.
- Add SDK compatibility test against `@1inch/limit-order-sdk` extension handling where practical.
- Add chain registry validation for supported LOP addresses.

## Phase B - template hardening

- Stop-loss: add oracle decimals and stale-answer configuration.
- Gas guard: fuzz `block.basefee` boundaries and document L2 caveats.
- TWAP slice: add tests for already-filled cumulative amount and end-of-schedule behavior.
- DCA schedule: generate order payload arrays and keeper hints.
- Add benchmark baselines for TWAP and DCA, not only stop-loss and gas guard.

## Phase C - studio production UX

- Add artifact manifest preview and download.
- Add test status panel with package/contract command output summaries.
- Add deploy dry-run before broadcast.
- Add mainnet disabled states with exact unmet gates.
- Add warning copy for keeper-dependent templates.

## Phase D - release hardening

- Add CI check for gas regressions with committed snapshots.
- Add Slither/static-analysis command if it runs reliably on the pinned dependency set.
- Add SECURITY.md with disclosure and template audit status policy.
- Add release checklist for tagging template versions.
- Add docs for integrating generated payloads with the 1inch Orderbook API.

## Phase E - v1.1 expansion

- Add oracle band template.
- Add deadline window reusable predicate.
- Add React Flow canvas backed by the same DSL.
- Add keeper adapters for Chainlink Automation or Gelato after the base DCA/TWAP flow is stable.
