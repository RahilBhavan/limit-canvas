/**
 * Curated allowlist of Chainlink aggregator addresses we have hand-verified for
 * stop-loss templates. The on-chain strategy still works with any address — this
 * registry is consulted off-chain to surface a warning when a maker plugs in an
 * address that isn't a known good feed.
 *
 * Add entries here only after verifying:
 *   - the address resolves to an active aggregator on the canonical Chainlink registry,
 *   - the published heartbeat matches the `staleAfter` you intend to ship with,
 *   - decimals match the threshold scale.
 */
export const KNOWN_ORACLES: Record<number, Record<string, OracleMeta>> = {
  // Ethereum mainnet — a few of the most-used Chainlink USD aggregators.
  1: {
    "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419": {
      name: "Chainlink ETH/USD",
      decimals: 8,
      heartbeatSeconds: 3600,
    },
    "0xf4030086522a5beea4988f8ca5b36dbc97bee88c": {
      name: "Chainlink BTC/USD",
      decimals: 8,
      heartbeatSeconds: 3600,
    },
    "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9": {
      name: "Chainlink DAI/USD",
      decimals: 8,
      heartbeatSeconds: 3600,
    },
    "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6": {
      name: "Chainlink USDC/USD",
      decimals: 8,
      heartbeatSeconds: 86400,
    },
  },
};

export interface OracleMeta {
  name: string;
  decimals: number;
  heartbeatSeconds: number;
}

export function lookupOracle(
  chainId: number,
  address: string,
): OracleMeta | undefined {
  return KNOWN_ORACLES[chainId]?.[address.toLowerCase()];
}

export function isKnownOracle(chainId: number, address: string): boolean {
  return lookupOracle(chainId, address) !== undefined;
}
