# v1 scope

## In scope

- [x] Monorepo: hook-dsl, lop-sdk, codegen, contracts, studio
- [x] Templates: `stop-loss`, `gas-guard`, `twap-slice`, `dca-schedule`
- [x] Full Solidity codegen per template + Foundry tests
- [x] Gas benchmarks vs naive baselines (`forge snapshot`)
- [x] Deploy profiles: `local`, `testnet`, `mainnet` (mainnet gated)
- [x] Wizard UI with React Flow canvas + Simple/Standard/JSON modes
- [x] Artifact manifest with DSL hash, compiler version, LOP tag, template version, and extension hash
- [x] Codegen tests for canonical strategies (gas-guard, gas-safe stop-loss graph)
- [x] LOP integration: `fillOrderArgs` with gas-guard predicate (Foundry)
- [ ] Mainnet deploy dry-run and bytecode hash confirmation UX
- [ ] API payload export compatible with the 1inch Orderbook API shape

## Out of scope (v1)

- Full graph-to-codegen for TWAP/DCA combined getters (preview/simulate only in studio)
- On-chain DCA/TWAP scheduler (keeper docs only)
- Certora / formal verification (v2)
- Production audit of generated code (templates marked `audited` for mainnet allowlist)
- Automatic external orderbook submission from the UI

## Personas

- 1inch / partner engineers
- DeFi protocols integrating LOP
- Hackathon builders

All served via templates + README.generated.md per artifact bundle.
