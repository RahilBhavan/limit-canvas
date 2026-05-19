# Security

## Scope

Limit Canvas generates **template instances** from a typed DSL. It is not a general Solidity compiler for arbitrary user code.

## Threat model (v1)

| Risk | Mitigation |
|------|------------|
| Wrong extension → unfillable order | UI + SDK validate extension hash vs salt low-160; manifest records hash |
| Wrong LOP address | Chain registry check before deploy/readiness |
| Mainnet deploy of unaudited templates | `audited: true` gate, bytecode review UX, explicit confirmation |
| Leaked deployer keys | `DEPLOYER_KEY` / `RPC_URL` only via env; never commit secrets |
| Fake “AI” safety claims | LLM assist is optional; rules-based fallback; no auto mainnet |

## What we do not guarantee

- Generated contracts are **not** audited unless a template is explicitly marked `mainnet-enabled` with an internal review process.
- Simulation in the UI is **logical replay**, not an on-chain `simulate` call unless you run Foundry tests locally/CI.
- TWAP/DCA templates may be preview-only; do not treat them as production-ready without reading template maturity in the catalog.

## Reporting

For vulnerabilities in **this repository**, open a private report to the maintainer or use your program’s preferred channel.

For issues in **1inch LOP itself**, follow the [limit-order-protocol](https://github.com/1inch/limit-order-protocol) security policy.

## Safe usage checklist

1. Pin LOP to an **audited tag** (this repo uses **4.3.2**).
2. Run `bun test` and `forge test` before deploying generated artifacts.
3. Compare `manifest.json` `extensionHash` with on-chain salt before signing.
4. Use testnet first; keep mainnet behind audited templates + explicit confirmation.
