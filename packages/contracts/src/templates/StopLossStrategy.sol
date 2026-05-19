// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IPriceOracle {
    function latestAnswer() external view returns (int256);
}

/// @title StopLossStrategy — Limit Canvas template
/// @notice View helper for stop-loss / take-profit predicates via LOP arbitraryStaticCall
contract StopLossStrategy {
  function checkPrice(address oracle, uint256 threshold, bool directionAbove) external view returns (uint256) {
    int256 answer = IPriceOracle(oracle).latestAnswer();
    require(answer > 0, "invalid oracle");
    uint256 price = uint256(answer);
    bool ok = directionAbove ? price > threshold : price < threshold;
    return ok ? 1 : 0;
  }
}
