// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {StopLossStrategy} from "../../src/templates/StopLossStrategy.sol";
import {MockOracle} from "../../src/mocks/MockOracle.sol";

contract StopLossStrategyTest is Test {
  StopLossStrategy internal strategy;
  MockOracle internal oracle;

  uint256 internal constant STALE_AFTER = 1 hours;
  uint8 internal constant DECIMALS = 8;

  function setUp() public {
    strategy = new StopLossStrategy();
    oracle = new MockOracle();
    vm.warp(1_700_000_000);
    oracle.setDecimals(DECIMALS);
    // Fresh answer at "now"; tests below override per-case.
    oracle.setRound(7, 1000e8, block.timestamp, 7);
  }

  function _check(uint256 threshold, bool above) internal view returns (uint256) {
    return strategy.checkPrice(address(oracle), threshold, above, STALE_AFTER, DECIMALS);
  }

  function test_floor_passes_below_threshold() public {
    oracle.setRound(7, 900e8, block.timestamp, 7);
    assertEq(_check(1000e8, false), 1);
  }

  function test_floor_fails_above_threshold() public {
    oracle.setRound(7, 1100e8, block.timestamp, 7);
    assertEq(_check(1000e8, false), 0);
  }

  function test_above_direction_passes() public {
    oracle.setRound(7, 1100e8, block.timestamp, 7);
    assertEq(_check(1000e8, true), 1);
  }

  function test_reverts_on_non_positive_answer() public {
    oracle.setRound(7, 0, block.timestamp, 7);
    vm.expectRevert(StopLossStrategy.InvalidAnswer.selector);
    _check(1000e8, false);

    oracle.setRound(7, -1, block.timestamp, 7);
    vm.expectRevert(StopLossStrategy.InvalidAnswer.selector);
    _check(1000e8, false);
  }

  function test_reverts_on_stale_answer() public {
    oracle.setRound(7, 900e8, block.timestamp - (STALE_AFTER + 1), 7);
    vm.expectRevert(
      abi.encodeWithSelector(
        StopLossStrategy.StaleAnswer.selector,
        block.timestamp - (STALE_AFTER + 1),
        block.timestamp,
        STALE_AFTER
      )
    );
    _check(1000e8, false);
  }

  function test_accepts_answer_at_heartbeat_boundary() public {
    oracle.setRound(7, 900e8, block.timestamp - STALE_AFTER, 7);
    assertEq(_check(1000e8, false), 1);
  }

  function test_reverts_on_incomplete_round() public {
    // updatedAt == 0 → round not finalized
    oracle.setRound(7, 900e8, 0, 7);
    vm.expectRevert(
      abi.encodeWithSelector(StopLossStrategy.IncompleteRound.selector, uint80(7), uint80(7), uint256(0))
    );
    _check(1000e8, false);

    // answeredInRound < roundId → stuck round
    oracle.setRound(10, 900e8, block.timestamp, 9);
    vm.expectRevert(
      abi.encodeWithSelector(
        StopLossStrategy.IncompleteRound.selector, uint80(10), uint80(9), block.timestamp
      )
    );
    _check(1000e8, false);
  }

  function test_reverts_on_decimals_mismatch() public {
    oracle.setDecimals(18);
    oracle.setRound(7, 900e18, block.timestamp, 7);
    vm.expectRevert(
      abi.encodeWithSelector(StopLossStrategy.DecimalsMismatch.selector, uint8(18), DECIMALS)
    );
    _check(1000e8, false);
  }
}
