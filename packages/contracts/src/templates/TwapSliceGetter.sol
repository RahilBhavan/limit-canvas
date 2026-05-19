// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title TwapSliceGetter — Limit Canvas template
/// @notice Caps cumulative making amount by elapsed TWAP slices
contract TwapSliceGetter {
  uint256 public immutable totalAmount;
  uint256 public immutable sliceAmount;
  uint256 public immutable intervalSeconds;
  uint256 public immutable startTime;

  constructor(uint256 _total, uint256 _slice, uint256 _interval, uint256 _start) {
    totalAmount = _total;
    sliceAmount = _slice;
    intervalSeconds = _interval;
    startTime = _start;
  }

  function maxMakingAmountNow() public view returns (uint256) {
    if (block.timestamp < startTime) return 0;
    uint256 elapsed = block.timestamp - startTime;
    uint256 slices = elapsed / intervalSeconds + 1;
    uint256 allowed = slices * sliceAmount;
    if (allowed > totalAmount) allowed = totalAmount;
    return allowed;
  }

  function getMakingAmount(uint256 requestedMaking, uint256 remainingMaking, bytes32) external view returns (uint256) {
    uint256 cap = maxMakingAmountNow();
    uint256 maxFill = cap > remainingMaking ? remainingMaking : cap;
    return requestedMaking > maxFill ? maxFill : requestedMaking;
  }
}
