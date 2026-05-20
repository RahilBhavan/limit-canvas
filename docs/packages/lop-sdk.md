# `@limit-canvas/lop-sdk`

The **protocol-correctness layer**. Everything in this package is a direct expression of a rule the 1inch Limit Order Protocol enforces at fill time: extension packing, predicate calldata shape, salt/extension-hash linkage, known LOP addresses, and the orderbook payload shape.

If any of these helpers drifts out of agreement with the pinned LOP `4.3.2` contracts, fills break — silently. This package is the single point where that drift would surface, and the [LOP integration test](../../packages/contracts/test/integration/LopFillIntegration.t.sol) round-trips its output through the real `LimitOrderProtocol.fillOrderArgs`.

---

## At a glance

| | |
|---|---|
| **Source** | `packages/lop-sdk/src/` |
| **Entry** | `packages/lop-sdk/src/index.ts` |
| **Runtime** | Bun / Node (pure TS, no I/O) |
| **Dependencies** | `viem` (for `keccak256`, `encodeFunctionData`, `encodeAbiParameters`) |
| **Tests** | `packages/lop-sdk/src/extension.test.ts` |
| **Imported by** | `codegen`, `apps/studio` |
| **Protocol pin** | LOP `v4.3.2` (matches the submodule in `packages/contracts/lib/limit-order-protocol`) |

---

## Public API

| Symbol | Signature | Purpose |
|---|---|---|
| `packPredicateOnlyExtension` | `(predicateCalldata: Hex) => Hex` | Build the predicate-only LOP extension (32-byte header + predicate calldata) |
| `computeExtensionHash` | `(extension: Hex) => Hex` | Low 160 bits of `keccak256(extension)`, hex-prefixed |
| `buildSaltWithExtension` | `(saltHigh96: bigint, extension: Hex) => bigint` | Compose a 256-bit order salt: high 96 bits free, low 160 bits = extension hash |
| `buildGasGuardPredicate` | `(strategyAddress: Hex, maxGwei: number) => Hex` | Predicate calldata that delegates to `GasGuardStrategy.isAllowed(maxBaseFee)` via `arbitraryStaticCall` |
| `buildStopLossPredicate` | `(strategyAddress: Hex, block: StopLossBlock) => Hex` | Predicate calldata that delegates to `StopLossStrategy.checkPrice(oracle, threshold, directionAbove)` |
| `buildCompareGt` | `(value: bigint, inner: Hex) => Hex` | Wrap a predicate in `PredicateHelper.gt(value, callData)` |
| `buildCompareLt` | `(value: bigint, inner: Hex) => Hex` | Wrap a predicate in `PredicateHelper.lt(value, callData)` |
| `buildAndPredicate` | `(predicates: Hex[]) => Hex` | Combine N predicates into `PredicateHelper.and(offsets, data)` |
| `LOP_REGISTRY` | `Record<chainId, address>` | Known LOP v4 deployments per chain |
| `getLopAddress` | `(chainId) => address \| undefined` | Registry lookup |
| `isKnownLopAddress` | `(chainId, address) => boolean` | Verify a user-supplied LOP address against the registry |
| `buildOrderbookPayloadShape` | `(doc, extension, salt) => OrderbookPayloadShape` | Build the JSON shape for `POST /orderbook/v4.1/{chain}` (no signing, no submission) |

`OrderbookPayloadShape` is a re-exported type.

---

## Core concepts

### Extension

In LOP v4, an **extension** is calldata attached to an order's taker-args buffer when the order needs anything beyond the default fill path (predicate, custom amount getters, pre/post interactions, permit, etc.). Its presence is signalled by **maker traits bit 249** (`HAS_EXTENSION`), and its low-160-bit hash is bound into the order salt.

The full extension format is a 32-byte offset header followed by concatenated segments. Each segment's **end-offset** lives in a 4-byte slot of the header. Slots correspond to:

| Header bytes | Segment |
|---|---|
| `[0..3]`   | maker asset suffix |
| `[4..7]`   | taker asset suffix |
| `[8..11]`  | making amount getter |
| `[12..15]` | taking amount getter |
| `[16..19]` | **predicate** |
| `[20..23]` | permit |
| `[24..27]` | pre-interaction |
| `[28..31]` | post-interaction |

This SDK only implements the **predicate-only** path: bytes `[16..19]` hold the predicate end-offset; all other slots stay zero.

### Predicate calldata

A predicate is a `bytes` blob that LOP feeds to `PredicateHelper.checkPredicate(...)` at fill time. The blob must decode to one of:

- `arbitraryStaticCall(address target, bytes data)` — call a view function on an external contract and treat a non-zero return as pass. This is what `buildGasGuardPredicate` and `buildStopLossPredicate` produce.
- `and(uint256 offsets, bytes data)` / `or(...)` / `not(bytes)` — boolean combinators. Only `and` is implemented in `buildAndPredicate`.
- `eq(uint256, bytes)` / `gt(uint256, bytes)` / `lt(uint256, bytes)` — value comparators. `buildCompareGt` and `buildCompareLt` produce the bytes shape but are currently unused by codegen.

The 4-byte selectors hard-coded in `predicates.ts` are LOP's `PredicateHelper` ABI:

| Selector | Function |
|---|---|
| `0xbf15fcd8` | `arbitraryStaticCall` |
| `0xbfa75143` | `and` (asserted in tests) |
| `0xca4ece22` | `lt` |
| `0x38c9c498` | `gt` |

### Salt / extension-hash linkage

**Rule (LOP v4):** when an order carries an extension, the **low 160 bits of the order salt** must equal the **low 160 bits of `keccak256(extension)`**. If they don't match, the fill reverts.

This SDK's `buildSaltWithExtension` enforces the rule on the producer side: `(saltHigh96 << 160) | extensionHashLow160`. The integration test enforces it on the consumer side via `LopOrderTestLib.saltFromExtension` (Solidity-side mirror).

---

## Module layout

```
packages/lop-sdk/src/
├── index.ts          ← public re-exports
├── extension.ts      ← packPredicateOnlyExtension, computeExtensionHash, buildSaltWithExtension
├── predicates.ts     ← arbitraryStaticCall wrappers, AND combinator, GT/LT comparators
├── registry.ts       ← LOP_REGISTRY for 10 chains
├── orderbook.ts      ← buildOrderbookPayloadShape (no submission)
└── extension.test.ts ← unit + property-style tests
```

---

## Invariants

| # | Invariant | Where |
|---|---|---|
| 1 | `salt & ((1<<160)-1) === BigInt(computeExtensionHash(extension))` | `buildSaltWithExtension`, asserted in test "salt low 160 bits matches extension hash" |
| 2 | `packPredicateOnlyExtension("0x") === "0x"` (empty in → empty out) | `extension.ts:13`, asserted in test "empty predicate has stable empty extension" |
| 3 | `computeExtensionHash` is deterministic for byte-identical input | asserted in test "stable hash for same predicate" |
| 4 | `buildAndPredicate` round-trips through viem's `decodeFunctionData` for `and(uint256,bytes)` | asserted in test "builds LOP PredicateHelper.and calldata with offsets" |
| 5 | `LOP_REGISTRY[1]` matches the official 1inch mainnet deployment | asserted in test "recognizes official mainnet LOP address" |
| 6 | Predicate end-offset stored at header bytes `[16..19]` (big-endian) | `extension.ts:18-21`; consumed by `LopOrderTestLib.buildPredicateExtension` Solidity mirror |
| 7 | Bit 249 in maker traits means `HAS_EXTENSION`; set by integration helper, exposed as `MAKER_TRAIT_HAS_EXTENSION` from `hook-dsl` | `LopOrderTestLib.sol:11`, `hook-dsl/validate.ts` |

---

## Extension packing in detail

```
Predicate-only extension layout (this SDK):

  bytes:   0                                               31  32                                  ?
           ┌──────────────────────────────────────────────────┬────────────────────────────────────┐
           │ 32-byte offset header                            │ predicate calldata (32-padded)     │
           │ all zeros except bytes [16..19] = endOffset (BE) │                                    │
           └──────────────────────────────────────────────────┴────────────────────────────────────┘

  where endOffset = 32 + ceil(predicateBytes / 32) * 32
                  = "byte index, from start of extension, where predicate segment ends"
```

`endOffset` is intentionally padded up to a 32-byte boundary even though the predicate itself isn't padded inside the extension. This matches LOP's offset-table convention where segment-end offsets are aligned.

The integration helper (`LopOrderTestLib.buildPredicateExtension`) uses a slightly different *Solidity-side* encoding (`offsets` placed at bit 128 of a `bytes32` header, predicate appended unpadded). Both encodings hash to a value the LOP contract will accept for the salt-low-160 check — the salt is computed over the chosen encoding, and the protocol only cares that the offsets decode correctly.

> **If you change the header encoding, you must update both `extension.ts` and `LopOrderTestLib.sol`** and re-verify the integration test still fills. See [the 1inch-review L7](../1inch-review.md#l7--predicate-composition-is-and-only).

---

## Predicate builders

### `buildGasGuardPredicate(strategyAddress, maxGwei)`

Produces calldata that LOP will execute as:

```solidity
arbitraryStaticCall(
  strategyAddress,
  abi.encodeWithSignature("isAllowed(uint256)", maxGwei * 1 gwei)
)
```

The deployed [`GasGuardStrategy.isAllowed`](../../packages/contracts/src/templates/GasGuardStrategy.sol) returns `block.basefee <= maxBaseFee`. LOP treats a non-zero return as "predicate passed."

### `buildStopLossPredicate(strategyAddress, block)`

Produces calldata that LOP will execute as:

```solidity
arbitraryStaticCall(
  strategyAddress,
  abi.encodeWithSignature(
    "checkPrice(address,uint256,bool,uint256,uint8)",
    block.oracle, block.threshold, block.direction === "above", block.staleAfter, block.decimals
  )
)
```

[`StopLossStrategy.checkPrice`](../../packages/contracts/src/templates/StopLossStrategy.sol) reads the latest aggregator data from the oracle via `latestRoundData()`, asserts that the answer is positive and not stale (within `staleAfter` seconds), verifies that the round is complete, and checks that the oracle's decimals match `expectedDecimals` on-chain before executing the comparison.

### `buildAndPredicate(predicates)`

Combines N predicate blobs into `PredicateHelper.and(uint256 offsets, bytes data)`.

```
offsets layout (per LOP):
  bits  0..31:  end-offset of predicate[0] (cursor after first predicate's bytes)
  bits 32..63:  end-offset of predicate[1]
  bits 64..95:  ...
```

The cursors are running totals of `bytes-so-far` after each predicate is concatenated into `data`. Verified against viem's ABI decoder in tests (`decoded.args[0] === 0x0000000600000004n` for two predicates of 4 and 2 bytes).

> **Why not `OR` / `NOT` too?** Out of v1 scope. The flagship demo only needs AND-composition (`stop-loss AND gas-guard`). Adding OR/NOT is mechanical — same ABI shape, different selectors. See P1 in the [1inch review](../1inch-review.md#p1--closes-the-production-grade-gap).

---

## `LOP_REGISTRY`

Hard-coded LOP v4 deployments. Values mirror the public README of the 1inch limit-order-protocol repo.

| Chain | Chain ID | LOP address |
|---|---|---|
| Ethereum | `1` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Optimism | `10` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| BSC | `56` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Gnosis | `100` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Polygon | `137` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| zkSync Era | `324` | `0x6fd4383cb451173d5f9304f041c7bcbf27d561ff` |
| Base | `8453` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Arbitrum | `42161` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Avalanche | `43114` | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Sepolia | `11155111` | `0x111111125421ca6dc452d289314280a0f8842a65` |

`isKnownLopAddress` does a case-insensitive comparison — both checksum and lowercase addresses are accepted.

The wizard surfaces this as a readiness gate ("LOP address"). A `network.lopAddress` that doesn't match the registry for `network.chainId` blocks the mainnet path.

---

## `buildOrderbookPayloadShape`

Produces the JSON shape expected by `POST https://api.1inch.com/orderbook/v4.1/{chain}` — but **does not sign and does not submit**.

```ts
{
  orderHash: "0x",      // filled by signer downstream
  signature: "0x",      // filled by signer downstream
  data: {
    makerAsset, takerAsset, maker, receiver,
    makingAmount, takingAmount,
    salt: salt.toString(),  // decimal string (the API expects this)
    extension,              // hex
    makerTraits: "0",       // not yet wired; see "Gotchas" below
  }
}
```

This is deliberately just a shape. The studio never POSTs to the orderbook in v1 — the user does. This keeps the trust surface small.

---

## Example

```ts
import {
  buildAndPredicate,
  buildGasGuardPredicate,
  buildStopLossPredicate,
  buildSaltWithExtension,
  computeExtensionHash,
  packPredicateOnlyExtension,
  isKnownLopAddress,
} from "@limit-canvas/lop-sdk";

// 1. Verify the LOP address belongs to chain.
if (!isKnownLopAddress(1, lopAddress)) {
  throw new Error("Unknown LOP address for this chain");
}

// 2. Build two predicate blobs.
const stopLoss = buildStopLossPredicate(
  STOP_LOSS_STRATEGY_ADDRESS,
  { type: "stop-loss", oracle: ORACLE, threshold: "300000000000", direction: "below" },
);
const gasGuard = buildGasGuardPredicate(GAS_GUARD_STRATEGY_ADDRESS, 25);

// 3. AND-combine them.
const combined = buildAndPredicate([stopLoss, gasGuard]);

// 4. Pack as a predicate-only extension.
const extension = packPredicateOnlyExtension(combined);

// 5. Compose the salt: 96 bits user-chosen, 160 bits from extension hash.
const salt = buildSaltWithExtension(/* user nonce */ 42n, extension);

// 6. Salt invariant holds:
const hash = BigInt(computeExtensionHash(extension));
const mask = (1n << 160n) - 1n;
console.assert((salt & mask) === hash);
```

---

## Testing

`packages/lop-sdk/src/extension.test.ts` covers:

- extension-hash determinism,
- salt/hash linkage (the load-bearing invariant),
- empty-predicate round-trip,
- `PredicateHelper.and` ABI shape (offsets table + concatenated data),
- registry positive case (mainnet address recognised),
- orderbook payload shape (no submission).

The deeper proof is in `packages/contracts/test/integration/LopFillIntegration.t.sol`, which packs a gas-guard predicate via this SDK's logic (mirrored in `LopOrderTestLib`), computes the salt with the same invariant, signs as the maker, and calls `lop.fillOrderArgs(...)` on the real pinned-`4.3.2` `LimitOrderProtocol`. Pass = the SDK is protocol-correct.

Run:

```bash
bun test packages/lop-sdk                       # SDK unit tests
cd packages/contracts && forge test -vvv \
  --match-path "test/integration/LopFillIntegration*"  # protocol round-trip
```

---

## Extending

### Add a new predicate primitive (e.g. `buildOrPredicate`)

Mechanically identical to `buildAndPredicate`. In `predicates.ts`:

1. Find the LOP `PredicateHelper` selector for `or` (`0x` + first 4 bytes of `keccak256("or(uint256,bytes)")`).
2. Reuse the offsets-table packing.
3. Add to `index.ts` exports.
4. Add a unit test that decodes back via `viem.decodeFunctionData`.
5. Add a positive case in `LopFillIntegration` if codegen will emit OR-composed predicates.

### Add a chain to the registry

Edit `registry.ts`. Make sure the address is from the **official 1inch deployment docs**, not third-party trackers. Add a test mirroring "recognizes official mainnet LOP address" for the new chain.

### Support a non-predicate extension segment (permit, pre/post interaction)

Currently out of scope. Adding one means:

1. New `pack...Extension` function alongside `packPredicateOnlyExtension` (and likely a generic `packExtension({ predicate?, permit?, preInteraction?, ... })`).
2. New offset bytes in the header per the table above.
3. Solidity-side mirror in `LopOrderTestLib`.
4. Integration test that fills an order using the new segment.

Don't put any of this in production until each step lands.

---

## Gotchas

- **`makerTraits` is hard-coded `"0"` in the orderbook shape.** The wizard surfaces `HAS_EXTENSION` via the readiness panel and integration tests set it explicitly via `LopOrderTestLib.defaultMakerTraits`, but `buildOrderbookPayloadShape` does not yet compute the maker-traits bitfield from the DSL. A downstream signer must set bit 249 themselves (and any other relevant flags: `ALLOW_PARTIAL_FILL`, `ALLOW_MULTIPLE_FILLS`, `USE_PERMIT2`, etc.). See [the 1inch review L8](../1inch-review.md#l8--maker-traits-are-partly-nominal).
- **`STRATEGY_PLACEHOLDER` in codegen.** The codegen builds predicate calldata against `0x000...001` because the real strategy address isn't known at codegen time (it's set at deploy). Downstream, the real address must be substituted into the predicate before the order is signed.
- **Predicate-only**. This SDK does not (yet) pack maker-asset suffixes, amount getters, permits, or pre/post interactions. If a future template needs one of those, the extension layout has to expand and this SDK + the Solidity helpers + the integration test all change in lockstep.
- **`saltHigh96` is user-chosen.** Pass a nonce or a deliberate random; do not reuse across orders for the same maker, or LOP will collide on order hashes.
- **Predicate composition is AND-only.** Codegen currently only emits `and(...)` for two-template compositions. OR / NOT exist in this SDK as primitives (well, GT/LT do; OR/NOT don't) but aren't wired through codegen.

---

## See also

- [`hook-dsl`](./hook-dsl.md) — defines `StrategyDocument`, which feeds this SDK's predicate builders.
- [`codegen`](./codegen.md) — assembles the predicate tree (single / and) and packs the extension.
- [`packages/contracts`](./contracts.md) — Foundry harness and the load-bearing `LopFillIntegration` test.
- [LOP v4.3.2 source](https://github.com/1inch/limit-order-protocol/tree/4.3.2) — the protocol contract this SDK targets.
- [`docs/plan/08-research-dossier.md`](../plan/08-research-dossier.md) — protocol facts and design rationale.
