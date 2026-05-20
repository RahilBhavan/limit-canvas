// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {TwapSliceGetter} from "../../src/templates/TwapSliceGetter.sol";
import {IOrderMixin} from "limit-order-protocol/interfaces/IOrderMixin.sol";

contract TwapSliceGetterTest is Test {
  TwapSliceGetter internal getter;

  function setUp() public {
    getter = new TwapSliceGetter(1000 ether, 100 ether, 3600, block.timestamp);
  }

  function test_first_slice_cap() public {
    assertEq(getter.maxMakingAmountNow(), 100 ether);
  }

  function test_caps_requested_making() public {
    IOrderMixin.Order memory order;
    order.makingAmount = 1000 ether;
    order.takingAmount = 1000 ether;
    vm.expectRevert(TwapSliceGetter.ExceedsTwapCappedAmount.selector);
    getter.getMakingAmount(
      order,
      "",
      bytes32(0),
      address(0),
      500 ether,
      1000 ether,
      ""
    );
  }

  function test_caps_requested_making_success() public {
    IOrderMixin.Order memory order;
    order.makingAmount = 1000 ether;
    order.takingAmount = 1000 ether;
    uint256 fill = getter.getMakingAmount(
      order,
      "",
      bytes32(0),
      address(0),
      100 ether,
      1000 ether,
      ""
    );
    assertEq(fill, 100 ether);
  }

  function test_caps_requested_taking() public {
    IOrderMixin.Order memory order;
    order.makingAmount = 1000 ether;
    order.takingAmount = 1000 ether;
    vm.expectRevert(TwapSliceGetter.ExceedsTwapCappedAmount.selector);
    getter.getTakingAmount(
      order,
      "",
      bytes32(0),
      address(0),
      500 ether,
      1000 ether,
      ""
    );
  }

  function test_caps_requested_taking_success() public {
    IOrderMixin.Order memory order;
    order.makingAmount = 1000 ether;
    order.takingAmount = 1000 ether;
    uint256 fill = getter.getTakingAmount(
      order,
      "",
      bytes32(0),
      address(0),
      100 ether,
      1000 ether,
      ""
    );
    assertEq(fill, 100 ether);
  }

  function test_advances_with_time() public {
    vm.warp(block.timestamp + 7200);
    assertEq(getter.maxMakingAmountNow(), 300 ether);
  }
}
