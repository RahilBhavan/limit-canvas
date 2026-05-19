# CLAUDE.md

<!-- Last generated: 2026-05-18 -->
<!-- Global rules in ~/.claude/CLAUDE.md apply automatically. -->

## Project

**Name:** Limit Canvas
**Stack:** TypeScript · Next.js 15 App Router · Foundry · Bun
**Architecture:** Monorepo — DSL + codegen + Solidity templates + Next.js wizard for 1inch LOP v4.3.2 extensions
**Deployment:** Vercel (studio), Foundry scripts (contracts)
**Status:** Active development

---

## Stack — never suggest alternatives unless asked

**Language:** TypeScript 5.x strict
**Runtime:** Bun
**Framework:** Next.js 15 App Router (`apps/studio`)
**Package manager:** Bun workspaces
**Database:** None (v1)
**Styling:** Tailwind CSS 4 + shadcn-style components
**Testing:** Bun test (TS), Foundry (Solidity)
**Linting:** Biome
**CI:** GitHub Actions

---

## Code Standards

**Commits:** conventional — feat/fix/chore/docs/test
**Branches:** never commit directly to `main`
**PR size:** &lt;400 lines where possible
**Tests:** every template has unit + integration + benchmark
**Types:** no `any`; Zod at DSL boundaries
**Errors:** validate early in hook-dsl; never swallow in codegen

---

## File & Folder Conventions

```
limit-canvas/
├── apps/studio/           # Next.js UI
├── packages/hook-dsl/     # Strategy DSL
├── packages/lop-sdk/      # Extension packing
├── packages/codegen/      # Artifact generator
├── packages/contracts/    # Foundry
├── docs/plan/
└── scripts/
```

**Naming:** files kebab-case; components PascalCase; Solidity contracts PascalCase

---

## Permanent Rules

- Pin LOP to tag **4.3.2** in `packages/contracts/lib/limit-order-protocol`
- Remappings live in `foundry.toml` only, not `remappings.txt`
- Extension hash must match salt low 160 bits — validate in `lop-sdk` before deploy
- Mainnet deploy only when DSL `audited: true` and user confirms bytecode hash
- Prefer LOP predicate primitives over custom Solidity when possible
- Use `bun` for all package scripts, not npm/yarn

---

## Deployment & Environments

**Environments:** local (Anvil) / testnet (Sepolia) / mainnet
**Local setup:** `bun install` && `bun run dev`
**Test command:** `bun run test`
**Build command:** `bun run build`
**Lint command:** `bun run lint`

---

## Current Sprint

**Sprint goal:** Portfolio-grade polish on the gas-safe stop-loss story (visual canvas → manifest → proof).
**My current focus:** Reviewer-friendliness — README, code tour, in-app onboarding, plain-language strategy review.
**Active tasks:** Onboarding overlay clarity; `CODE_TOUR.md` surfacing the load-bearing files; README hook + diagram.
**Blocked on:** P0 items in [`docs/1inch-review.md`](docs/1inch-review.md) — oracle hardening, real bytecode hash, audit-provenance schema, fill-path benchmark.

---

## What I Am and What I Know

**Role:** Solo builder — frontend + Solidity + DSL + codegen.
**Strong in:** TypeScript, React, schema design, deterministic codegen, LOP v4 extension layout.
**Still learning:** Foundry fuzz strategy, Chainlink consumer hardening patterns, multichain deploy ergonomics.
