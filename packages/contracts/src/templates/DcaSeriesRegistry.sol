// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title DcaSeriesRegistry — Limit Canvas template
contract DcaSeriesRegistry {
  event DcaSeriesRegistered(
    bytes32 indexed seriesKey, address indexed maker, uint256 tranches, uint256 amountPerTranche, uint256 intervalSeconds
  );

  struct Series {
    address maker;
    uint256 tranches;
    uint256 amountPerTranche;
    uint256 intervalSeconds;
  }

  mapping(bytes32 => Series) public series;

  function registerSeries(
    address maker,
    uint256 tranches,
    uint256 amountPerTranche,
    uint256 intervalSeconds,
    uint256 seriesId
  ) external returns (bytes32 key) {
    key = keccak256(abi.encode(maker, seriesId, block.chainid));
    series[key] = Series(maker, tranches, amountPerTranche, intervalSeconds);
    emit DcaSeriesRegistered(key, maker, tranches, amountPerTranche, intervalSeconds);
  }
}
