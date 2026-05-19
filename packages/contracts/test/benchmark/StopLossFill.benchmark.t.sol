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
import {MockOracle} from "../../src/mocks/MockOracle.sol";
import {GasGuardStrategy} from "../../src/templates/GasGuardStrategy.sol";
import {StopLossStrategy} from "../../src/templates/StopLossStrategy.sol";
import {LopOrderTestLib} from "../helpers/LopOrderTestLib.sol";

/// @notice End-to-end gas snapshot for a stop-loss + gas-guard composed fill on pinned LOP 4.3.2.
///         The fill-path benchmark is what partners actually care about — predicate-helper
///         snapshots in the unit benchmarks measure ~hundreds of gas; the dominant cost is the
///         protocol's order-hash + signature recovery + transfer machinery, which this test exposes.
contract StopLossFillBenchmarkTest is Test {
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

  // Pre-built fixtures so the measured function only contains the fill call.
  IOrderMixin.Order internal preparedOrder;
  bytes32 internal preparedR;
  bytes32 internal preparedVs;
  TakerTraits internal preparedTraits;
  bytes internal preparedArgs;

  function setUp() public {
    weth = new MockWeth();
    lop = new LimitOrderProtocol(IWETH(address(weth)));
    gasGuard = new GasGuardStrategy();
    stopLoss = new StopLossStrategy();
    oracle = new MockOracle();
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
    vm.fee(10 gwei);
    oracle.setDecimals(FEED_DECIMALS);
    // Fresh, passing answer (price below threshold for floor predicate).
    oracle.setRound(7, 900e8, block.timestamp, 7);

    bytes memory predicate = _composedPredicate();
    bytes memory extension = LopOrderTestLib.buildPredicateExtension(predicate);
    uint256 salt = LopOrderTestLib.saltFromExtension(extension);
    preparedOrder = LopOrderTestLib.buildOrder(
      maker, maker, address(makerToken), address(takerToken), 100 ether, 200 ether, salt
    );
    (preparedR, preparedVs) = _sign(preparedOrder);
    (preparedTraits, preparedArgs) = LopOrderTestLib.buildTakerFillArgs(extension, preparedOrder.takingAmount);
  }

  /// @notice The snapshot that partners want: gas for one full fill of a stop-loss + gas-guard order.
  function testBenchmark_fillOrderArgs_stopLoss_with_gasGuard() public {
    vm.prank(taker);
    lop.fillOrderArgs(
      preparedOrder,
      preparedR,
      preparedVs,
      preparedOrder.makingAmount,
      preparedTraits,
      preparedArgs
    );
  }

  function _composedPredicate() internal view returns (bytes memory) {
    bytes memory stopLossInner = abi.encodeCall(
      StopLossStrategy.checkPrice,
      (address(oracle), STOP_THRESHOLD, false, STALE_AFTER, FEED_DECIMALS)
    );
    bytes memory stopLossCall =
      abi.encodeCall(PredicateHelper.arbitraryStaticCall, (address(stopLoss), stopLossInner));

    bytes memory gasInner = abi.encodeCall(GasGuardStrategy.isAllowedUint, (MAX_BASE_FEE));
    bytes memory gasCall =
      abi.encodeCall(PredicateHelper.arbitraryStaticCall, (address(gasGuard), gasInner));

    uint256 offsets = (uint256(uint32(stopLossCall.length)))
      | (uint256(uint32(stopLossCall.length + gasCall.length)) << 32);
    bytes memory packed = abi.encodePacked(stopLossCall, gasCall);
    return abi.encodeCall(PredicateHelper.and, (offsets, packed));
  }

  function orderHash(IOrderMixin.Order calldata order) public view returns (bytes32) {
    return order.hash(lop.DOMAIN_SEPARATOR());
  }

  function _sign(IOrderMixin.Order memory order_) internal view returns (bytes32 r, bytes32 vs) {
    bytes32 digest = this.orderHash(order_);
    (uint8 v, bytes32 sigR, bytes32 s) = vm.sign(MAKER_PK, digest);
    return (sigR, LopOrderTestLib.toVs(v, s));
  }
}
