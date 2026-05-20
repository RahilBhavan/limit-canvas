# MEMORY.md

## 2026-05-19 — Feature audit + front-door doc resync for portfolio readiness

What: Audited every feature — 24 TS tests, 34 Foundry tests, typecheck across all 4 workspaces, and the full build (packages + Next.js studio) all pass; codegen generates valid bundles for all 4 templates. Fixed the two broken root scripts found: (1) `bun run lint` was failing with 39 errors all in `packages/*/dist/` build artifacts — added `**/dist` to `biome.json`'s `files.ignore`; (2) `bun run verify-extension` failed with `Cannot find module '@limit-canvas/hook-dsl'` because `scripts/` is not a workspace package — switched it to relative `../packages/*/src/index.ts` imports. Then resynced the three front-door docs to the actual P0/P1-complete state of the working tree: README ("Template library" now shows all 4 templates executable at audit-ready, "Honest limitations" replaced the 3 resolved P0 items with the genuine open ones, added oracle-hardening + real-bytecode-hash rows to the proof table); `docs/1inch-review.md` (marked L1/L4/L7/L8/L12 and P1 items 5–9 resolved, rewrote the TL;DR and closing read); `CLAUDE.md` sprint status.

Why: Goal was making the project a statement portfolio piece. The biggest self-inflicted wound was that README and 1inch-review.md still described the pre-P0/P1 state — calling the oracle "naive", the bytecode hash a "placeholder", and TWAP/DCA "preview-only" — when the working tree had all of that resolved. A reviewer reading those docs would discount a project that is actually much stronger. Correcting doc accuracy is higher-leverage for first impressions than adding product surface (consistent with the reviewer-first-impression focus).

Rejected: Committing the large uncommitted P1 working tree — global rules require an explicit user request to commit. Adding new product surface (new templates, keeper integration code) — the leverage was in correctly representing finished work, not adding more.

## 2026-05-19 — P0 release-blockers closed

What: Closed the four P0 items called out in `docs/1inch-review.md`. (1) **Oracle hardening**: `StopLossStrategy.checkPrice` now reads `latestRoundData()` and enforces positive answer + complete round (`updatedAt > 0` and `answeredInRound >= roundId`) + heartbeat freshness + decimals match; reverts with named custom errors on every integrity failure. DSL gains `staleAfter` and `decimals` (required). `MockOracle` extended with `setRound`/`setDecimals`/`latestRoundData`. Unit tests cover all 4 negative paths; integration tests prove a full `fillOrderArgs` succeeds on a fresh feed and reverts on stale / decimals-mismatch. Curated Chainlink oracle allowlist (`lop-sdk/src/oracle-registry.ts`) emits warnings when the configured aggregator isn't on the chain's known-good list, or when staleAfter is shorter than the feed's heartbeat. (2) **Bytecode hash**: `packages/codegen/scripts/snapshot-bytecode-hashes.ts` reads forge's `deployedBytecode.object`, keccaks it, and writes a committed `packages/codegen/src/bytecode-hashes.json`. `foundry.toml` strips IPFS metadata (`bytecode_hash = "none"`, `cbor_metadata = false`) so the hash is comment-independent and a `forge build` of the generated bundle matches the manifest. Codegen embeds the hash; UI exposes it via a new `bytecode-hash` readiness gate (with hash inline) + Sign-off checkbox + manifest summary entry. CI re-runs the snapshot and `git diff --exit-code` enforces it stays in sync. (3) **Audit provenance**: replaced "audited: boolean" with an additive `audit: { auditor, reportUrl, scope, commitHash, date }` Zod schema; manifest carries it verbatim; validate.ts warns when `audited: true` is set without a populated `audit` object. UI shows `{auditor · date · commit(8)}` in the manifest evidence grid. (4) **Fill-path benchmark**: `test/benchmark/StopLossFill.benchmark.t.sol` snapshots gas for a real `fillOrderArgs` on a stop-loss-AND-gas-guard composed extension (currently 208,825 gas). `.gas-snapshot` updated; CI's existing `forge snapshot --check` enforces it.

Why: The 1inch-style internal review (`docs/1inch-review.md`) explicitly framed these four as "mandatory before mainnet claims" and the rest of the work as "scoped, not foundational." User goal was release-readiness — closing P0 means we can honestly point a partner at the stop-loss story as the flagship demo without the "stale oracle would fill" / "bytecode hash is a placeholder" footguns the review flagged.

Rejected: Making the codegen template byte-identical to the committed template (so a maker's `forge build` produces the same hash) was rejected as more brittle than configuring solc to strip metadata via `bytecode_hash = "none"`; metadata stripping is a 2-line foundry.toml change that survives future comment edits. Putting the oracle allowlist into `hook-dsl` was rejected to preserve the package layering (`hook-dsl` must not depend on `lop-sdk`); the allowlist warning is computed in `codegen` where both are available. Replacing the boolean `audited` entirely was rejected — `audit?: {…}` is additive, doesn't break existing example DSLs, and the `validate.ts` warning steers makers toward the structured form for mainnet.

## 2026-05-19 — UI legibility + spacing polish

What: Pure CSS + layout polish on `apps/studio` to make the wizard easier to scan and stop competing surfaces from overlapping. (1) Loaded the two intended fonts for real — `Inter` (sans) and `JetBrains Mono` (mono) via `next/font/google` in `apps/studio/src/app/layout.tsx`, exposed as `--font-sans` / `--font-mono`, and routed every `font-family` in `globals.css` through them. Previously the CSS referenced "Inter"/"Geist Mono" but nothing actually loaded them; users saw system fallback. (2) Bumped base type from 14→15px and line-height to 1.5; tightened uppercase mono labels from 0.09em→0.06em letter-spacing. (3) Replaced fixed `top: 76px` sticky offset with a real `--nav-h` token derived from nav height. (4) Composer grid: 3-col ≥1320 → 2-col 960–1320 (proof slides under canvas) → 1-col <960. Topbar converted from rigid 3-col grid to flex-wrap so identity/status/actions don't collide on narrow widths. (5) Calmer phase-rail "current" state — accent index + 2px accent bottom stripe only — so the topbar primary CTA is the only solid-orange surface on screen. Removed ambient orange radial gradient from `body`. (6) Bigger input padding (8→10/12px) + focus rings, real `:focus-visible` outline baseline, larger touch targets on dock-tabs / nav links / small ghost buttons.

Why: User goal was "easy to use, no overlap, good spacing, easy to digest, 2 fonts max." The biggest single regression was that no font was actually being downloaded — the system fallback made every layout decision feel off. After that, the multiple orange surfaces (CTA, phase-rail current, body radial) all fought for attention and the 1180px composer breakpoint dumped most laptops straight from 3-col to 1-col.

Rejected: Splitting `compose-wizard.tsx` was rejected again — same reason as the 2026-05-18 polish pass: pure refactor, no user payoff. Switching to a different mono (e.g. Geist Mono) was rejected because JetBrains Mono ships well-tuned at small sizes and matches the engineering-console direction. Adding a third "display" font for headings was rejected to honor the explicit 2-font cap.

## 2026-05-18 - Reviewer-first-impression polish pass

What: Rewrote the README around a 1-line hook + ASCII architecture diagram + 60-second demo + claims-with-evidence table + reading paths by time budget. Added a top-level `CODE_TOUR.md` walking the 5 load-bearing files (`LopFillIntegration.t.sol`, `extension.ts`, `predicates.ts`, `generate.ts`, `schemas.ts`) with a glossary and "what lives where" cheat sheet. Sharpened the in-app onboarding overlay (plain-language hook, named buttons, lede paragraph). Filled the `[manual]` Sprint + "What I Am" placeholders in `CLAUDE.md` and `AGENTS.md` so the repo doesn't read as half-finished.

Why: The project is already deep and well-documented internally (1inch-review.md, docs/packages, plan pack). The leverage for "world-class portfolio + easy to understand" was at the funnel — what a reviewer sees in the first 30 seconds on GitHub and the first 5 seconds in the app — not in adding more templates or codegen surface.

Rejected: Splitting the 1444-line `compose-wizard.tsx` was rejected because it's a pure refactor with no user-visible payoff and violates "no abstractions beyond what the task requires." Adding screenshots/GIFs was deferred because that's a capture task, not a code task, and the README now points to the demo explicitly.

## 2026-05-18 - Production-grade direction

What: Position Limit Canvas as a production-grade protocol expansion product, not only a hackathon demo.

Why: The intended bar is full production readiness: secure template library, deterministic codegen, full Foundry test harness, gas benchmarks, deploy guardrails, and a small UI that makes LOP extensions usable without expert-level protocol knowledge.

Rejected: A narrow hackathon-only demo was rejected because it would underinvest in correctness, security, and deploy confidence. An SDK-first-only path was rejected because the product needs UI, docs, contracts, and test harnesses together to prove the workflow.

## 2026-05-18 - Template selection policy

What: Keep the initial executable template set focused on stop-loss, gas guard, TWAP slice, and DCA schedule, then add production templates only when each ships with schema, codegen, contracts/tests, fuzzing, benchmarks, and generated docs.

Why: The core four cover high-signal LOP extension surfaces: predicates, amount getters, partial fills, order series, and gas-aware execution. Adding DSL enum values before the full harness exists would create false product surface.

Rejected: Adding every advanced template to the executable DSL immediately was rejected because unsupported generated artifacts would weaken the production promise.

## 2026-05-18 - Production Composer v1 shape

What: Replace the JSON-first composer with a three-column engineering console: structured strategy controls, simulation/preview, and a proof/readiness panel. Keep JSON as an Advanced tab.

Why: The product should feel like a protocol workstation that makes strategy behavior and deploy risk inspectable before signing or broadcasting.

Rejected: A node canvas was deferred because the core four templates need trustworthy controls, evidence, manifests, and test feedback before open-ended visual composition.

## 2026-05-18 - Visual Composer direction

What: Add a React Flow canvas as the primary visual strategy surface, with draggable template blocks and a local prompt-to-canvas sketch box.

Why: The product should feel like a visual order-logic builder rather than a form or JSON editor, while still compiling down to the existing DSL/codegen/proof pipeline.

Rejected: Calling external ChatGPT/OpenAI APIs directly in v1 was deferred because external API calls require explicit confirmation and key management; the first implementation keeps prompt sketching local.

## 2026-05-18 - Portfolio story

What: Center the portfolio narrative on a gas-safe stop-loss demo: price condition plus gas guard plus LOP extension plus proof gate.

Why: A single killer flow is more memorable than a broad list of templates, and it demonstrates protocol understanding, visual design, simulation, artifacts, and verification together.

Rejected: Presenting the app as a generic no-code DeFi builder was rejected because the strongest story is specifically about making 1inch LOP extension development safer and easier.

## 2026-05-18 - Dark lab visual system

What: Restyle the studio frontend around a restrained near-black lab interface: white-on-canvas typography, translucent pill controls, 8px charcoal panels, mono uppercase labels, and no decorative shadows.

Why: The product should feel like a precise frontier-protocol workstation rather than a colorful SaaS dashboard, matching the requested xAI-inspired design direction while keeping the existing composer and proof workflow intact.

Rejected: Keeping the previous green industrial palette was rejected because it made the app feel more like a terminal demo than a world-class protocol UI. Adding broad gradients, shadows, or filled CTA variety was rejected because the new direction depends on engineered restraint.

## 2026-05-18 - Graph-to-codegen portfolio path

What: Make the visual graph part of the strategy document and generated manifest, and compile the gas-safe stop-loss graph into a combined stop-loss plus gas-guard predicate tree.

Why: This closes the main portfolio gap between a convincing canvas demo and a real protocol artifact. The manifest can now prove which graph, nodes, edges, and compiled predicate tree produced the LOP extension hash.

Rejected: A fully general open-ended graph compiler was deferred because TWAP/DCA getter composition needs deeper protocol-specific tests before it should look production-safe.

## 2026-05-18 - Clean console UI pass

What: Replace the oversized workstation hero with a compact command bar, make the canvas the primary viewport object, collapse raw order fields behind Order details, and add a deploy preflight proof summary.

Why: Screenshots showed the app looked more like stacked prototype panels than a clean engineering console. The portfolio experience needs immediate canvas focus, less vertical scrolling, clearer proof status, and more intentional demo flow.

Rejected: Keeping every raw field visible by default was rejected because it hides the actual strategy-building task behind addresses and amounts. Removing advanced details entirely was rejected because protocol users still need inspectability.

## 2026-05-18 - Workbench Polish v2

What: Move primary actions into the top toolbar, collapse the left rail into workbench sections, make simulation an overlay inside the canvas stage, shrink artifacts into a compact inspector, collapse proof detail sections, and enlarge graph nodes.

Why: Follow-up screenshots showed the canvas, simulation, artifacts, and proof panel were still competing vertically. The interface needed a clearer center of gravity: graph first, proof summary second, details available on demand.

Rejected: Keeping the three-column page with a bottom dock was rejected because it pushed the actual workflow below the fold and made empty artifact states look like broken content.

## 2026-05-18 - Guided UX pass

What: Added Simple / Standard / JSON modes, clickable workflow stepper (Sketch → Review), collapsed technical proof sections by default, and opened Strategy review in Simple mode.

Why: Average users need a linear path and plain-language review first; protocol hashes and forge output stay available but out of the way.

Rejected: Auto-running proof on every step click was rejected to avoid surprise long-running forge commands; Prove step runs checks only when status is idle.

## 2026-05-18 - UX cleanup pass

What: Removed dead `extension-preview.tsx`, renamed misleading “ChatGPT sketch” copy, added plain-language strategy summary, dashed “Planning only” canvas nodes, unified Verify page copy, and linked Deploy to composer via `?template=`.

Why: The studio should read as a trustworthy builder for non-experts: honest labeling, visible planning-vs-executable distinction, and connected compose → verify → deploy flow.

Rejected: Keeping fake AI branding or duplicate preview components was rejected because it erodes trust for average users.

## 2026-05-18 - Proof UI improvement scope

What: Improve the existing gas-safe stop-loss story with step-by-step simulation, canvas validation badges, compiled predicate visibility, generated bundle fingerprints, and manifest summary cards rather than broadening the executable template catalog.

Why: The current project already has the core four templates and a graph-to-codegen path. The highest-confidence improvement is making the existing proof path more inspectable and portfolio-ready without creating unsupported template surface.

Rejected: Adding a new executable template immediately was deferred because project rules require every production template to include schema, codegen, Solidity helpers when needed, examples, Foundry tests, fuzz cases, benchmarks, and generated docs.

## 2026-05-18 - Canvas customization boundary

What: Make canvas nodes persistently movable and add draggable blueprint sections for custom strategy planning, while keeping generated artifacts limited to supported executable templates.

Why: Users need a more tactile visual builder and a place to sketch custom strategy sections, but project rules require new production templates to ship with full schema, codegen, contracts, tests, fuzzing, benchmarks, and docs.

Rejected: Treating arbitrary custom sections as generated templates was rejected because it would imply unsupported Solidity/codegen behavior.
