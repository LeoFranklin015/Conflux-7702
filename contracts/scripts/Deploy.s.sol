// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {Lock} from "../contracts/Lock.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        // Retrieve private key from environment and begin broadcasting
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get current timestamp and add 1 hour (3600 seconds) for unlock time
        uint lockedAmount = 0.001 ether;
        uint unlockTime = block.timestamp + 3600;

        // Deploy Lock contract
        Lock lock = new Lock{value: lockedAmount}(unlockTime);
        
        vm.stopBroadcast();

        // Log deployment info
        console2.log("Lock deployed to:", address(lock));
        console2.log("Unlock time:", unlockTime);
        console2.log("Locked amount:", lockedAmount);

        // Add this after deployment
        console2.log("Constructor Args:");
        console2.log(unlockTime);
    }
} 