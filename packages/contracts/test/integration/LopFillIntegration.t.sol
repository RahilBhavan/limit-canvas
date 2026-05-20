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
import {StopLossStrategy} from "../../src/templates/StopLossStrategy.sol";
import {MockOracle} from "../../src/mocks/MockOracle.sol";
import {LopOrderTestLib} from "../helpers/LopOrderTestLib.sol";
import {TwapSliceGetter} from "../../src/templates/TwapSliceGetter.sol";
import {DcaSeriesRegistry} from "../../src/templates/DcaSeriesRegistry.sol";

/// @notice End-to-end fill through pinned LOP 4.3.2 using a studio gas-guard predicate.
contract LopFillIntegrationTest is Test {
  using OrderLib for IOrderMixin.Order;

  LimitOrderProtocol internal lop;
  GasGuardStrategy internal gasGuard;
  StopLossStrategy internal stopLoss;
  MockOracle internal oracle;
  MockWeth internal weth;
  MockERC20 internal makerToken;
  MockERC20 internal takerToken;

  uint256 internal constant MAKER_PK = 0xA11CE;
  address internal maker;
  address internal taker;
  uint256 internal constant MAX_BASE_FEE = 30 gwei;
  uint256 internal constant STALE_AFTER = 1 hours;
  uint8 internal constant FEED_DECIMALS = 8;
  uint256 internal constant STOP_THRESHOLD = 1000e8;

  function setUp() public {
    weth = new MockWeth();
    lop = new LimitOrderProtocol(IWETH(address(weth)));
    gasGuard = new GasGuardStrategy();
    stopLoss = new StopLossStrategy();
    oracle = new MockOracle();
    oracle.setDecimals(FEED_DECIMALS);
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

    vm.warp(1_700_000_000);
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

  function _stopLossPredicate(bool directionAbove) internal view returns (bytes memory) {
    bytes memory inner = abi.encodeCall(
      StopLossStrategy.checkPrice,
      (address(oracle), STOP_THRESHOLD, directionAbove, STALE_AFTER, FEED_DECIMALS)
    );
    return abi.encodeCall(PredicateHelper.arbitraryStaticCall, (address(stopLoss), inner));
  }

  function _placeStopLossOrder(bool directionAbove)
    internal
    returns (IOrderMixin.Order memory order, bytes32 r, bytes32 vs, TakerTraits traits, bytes memory args)
  {
    bytes memory predicate = _stopLossPredicate(directionAbove);
    bytes memory extension = LopOrderTestLib.buildPredicateExtension(predicate);
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);
    order = LopOrderTestLib.buildOrder(
      maker,
      maker,
      address(makerToken),
      address(takerToken),
      100 ether,
      200 ether,
      salt
    );
    (r, vs) = _sign(order);
    (traits, args) = LopOrderTestLib.buildTakerFillArgs(extension, order.takingAmount);
  }

  /// @notice Proof that the hardened stop-loss predicate fills end-to-end on the pinned LOP.
  function test_fillOrderArgs_stop_loss_floor_fills_when_price_below_threshold() public {
    // price 900e8 < threshold 1000e8 → floor predicate (directionAbove = false) passes.
    oracle.setRound(7, 900e8, block.timestamp, 7);

    (
      IOrderMixin.Order memory order,
      bytes32 r,
      bytes32 vs,
      TakerTraits traits,
      bytes memory args
    ) = _placeStopLossOrder(false);

    uint256 makerBefore = makerToken.balanceOf(maker);
    uint256 takerBefore = takerToken.balanceOf(taker);

    vm.prank(taker);
    (uint256 makingAmount, uint256 takingAmount,) =
      lop.fillOrderArgs(order, r, vs, order.makingAmount, traits, args);

    assertEq(makingAmount, 100 ether);
    assertEq(takingAmount, 200 ether);
    assertEq(makerToken.balanceOf(maker), makerBefore - 100 ether);
    assertEq(takerToken.balanceOf(taker), takerBefore - 200 ether);
  }

  function test_fillOrderArgs_stop_loss_reverts_when_oracle_is_stale() public {
    // Answer was last updated longer ago than the configured heartbeat.
    oracle.setRound(7, 900e8, block.timestamp - (STALE_AFTER + 1), 7);

    (
      IOrderMixin.Order memory order,
      bytes32 r,
      bytes32 vs,
      TakerTraits traits,
      bytes memory args
    ) = _placeStopLossOrder(false);

    vm.prank(taker);
    vm.expectRevert();
    lop.fillOrderArgs(order, r, vs, order.makingAmount, traits, args);
  }

  function test_fillOrderArgs_stop_loss_reverts_when_decimals_mismatch() public {
    oracle.setRound(7, 900e8, block.timestamp, 7);
    oracle.setDecimals(18);

    (
      IOrderMixin.Order memory order,
      bytes32 r,
      bytes32 vs,
      TakerTraits traits,
      bytes memory args
    ) = _placeStopLossOrder(false);

    vm.prank(taker);
    vm.expectRevert();
    lop.fillOrderArgs(order, r, vs, order.makingAmount, traits, args);
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

  event DcaSeriesRegistered(
    bytes32 indexed seriesKey, address indexed maker, uint256 tranches, uint256 amountPerTranche, uint256 intervalSeconds
  );

  function test_fillOrderArgs_twap_slice_getter_succeeds() public {
    TwapSliceGetter twapGetter = new TwapSliceGetter(1000 ether, 100 ether, 3600, block.timestamp);
    bytes memory extension = LopOrderTestLib.buildGetterExtension(address(twapGetter), "");
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);

    IOrderMixin.Order memory order = LopOrderTestLib.buildOrder(
      maker,
      maker,
      address(makerToken),
      address(takerToken),
      1000 ether,
      1000 ether,
      salt
    );

    (bytes32 r, bytes32 vs) = _sign(order);
    (TakerTraits traits, bytes memory args) =
      LopOrderTestLib.buildTakerFillArgs(extension, order.takingAmount);

    uint256 makerBefore = makerToken.balanceOf(maker);
    uint256 takerBefore = takerToken.balanceOf(taker);

    vm.prank(taker);
    (uint256 makingAmount, uint256 takingAmount,) =
      lop.fillOrderArgs(order, r, vs, 100 ether, traits, args);

    assertEq(makingAmount, 100 ether);
    assertEq(takingAmount, 100 ether);
    assertEq(makerToken.balanceOf(maker), makerBefore - 100 ether);
    assertEq(takerToken.balanceOf(taker), takerBefore - 100 ether);
  }

  function test_fillOrderArgs_twap_slice_getter_reverts_above_cap() public {
    TwapSliceGetter twapGetter = new TwapSliceGetter(1000 ether, 100 ether, 3600, block.timestamp);
    bytes memory extension = LopOrderTestLib.buildGetterExtension(address(twapGetter), "");
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);

    IOrderMixin.Order memory order = LopOrderTestLib.buildOrder(
      maker,
      maker,
      address(makerToken),
      address(takerToken),
      1000 ether,
      1000 ether,
      salt
    );

    (bytes32 r, bytes32 vs) = _sign(order);
    (TakerTraits traits, bytes memory args) =
      LopOrderTestLib.buildTakerFillArgs(extension, order.takingAmount);

    vm.prank(taker);
    vm.expectRevert(TwapSliceGetter.ExceedsTwapCappedAmount.selector);
    lop.fillOrderArgs(order, r, vs, 101 ether, traits, args);
  }

  function test_registerDcaSeries_succeeds() public {
    DcaSeriesRegistry registry = new DcaSeriesRegistry();
    vm.expectEmit(true, true, false, true);
    emit DcaSeriesRegistered(
      keccak256(abi.encode(maker, 42, block.chainid)),
      maker,
      10,
      5 ether,
      3600
    );
    registry.registerSeries(maker, 10, 5 ether, 3600, 42);
  }
}
