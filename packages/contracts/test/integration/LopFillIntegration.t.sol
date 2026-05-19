// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {LimitOrderProtocol} from "limit-order-protocol/LimitOrderProtocol.sol";
import {IOrderMixin} from "limit-order-protocol/interfaces/IOrderMixin.sol";
import {OrderLib} from "limit-order-protocol/OrderLib.sol";
import {PredicateHelper} from "limit-order-protocol/helpers/PredicateHelper.sol";
import {TakerTraits} from "limit-order-protocol/libraries/TakerTraitsLib.sol";
import {IWETH} from "@1inch/solidity-utils/contracts/interfaces/IWETH.sol";
import {MockWeth} from "../../src/mocks/MockWeth.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {GasGuardStrategy} from "../../src/templates/GasGuardStrategy.sol";
import {LopOrderTestLib} from "../helpers/LopOrderTestLib.sol";

/// @notice End-to-end fill through pinned LOP 4.3.2 using a studio gas-guard predicate.
contract LopFillIntegrationTest is Test {
  using OrderLib for IOrderMixin.Order;

  LimitOrderProtocol internal lop;
  GasGuardStrategy internal gasGuard;
  MockWeth internal weth;
  MockERC20 internal makerToken;
  MockERC20 internal takerToken;

  uint256 internal constant MAKER_PK = 0xA11CE;
  address internal maker;
  address internal taker;
  uint256 internal constant MAX_BASE_FEE = 30 gwei;

  function setUp() public {
    weth = new MockWeth();
    lop = new LimitOrderProtocol(IWETH(address(weth)));
    gasGuard = new GasGuardStrategy();
    makerToken = new MockERC20("Maker", "MKR");
    takerToken = new MockERC20("Taker", "TKR");
    maker = vm.addr(MAKER_PK);
    taker = makeAddr("taker");

    makerToken.mint(maker, 1_000 ether);
    takerToken.mint(taker, 1_000 ether);

    vm.prank(maker);
    makerToken.approve(address(lop), type(uint256).max);
    vm.prank(taker);
    takerToken.approve(address(lop), type(uint256).max);
  }

  function test_fillOrderArgs_gas_guard_succeeds_when_basefee_within_cap() public {
    vm.fee(10 gwei);

    bytes memory predicate = _gasGuardPredicate();
    bytes memory extension = LopOrderTestLib.buildPredicateExtension(predicate);
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);
    IOrderMixin.Order memory order = LopOrderTestLib.buildOrder(
      maker,
      maker,
      address(makerToken),
      address(takerToken),
      100 ether,
      200 ether,
      salt
    );

    (bytes32 r, bytes32 vs) = _sign(order);
    (TakerTraits traits, bytes memory args) =
      LopOrderTestLib.buildTakerFillArgs(extension, order.takingAmount);

    uint256 makerBefore = makerToken.balanceOf(maker);
    uint256 takerBefore = takerToken.balanceOf(taker);

    vm.prank(taker);
    (uint256 makingAmount, uint256 takingAmount,) =
      lop.fillOrderArgs(order, r, vs, order.makingAmount, traits, args);

    assertEq(makingAmount, 100 ether);
    assertEq(takingAmount, 200 ether);
    assertEq(makerToken.balanceOf(maker), makerBefore - 100 ether);
    assertEq(takerToken.balanceOf(taker), takerBefore - 200 ether);
    assertEq(makerToken.balanceOf(taker), 100 ether);
    assertEq(takerToken.balanceOf(maker), 200 ether);
  }

  function test_fillOrderArgs_gas_guard_reverts_when_basefee_exceeds_cap() public {
    vm.fee(50 gwei);

    bytes memory predicate = _gasGuardPredicate();
    bytes memory extension = LopOrderTestLib.buildPredicateExtension(predicate);
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);
    IOrderMixin.Order memory order = LopOrderTestLib.buildOrder(
      maker,
      maker,
      address(makerToken),
      address(takerToken),
      100 ether,
      200 ether,
      salt
    );

    (bytes32 r, bytes32 vs) = _sign(order);
    (TakerTraits traits, bytes memory args) =
      LopOrderTestLib.buildTakerFillArgs(extension, order.takingAmount);

    vm.prank(taker);
    vm.expectRevert();
    lop.fillOrderArgs(order, r, vs, order.makingAmount, traits, args);
  }

  function test_checkPredicate_passes_within_gas_cap() public {
    vm.fee(10 gwei);
    assertTrue(lop.checkPredicate(_gasGuardPredicate()));
  }

  function test_checkPredicate_fails_above_gas_cap() public {
    vm.fee(50 gwei);
    assertFalse(lop.checkPredicate(_gasGuardPredicate()));
  }

  function _gasGuardPredicate() internal view returns (bytes memory) {
    bytes memory inner = abi.encodeCall(GasGuardStrategy.isAllowedUint, (MAX_BASE_FEE));
    return abi.encodeCall(PredicateHelper.arbitraryStaticCall, (address(gasGuard), inner));
  }

  /// @dev External so a memory `Order` can be hashed via calldata (OrderLib.hash).
  function orderHash(IOrderMixin.Order calldata order) public view returns (bytes32) {
    return order.hash(lop.DOMAIN_SEPARATOR());
  }

  function _sign(IOrderMixin.Order memory order_) internal view returns (bytes32 r, bytes32 vs) {
    bytes32 digest = this.orderHash(order_);
    (uint8 v, bytes32 sigR, bytes32 s) = vm.sign(MAKER_PK, digest);
    return (sigR, LopOrderTestLib.toVs(v, s));
  }
}
