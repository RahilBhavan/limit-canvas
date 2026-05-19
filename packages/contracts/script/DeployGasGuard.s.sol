// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {GasGuardStrategy} from "../src/templates/GasGuardStrategy.sol";

contract DeployGasGuard is Script {
  function run() external {
    uint256 key = vm.envUint("DEPLOYER_KEY");
    vm.startBroadcast(key);
    GasGuardStrategy strategy = new GasGuardStrategy();
    console2.log("GasGuardStrategy", address(strategy));
    vm.stopBroadcast();
  }
}
