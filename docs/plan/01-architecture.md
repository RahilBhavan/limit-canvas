# Architecture

## Layers

1. **Studio UI** (`apps/studio`) — wizard, extension preview, artifact download
2. **hook-dsl** — versioned JSON strategy schema (Zod)
3. **lop-sdk** — extension packing, `keccak256(extension)` → salt, trait helpers
4. **codegen** — DSL → `Strategy.sol`, tests, deploy script, `extensions.json`, artifact manifest
5. **contracts** — audited templates, mocks, benchmarks, LOP integration tests

## Data flow

```
User → Wizard → StrategyDocument (JSON)
       → validate (hook-dsl)
       → codegen → artifacts/
       → forge test / deploy
```

## LOP concepts (terminology)

| Studio term | LOP term |
|-------------|----------|
| Hook / strategy | Order **extension** (predicate, getters, interactions) |
| Gas guard | **Predicate** on `block.basefee` |
| Stop-loss | **Predicate** + `arbitraryStaticCall` oracle |
| TWAP slice | Partial fills + **MakingAmountGetter** / time predicate |
| DCA | Order **series** + off-chain keeper |

Extensions are passed separately at fill time; salt low 160 bits = extension hash; `HAS_EXTENSION` trait required.

## Pin

- **LOP tag:** `4.3.2` (submodule `packages/contracts/lib/limit-order-protocol`)
- **Solidity:** `0.8.23` for checked-in Foundry templates and generated scaffolds

## Production invariant

Every generated bundle must prove:

1. the strategy JSON validates against the versioned DSL,
2. the extension bytes are deterministic,
3. the salt low 160 bits match the extension hash low 160 bits,
4. the target chain uses the expected LOP deployment,
5. the template test and benchmark suite can be run locally before deploy.
