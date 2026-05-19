// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IPriceOracle {
  function latestAnswer() external view returns (int256);
}

/// @notice Naive baseline: double oracle read in nested checks
contract NaiveStopLossChecker {
  function checkTwice(address oracle, uint256 threshold, bool directionAbove) external view returns (uint256) {
    int256 a1 = IPriceOracle(oracle).latestAnswer();
    int256 a2 = IPriceOracle(oracle).latestAnswer();
    require(a1 > 0 && a2 > 0, "invalid");
    uint256 price = uint256(a1);
    bool ok = directionAbove ? price > threshold : price < threshold;
    return ok && a1 == a2 ? 1 : 0;
  }
}
