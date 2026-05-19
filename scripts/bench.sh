#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/packages/contracts"
export PATH="$HOME/.foundry/bin:$PATH"

cd "$CONTRACTS"
echo "==> Running benchmark tests with gas report..."
forge test --match-path "test/benchmark/*" --gas-report -vvv
echo "==> Updating gas snapshots..."
forge snapshot --match-path "test/benchmark/*"
echo "==> Done. See .gas-snapshot in packages/contracts"
