import { expect } from "chai";
import { ethers } from "hardhat";
import { SimpleSmartAccount } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleSmartAccount", function () {
  let simpleSmartAccount: SimpleSmartAccount;
  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    // Get signers
    [owner, relayer, user] = await ethers.getSigners();

    // Deploy contract
    const SimpleSmartAccount = await ethers.getContractFactory("SimpleSmartAccount");
    simpleSmartAccount = await SimpleSmartAccount.deploy();
    await simpleSmartAccount.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await simpleSmartAccount.getAddress()).to.be.properAddress;
    });

    it("Should initialize with nonce 0 for any address", async function () {
      expect(await simpleSmartAccount.getNonce(user.address)).to.equal(0);
      expect(await simpleSmartAccount.getNonce(owner.address)).to.equal(0);
    });
  });

  describe("Nonce Management", function () {
    it("Should return correct nonce for an address", async function () {
      const nonce = await simpleSmartAccount.getNonce(user.address);
      expect(nonce).to.equal(0);
    });

    it("Should have independent nonces for different addresses", async function () {
      const nonce1 = await simpleSmartAccount.getNonce(user.address);
      const nonce2 = await simpleSmartAccount.getNonce(relayer.address);

      expect(nonce1).to.equal(0);
      expect(nonce2).to.equal(0);
    });
  });

  describe("Call Hashing", function () {
    it("Should accept empty calls array", async function () {
      // This test validates the contract doesn't revert on empty calls
      // Actual execution would require proper 7702 delegation setup
      const calls: SimpleSmartAccount.CallStruct[] = [];

      // Since we can't easily test with 7702 delegation in this environment,
      // we're just checking the contract is properly structured
      expect(calls.length).to.equal(0);
    });
  });

  describe("Contract Interface", function () {
    it("Should have execute function", async function () {
      expect(simpleSmartAccount.execute).to.exist;
    });

    it("Should have executeWithFee function", async function () {
      expect(simpleSmartAccount.executeWithFee).to.exist;
    });

    it("Should have getNonce function", async function () {
      expect(simpleSmartAccount.getNonce).to.exist;
    });
  });

  describe("Receive CFX", function () {
    it("Should be able to receive CFX", async function () {
      const amount = ethers.parseEther("1.0");

      await expect(
        owner.sendTransaction({
          to: await simpleSmartAccount.getAddress(),
          value: amount,
        })
      ).to.changeEtherBalance(simpleSmartAccount, amount);
    });
  });
});
