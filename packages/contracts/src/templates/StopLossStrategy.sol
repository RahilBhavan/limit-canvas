// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @dev Chainlink-compatible aggregator surface.
interface IPriceOracle {
  function latestRoundData()
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

  function decimals() external view returns (uint8);
}

/// @title StopLossStrategy — Limit Canvas template
/// @notice View helper for stop-loss / take-profit predicates via LOP arbitraryStaticCall.
///         Applies the standard Chainlink-consumer checks (positive answer, complete round,
///         heartbeat freshness, decimals match) before comparing against the threshold.
contract StopLossStrategy {
  error InvalidAnswer();
  error IncompleteRound(uint80 roundId, uint80 answeredInRound, uint256 updatedAt);
  error StaleAnswer(uint256 updatedAt, uint256 nowTs, uint256 staleAfter);
  error DecimalsMismatch(uint8 actual, uint8 expected);

  /// @notice Returns 1 if the oracle is fresh and the price condition passes, 0 if it does not pass.
  ///         Reverts (rather than returning 0) on oracle integrity failures so callers can
  ///         distinguish "condition not met" from "oracle is broken or stale".
  /// @param oracle Chainlink-compatible aggregator address
  /// @param threshold Price threshold scaled in the oracle's own decimals
  /// @param directionAbove true → fill when price > threshold (take-profit); false → fill when price < threshold (stop-loss floor)
  /// @param staleAfter Maximum acceptable seconds since the last oracle update
  /// @param expectedDecimals Decimals the threshold was scaled in; must equal `oracle.decimals()`
  function checkPrice(
    address oracle,
    uint256 threshold,
    bool directionAbove,
    uint256 staleAfter,
    uint8 expectedDecimals
  ) external view returns (uint256) {
    (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
      IPriceOracle(oracle).latestRoundData();
    if (answer <= 0) revert InvalidAnswer();
    if (updatedAt == 0 || answeredInRound < roundId) {
      revert IncompleteRound(roundId, answeredInRound, updatedAt);
    }
    if (block.timestamp > updatedAt && block.timestamp - updatedAt > staleAfter) {
      revert StaleAnswer(updatedAt, block.timestamp, staleAfter);
    }
    uint8 actualDecimals = IPriceOracle(oracle).decimals();
    if (actualDecimals != expectedDecimals) {
      revert DecimalsMismatch(actualDecimals, expectedDecimals);
    }
    uint256 price = uint256(answer);
    bool ok = directionAbove ? price > threshold : price < threshold;
    return ok ? 1 : 0;
  }
}
