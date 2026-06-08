// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { GoodHabitsTreasury } from "../src/GoodHabitsTreasury.sol";

contract GrantRoles is Script {
    function run() external {
        address treasuryAddr = vm.envAddress("TREASURY_CONTRACT");
        address backend = vm.envAddress("BACKEND_ADDRESS");
        GoodHabitsTreasury treasury = GoodHabitsTreasury(treasuryAddr);

        vm.startBroadcast();
        treasury.grantRole(treasury.STRATEGY_ROLE(), backend);
        treasury.grantRole(treasury.SYNC_ROLE(), backend);
        vm.stopBroadcast();
    }
}
