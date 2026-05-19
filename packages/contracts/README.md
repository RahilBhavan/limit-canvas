# @limit-canvas/contracts

Foundry package — LOP v4.3.2 template strategies, tests, benchmarks, deploy scripts.

## Setup

```bash
# From repo root after git clone
cd packages/contracts
# lib/ includes forge-std, openzeppelin, solidity-utils, limit-order-protocol @ 4.3.2
forge build
forge test
```

## LOP pin

`lib/limit-order-protocol` is cloned at tag **4.3.2**. Re-install:

```bash
rm -rf lib/limit-order-protocol
git clone --depth 1 --branch 4.3.2 https://github.com/1inch/limit-order-protocol.git lib/limit-order-protocol
```

## Deploy

```bash
export DEPLOYER_KEY=0x...
export RPC_URL=http://127.0.0.1:8545
forge script script/DeployGasGuard.s.sol --rpc-url $RPC_URL --broadcast
```

Mainnet: set `FOUNDRY_PROFILE=mainnet` and ensure DSL `audited: true`.
