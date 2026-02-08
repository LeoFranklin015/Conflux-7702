// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SimpleSmartAccountV3Simple} from "../contracts/SimpleSmartAccountV3Simple.sol";

contract DeployV3Simple is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console2.log("\n========================================");
        console2.log("Deploying SimpleSmartAccountV3Simple...");
        console2.log("(Ultra-Simplified Subscription Model)");
        console2.log("========================================\n");

        SimpleSmartAccountV3Simple account = new SimpleSmartAccountV3Simple();

        console2.log("Contract deployed at:", address(account));
        console2.log("Chain ID:", block.chainid);

        vm.stopBroadcast();

        console2.log("\n========================================");
        console2.log("ULTRA-SIMPLE SUBSCRIPTION MODEL");
        console2.log("========================================");
        console2.log("1. User: grantPermission(netflix, $10/month, $5/tx)");
        console2.log("2. Netflix signs intent + relayer submits");
        console2.log("3. Contract checks limits & executes");
        console2.log("\nNo contract/method validation - just spending limits!");
        console2.log("========================================\n");
    }
}
