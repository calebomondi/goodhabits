// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { GoodHabitsTreasury } from "../src/GoodHabitsTreasury.sol";

contract DeployTreasury is Script {
    function run() external returns (GoodHabitsTreasury treasury) {
        address gDollar = vm.envAddress("GDOLLAR_ADDRESS");
        uint256 feeBps = vm.envUint("FEE_BPS");
        uint256 requestTimeout = vm.envUint("REQUEST_TIMEOUT");

        vm.startBroadcast();

        treasury = new GoodHabitsTreasury(gDollar, feeBps, requestTimeout);

        vm.stopBroadcast();
    }
}
