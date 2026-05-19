# Roadmap

## Phase 0 — Scaffold ✅

Monorepo, docs, CI skeleton, package stubs.

## Phase 1 — Core + stop-loss + gas-guard ✅

hook-dsl, lop-sdk, codegen MVP, two templates with tests.

## Phase 2 — TWAP + DCA + Studio ✅

Remaining templates, wizard UI, extension preview.

## Phase 3 — Deploy + polish ✅

Deploy scripts, mainnet guards, README, gas snapshots in CI.

## Phase 4 — Production hardening

- Artifact manifest and deterministic codegen snapshots
- Extension/salt mismatch negative tests
- Chain registry validation
- Stop-loss oracle stale-price and decimals support
- TWAP/DCA realistic benchmark coverage
- Studio deploy dry-run and bytecode hash confirmation
- Orderbook API payload export docs

## v1.1

- React Flow canvas ↔ same DSL
- Keeper starters (Chainlink Automation, Gelato)
- Template registry JSON + marketplace UX
- Optional Certora specs for `StopLossStrategy`
