// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {LimitOrderProtocol} from "limit-order-protocol/LimitOrderProtocol.sol";
import {PredicateHelper} from "limit-order-protocol/helpers/PredicateHelper.sol";
import {IWETH} from "@1inch/solidity-utils/contracts/interfaces/IWETH.sol";
import {MockWeth} from "../../src/mocks/MockWeth.sol";

/// @notice Smoke test that LOP 4.3.2 submodule compiles and deploys.
/// @dev See LopFillIntegrationTest for fillOrderArgs with a studio gas-guard predicate.
contract LopIntegrationTest is Test {
  function test_deploy_lop_and_predicate_helper() public {
    MockWeth weth = new MockWeth();
    LimitOrderProtocol lop = new LimitOrderProtocol(IWETH(address(weth)));
    PredicateHelper helper = new PredicateHelper();
    assertTrue(address(lop) != address(0));
    assertTrue(address(helper) != address(0));
  }
}
