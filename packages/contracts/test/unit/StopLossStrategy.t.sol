// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {StopLossStrategy} from "../../src/templates/StopLossStrategy.sol";
import {MockOracle} from "../../src/mocks/MockOracle.sol";

contract StopLossStrategyTest is Test {
  StopLossStrategy internal strategy;
  MockOracle internal oracle;

  function setUp() public {
    strategy = new StopLossStrategy();
    oracle = new MockOracle();
  }

  function test_floor_passes_below_threshold() public {
    oracle.setAnswer(900e8);
    assertEq(strategy.checkPrice(address(oracle), 1000e8, false), 1);
  }

  function test_floor_fails_above_threshold() public {
    oracle.setAnswer(1100e8);
    assertEq(strategy.checkPrice(address(oracle), 1000e8, false), 0);
  }

  function test_above_direction() public {
    oracle.setAnswer(1100e8);
    assertEq(strategy.checkPrice(address(oracle), 1000e8, true), 1);
  }
}
