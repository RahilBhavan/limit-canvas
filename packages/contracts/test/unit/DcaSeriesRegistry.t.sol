// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {DcaSeriesRegistry} from "../../src/templates/DcaSeriesRegistry.sol";

contract DcaSeriesRegistryTest is Test {
  DcaSeriesRegistry internal registry;

  function setUp() public {
    registry = new DcaSeriesRegistry();
  }

  function test_register_series() public {
    bytes32 key = registry.registerSeries(address(this), 4, 100 ether, 86400, 1);
    (address maker, uint256 tranches, uint256 amountPerTranche,) = registry.series(key);
    assertEq(maker, address(this));
    assertEq(tranches, 4);
    assertEq(amountPerTranche, 100 ether);
  }
}
