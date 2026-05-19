// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {TwapSliceGetter} from "../../src/templates/TwapSliceGetter.sol";

contract TwapSliceGetterTest is Test {
  TwapSliceGetter internal getter;

  function setUp() public {
    getter = new TwapSliceGetter(1000 ether, 100 ether, 3600, block.timestamp);
  }

  function test_first_slice_cap() public {
    assertEq(getter.maxMakingAmountNow(), 100 ether);
  }

  function test_caps_requested_making() public {
    uint256 fill = getter.getMakingAmount(500 ether, 1000 ether, bytes32(0));
    assertEq(fill, 100 ether);
  }

  function test_advances_with_time() public {
    vm.warp(block.timestamp + 7200);
    assertEq(getter.maxMakingAmountNow(), 300 ether);
  }
}
