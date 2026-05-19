// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {StopLossStrategy} from "../../src/templates/StopLossStrategy.sol";
import {NaiveStopLossChecker} from "../../src/benchmarks/NaiveStopLossChecker.sol";
import {MockOracle} from "../../src/mocks/MockOracle.sol";

contract StopLossBenchmarkTest is Test {
  StopLossStrategy internal optimized = new StopLossStrategy();
  NaiveStopLossChecker internal naive = new NaiveStopLossChecker();
  MockOracle internal oracle;

  function setUp() public {
    oracle = new MockOracle();
    vm.warp(1_700_000_000);
    oracle.setDecimals(8);
    oracle.setRound(7, 1500e8, block.timestamp, 7);
  }

  function testBenchmark_optimized() public view {
    optimized.checkPrice(address(oracle), 1000e8, true, 1 hours, 8);
  }

  function testBenchmark_naive() public {
    naive.checkTwice(address(oracle), 1000e8, true);
  }
}
