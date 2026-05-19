# Why Limit Canvas

## The problem

[1inch Limit Order Protocol (LOP) v4](https://github.com/1inch/limit-order-protocol) supports rich order logic: predicates, amount getters, partial fills, and interaction hooks. Most teams never use that surface because:

- Extension calldata must be packed with correct offsets.
- The low 160 bits of order `salt` must match `keccak256(extension)`.
- Wrong trait flags silently break fills at execution time.

That work is expert-only and error-prone.

## What this project does

Limit Canvas is a **protocol workstation** for LOP extensions:

1. **Compose** — visual graph + typed DSL for common strategies (stop-loss, gas guard, and more).
2. **Simulate** — replay fill conditions before signing (price, base fee, TWAP caps).
3. **Generate** — deterministic Solidity, tests, deploy scripts, and `manifest.json`.
4. **Prove** — Foundry unit/integration/fuzz tests and gas benchmarks against naive baselines.

The portfolio hero flow is **gas-safe stop-loss**: oracle price condition **and** gas guard, compiled to a single LOP predicate tree with an auditable manifest.

## Why 1inch cares

- Aligns with **LOP expansion** (lower integration cost → more order flow on LOP).
- Ships **MIT OSS** reference templates partners can fork.
- Does **not** replace 1inch products — it helps builders use LOP correctly.

## What is not claimed

- Not an official 1inch product unless separately approved.
- v1 does **not** submit orders to the Orderbook API (exports payload shape only).
- TWAP/DCA are **simulate / preview** until full graph codegen and LOP fill tests land.

## Links

- LOP repo: https://github.com/1inch/limit-order-protocol (pinned at **4.3.2** in this monorepo)
- Orderbook API docs: https://business.1inch.com/portal/documentation/apis/orderbook/methods/v4.1/1/method/post
- Plan pack: [docs/plan/README.md](./plan/README.md)
