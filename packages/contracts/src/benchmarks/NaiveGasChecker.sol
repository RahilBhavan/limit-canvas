// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @notice Naive baseline for gas-guard benchmarks (external call per check)
contract NaiveGasChecker {
  function check(uint256 maxBaseFee) external view returns (uint256) {
    return block.basefee <= maxBaseFee ? 1 : 0;
  }
}
