// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {GasGuardStrategy} from "../../src/templates/GasGuardStrategy.sol";

contract GasGuardFuzzTest is Test {
  GasGuardStrategy internal strategy = new GasGuardStrategy();

  function testFuzz_isAllowed(uint64 maxGwei) public {
    maxGwei = uint64(bound(maxGwei, 1, 500));
    uint256 maxBase = uint256(maxGwei) * 1 gwei;
    vm.fee(maxGwei);
    bool allowed = strategy.isAllowed(maxBase);
    assertEq(allowed, block.basefee <= maxBase);
  }
}
