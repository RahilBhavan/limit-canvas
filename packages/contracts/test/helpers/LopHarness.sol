// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockOracle} from "../../src/mocks/MockOracle.sol";

/// @notice Shared fixtures for template tests; optional LOP integration when submodule present
abstract contract LopHarness is Test {
  MockERC20 internal makerToken;
  MockERC20 internal takerToken;
  MockOracle internal oracle;

  function setUp() public virtual {
    makerToken = new MockERC20("Maker", "MKR");
    takerToken = new MockERC20("Taker", "TKR");
    oracle = new MockOracle();
    makerToken.mint(address(this), 1_000_000 ether);
    takerToken.mint(address(this), 1_000_000 ether);
  }

  function lopAvailable() internal view returns (bool) {
    return _getCodeSize(address(0)) > 0; // overridden in integration tests
  }

  function _getCodeSize(address target) private view returns (uint256 size) {
    assembly {
      size := extcodesize(target)
    }
  }
}
