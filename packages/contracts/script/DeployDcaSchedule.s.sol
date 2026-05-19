// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {DcaSeriesRegistry} from "../src/templates/DcaSeriesRegistry.sol";

contract DeployDcaSchedule is Script {
  function run() external {
    uint256 key = vm.envUint("DEPLOYER_KEY");
    vm.startBroadcast(key);
    DcaSeriesRegistry registry = new DcaSeriesRegistry();
    console2.log("DcaSeriesRegistry", address(registry));
    vm.stopBroadcast();
  }
}
