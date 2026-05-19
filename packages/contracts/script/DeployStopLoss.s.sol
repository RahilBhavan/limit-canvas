// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {StopLossStrategy} from "../src/templates/StopLossStrategy.sol";

contract DeployStopLoss is Script {
  function run() external {
    uint256 key = vm.envUint("DEPLOYER_KEY");
    vm.startBroadcast(key);
    StopLossStrategy strategy = new StopLossStrategy();
    console2.log("StopLossStrategy", address(strategy));
    vm.stopBroadcast();
  }
}
