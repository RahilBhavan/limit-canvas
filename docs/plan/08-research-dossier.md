# Research dossier

## Primary sources checked on 2026-05-18

- 1inch Limit Order Protocol repository: https://github.com/1inch/limit-order-protocol
- 1inch Orderbook API docs: https://business.1inch.com/portal/documentation/apis/orderbook/methods/v4.1/1/method/post
- 1inch Limit Order SDK repository: https://github.com/1inch/limit-order-sdk
- 1inch help center overview: https://help.1inch.io/en/articles/4656415-1inch-v4-limit-orders

## Protocol facts that shape the product

- The 1inch protocol repository warns that `master` is work-in-progress and production consumers should use audited tagged releases.
- LOP v4 supports conditional execution, arbitrary maker interactions, predicates, partial/multiple fill behavior, Permit2, expiration, private takers, nonce/epoch cancellation, and dynamic amount getters.
- Order extensions are ABI-encoded segments including maker/taker asset suffixes, making/taking amount getters, predicate, permit, pre-interaction, and post-interaction.
- If an extension exists, the low 160 bits of the order salt must equal the low 160 bits of the extension hash.
- The current Orderbook API uses `POST https://api.1inch.com/orderbook/v4.1/{chain}` for order submission and requires signed typed-data order payloads.
- Filling orders with extensions uses the SDK fill-args path with extension calldata attached through taker traits.

## Product implications

- The studio must show extension hash and salt compatibility as a first-class preview item.
- The studio should pin a protocol version and expose the pin in generated manifests.
- The no-code composer should hide calldata layout but never hide the resulting extension payload.
- Production support means API payload export and SDK compatibility tests, even if the studio does not submit orders itself.
- Template claims should be conservative: `audited` must mean reviewed template implementation, not audited user strategy intent.

## Competitive angle

Limit Canvas should win by making sophisticated LOP strategies boring to ship:

- users choose a known template,
- fill in typed parameters,
- inspect generated Solidity/calldata/tests,
- run the harness,
- compare gas,
- deploy or export with explicit guardrails.

The differentiator is not a prettier visual node editor. It is trustworthy generation of protocol-correct extensions with evidence attached.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extension packing drift vs upstream LOP | Orders fail or fill incorrectly | Pin version, add SDK compatibility tests, snapshot offsets |
| Oracle assumptions in stop-loss | Bad fills from stale or malformed prices | Add stale-price fields before mainnet, validate decimals, document oracle trust |
| TWAP/DCA liveness | Strategy only works if takers/keepers act | Document off-chain liveness and add keeper adapters after v1 |
| Mainnet misuse | Users deploy unaudited generated helpers | Hard mainnet gates and bytecode confirmation |
| Gas benchmark theater | Benchmarks do not reflect realistic fills | Include LOP integration path benchmarks, not only helper-call microbenchmarks |
| UI overpromises safety | No-code users miss protocol risk | Generated README, visible risk labels, and test status badges |

## Research backlog

- Confirm exact LOP extension offset layout against the pinned `4.3.2` contracts and SDK.
- Build a chain registry from official 1inch deployment docs and verify addresses in tests.
- Review 1inch audit reports relevant to LOP v4.3.2 and extract template-specific constraints.
- Compare `@1inch/limit-order-sdk` generated order objects against local `lop-sdk` helpers.
- Identify whether orderbook submission requires API keys for all launch chains and how to represent that in deploy/export UX.
