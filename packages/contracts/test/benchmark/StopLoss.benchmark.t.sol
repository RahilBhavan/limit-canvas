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
    oracle.setAnswer(1500e8);
  }

  function testBenchmark_optimized() public {
    optimized.checkPrice(address(oracle), 1000e8, true);
  }

  function testBenchmark_naive() public {
    naive.checkTwice(address(oracle), 1000e8, true);
  }
}
