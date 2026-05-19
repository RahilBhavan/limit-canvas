// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @notice Test double for a Chainlink AggregatorV3-shaped oracle.
///         Exposes the round fields StopLossStrategy reads (`latestRoundData`, `decimals`).
contract MockOracle {
  uint80 internal _roundId = 1;
  int256 internal _answer;
  uint256 internal _startedAt;
  uint256 internal _updatedAt;
  uint80 internal _answeredInRound = 1;
  uint8 internal _decimals = 8;

  function setRound(
    uint80 roundId_,
    int256 answer_,
    uint256 updatedAt_,
    uint80 answeredInRound_
  ) external {
    _roundId = roundId_;
    _answer = answer_;
    _updatedAt = updatedAt_;
    _startedAt = updatedAt_;
    _answeredInRound = answeredInRound_;
  }

  function setAnswer(int256 answer_) external {
    _answer = answer_;
    _updatedAt = block.timestamp;
    _startedAt = block.timestamp;
    _roundId = _roundId + 1;
    _answeredInRound = _roundId;
  }

  function setDecimals(uint8 decimals_) external {
    _decimals = decimals_;
  }

  function latestRoundData()
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
  {
    return (_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);
  }

  function decimals() external view returns (uint8) {
    return _decimals;
  }

  /// @dev Retained for tests that only need an answer; mirrors the new round storage.
  function latestAnswer() external view returns (int256) {
    return _answer;
  }
}
