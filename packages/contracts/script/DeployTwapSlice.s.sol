// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {TwapSliceGetter} from "../src/templates/TwapSliceGetter.sol";

contract DeployTwapSlice is Script {
  function run() external {
    uint256 key = vm.envUint("DEPLOYER_KEY");
    uint256 total = vm.envOr("TWAP_TOTAL", uint256(1000 ether));
    uint256 slice = vm.envOr("TWAP_SLICE", uint256(100 ether));
    uint256 interval = vm.envOr("TWAP_INTERVAL", uint256(3600));
    vm.startBroadcast(key);
    TwapSliceGetter getter = new TwapSliceGetter(total, slice, interval, block.timestamp);
    console2.log("TwapSliceGetter", address(getter));
    vm.stopBroadcast();
  }
}
