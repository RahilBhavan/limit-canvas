# Deploy environments

## Foundry profiles (`foundry.toml`)

| Profile | Use | RPC | Verification |
|---------|-----|-----|--------------|
| `default` / `local` | Anvil, fork | `http://127.0.0.1:8545` | off |
| `testnet` | Sepolia | `$RPC_URL` | Etherscan |
| `mainnet` | Production | `$RPC_URL` | Etherscan |

## Scripts

- `script/DeployStopLoss.s.sol`
- `script/DeployGasGuard.s.sol`
- `script/DeployTwapSlice.s.sol`
- `script/DeployDcaSchedule.s.sol`

Each reads `DEPLOYER_KEY` via `vm.envUint` / broadcast pattern.

## Mainnet guardrails

1. DSL field `audited: true` required for `mainnet` profile in codegen CLI
2. Studio deploy tab blocks mainnet if template not audited
3. User must confirm bytecode hash shown in UI

## Commands

```bash
# Local
cd packages/contracts
forge script script/DeployGasGuard.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Testnet
FOUNDRY_PROFILE=testnet forge script script/DeployGasGuard.s.sol --rpc-url $RPC_URL --broadcast --verify
```
