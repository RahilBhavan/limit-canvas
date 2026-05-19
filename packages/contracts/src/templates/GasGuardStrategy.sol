// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title GasGuardStrategy — Limit Canvas template
/// @notice Fill only when block.basefee <= maxBaseFee
contract GasGuardStrategy {
  function isAllowed(uint256 maxBaseFee) external view returns (bool) {
    return block.basefee <= maxBaseFee;
  }

  function isAllowedUint(uint256 maxBaseFee) external view returns (uint256) {
    return block.basefee <= maxBaseFee ? 1 : 0;
  }
}
