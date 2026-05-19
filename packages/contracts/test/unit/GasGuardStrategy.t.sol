// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {GasGuardStrategy} from "../../src/templates/GasGuardStrategy.sol";

contract GasGuardStrategyTest is Test {
  GasGuardStrategy internal strategy;

  function setUp() public {
    strategy = new GasGuardStrategy();
  }

  function test_allows_low_basefee() public {
    vm.fee(10 gwei);
    assertTrue(strategy.isAllowed(30 gwei));
    assertEq(strategy.isAllowedUint(30 gwei), 1);
  }

  function test_rejects_high_basefee() public {
    vm.fee(50 gwei);
    assertFalse(strategy.isAllowed(30 gwei));
  }
}
