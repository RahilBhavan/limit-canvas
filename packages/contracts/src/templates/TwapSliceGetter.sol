// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IAmountGetter} from "limit-order-protocol/interfaces/IAmountGetter.sol";
import {IOrderMixin} from "limit-order-protocol/interfaces/IOrderMixin.sol";

/// @title TwapSliceGetter — Limit Canvas template
/// @notice Caps cumulative making amount by elapsed TWAP slices
contract TwapSliceGetter is IAmountGetter {
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

  error ExceedsTwapCappedAmount();

  function getMakingAmount(
    IOrderMixin.Order calldata order,
    bytes calldata /* extension */,
    bytes32 /* orderHash */,
    address /* taker */,
    uint256 takingAmount,
    uint256 remainingMakingAmount,
    bytes calldata /* extraData */
  ) external view override returns (uint256) {
    uint256 cap = maxMakingAmountNow();
    uint256 maxFill = cap > remainingMakingAmount ? remainingMakingAmount : cap;
    uint256 requestedMaking = (takingAmount * order.makingAmount) / order.takingAmount;
    if (requestedMaking > maxFill) revert ExceedsTwapCappedAmount();
    return requestedMaking;
  }

  function getTakingAmount(
    IOrderMixin.Order calldata order,
    bytes calldata /* extension */,
    bytes32 /* orderHash */,
    address /* taker */,
    uint256 makingAmount,
    uint256 remainingMakingAmount,
    bytes calldata /* extraData */
  ) external view override returns (uint256) {
    uint256 cap = maxMakingAmountNow();
    uint256 maxFill = cap > remainingMakingAmount ? remainingMakingAmount : cap;
    if (makingAmount > maxFill) revert ExceedsTwapCappedAmount();
    return (makingAmount * order.takingAmount + order.makingAmount - 1) / order.makingAmount;
  }
}
