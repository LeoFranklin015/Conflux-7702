import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SimpleSmartAccountV3Simple...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CFX");

  const Contract = await ethers.getContractFactory("SimpleSmartAccountV3Simple");
  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SimpleSmartAccountV3Simple deployed to:", address);

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  console.log("\n✅ Deployment complete!");
  console.log("==================================================");
  console.log("Contract address:", address);
  console.log("Update SMART_ACCOUNT_ADDRESS in:");
  console.log("  - contracts/.env");
  console.log("  - relayer/.env");
  console.log("  - web/.env.local");
  console.log("  - web/src/lib/viem-client.ts");
  console.log(`\nSMART_ACCOUNT_ADDRESS=${address}`);
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
