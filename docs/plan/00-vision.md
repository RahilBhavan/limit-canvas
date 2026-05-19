# Vision

## Problem

1inch Limit Order Protocol v4 is powerful: predicates, amount getters, pre/post interactions. Building extensions is expert-only — packing extension calldata, extension hashes in salt, and trait flags is error-prone. Most teams never extend LOP.

## Product

**Limit Canvas** — a production-grade no-code/low-code composer for LOP extension strategies:

- Template library: stop-loss, gas guard, TWAP slice, DCA schedule, with stricter expansion gates for future templates
- Typed DSL + codegen → Solidity, Foundry tests, deploy scripts
- Test harness + fuzz tests + gas benchmarks vs naive baselines
- Next.js wizard: compose → preview → generate → test → deploy

## Why 1inch cares

- Aligns with **Unite DeFi Track 2** (LOP expansion)
- Grows order flow on LOP by lowering integration cost
- OSS (MIT) reference implementations partners can fork

## Demo narrative (Unite / ETHGlobal style)

1. Pick **Stop-loss** template, set Chainlink feed + floor price
2. Preview predicate tree + extension hash
3. Generate artifacts, run `forge test` from UI
4. Deploy strategy helper to Sepolia, create signed order with `limit-order-protocol-utils`

## Success metrics (v1)

- 4 templates with passing Foundry + snapshot benchmarks
- Extension hash mismatch caught before deploy
- &lt;30s local artifact generation from DSL
- Generated artifact manifest includes DSL hash, compiler version, LOP tag, template version, and extension hash
- Mainnet path is gated behind audited template status, bytecode hash review, and explicit confirmation
