import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SimpleSmartAccount...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CFX");

  // Deploy the contract
  const SimpleSmartAccount = await ethers.getContractFactory("SimpleSmartAccount");
  const simpleSmartAccount = await SimpleSmartAccount.deploy();

  await simpleSmartAccount.waitForDeployment();

  const address = await simpleSmartAccount.getAddress();
  console.log("SimpleSmartAccount deployed to:", address);

  // Display network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // Save deployment info
  console.log("\n✅ Deployment complete!");
  console.log("==================================================");
  console.log("Contract address:", address);
  console.log("Add this to your .env file:");
  console.log(`SMART_ACCOUNT_ADDRESS=${address}`);
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
