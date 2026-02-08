import { ethers } from "hardhat";

/**
 * Deploy SimpleSmartAccountV2 with permissions
 *
 * Usage:
 *   npx hardhat run scripts/deploy-v2.ts --network confluxTestnet
 *   npx hardhat run scripts/deploy-v2.ts --network confluxMainnet
 */

// Token addresses
const TESTNET_TOKEN = "0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa";
const USDT_MAINNET = "0xfe97E85d13ABD9c1c33384E796F10B73905637cE";
const USDC_MAINNET = "0x6963EfED0aB40F6C3d7BdA44A05dcf1437C44372";

// Common method selectors
const TRANSFER_SELECTOR = ethers.id("transfer(address,uint256)").slice(0, 10);
const APPROVE_SELECTOR = ethers.id("approve(address,uint256)").slice(0, 10);
const TRANSFER_FROM_SELECTOR = ethers.id("transferFrom(address,address,uint256)").slice(0, 10);

async function main() {
  console.log("\n========================================");
  console.log("Deploying SimpleSmartAccountV2...");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", chainId);

  // Deploy contract
  const SimpleSmartAccountV2 = await ethers.getContractFactory("SimpleSmartAccountV2");
  const account = await SimpleSmartAccountV2.deploy();
  await account.waitForDeployment();

  const address = await account.getAddress();
  console.log("Contract deployed at:", address);

  // Setup global whitelist based on network
  console.log("\n--- Setting up global whitelist ---");

  if (chainId === 71n) {
    // Testnet
    console.log("Network: Conflux eSpace Testnet");
    console.log("Adding testnet token to whitelist:", TESTNET_TOKEN);
    const tx = await account.setGlobalContractWhitelist(TESTNET_TOKEN, true);
    await tx.wait();
  } else if (chainId === 1030n) {
    // Mainnet
    console.log("Network: Conflux eSpace Mainnet");
    console.log("Adding USDT and USDC to whitelist");
    const tx = await account.setGlobalContractWhitelistBatch(
      [USDT_MAINNET, USDC_MAINNET],
      true
    );
    await tx.wait();
  }

  // Setup global method whitelist
  console.log("\n--- Setting up global method whitelist ---");
  console.log("Adding ERC20 methods: transfer, approve, transferFrom");

  const methodsTx = await account.setGlobalMethodWhitelistBatch(
    [TRANSFER_SELECTOR, APPROVE_SELECTOR, TRANSFER_FROM_SELECTOR],
    true
  );
  await methodsTx.wait();

  // Print summary
  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Contract Address:", address);
  console.log("Owner:", await account.owner());
  console.log("Chain ID:", chainId);
  console.log("\nGlobal Whitelisted Contracts:");
  if (chainId === 71n) {
    console.log("  -", TESTNET_TOKEN, "(Testnet Token)");
  } else if (chainId === 1030n) {
    console.log("  -", USDT_MAINNET, "(USDT)");
    console.log("  -", USDC_MAINNET, "(USDC)");
  }
  console.log("\nGlobal Whitelisted Methods:");
  console.log("  - 0xa9059cbb (transfer)");
  console.log("  - 0x095ea7b3 (approve)");
  console.log("  - 0x23b872dd (transferFrom)");
  console.log("\n========================================");
  console.log("NEXT STEPS:");
  console.log("========================================");
  console.log("1. Update .env with:");
  console.log("   SMART_ACCOUNT_ADDRESS=" + address);
  console.log("\n2. Verify contract:");
  if (chainId === 71n) {
    console.log("   npx hardhat verify --network confluxTestnet", address);
    console.log("   https://evmtestnet.confluxscan.io/address/" + address);
  } else if (chainId === 1030n) {
    console.log("   npx hardhat verify --network confluxMainnet", address);
    console.log("   https://evm.confluxscan.io/address/" + address);
  }
  console.log("\n3. Test permissions:");
  console.log("   cd ../relayer && npm run dev");
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
