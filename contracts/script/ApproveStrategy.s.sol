// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { GoodHabitsTreasury } from "../src/GoodHabitsTreasury.sol";

contract ApproveStrategy is Script {
    function run() external {
        address treasuryAddr = vm.envAddress("TREASURY_CONTRACT");
        address backend = vm.envAddress("BACKEND_ADDRESS");
        GoodHabitsTreasury treasury = GoodHabitsTreasury(treasuryAddr);

        vm.startBroadcast();
        treasury.approveStrategy(backend);
        vm.stopBroadcast();
    }
}
