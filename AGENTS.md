# AGENTS.md

<!-- Last generated: 2026-05-18 -->
<!-- Global rules in ~/.Codex/AGENTS.md apply automatically. -->

## Project

**Name:** Limit Canvas
**Stack:** TypeScript 5.x strict · Next.js 15 App Router · Foundry · Bun
**Architecture:** Bun monorepo for a visual/no-code 1inch Limit Order Protocol extension studio: Zod DSL, LOP extension SDK helpers, Solidity/test codegen, Foundry templates, and a Next.js wizard.
**Deployment:** Studio target is Vercel or static-compatible Next hosting; generated contracts deploy through Foundry scripts to local, testnet, or gated mainnet profiles.
**Status:** Active development toward production-grade MVP.

---

## Stack - never suggest alternatives unless asked

**Language:** TypeScript 5.x strict, Solidity 0.8.23 in checked-in contracts  
**Runtime:** Bun for workspace scripts, Foundry for Solidity  
**Framework:** Next.js 15 App Router in `apps/studio`  
**Package manager:** Bun workspaces  
**Database:** None in v1  
**Styling:** Tailwind CSS in `apps/studio`  
**Testing:** Bun test for TS packages, Foundry unit/integration/fuzz/benchmark tests for contracts  
**Linting:** Biome  
**CI:** GitHub Actions

---

## Code Standards

**Commits:** conventional commits preferred: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`  
**Branches:** never commit directly to `main` or `master`  
**PR size:** keep under 400 changed lines where practical; split larger feature work by package or template  
**Tests:** every production template needs DSL validation, codegen coverage, Foundry unit tests, LOP integration tests, fuzz cases, and gas benchmark baselines  
**Types:** no `any`; use Zod at DSL and artifact boundaries  
**Errors:** validate early and return actionable errors from DSL/codegen; never silently coerce invalid extension or salt data

---

## File & Folder Conventions

```text
limit-canvas/
├── apps/studio/           # Next.js composer, preview, test, deploy UI
├── packages/hook-dsl/     # Versioned Zod strategy schema
├── packages/lop-sdk/      # LOP extension packing and salt/hash helpers
├── packages/codegen/      # DSL to Solidity/tests/deploy artifacts
├── packages/contracts/    # Foundry templates, mocks, tests, benchmarks
├── docs/plan/             # Product, architecture, research, delivery plan
├── examples/              # Example strategy documents
└── scripts/               # Bench and verification scripts
```

**Key paths:**
- Entry point: `apps/studio/src/app/page.tsx`
- Studio actions: `apps/studio/src/app/actions.ts`
- DSL schema: `packages/hook-dsl/src/schemas.ts`
- Extension helpers: `packages/lop-sdk/src/extension.ts`
- Codegen templates: `packages/codegen/src/templates.ts`
- Solidity templates: `packages/contracts/src/templates/`
- Contract tests: `packages/contracts/test/`

**Naming:** TypeScript files use kebab-case where already established; React components use PascalCase; functions use camelCase; Solidity contracts use PascalCase.

---

## Permanent Rules - apply without exception

- Pin production LOP integrations to audited tagged releases; do not build against `master`.
- Extension hash validation is a release blocker: the low 160 bits of order salt must match the low 160 bits of `keccak256(extension)`.
- Mainnet deploy UX must require audited template status, explicit bytecode hash review, and an in-session user confirmation.
- Prefer native LOP predicates, traits, getters, and extension fields over custom contracts when they can express the same strategy.
- New templates must ship as a full set: DSL schema, codegen, Solidity helper if needed, examples, Foundry tests, fuzz cases, gas benchmark, generated README.
- Generated code must be deterministic from DSL input; avoid hidden network calls or mutable external state during generation.
- Use Bun for JS workspace commands and Foundry for contract commands.
- Keep deploy credentials in environment variables only; never commit secrets or generated private keys.

If any task conflicts with these, flag it before proceeding.

---

## Deployment & Environments

**Environments:** local Anvil, Sepolia/testnet, mainnet gated  
**Local setup:** `bun install` then `bun run dev`  
**Test command:** `bun run test`  
**Build command:** `bun run build`  
**Lint command:** `bun run lint`  
**Gas command:** `bun run bench`

---

## Hooks in effect

> No `.Codex/settings.json` was found during bootstrap. Do not bypass future hooks if added.

---

## Current Sprint

> Update every Monday.

**Sprint goal:** Portfolio-grade polish on the gas-safe stop-loss story (visual canvas → manifest → proof).  
**My current focus:** Reviewer-friendliness — README, code tour, in-app onboarding, plain-language strategy review.  
**Active tasks:** Onboarding overlay clarity; `CODE_TOUR.md` surfacing the load-bearing files; README hook + diagram.  
**Blocked on:** P0 items in `docs/1inch-review.md` — oracle hardening, real bytecode hash, audit-provenance schema, fill-path benchmark.

---

## What I Am and What I Know

**Role:** Solo builder — frontend + Solidity + DSL + codegen.  
**Strong in:** TypeScript, React, schema design, deterministic codegen, LOP v4 extension layout.  
**Still learning:** Foundry fuzz strategy, Chainlink consumer hardening patterns, multichain deploy ergonomics.

---

## Learned User Preferences

- Limit Canvas should serve average and non-technical users, not only protocol engineers; favor a guided product layer over adding more panels or Solidity surface area.
- The primary user outcome to optimize for is confidence in plain language: what the order does and whether it is safe to try on testnet.
- Prefer honest UI labeling: no fake AI branding; planning-only canvas nodes must be visibly marked as not included in generated code.
- Reduce information overload by deduplicating preflight/readiness UI, using step-scoped visibility, and progressive disclosure (one headline, one action, one status by default).
- Simple mode should stay the default focused path: fewer panels, plain-language review first, technical hashes and forge output collapsed unless expanded.
- Prefer a single guided compose flow (configure → simulate → generate → prove → export/deploy) over mentally separate Compose, Verify, and Deploy experiences.
- Studio UI changes should keep uniform buttons and readable typography via shared primitives in `apps/studio/src/app/globals.css`.
- 1inch-side project ideas should be world-class, solve real ecosystem problems, and align with LOP, Fusion+, grants, or integrator needs rather than generic swap clones.

---

## Learned Workspace Facts

- Active product repo in this workspace is `limit-canvas/`: Bun monorepo with Next.js 15 studio at `apps/studio/`.
- Studio composer exposes three UI modes: Simple (default), Standard, and JSON/advanced.
- Production-ready codegen templates are `stop-loss` and `gas-guard`; `twap-slice` and `dca-schedule` are preview-only and should not be pushed as Simple-mode codegen paths.
- Human-friendly inputs live in `apps/studio/src/lib/human-units.ts` (USD price, gas presets); plain-language summaries in `apps/studio/src/lib/strategy-summary.ts`.
- Studio nav is Compose, Verify (`/test`), and Deploy; a known UX issue is duplicate preflight surfaces (summary, status cards, mainnet progress, readiness list) competing with the workflow rail and mode tabs.
- Accepted simplification direction: collapse preflight in Simple mode, wire workflow steps to panel visibility, and prefer outcome-first simulation copy over raw technical fields up front.
