// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console2} from "forge-std/Test.sol";
import {Lock} from "../contracts/Lock.sol";

contract LockTest is Test {
    Lock public lock;
    uint public unlockTime;
    uint public lockedAmount;
    address public owner;
    address public otherAccount;

    function setUp() public {
        // Setup similar to the Hardhat fixture
        unlockTime = block.timestamp + 365 days;
        lockedAmount = 1 gwei;
        owner = address(this);
        otherAccount = address(0xdead);
        
        // Deploy the contract
        lock = new Lock{value: lockedAmount}(unlockTime);
    }

    function testDeployment() public {
        // Test correct unlock time
        assertEq(lock.unlockTime(), unlockTime, "Incorrect unlock time");
        
        // Test correct owner
        assertEq(lock.owner(), owner, "Incorrect owner");
        
        // Test correct locked amount
        assertEq(address(lock).balance, lockedAmount, "Incorrect locked amount");
    }

    function testFailDeployWithPastTime() public {
        // This should fail when deploying with past timestamp
        new Lock{value: 1}(block.timestamp);
    }

    function testWithdrawalTooSoon() public {
        // Should revert if called too soon
        vm.expectRevert("You can't withdraw yet");
        lock.withdraw();
    }

    function testWithdrawalWrongAccount() public {
        // Should revert if called from wrong account
        vm.warp(unlockTime);
        vm.prank(otherAccount);
        vm.expectRevert("You aren't the owner");
        lock.withdraw();
    }

    function testSuccessfulWithdrawal() public {
        // Should succeed when called by owner after unlock time
        vm.warp(unlockTime);
        uint256 preBalance = address(this).balance;
        
        lock.withdraw();
        
        assertEq(
            address(this).balance,
            preBalance + lockedAmount,
            "Withdrawal amount incorrect"
        );
    }

    function testWithdrawalEmitsEvent() public {
        // Test event emission
        vm.warp(unlockTime);
        vm.expectEmit(true, true, true, true);
        emit Lock.Withdrawal(lockedAmount, unlockTime);
        lock.withdraw();
    }

    // Required to receive ETH
    receive() external payable {}
} 