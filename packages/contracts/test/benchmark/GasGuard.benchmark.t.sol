// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {GasGuardStrategy} from "../../src/templates/GasGuardStrategy.sol";
import {NaiveGasChecker} from "../../src/benchmarks/NaiveGasChecker.sol";

contract GasGuardBenchmarkTest is Test {
  GasGuardStrategy internal optimized = new GasGuardStrategy();
  NaiveGasChecker internal naive = new NaiveGasChecker();
  uint256 internal maxBase = 30 gwei;

  function setUp() public {
    vm.fee(10 gwei);
  }

  function testBenchmark_optimized() public view {
    optimized.isAllowedUint(maxBase);
  }

  function testBenchmark_naive() public view {
    naive.check(maxBase);
  }
}
