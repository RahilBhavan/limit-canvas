// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IOrderMixin} from "limit-order-protocol/interfaces/IOrderMixin.sol";
import {MakerTraits} from "limit-order-protocol/libraries/MakerTraitsLib.sol";
import {TakerTraits} from "limit-order-protocol/libraries/TakerTraitsLib.sol";
import {Address} from "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";

/// @notice Builds LOP v4 orders and taker args for integration tests.
library LopOrderTestLib {
  uint256 internal constant HAS_EXTENSION_FLAG = 1 << 249;
  uint256 internal constant ALLOW_MULTIPLE_FILLS_FLAG = 1 << 254;
  uint256 internal constant MAKER_AMOUNT_FLAG = 1 << 255;
  uint256 internal constant SKIP_ORDER_PERMIT_FLAG = 1 << 253;
  uint256 internal constant ARGS_EXTENSION_LENGTH_OFFSET = 224;

  /// @dev Extension with only the predicate segment populated (field index 4).
  function buildPredicateExtension(bytes memory predicate) internal pure returns (bytes memory extension) {
    uint256 offsets = uint256(uint32(predicate.length)) << 128;
    extension = abi.encodePacked(bytes32(offsets), predicate);
  }

  /// @dev Matches LOP test helpers: low 160 bits of `keccak256(extension)` when using extensions.
  function saltFromExtension(bytes memory extension) internal pure returns (uint256 salt) {
    salt = uint256(keccak256(extension)) & ((1 << 160) - 1);
  }

  function defaultMakerTraits() internal pure returns (MakerTraits traits) {
    traits = MakerTraits.wrap(HAS_EXTENSION_FLAG | ALLOW_MULTIPLE_FILLS_FLAG);
  }

  function defaultMakerTraitsNoExtension() internal pure returns (MakerTraits traits) {
    traits = MakerTraits.wrap(ALLOW_MULTIPLE_FILLS_FLAG);
  }

  function buildOrder(
    address maker,
    address receiver,
    address makerAsset,
    address takerAsset,
    uint256 makingAmount,
    uint256 takingAmount,
    uint256 salt
  ) internal pure returns (IOrderMixin.Order memory order) {
    order = IOrderMixin.Order({
      salt: salt,
      maker: Address.wrap(uint256(uint160(maker))),
      receiver: Address.wrap(uint256(uint160(receiver))),
      makerAsset: Address.wrap(uint256(uint160(makerAsset))),
      takerAsset: Address.wrap(uint256(uint160(takerAsset))),
      makingAmount: makingAmount,
      takingAmount: takingAmount,
      makerTraits: defaultMakerTraits()
    });
  }

  function buildTakerFillArgs(
    bytes memory extension,
    uint256 threshold
  ) internal pure returns (TakerTraits traits, bytes memory args) {
    uint256 extLen = extension.length;
    traits = TakerTraits.wrap(
      threshold | MAKER_AMOUNT_FLAG | SKIP_ORDER_PERMIT_FLAG | (extLen << ARGS_EXTENSION_LENGTH_OFFSET)
    );
    args = extension;
  }

  function toVs(uint8 v, bytes32 s) internal pure returns (bytes32 vs) {
    return bytes32(uint256(s) | (uint256(v - 27) << 255));
  }
}
